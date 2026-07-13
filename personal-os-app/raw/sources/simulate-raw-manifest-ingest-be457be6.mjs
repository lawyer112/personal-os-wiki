#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const taskId = "cmqq2o6lz000w0jmj9mfh4cer";
const scriptPath = decodeURIComponent(new URL(import.meta.url).pathname);
const runDir = path.resolve(path.dirname(scriptPath), "..");
const rawDir = path.join(runDir, "examples", "raw");
const outDir = path.join(runDir, "examples");

const fixtures = [
  {
    file: "new-agent-run.md",
    source_id: "agent-run:cmqq-sample-new",
    source_type: "agent-run",
    wiki_note_path: "30_projects/Personal-OS-Wiki-知识库升级/new-agent-run-evidence.md",
  },
  {
    file: "duplicate-existing.md",
    source_id: "telegram:msg-001",
    source_type: "telegram",
    wiki_note_path: "20_notes/telegram/existing-telegram-capture.md",
  },
  {
    file: "update-project-readme.md",
    source_id: "file:project-readme",
    source_type: "file",
    wiki_note_path: "30_projects/Personal-OS-Wiki-知识库升级/project-readme.md",
  },
];

function sha256(data) {
  return `sha256:${crypto.createHash("sha256").update(data).digest("hex")}`;
}

function readFixture(file) {
  const rawPath = path.join(rawDir, file);
  const content = fs.readFileSync(rawPath);
  const stat = fs.statSync(rawPath);
  return {
    rawPath,
    rawPathRelative: path.relative(runDir, rawPath),
    content,
    hash: sha256(content),
    size: stat.size,
    mtime: stat.mtime.toISOString(),
  };
}

function entry({ source_id, source_type, rawPathRelative, hash, size, mtime, wiki_note_path, revision = 1, status = "ingested", decision = "ingest", previous_hashes = [] }, now) {
  return {
    source_id,
    source_type,
    raw_path: rawPathRelative,
    content_hash: hash,
    hash_algorithm: "sha256",
    size_bytes: size,
    mtime,
    revision,
    status,
    wiki_note_path,
    personal_os_task_id: taskId,
    first_seen_at: now,
    last_seen_at: now,
    last_decision: decision,
    previous_hashes,
    metadata: { task_id: taskId, fixture: true },
  };
}

function buildSeedManifest(now) {
  const duplicate = readFixture("duplicate-existing.md");
  const update = readFixture("update-project-readme.md");
  const oldProjectReadme = Buffer.from(`# Project README Snapshot\n\nsource_id: file:project-readme\nsource_type: file\n\nRevision 1 only described a manual import.\n`, "utf8");
  return {
    manifest_version: "raw-manifest-v0",
    generated_at: now,
    root: "examples/raw",
    entries: [
      entry({
        source_id: "telegram:msg-001",
        source_type: "telegram",
        rawPathRelative: duplicate.rawPathRelative,
        hash: duplicate.hash,
        size: duplicate.size,
        mtime: duplicate.mtime,
        wiki_note_path: "20_notes/telegram/existing-telegram-capture.md",
        revision: 1,
        status: "ingested",
        decision: "ingest",
      }, now),
      entry({
        source_id: "file:project-readme",
        source_type: "file",
        rawPathRelative: update.rawPathRelative,
        hash: sha256(oldProjectReadme),
        size: oldProjectReadme.length,
        mtime: update.mtime,
        wiki_note_path: "30_projects/Personal-OS-Wiki-知识库升级/project-readme.md",
        revision: 1,
        status: "ingested",
        decision: "ingest",
      }, now),
    ],
    events: [],
  };
}

function validateManifest(manifest) {
  const errors = [];
  if (manifest.manifest_version !== "raw-manifest-v0") errors.push("manifest_version must be raw-manifest-v0");
  if (!Array.isArray(manifest.entries)) errors.push("entries must be an array");
  if (!Array.isArray(manifest.events)) errors.push("events must be an array");
  for (const [index, item] of (manifest.entries ?? []).entries()) {
    for (const key of ["source_id", "source_type", "raw_path", "content_hash", "hash_algorithm", "size_bytes", "revision", "status", "first_seen_at", "last_seen_at", "last_decision"]) {
      if (item[key] === undefined || item[key] === null || item[key] === "") errors.push(`entries[${index}].${key} missing`);
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(item.content_hash ?? "")) errors.push(`entries[${index}].content_hash invalid`);
    if (item.hash_algorithm !== "sha256") errors.push(`entries[${index}].hash_algorithm must be sha256`);
    if (!Number.isInteger(item.revision) || item.revision < 1) errors.push(`entries[${index}].revision invalid`);
  }
  for (const [index, event] of (manifest.events ?? []).entries()) {
    for (const key of ["at", "source_id", "decision", "reason"]) {
      if (!event[key]) errors.push(`events[${index}].${key} missing`);
    }
    if (!["ingest", "skip", "update"].includes(event.decision)) errors.push(`events[${index}].decision invalid`);
  }
  return errors;
}

function processFixture(manifest, fixture, now) {
  const observed = readFixture(fixture.file);
  const byHash = manifest.entries.find((item) => item.content_hash === observed.hash);
  if (byHash) {
    byHash.last_seen_at = now;
    byHash.last_decision = "skip";
    byHash.status = byHash.status === "ingested" ? "skipped" : byHash.status;
    manifest.events.push({
      at: now,
      source_id: fixture.source_id,
      decision: "skip",
      reason: "same hash already ingested",
      raw_path: observed.rawPathRelative,
      wiki_note_path: byHash.wiki_note_path,
    });
    return { file: fixture.file, source_id: fixture.source_id, decision: "skip", reason: "same hash already ingested" };
  }

  const bySource = manifest.entries.find((item) => item.source_id === fixture.source_id);
  if (bySource) {
    const previousHash = bySource.content_hash;
    bySource.previous_hashes = [...(bySource.previous_hashes ?? []), previousHash];
    bySource.content_hash = observed.hash;
    bySource.size_bytes = observed.size;
    bySource.mtime = observed.mtime;
    bySource.raw_path = observed.rawPathRelative;
    bySource.revision += 1;
    bySource.status = "updated";
    bySource.last_seen_at = now;
    bySource.last_decision = "update";
    manifest.events.push({
      at: now,
      source_id: fixture.source_id,
      decision: "update",
      reason: "same source_id with changed hash",
      raw_path: observed.rawPathRelative,
      wiki_note_path: bySource.wiki_note_path,
      previous_hash: previousHash,
      next_hash: observed.hash,
    });
    return { file: fixture.file, source_id: fixture.source_id, decision: "update", reason: "same source_id with changed hash" };
  }

  const newEntry = entry({
    source_id: fixture.source_id,
    source_type: fixture.source_type,
    rawPathRelative: observed.rawPathRelative,
    hash: observed.hash,
    size: observed.size,
    mtime: observed.mtime,
    wiki_note_path: fixture.wiki_note_path,
    revision: 1,
    status: "ingested",
    decision: "ingest",
  }, now);
  manifest.entries.push(newEntry);
  manifest.events.push({
    at: now,
    source_id: fixture.source_id,
    decision: "ingest",
    reason: "new source_id and new hash",
    raw_path: observed.rawPathRelative,
    wiki_note_path: fixture.wiki_note_path,
  });
  return { file: fixture.file, source_id: fixture.source_id, decision: "ingest", reason: "new source_id and new hash" };
}

const now = new Date().toISOString();
const before = buildSeedManifest(now);
const beforeErrors = validateManifest(before);
if (beforeErrors.length) {
  console.error(JSON.stringify({ ok: false, stage: "before", errors: beforeErrors }, null, 2));
  process.exit(1);
}

const after = JSON.parse(JSON.stringify(before));
const decisions = fixtures.map((fixture) => processFixture(after, fixture, now));
after.generated_at = now;
const afterErrors = validateManifest(after);
if (afterErrors.length) {
  console.error(JSON.stringify({ ok: false, stage: "after", errors: afterErrors }, null, 2));
  process.exit(1);
}

const summary = {
  ok: true,
  task_id: taskId,
  decisions,
  counts: decisions.reduce((acc, item) => {
    acc[item.decision] = (acc[item.decision] ?? 0) + 1;
    return acc;
  }, {}),
  outputs: {
    before: "examples/manifest.before.json",
    after: "examples/manifest.after.json",
    decisions: "examples/decisions.json",
  },
};

fs.writeFileSync(path.join(outDir, "manifest.before.json"), JSON.stringify(before, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "manifest.after.json"), JSON.stringify(after, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "decisions.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
