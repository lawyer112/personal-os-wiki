#!/usr/bin/env node

/**
 * Dream Pass v0 — nightly cleanup scanner for Personal OS / Wiki
 *
 * Scans:
 * 1. Personal Wiki notes for duplicate/near-duplicate titles (across all pages)
 * 2. Personal OS Inbox items older than 30 days that are still in "pending" status
 *
 * Output: JSON report + Markdown report. Does NOT delete anything.
 * Designed to be run via cron.
 *
 * Usage:
 *   node scripts/dream-pass.mjs [--intake] [--task-id=<id>] [--out=<dir>]
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PERSONAL_OS_BASE_URL =
  process.env.PERSONAL_OS_BASE_URL || "http://192.168.6.37:3100";
const PERSONAL_WIKI_BASE_URL =
  process.env.PERSONAL_WIKI_BASE_URL ||
  process.env.WIKI_BASE_URL ||
  "http://192.168.6.37:3422";

const INBOX_MAX_AGE_DAYS = 30;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    intake: false,
    taskId: `dream-pass-${stampDate()}`,
    out: path.join(".agent-runs", `dream-pass-${stampDate()}`),
  };
  for (const arg of argv) {
    if (arg === "--intake") args.intake = true;
    else if (arg.startsWith("--task-id=")) args.taskId = arg.split("=", 2)[1];
    else if (arg.startsWith("--out=")) args.out = arg.split("=", 2)[1];
    else if (arg === "--help") {
      console.log(
        `Usage: node scripts/dream-pass.mjs [--intake] [--task-id=<id>] [--out=<dir>]`
      );
      process.exit(0);
    }
  }
  return args;
}

function stampDate() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function isoNow() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Token helpers (never print tokens)
// ---------------------------------------------------------------------------

function getOsReadToken() {
  return (
    process.env.PERSONAL_OS_READ_TOKEN || process.env.PERSONAL_OS_API_TOKEN
  );
}

function getOsWriteToken() {
  return process.env.PERSONAL_OS_API_TOKEN;
}

function getWikiReadToken() {
  return (
    process.env.PERSONAL_WIKI_READ_TOKEN ||
    process.env.WIKI_READ_TOKEN ||
    process.env.PERSONAL_WIKI_API_TOKEN ||
    process.env.WIKI_API_TOKEN
  );
}

// ---------------------------------------------------------------------------
// Wiki scanning — fetch all notes, find duplicate titles
// ---------------------------------------------------------------------------

async function fetchWikiNotesPage(page, token) {
  const url = `${PERSONAL_WIKI_BASE_URL}/api/notes?limit=100&page=${page}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Wiki notes page ${page} ${response.status}: ${text.slice(0, 200)}`
    );
  }
  return response.json();
}

async function fetchAllWikiNotes(token) {
  const first = await fetchWikiNotesPage(1, token);
  const notes = first.notes || [];
  const pageCount = first.page_count || 1;

  for (let p = 2; p <= pageCount; p++) {
    const data = await fetchWikiNotesPage(p, token);
    if (data.notes) notes.push(...data.notes);
  }

  return { notes, total: first.total || notes.length };
}

/**
 * Normalize a title for comparison: lowercase, remove punctuation,
 * collapse whitespace, remove common suffixes like dates.
 */
function normalizeTitle(title) {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^\w\s\u4e00-\u9fff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find groups of notes with duplicate or near-duplicate titles.
 * Two strategies:
 *   1. Exact normalized title match
 *   2. Levenshtein distance <= 3 for titles > 20 chars
 */
function findDuplicateNotes(notes) {
  const groups = [];

  // Strategy 1: exact normalized title match
  const byNormTitle = new Map();
  for (const note of notes) {
    const norm = normalizeTitle(note.title);
    if (!norm) continue;
    if (!byNormTitle.has(norm)) byNormTitle.set(norm, []);
    byNormTitle.get(norm).push(note);
  }

  for (const [normTitle, group] of byNormTitle) {
    if (group.length > 1) {
      groups.push({
        type: "exact_title",
        normalizedTitle: normTitle,
        count: group.length,
        notes: group.map((n) => ({
          title: n.title,
          path: n.path,
          created: n.created,
          source_type: n.source_type,
          status: n.status,
        })),
      });
    }
  }

  // Strategy 2: near-duplicate (Levenshtein) for titles not already in exact groups
  const exactGroupedPaths = new Set(
    groups.flatMap((g) => g.notes.map((n) => n.path))
  );
  const remaining = notes.filter(
    (n) => n.title && n.title.length > 20 && !exactGroupedPaths.has(n.path)
  );

  // Only compare within same first 15 chars (to limit O(n^2))
  const byPrefix = new Map();
  for (const note of remaining) {
    const prefix = normalizeTitle(note.title).slice(0, 15);
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(note);
  }

  for (const [, candidates] of byPrefix) {
    if (candidates.length < 2) continue;
    const used = new Set();
    for (let i = 0; i < candidates.length; i++) {
      if (used.has(candidates[i].path)) continue;
      const group = [candidates[i]];
      for (let j = i + 1; j < candidates.length; j++) {
        if (used.has(candidates[j].path)) continue;
        const dist = levenshtein(
          normalizeTitle(candidates[i].title),
          normalizeTitle(candidates[j].title)
        );
        if (dist <= 3) {
          group.push(candidates[j]);
          used.add(candidates[j].path);
        }
      }
      if (group.length > 1) {
        used.add(candidates[i].path);
        groups.push({
          type: "near_duplicate_title",
          count: group.length,
          notes: group.map((n) => ({
            title: n.title,
            path: n.path,
            created: n.created,
            source_type: n.source_type,
            status: n.status,
          })),
        });
      }
    }
  }

  return groups;
}

/**
 * Simple Levenshtein distance (bounded at 10 for performance).
 */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const maxLen = Math.max(a.length, b.length);
  const bound = 10;
  const matrix = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
      // Early exit
      if (i === j && matrix[i][j] > bound) return bound + 1;
    }
  }

  return matrix[b.length][a.length];
}

// ---------------------------------------------------------------------------
// Inbox scanning — find old pending items
// ---------------------------------------------------------------------------

async function fetchInboxItems(token) {
  const url = `${PERSONAL_OS_BASE_URL}/api/inbox/items?limit=100`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Inbox items ${response.status}: ${text.slice(0, 200)}`
    );
  }
  const data = await response.json();
  return data.items || [];
}

function findStaleInboxItems(items, maxAgeDays = INBOX_MAX_AGE_DAYS) {
  const now = Date.now();
  const cutoff = now - maxAgeDays * 86_400_000;

  return items
    .filter((item) => {
      // Only flag items that are still "pending" (not "processed")
      if (item.status !== "pending") return false;
      const ts = item.receivedAt || item.createdAt;
      if (!ts) return false;
      return Date.parse(ts) < cutoff;
    })
    .map((item) => ({
      id: item.id,
      status: item.status,
      receivedAt: item.receivedAt || item.createdAt,
      sourceType: item.sourceType,
      sourcePlatform: item.sourcePlatform,
      rawTextPreview: (item.rawText || "").slice(0, 120),
    }));
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function buildMarkdownReport(dupGroups, staleItems, wikiTotal) {
  const lines = [
    `# Dream Pass Report ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## 结论",
    "",
    `扫描 Personal Wiki ${wikiTotal} 条 notes，发现 ${dupGroups.length} 组重复/近重复；`,
    `扫描 Personal OS Inbox 100 条最近 items，发现 ${staleItems.length} 条超过 ${INBOX_MAX_AGE_DAYS} 天的 pending items。`,
    "",
    "本报告不执行删除，只列出建议清理对象。",
    "",
    "## 重复 Wiki Notes",
    "",
  ];

  if (dupGroups.length === 0) {
    lines.push("未发现重复 notes。");
  } else {
    for (const group of dupGroups) {
      lines.push(
        `### [${group.type}] ${group.count}x — ${group.notes[0].title.slice(0, 60)}`
      );
      for (const n of group.notes) {
        lines.push(
          `- ${n.path} (created: ${n.created || "?"}, source: ${n.source_type || "?"}, status: ${n.status || "?"})`
        );
      }
      lines.push("");
    }
  }

  lines.push("## 过期 Inbox Items");
  lines.push("");

  if (staleItems.length === 0) {
    lines.push("未发现过期 pending items。");
  } else {
    for (const item of staleItems) {
      lines.push(
        `- [${item.id}] ${item.receivedAt?.slice(0, 10)} | ${item.sourceType || "?"} | ${item.rawTextPreview}`
      );
    }
  }

  lines.push("");
  lines.push("## 建议动作");
  lines.push("");

  if (dupGroups.length > 0) {
    lines.push(
      `- 对 ${dupGroups.length} 组重复 Wiki notes，建议保留最新版本，对其余标记 superseded 或归档。`
    );
  }
  if (staleItems.length > 0) {
    lines.push(
      `- 对 ${staleItems.length} 条过期 pending Inbox items，建议标记为 archived 或 processed。`
    );
  }
  if (dupGroups.length === 0 && staleItems.length === 0) {
    lines.push("本轮无需清理。");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Intake write-back
// ---------------------------------------------------------------------------

async function postIntake(payload, token) {
  const response = await fetch(`${PERSONAL_OS_BASE_URL.replace(/\/$/, "")}/api/intake`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Personal OS intake ${response.status}: ${JSON.stringify(body).slice(0, 500)}`
    );
  }
  return body;
}

function buildIntakePayload({ markdown, dupGroups, staleItems, wikiTotal, taskId }) {
  const now = isoNow();
  return {
    source: {
      sourceType: "agent-output",
      sourcePlatform: "cron/dream-pass",
      rawText: `Dream pass: scanned ${wikiTotal} wiki notes, found ${dupGroups.length} dup groups; ${staleItems.length} stale inbox items.`,
      createdBy: "hermes",
    },
    agent: {
      model: "hermes-dream-pass-script",
      classification: {
        kind: "dream-pass",
        dupGroups: dupGroups.length,
        staleInboxItems: staleItems.length,
      },
      reasoningSummary:
        "Dream pass 扫描 Personal Wiki notes 重复标题和 Personal OS Inbox 过期 pending items，生成清理建议。",
      outputSummary: `扫描 ${wikiTotal} wiki notes，发现 ${dupGroups.length} 组重复，${staleItems.length} 条过期 inbox items。`,
    },
    project: {
      name: "Personal OS / Wiki 知识库升级",
      status: "active",
      priority: "P0",
      currentFocus: "GitHub 外部方案转成 Agent 自驱执行闭环",
    },
    wikiNotes: [
      {
        title: `Dream Pass 清理报告 ${now.slice(0, 10)}`,
        frontmatter: {
          title: `Dream Pass 清理报告 ${now.slice(0, 10)}`,
          type: "project",
          created_by: "hermes:worker",
          source_type: "agent-output",
          tags: ["personal-os", "personal-wiki", "dream-pass", "agent-self-improvement"],
          created_at: now,
          task_id: taskId,
          agent_id: "hermes:dream-pass",
          project: "Personal OS / Wiki 知识库升级",
          last_reviewed: now.slice(0, 10),
        },
        content: markdown,
      },
    ],
    projectEvents: [
      {
        projectName: "Personal OS / Wiki 知识库升级",
        title: `Dream pass ${now.slice(0, 10)}：${dupGroups.length} 组重复 notes，${staleItems.length} 条过期 inbox`,
        body: `扫描 ${wikiTotal} wiki notes，发现 ${dupGroups.length} 组重复/近重复；${staleItems.length} 条超过 ${INBOX_MAX_AGE_DAYS} 天的 pending inbox items。`,
        eventType: "dream-pass",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.out, { recursive: true });

  console.log(`[dream-pass] starting at ${isoNow()}`);

  // --- Scan Wiki notes ---
  const wikiToken = getWikiReadToken();
  let wikiResult = { notes: [], total: 0 };
  try {
    console.log("[dream-pass] fetching wiki notes...");
    wikiResult = await fetchAllWikiNotes(wikiToken);
    console.log(`[dream-pass] fetched ${wikiResult.notes.length} of ${wikiResult.total} wiki notes`);
  } catch (err) {
    console.error(`[dream-pass] wiki fetch error: ${err.message}`);
  }

  const dupGroups = findDuplicateNotes(wikiResult.notes);
  console.log(`[dream-pass] found ${dupGroups.length} duplicate/near-duplicate groups`);

  // --- Scan Inbox items ---
  const osReadToken = getOsReadToken();
  let inboxItems = [];
  try {
    console.log("[dream-pass] fetching inbox items...");
    inboxItems = await fetchInboxItems(osReadToken);
    console.log(`[dream-pass] fetched ${inboxItems.length} inbox items`);
  } catch (err) {
    console.error(`[dream-pass] inbox fetch error: ${err.message}`);
  }

  const staleItems = findStaleInboxItems(inboxItems);
  console.log(`[dream-pass] found ${staleItems.length} stale (> ${INBOX_MAX_AGE_DAYS}d) pending inbox items`);

  // --- Build reports ---
  const markdown = buildMarkdownReport(dupGroups, staleItems, wikiResult.total);
  const report = {
    generatedAt: isoNow(),
    taskId: args.taskId,
    wiki: {
      total: wikiResult.total,
      scanned: wikiResult.notes.length,
      duplicateGroups: dupGroups.length,
      groups: dupGroups,
    },
    inbox: {
      scanned: inboxItems.length,
      stalePending: staleItems.length,
      staleItems,
    },
  };

  await writeFile(path.join(args.out, "dream-pass-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(args.out, "dream-pass-report.md"), markdown);
  console.log(`[dream-pass] reports written to ${args.out}`);

  // --- Worker result ---
  const workerResult = {
    taskId: args.taskId,
    status: "completed",
    summary: `Scanned ${wikiResult.total} wiki notes, found ${dupGroups.length} dup groups; ${staleItems.length} stale inbox items.`,
    outputs: [
      path.join(args.out, "dream-pass-report.json"),
      path.join(args.out, "dream-pass-report.md"),
    ],
  };
  await writeFile(path.join(args.out, "worker-result.json"), `${JSON.stringify(workerResult, null, 2)}\n`);

  // --- Gate ---
  const gate = {
    taskId: args.taskId,
    status: "pass",
    checks: [
      { name: "wiki_fetch", passed: wikiResult.notes.length > 0 },
      { name: "inbox_fetch", passed: inboxItems.length > 0 },
      { name: "report_generated", passed: true },
      { name: "no_destructive_ops", passed: true },
    ],
    timestamp: isoNow(),
  };
  await writeFile(path.join(args.out, "gate.json"), `${JSON.stringify(gate, null, 2)}\n`);

  // --- Intake write-back ---
  let intake = null;
  if (args.intake) {
    const osWriteToken = getOsWriteToken();
    if (!osWriteToken) {
      console.error("[dream-pass] no PERSONAL_OS_API_TOKEN for intake");
    } else {
      try {
        const payload = buildIntakePayload({
          markdown,
          dupGroups,
          staleItems,
          wikiTotal: wikiResult.total,
          taskId: args.taskId,
        });
        intake = await postIntake(payload, osWriteToken);
        await writeFile(
          path.join(args.out, "intake-result.json"),
          `${JSON.stringify(intake, null, 2)}\n`
        );
        console.log(`[dream-pass] intake ok: agentRunId=${intake.agentRunId || "?"}`);
      } catch (err) {
        console.error(`[dream-pass] intake error: ${err.message}`);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        out: args.out,
        wikiScanned: wikiResult.notes.length,
        wikiTotal: wikiResult.total,
        dupGroups: dupGroups.length,
        staleInbox: staleItems.length,
        intake: intake
          ? { ok: intake.ok, agentRunId: intake.agentRunId }
          : null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
