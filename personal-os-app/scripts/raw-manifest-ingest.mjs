#!/usr/bin/env node
import { lintFiles } from "./lint-classic-knowledge-object-manifest.mjs";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_AGENT_ID = "obsidianmanager1";
const DEFAULT_PROJECT = "Personal OS / Wiki Upgrade";

function isoNow() {
  return new Date().toISOString();
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function readState(stateFile) {
  if (!fs.existsSync(stateFile)) return {};
  return readJson(stateFile) ?? {};
}

function writeState(stateFile, state) {
  writeJson(stateFile, state);
}

function classify(filePath, lintResult, state) {
  const errors = lintResult.findings.filter((f) => f.severity === "error");
  if (errors.length > 0) {
    return { action: "invalid", reason: errors.map((e) => e.code).join(", "), errors };
  }
  const object = readJson(filePath);
  if (!object) {
    return { action: "invalid", reason: "json-parse-error", errors: [{ code: "json-parse-error" }] };
  }
  const id = object.id;
  const hash = object.hash?.value ?? null;
  const existing = state[id];
  if (!existing) {
    return { action: "ingest", reason: "not in registry", id, hash };
  }
  if (existing.hash === hash) {
    return { action: "skip", reason: "hash matches registry", id, hash };
  }
  return { action: "update", reason: "hash drift", id, existingHash: existing.hash, newHash: hash };
}

export function buildIntakePayload(objects, options) {
  const {
    agentId = DEFAULT_AGENT_ID,
    projectName = DEFAULT_PROJECT,
    generatedAt = isoNow(),
  } = options;
  return {
    source: {
      sourceType: "agent-output",
      sourcePlatform: "raw-manifest-ingest",
      rawText: `Raw manifest ingest: ${objects.length} object(s).`,
      createdBy: "hermes",
    },
    agent: {
      model: "hermes-raw-manifest-ingest",
      classification: {
        kind: "raw-manifest-ingest",
      },
      reasoningSummary: "将本地 manifest JSON 对象通过 /api/intake 批量写入 Personal OS。",
      outputSummary: `已处理 ${objects.length} 个 manifest 对象。`,
    },
    project: {
      name: projectName,
      status: "active",
      priority: "P0",
      currentFocus: "Personal OS / Wiki 自驱闭环生产化",
    },
    wikiNotes: objects.map((obj) => ({
      frontmatter: {
        title: obj.title || obj.id,
        type: obj.type || "note",
        created_by: "hermes:worker",
        source_type: "agent-output",
        tags: ["personal-os", "personal-wiki", "raw-manifest", "ingest"],
        created_at: generatedAt,
        task_id: obj.id,
        agent_id: agentId,
        project: projectName,
        last_reviewed: generatedAt.slice(0, 10),
      },
      metadata: {
        task_id: obj.id,
        agent_id: agentId,
        project: projectName,
      },
      content: JSON.stringify(obj, null, 2),
    })),
    projectEvents: [
      {
        projectName,
        title: `Raw manifest ingest ${generatedAt.slice(0, 10)}`,
        body: `已处理 ${objects.length} 个 manifest 对象。`,
        eventType: "raw-manifest-ingest",
      },
    ],
  };
}

async function postIntake(baseUrl, token, payload) {
  if (!token) throw new Error("PERSONAL_OS_API_TOKEN is required for --intake");
  const scheme = "Bearer";
  const hdr = {};
  hdr["Authorization"] = [scheme, token].join(" ");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/intake`, {
    method: "POST",
    headers: {
      ...hdr,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Personal OS intake ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

function parseArgs(argv) {
  const args = {
    dir: "",
    dryRun: true,
    intake: false,
    stateFile: "",
    baseUrl: process.env.PERSONAL_OS_BASE_URL || DEFAULT_BASE_URL,
    agentId: process.env.INGEST_AGENT_ID || DEFAULT_AGENT_ID,
    projectName: process.env.INGEST_PROJECT || DEFAULT_PROJECT,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--intake") { args.intake = true; args.dryRun = false; }
    else if (arg.startsWith("--dir=")) args.dir = arg.split("=", 2)[1];
    else if (arg.startsWith("--state-file=")) args.stateFile = arg.split("=", 2)[1];
    else if (arg.startsWith("--base-url=")) args.baseUrl = arg.split("=", 2)[1];
    else if (arg.startsWith("--agent-id=")) args.agentId = arg.split("=", 2)[1];
    else if (arg.startsWith("--project=")) args.projectName = arg.split("=", 2)[1];
    else if (arg === "--help") {
      console.log(`Usage: node scripts/raw-manifest-ingest.mjs --dir=<manifest-dir> [--dry-run|--intake] [--state-file=<path>]`);
      process.exit(0);
    }
  }

  if (!args.dir) {
    throw new Error("--dir is required");
  }
  if (!args.stateFile) {
    args.stateFile = path.join(args.dir, ".raw-manifest-registry.json");
  }
  return args;
}

export async function ingestDirectory(args) {
  const dir = path.resolve(args.dir);
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory does not exist: ${dir}`);
  }
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dir}`);
  }

  const stateFileName = path.basename(args.stateFile);
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== stateFileName)
    .map((f) => path.join(dir, f))
    .filter((f) => fs.statSync(f).isFile());

  if (files.length === 0) {
    return { counts: { ingest: 0, skip: 0, update: 0, invalid: 0 }, items: [], payload: null, intakeResult: null };
  }

  const lintResults = lintFiles(files, { baseDir: dir });
  const state = readState(args.stateFile);
  const items = [];
  const toIngest = [];
  const counts = { ingest: 0, skip: 0, update: 0, invalid: 0 };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = classify(file, lintResults[i], state);
    const object = readJson(file);
    items.push({ file: path.relative(dir, file), action: result.action, reason: result.reason, id: result.id || (object?.id ?? null) });
    counts[result.action]++;
    if (result.action === "ingest" || result.action === "update") {
      if (object) toIngest.push(object);
    }
  }

  let payload = null;
  let intakeResult = null;

  if (args.intake) {
    payload = buildIntakePayload(toIngest, { agentId: args.agentId, projectName: args.projectName });
    const token = process.env.PERSONAL_OS_API_TOKEN;
    intakeResult = await postIntake(args.baseUrl, token, payload);
    for (const obj of toIngest) {
      state[obj.id] = { hash: obj.hash?.value ?? null, ingestedAt: isoNow() };
    }
    writeState(args.stateFile, state);
  } else if (!args.dryRun) {
    for (const obj of toIngest) {
      state[obj.id] = { hash: obj.hash?.value ?? null, ingestedAt: isoNow() };
    }
    writeState(args.stateFile, state);
  }

  return { counts, items, payload, intakeResult };
}

export function formatReport(result, dir) {
  const lines = [
    "raw-manifest-ingest report",
    `  dir: ${dir}`,
    `  ingest: ${result.counts.ingest}, skip: ${result.counts.skip}, update: ${result.counts.update}, invalid: ${result.counts.invalid}`,
    "",
  ];
  for (const item of result.items) {
    lines.push(`  ${item.action.toUpperCase()}  ${item.file}  (${item.reason})`);
  }
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await ingestDirectory(args);
  console.log(formatReport(result, args.dir));
  if (result.intakeResult) {
    console.log("\nIntake result:", JSON.stringify(result.intakeResult, null, 2).slice(0, 800));
  }
  const exitCode = result.counts.invalid > 0 ? 1 : 0;
  process.exitCode = exitCode;
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
