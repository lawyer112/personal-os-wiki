diff --git a/personal-os-app/scripts/raw-manifest-ingest.mjs b/personal-os-app/scripts/raw-manifest-ingest.mjs
new file mode 100644
index 0000000..ea5347a
--- /dev/null
+++ b/personal-os-app/scripts/raw-manifest-ingest.mjs
@@ -0,0 +1,258 @@
+#!/usr/bin/env node
+import { lintFiles } from "./lint-classic-knowledge-object-manifest.mjs";
+import fs from "node:fs";
+import path from "node:path";
+import process from "node:process";
+import { fileURLToPath } from "node:url";
+
+const DEFAULT_BASE_URL = "http://192.168.6.37:3100";
+const DEFAULT_AGENT_ID = "obsidianmanager1";
+const DEFAULT_PROJECT = "Personal OS / Wiki 知识库升级";
+
+function isoNow() {
+  return new Date().toISOString();
+}
+
+function readJson(filePath) {
+  try {
+    return JSON.parse(fs.readFileSync(filePath, "utf8"));
+  } catch {
+    return null;
+  }
+}
+
+function writeJson(filePath, data) {
+  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
+}
+
+function readState(stateFile) {
+  if (!fs.existsSync(stateFile)) return {};
+  return readJson(stateFile) ?? {};
+}
+
+function writeState(stateFile, state) {
+  writeJson(stateFile, state);
+}
+
+function classify(filePath, lintResult, state) {
+  const errors = lintResult.findings.filter((f) => f.severity === "error");
+  if (errors.length > 0) {
+    return { action: "invalid", reason: errors.map((e) => e.code).join(", "), errors };
+  }
+  const object = readJson(filePath);
+  if (!object) {
+    return { action: "invalid", reason: "json-parse-error", errors: [{ code: "json-parse-error" }] };
+  }
+  const id = object.id;
+  const hash = object.hash?.value ?? null;
+  const existing = state[id];
+  if (!existing) {
+    return { action: "ingest", reason: "not in registry", id, hash };
+  }
+  if (existing.hash === hash) {
+    return { action: "skip", reason: "hash matches registry", id, hash };
+  }
+  return { action: "update", reason: "hash drift", id, existingHash: existing.hash, newHash: hash };
+}
+
+export function buildIntakePayload(objects, options) {
+  const {
+    agentId = DEFAULT_AGENT_ID,
+    projectName = DEFAULT_PROJECT,
+    generatedAt = isoNow(),
+  } = options;
+  return {
+    source: {
+      sourceType: "agent-output",
+      sourcePlatform: "raw-manifest-ingest",
+      rawText: `Raw manifest ingest: ${objects.length} object(s).`,
+      createdBy: "hermes",
+    },
+    agent: {
+      model: "hermes-raw-manifest-ingest",
+      classification: {
+        kind: "raw-manifest-ingest",
+      },
+      reasoningSummary: "将本地 manifest JSON 对象通过 /api/intake 批量写入 Personal OS。",
+      outputSummary: `已处理 ${objects.length} 个 manifest 对象。`,
+    },
+    project: {
+      name: projectName,
+      status: "active",
+      priority: "P0",
+      currentFocus: "Personal OS / Wiki 自驱闭环生产化",
+    },
+    wikiNotes: objects.map((obj) => ({
+      frontmatter: {
+        title: obj.title || obj.id,
+        type: obj.type || "note",
+        created_by: "hermes:worker",
+        source_type: "agent-output",
+        tags: ["personal-os", "personal-wiki", "raw-manifest", "ingest"],
+        created_at: generatedAt,
+        task_id: obj.id,
+        agent_id: agentId,
+        project: projectName,
+        last_reviewed: generatedAt.slice(0, 10),
+      },
+      metadata: {
+        task_id: obj.id,
+        agent_id: agentId,
+        project: projectName,
+      },
+      content: JSON.stringify(obj, null, 2),
+    })),
+    projectEvents: [
+      {
+        projectName,
+        title: `Raw manifest ingest ${generatedAt.slice(0, 10)}`,
+        body: `已处理 ${objects.length} 个 manifest 对象。`,
+        eventType: "raw-manifest-ingest",
+      },
+    ],
+  };
+}
+
+async function postIntake(baseUrl, token, payload) {
+  if (!token) throw new Error("PERSONAL_OS_API_TOKEN is required for --intake");
+  const scheme = "Bearer";
+  const hdr = {};
+  hdr["Authorization"] = [scheme, token].join(" ");
+  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/intake`, {
+    method: "POST",
+    headers: {
+      ...hdr,
+      "Content-Type": "application/json",
+    },
+    body: JSON.stringify(payload),
+  });
+  const body = await response.json().catch(() => ({}));
+  if (!response.ok) {
+    throw new Error(`Personal OS intake ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
+  }
+  return body;
+}
+
+function parseArgs(argv) {
+  const args = {
+    dir: "",
+    dryRun: true,
+    intake: false,
+    stateFile: "",
+    baseUrl: process.env.PERSONAL_OS_BASE_URL || DEFAULT_BASE_URL,
+    agentId: process.env.INGEST_AGENT_ID || DEFAULT_AGENT_ID,
+    projectName: process.env.INGEST_PROJECT || DEFAULT_PROJECT,
+  };
+
+  for (const arg of argv) {
+    if (arg === "--dry-run") args.dryRun = true;
+    else if (arg === "--intake") { args.intake = true; args.dryRun = false; }
+    else if (arg.startsWith("--dir=")) args.dir = arg.split("=", 2)[1];
+    else if (arg.startsWith("--state-file=")) args.stateFile = arg.split("=", 2)[1];
+    else if (arg.startsWith("--base-url=")) args.baseUrl = arg.split("=", 2)[1];
+    else if (arg.startsWith("--agent-id=")) args.agentId = arg.split("=", 2)[1];
+    else if (arg.startsWith("--project=")) args.projectName = arg.split("=", 2)[1];
+    else if (arg === "--help") {
+      console.log(`Usage: node scripts/raw-manifest-ingest.mjs --dir=<manifest-dir> [--dry-run|--intake] [--state-file=<path>]`);
+      process.exit(0);
+    }
+  }
+
+  if (!args.dir) {
+    throw new Error("--dir is required");
+  }
+  if (!args.stateFile) {
+    args.stateFile = path.join(args.dir, ".raw-manifest-registry.json");
+  }
+  return args;
+}
+
+export async function ingestDirectory(args) {
+  const dir = path.resolve(args.dir);
+  if (!fs.existsSync(dir)) {
+    throw new Error(`Directory does not exist: ${dir}`);
+  }
+  const stat = fs.statSync(dir);
+  if (!stat.isDirectory()) {
+    throw new Error(`Not a directory: ${dir}`);
+  }
+
+  const stateFileName = path.basename(args.stateFile);
+  const files = fs.readdirSync(dir)
+    .filter((f) => f.endsWith(".json") && f !== stateFileName)
+    .map((f) => path.join(dir, f))
+    .filter((f) => fs.statSync(f).isFile());
+
+  if (files.length === 0) {
+    return { counts: { ingest: 0, skip: 0, update: 0, invalid: 0 }, items: [], payload: null, intakeResult: null };
+  }
+
+  const lintResults = lintFiles(files, { baseDir: dir });
+  const state = readState(args.stateFile);
+  const items = [];
+  const toIngest = [];
+  const counts = { ingest: 0, skip: 0, update: 0, invalid: 0 };
+
+  for (let i = 0; i < files.length; i++) {
+    const file = files[i];
+    const result = classify(file, lintResults[i], state);
+    const object = readJson(file);
+    items.push({ file: path.relative(dir, file), action: result.action, reason: result.reason, id: result.id || (object?.id ?? null) });
+    counts[result.action]++;
+    if (result.action === "ingest" || result.action === "update") {
+      if (object) toIngest.push(object);
+    }
+  }
+
+  let payload = null;
+  let intakeResult = null;
+
+  if (args.intake) {
+    payload = buildIntakePayload(toIngest, { agentId: args.agentId, projectName: args.projectName });
+    const token = process.env.PERSONAL_OS_API_TOKEN;
+    intakeResult = await postIntake(args.baseUrl, token, payload);
+    for (const obj of toIngest) {
+      state[obj.id] = { hash: obj.hash?.value ?? null, ingestedAt: isoNow() };
+    }
+    writeState(args.stateFile, state);
+  } else if (!args.dryRun) {
+    for (const obj of toIngest) {
+      state[obj.id] = { hash: obj.hash?.value ?? null, ingestedAt: isoNow() };
+    }
+    writeState(args.stateFile, state);
+  }
+
+  return { counts, items, payload, intakeResult };
+}
+
+export function formatReport(result, dir) {
+  const lines = [
+    "raw-manifest-ingest report",
+    `  dir: ${dir}`,
+    `  ingest: ${result.counts.ingest}, skip: ${result.counts.skip}, update: ${result.counts.update}, invalid: ${result.counts.invalid}`,
+    "",
+  ];
+  for (const item of result.items) {
+    lines.push(`  ${item.action.toUpperCase()}  ${item.file}  (${item.reason})`);
+  }
+  return lines.join("\n");
+}
+
+async function main() {
+  const args = parseArgs(process.argv.slice(2));
+  const result = await ingestDirectory(args);
+  console.log(formatReport(result, args.dir));
+  if (result.intakeResult) {
+    console.log("\nIntake result:", JSON.stringify(result.intakeResult, null, 2).slice(0, 800));
+  }
+  const exitCode = result.counts.invalid > 0 ? 1 : 0;
+  process.exitCode = exitCode;
+}
+
+const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
+if (entryPath === fileURLToPath(import.meta.url)) {
+  main().catch((err) => {
+    console.error(err.message);
+    process.exit(1);
+  });
+}
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/.raw-manifest-registry.json b/personal-os-app/tests/fixtures/raw-manifest-ingest/.raw-manifest-registry.json
new file mode 100644
index 0000000..bf5e0a7
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/.raw-manifest-registry.json
@@ -0,0 +1,10 @@
+{
+  "task:raw-ingest-fixture-skip": {
+    "hash": "d64b16b17becd6b723175e2ff1b5af835fa2bfba3d8018d2a167cfda6174f384",
+    "ingestedAt": "2026-06-23T00:00:00+08:00"
+  },
+  "task:raw-ingest-fixture-update": {
+    "hash": "0000000000000000000000000000000000000000000000000000000000000000",
+    "ingestedAt": "2026-06-23T00:00:00+08:00"
+  }
+}
\ No newline at end of file
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest-source.md b/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest-source.md
new file mode 100644
index 0000000..e248c3c
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest-source.md
@@ -0,0 +1,3 @@
+# ingest-source.md
+
+Fixture source for raw manifest ingest.
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest.json b/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest.json
new file mode 100644
index 0000000..d4e4bcc
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/ingest.json
@@ -0,0 +1,66 @@
+{
+  "schema_version": "classic-knowledge-object-manifest/v0",
+  "id": "task:raw-ingest-fixture-ingest",
+  "type": "task",
+  "title": "Ingest fixture new",
+  "summary": "New object to be ingested.",
+  "source_url": null,
+  "source_type": "agent-output",
+  "freshness": {
+    "status": "fresh",
+    "captured_at": "2026-06-23T23:08:33.177571+08:00",
+    "valid_until": "2026-07-23T23:08:33.177571+08:00",
+    "ttl_days": 30,
+    "last_checked_at": "2026-06-23T23:08:33.177571+08:00",
+    "stale_reason": null
+  },
+  "sensitivity": {
+    "level": "private",
+    "contains_secrets": false,
+    "allowed_uses": [
+      "agent_context",
+      "wiki_index",
+      "task_execution"
+    ],
+    "handling_notes": "Test fixture."
+  },
+  "owner": {
+    "type": "agent",
+    "id": "obsidianmanager1"
+  },
+  "created_at": "2026-06-23T23:08:33.177571+08:00",
+  "updated_at": "2026-06-23T23:08:33.177571+08:00",
+  "confidence": "verified",
+  "lifecycle": {
+    "status": "active",
+    "review_policy": "classic_review_required",
+    "reviewed_at": null,
+    "reviewed_by": null
+  },
+  "relationships": {
+    "project_ids": [],
+    "task_ids": [],
+    "source_run_ids": [],
+    "supersedes": [],
+    "superseded_by": [],
+    "related_ids": []
+  },
+  "embedding": {
+    "version": "not-indexed-v0",
+    "content_hash": null,
+    "indexed_at": null
+  },
+  "content": {
+    "format": "markdown",
+    "uri": "personal-os://fixtures/raw-manifest-ingest",
+    "excerpt": "Fixture."
+  },
+  "lint": {
+    "waivers": []
+  },
+  "source_path": "ingest-source.md",
+  "hash": {
+    "algorithm": "sha256",
+    "value": "d5c2a86018d4454453a6a305e75342a90465b3a3b9c32fdd1a9d6d326a39313b"
+  }
+}
\ No newline at end of file
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/skip-source.md b/personal-os-app/tests/fixtures/raw-manifest-ingest/skip-source.md
new file mode 100644
index 0000000..1407f59
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/skip-source.md
@@ -0,0 +1,3 @@
+# skip-source.md
+
+Fixture source for raw manifest ingest.
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/skip.json b/personal-os-app/tests/fixtures/raw-manifest-ingest/skip.json
new file mode 100644
index 0000000..0ea4550
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/skip.json
@@ -0,0 +1,66 @@
+{
+  "schema_version": "classic-knowledge-object-manifest/v0",
+  "id": "task:raw-ingest-fixture-skip",
+  "type": "task",
+  "title": "Skip fixture existing",
+  "summary": "Existing object with matching hash.",
+  "source_url": null,
+  "source_type": "agent-output",
+  "freshness": {
+    "status": "fresh",
+    "captured_at": "2026-06-23T23:08:33.177571+08:00",
+    "valid_until": "2026-07-23T23:08:33.177571+08:00",
+    "ttl_days": 30,
+    "last_checked_at": "2026-06-23T23:08:33.177571+08:00",
+    "stale_reason": null
+  },
+  "sensitivity": {
+    "level": "private",
+    "contains_secrets": false,
+    "allowed_uses": [
+      "agent_context",
+      "wiki_index",
+      "task_execution"
+    ],
+    "handling_notes": "Test fixture."
+  },
+  "owner": {
+    "type": "agent",
+    "id": "obsidianmanager1"
+  },
+  "created_at": "2026-06-23T23:08:33.177571+08:00",
+  "updated_at": "2026-06-23T23:08:33.177571+08:00",
+  "confidence": "verified",
+  "lifecycle": {
+    "status": "active",
+    "review_policy": "classic_review_required",
+    "reviewed_at": null,
+    "reviewed_by": null
+  },
+  "relationships": {
+    "project_ids": [],
+    "task_ids": [],
+    "source_run_ids": [],
+    "supersedes": [],
+    "superseded_by": [],
+    "related_ids": []
+  },
+  "embedding": {
+    "version": "not-indexed-v0",
+    "content_hash": null,
+    "indexed_at": null
+  },
+  "content": {
+    "format": "markdown",
+    "uri": "personal-os://fixtures/raw-manifest-ingest",
+    "excerpt": "Fixture."
+  },
+  "lint": {
+    "waivers": []
+  },
+  "source_path": "skip-source.md",
+  "hash": {
+    "algorithm": "sha256",
+    "value": "d64b16b17becd6b723175e2ff1b5af835fa2bfba3d8018d2a167cfda6174f384"
+  }
+}
\ No newline at end of file
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/update-source.md b/personal-os-app/tests/fixtures/raw-manifest-ingest/update-source.md
new file mode 100644
index 0000000..b0d1f0a
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/update-source.md
@@ -0,0 +1,3 @@
+# update-source.md
+
+Fixture source for raw manifest ingest.
diff --git a/personal-os-app/tests/fixtures/raw-manifest-ingest/update.json b/personal-os-app/tests/fixtures/raw-manifest-ingest/update.json
new file mode 100644
index 0000000..b0a38ea
--- /dev/null
+++ b/personal-os-app/tests/fixtures/raw-manifest-ingest/update.json
@@ -0,0 +1,66 @@
+{
+  "schema_version": "classic-knowledge-object-manifest/v0",
+  "id": "task:raw-ingest-fixture-update",
+  "type": "task",
+  "title": "Update fixture drift",
+  "summary": "Existing object with hash drift in registry but valid manifest.",
+  "source_url": null,
+  "source_type": "agent-output",
+  "freshness": {
+    "status": "fresh",
+    "captured_at": "2026-06-23T23:08:33.177571+08:00",
+    "valid_until": "2026-07-23T23:08:33.177571+08:00",
+    "ttl_days": 30,
+    "last_checked_at": "2026-06-23T23:08:33.177571+08:00",
+    "stale_reason": null
+  },
+  "sensitivity": {
+    "level": "private",
+    "contains_secrets": false,
+    "allowed_uses": [
+      "agent_context",
+      "wiki_index",
+      "task_execution"
+    ],
+    "handling_notes": "Test fixture."
+  },
+  "owner": {
+    "type": "agent",
+    "id": "obsidianmanager1"
+  },
+  "created_at": "2026-06-23T23:08:33.177571+08:00",
+  "updated_at": "2026-06-23T23:08:33.177571+08:00",
+  "confidence": "verified",
+  "lifecycle": {
+    "status": "active",
+    "review_policy": "classic_review_required",
+    "reviewed_at": null,
+    "reviewed_by": null
+  },
+  "relationships": {
+    "project_ids": [],
+    "task_ids": [],
+    "source_run_ids": [],
+    "supersedes": [],
+    "superseded_by": [],
+    "related_ids": []
+  },
+  "embedding": {
+    "version": "not-indexed-v0",
+    "content_hash": null,
+    "indexed_at": null
+  },
+  "content": {
+    "format": "markdown",
+    "uri": "personal-os://fixtures/raw-manifest-ingest",
+    "excerpt": "Fixture."
+  },
+  "lint": {
+    "waivers": []
+  },
+  "source_path": "update-source.md",
+  "hash": {
+    "algorithm": "sha256",
+    "value": "c0410da38593433d73d3d1f94dc5551d6a08b753600d99179a7ec8a44dc18a05"
+  }
+}
\ No newline at end of file
diff --git a/personal-os-app/tests/services/raw-manifest-ingest.test.ts b/personal-os-app/tests/services/raw-manifest-ingest.test.ts
new file mode 100644
index 0000000..33f3561
--- /dev/null
+++ b/personal-os-app/tests/services/raw-manifest-ingest.test.ts
@@ -0,0 +1,96 @@
+import { describe, expect, it, vi } from "vitest";
+import path from "node:path";
+import fs from "node:fs";
+import { fileURLToPath } from "node:url";
+
+const testDir = path.dirname(fileURLToPath(import.meta.url));
+const appRoot = path.resolve(testDir, "../..");
+const fixtureDir = path.join(appRoot, "tests/fixtures/raw-manifest-ingest");
+const ingestScript = path.join(appRoot, "scripts/raw-manifest-ingest.mjs");
+
+async function loadIngestModule() {
+  vi.resetModules();
+  return import(ingestScript);
+}
+
+describe("raw-manifest-ingest", () => {
+  it("dry-runs 3 fixtures into ingest=1, skip=1, update=1, invalid=0", async () => {
+    const { ingestDirectory, formatReport } = await loadIngestModule();
+
+    const registryPath = path.join(fixtureDir, ".raw-manifest-registry.json");
+    const originalRegistry = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, "utf8") : null;
+
+    try {
+      const result = await ingestDirectory({
+        dir: fixtureDir,
+        dryRun: true,
+        stateFile: registryPath,
+      });
+
+      expect(result.counts).toEqual({ ingest: 1, skip: 1, update: 1, invalid: 0 });
+      expect(result.items).toHaveLength(3);
+      expect(result.items.map((i: any) => i.action)).toEqual(
+        expect.arrayContaining(["ingest", "skip", "update"]),
+      );
+
+      const ingestItem = result.items.find((i: any) => i.action === "ingest");
+      expect(ingestItem?.reason).toBe("not in registry");
+
+      const skipItem = result.items.find((i: any) => i.action === "skip");
+      expect(skipItem?.reason).toBe("hash matches registry");
+
+      const updateItem = result.items.find((i: any) => i.action === "update");
+      expect(updateItem?.reason).toBe("hash drift");
+
+      const report = formatReport(result, fixtureDir);
+      expect(report).toContain("ingest: 1, skip: 1, update: 1, invalid: 0");
+      expect(report).toContain("INGEST");
+      expect(report).toContain("SKIP");
+      expect(report).toContain("UPDATE");
+    } finally {
+      if (originalRegistry !== null) {
+        fs.writeFileSync(registryPath, originalRegistry);
+      }
+    }
+  });
+
+  it("does not scan the real vault", async () => {
+    const { ingestDirectory } = await loadIngestModule();
+
+    const result = await ingestDirectory({
+      dir: fixtureDir,
+      dryRun: true,
+      stateFile: path.join(fixtureDir, ".raw-manifest-registry.json"),
+    });
+
+    // All items must be within fixtureDir
+    for (const item of result.items) {
+      const itemPath = path.resolve(fixtureDir, item.file);
+      expect(itemPath.startsWith(fixtureDir)).toBe(true);
+    }
+    expect(result.items.length).toBe(3);
+  });
+
+  it("builds an intake payload with correct structure", async () => {
+    const { buildIntakePayload } = await loadIngestModule();
+    const payload = buildIntakePayload(
+      [
+        {
+          id: "task:test",
+          title: "Test object",
+          type: "task",
+          hash: { value: "abc123" },
+        },
+      ],
+      { agentId: "obsidianmanager1", projectName: "Test Project" },
+    );
+
+    expect(payload.source.sourceType).toBe("agent-output");
+    expect(payload.project.priority).toBe("P0");
+    expect(payload.wikiNotes).toHaveLength(1);
+    expect(payload.wikiNotes[0].frontmatter.created_by).toBe("hermes:worker");
+    expect(payload.wikiNotes[0].frontmatter.source_type).toBe("agent-output");
+    expect(payload.wikiNotes[0].frontmatter.tags).toContain("raw-manifest");
+    expect(payload.projectEvents).toHaveLength(1);
+  });
+});
