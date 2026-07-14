#!/usr/bin/env node

/**
 * Dream Pass Cleanup - Archive exact-duplicate Wiki notes
 *
 * Reads a dream-pass report JSON, processes only "exact_title" groups,
 * keeps the most recently created note per group, and archives the rest
 * via POST /api/note/delete (which moves notes to archive + git commit).
 *
 * Usage:
 *   node scripts/dream-pass-cleanup.mjs --report=.agent-runs/dream-pass-20260714/dream-pass-report.json [--intake] [--task-id=<id>]
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const PERSONAL_OS_BASE_URL =
  process.env.PERSONAL_OS_BASE_URL || "http://192.168.6.37:3100";
const PERSONAL_WIKI_BASE_URL =
  process.env.PERSONAL_WIKI_BASE_URL ||
  process.env.WIKI_BASE_URL ||
  "http://192.168.6.37:3422";

function getWikiWriteToken() {
  return (
    process.env.PERSONAL_WIKI_API_TOKEN ||
    process.env.WIKI_API_TOKEN ||
    ""
  );
}

function getOsWriteToken() {
  return process.env.PERSONAL_OS_API_TOKEN || "";
}

function parseArgs(argv) {
  const args = {
    report: "",
    intake: false,
    taskId: `dream-pass-cleanup-${stampDate()}`,
    out: path.join(".agent-runs", `dream-pass-cleanup-${stampDate()}`),
  };
  for (const arg of argv) {
    if (arg.startsWith("--report=")) args.report = arg.split("=", 2)[1];
    else if (arg === "--intake") args.intake = true;
    else if (arg.startsWith("--task-id=")) args.taskId = arg.split("=", 2)[1];
    else if (arg.startsWith("--out=")) args.out = arg.split("=", 2)[1];
  }
  return args;
}

function stampDate() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function isoNow() {
  return new Date().toISOString();
}

async function archiveNote(notePath, token) {
  const url = `${PERSONAL_WIKI_BASE_URL}/api/note/delete`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ path: notePath }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Archive ${notePath} failed: ${resp.status} ${text.slice(0, 200)}`);
  }
  return resp.json();
}

async function writeIntake(payload, token) {
  const url = `${PERSONAL_OS_BASE_URL}/api/intake`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Intake failed: ${resp.status} ${text.slice(0, 200)}`);
  }
  return resp.json();
}

function parseCreatedDate(createdStr) {
  // "2026-07-14 03:02 CST" -> Date
  const m = createdStr?.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  if (!m) return new Date(0);
  return new Date(`${m[1]}T${m[2]}:00+08:00`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.report) {
    console.error("Usage: node scripts/dream-pass-cleanup.mjs --report=<path> [--intake] [--task-id=<id>]");
    process.exit(1);
  }

  console.log(`[cleanup] starting at ${isoNow()}`);
  console.log(`[cleanup] reading report: ${args.report}`);

  const reportRaw = await readFile(args.report, "utf-8");
  const report = JSON.parse(reportRaw);

  const groups = report.wiki?.groups || [];
  const exactGroups = groups.filter((g) => g.type === "exact_title");

  console.log(`[cleanup] total groups: ${groups.length}`);
  console.log(`[cleanup] exact_title groups: ${exactGroups.length}`);

  const wikiToken = getWikiWriteToken();
  const osToken = getOsWriteToken();

  const results = {
    startedAt: isoNow(),
    taskId: args.taskId,
    exactGroupsProcessed: 0,
    notesArchived: 0,
    notesKept: 0,
    errors: [],
    details: [],
  };

  for (const group of exactGroups) {
    // Sort by created date descending - keep newest
    const sorted = [...group.notes].sort(
      (a, b) => parseCreatedDate(b.created) - parseCreatedDate(a.created)
    );

    const keep = sorted[0];
    const toArchive = sorted.slice(1);

    results.exactGroupsProcessed++;
    results.notesKept++;
    results.details.push({
      title: group.notes[0]?.title || "unknown",
      kept: keep.path,
      archived: toArchive.map((n) => n.path),
    });

    for (const note of toArchive) {
      try {
        const result = await archiveNote(note.path, wikiToken);
        results.notesArchived++;
        console.log(`[cleanup] archived: ${note.path} -> ${result.archive_path || "ok"}`);
      } catch (err) {
        results.errors.push({ path: note.path, error: err.message });
        console.error(`[cleanup] ERROR archiving ${note.path}: ${err.message}`);
      }
    }
  }

  results.completedAt = isoNow();
  console.log(`[cleanup] done. archived ${results.notesArchived} notes, kept ${results.notesKept}, errors: ${results.errors.length}`);

  // Write report
  await mkdir(args.out, { recursive: true });
  await writeFile(
    path.join(args.out, "cleanup-report.json"),
    JSON.stringify(results, null, 2)
  );

  // Write worker-result.json
  const workerResult = {
    taskId: args.taskId,
    timestamp: isoNow(),
    summary: `Archived ${results.notesArchived} exact-duplicate Wiki notes across ${results.exactGroupsProcessed} groups. Kept ${results.notesKept} original notes. Errors: ${results.errors.length}.`,
    archived: results.notesArchived,
    kept: results.notesKept,
    errors: results.errors,
    details: results.details,
  };
  await writeFile(
    path.join(args.out, "worker-result.json"),
    JSON.stringify(workerResult, null, 2)
  );

  // Write gate.json
  const gate = {
    taskId: args.taskId,
    timestamp: isoNow(),
    status: results.errors.length === 0 ? "pass" : "partial",
    checks: {
      archiveApiWorking: results.notesArchived > 0 || exactGroups.length === 0,
      noErrors: results.errors.length === 0,
    },
    notesArchived: results.notesArchived,
    errors: results.errors.length,
  };
  await writeFile(
    path.join(args.out, "gate.json"),
    JSON.stringify(gate, null, 2)
  );

  // Write intake
  if (args.intake) {
    try {
      const intakeResult = await writeIntake({
        source: {
          sourceType: "agent-output",
          sourcePlatform: "cron/dream-pass-cleanup",
          rawText: `Dream Pass cleanup: archived ${results.notesArchived} exact-duplicate Wiki notes across ${results.exactGroupsProcessed} groups. Kept ${results.notesKept} original notes. Errors: ${results.errors.length}. Report: ${args.out}/cleanup-report.json`,
          createdBy: "hermes",
        },
        agent: {
          model: "hermes-dream-pass-cleanup-script",
          classification: {
            kind: "dream-pass-cleanup",
            taskId: args.taskId,
            archived: results.notesArchived,
            kept: results.notesKept,
            errors: results.errors.length,
          },
          reasoningSummary: "Read dream-pass report, filtered exact_title duplicate groups, kept newest note per group, archived rest via Wiki /api/note/delete.",
          outputSummary: `Archived ${results.notesArchived} duplicate Wiki notes. ${results.errors.length} errors.`,
        },
        wikiWriteStatus: { status: "skipped", requested: 0, succeeded: 0, failed: 0, errors: [] },
      }, osToken);
      console.log(`[cleanup] intake ok: agentRunId=${intakeResult.agentRunId || intakeResult.id || "ok"}`);
      await writeFile(
        path.join(args.out, "intake-result.json"),
        JSON.stringify(intakeResult, null, 2)
      );
    } catch (err) {
      console.error(`[cleanup] intake failed: ${err.message}`);
    }
  }

  console.log(`[cleanup] reports written to ${args.out}`);
  console.log(JSON.stringify({
    archived: results.notesArchived,
    kept: results.notesKept,
    groupsProcessed: results.exactGroupsProcessed,
    errors: results.errors.length,
    gate: gate.status,
  }, null, 2));
}

main().catch((err) => {
  console.error(`[cleanup] FATAL: ${err.message}`);
  process.exit(1);
});
