#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const HERMES_ENV_PATH = "/Users/xingqiwu/.hermes/profiles/obsidianmanager1/.env";
const DEFAULT_LIMIT = 5;
const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

await loadEnvFile(HERMES_ENV_PATH);

const args = parseArgs(process.argv.slice(2));
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: requireEnv("DATABASE_URL"),
  }),
});

try {
  if (args.loop) {
    while (true) {
      await processBatch(args);
      await sleep(args.intervalMs);
    }
  } else {
    const result = await processBatch(args);
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await prisma.$disconnect();
}

function parseArgs(argv) {
  const args = {
    limit: numberEnv("WIKI_WRITE_JOB_LIMIT", DEFAULT_LIMIT),
    loop: false,
    intervalMs: numberEnv("WIKI_WRITE_JOB_INTERVAL_MS", DEFAULT_INTERVAL_MS),
    lockTimeoutMs: numberEnv("WIKI_WRITE_JOB_LOCK_TIMEOUT_MS", DEFAULT_LOCK_TIMEOUT_MS),
    workerId: process.env.WIKI_WRITE_WORKER_ID ?? `wiki-worker-${process.pid}`,
  };

  for (const arg of argv) {
    if (arg === "--loop") args.loop = true;
    else if (arg === "--once") args.loop = false;
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=", 2)[1]);
    else if (arg.startsWith("--interval-ms=")) args.intervalMs = Number(arg.split("=", 2)[1]);
    else if (arg.startsWith("--lock-timeout-ms=")) args.lockTimeoutMs = Number(arg.split("=", 2)[1]);
    else if (arg.startsWith("--worker-id=")) args.workerId = arg.split("=", 2)[1];
    else if (arg === "--help") {
      console.log("Usage: node scripts/process-wiki-write-jobs.mjs [--once] [--loop] [--limit=5] [--interval-ms=5000] [--worker-id=<id>]");
      process.exit(0);
    }
  }

  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = DEFAULT_LIMIT;
  if (!Number.isFinite(args.intervalMs) || args.intervalMs < 250) args.intervalMs = DEFAULT_INTERVAL_MS;
  if (!Number.isFinite(args.lockTimeoutMs) || args.lockTimeoutMs < 60_000) args.lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS;
  return args;
}

async function processBatch(args) {
  const recovered = await recoverStaleJobs(args.lockTimeoutMs);
  const jobs = await prisma.wikiWriteJob.findMany({
    where: {
      status: { in: ["queued", "retry"] },
      nextRunAt: { lte: new Date() },
    },
    orderBy: [{ createdAt: "asc" }],
    take: args.limit,
  });

  const results = [];
  for (const job of jobs) {
    const claimed = await claimJob(job, args.workerId);
    if (!claimed) {
      results.push({ id: job.id, status: "skipped" });
      continue;
    }
    results.push(await processJob({ ...job, attempts: job.attempts + 1 }, args.workerId));
  }

  return {
    ok: true,
    recovered,
    processed: results.length,
    results,
  };
}

async function recoverStaleJobs(lockTimeoutMs) {
  const cutoff = new Date(Date.now() - lockTimeoutMs);
  const result = await prisma.wikiWriteJob.updateMany({
    where: {
      status: "processing",
      lockedAt: { lt: cutoff },
    },
    data: {
      status: "retry",
      lockedBy: null,
      lockedAt: null,
      lastError: "Recovered stale processing lock",
      nextRunAt: new Date(),
    },
  });
  return result.count;
}

async function claimJob(job, workerId) {
  const result = await prisma.wikiWriteJob.updateMany({
    where: {
      id: job.id,
      status: { in: ["queued", "retry"] },
      nextRunAt: { lte: new Date() },
    },
    data: {
      status: "processing",
      attempts: { increment: 1 },
      lockedBy: workerId,
      lockedAt: new Date(),
    },
  });

  return result.count === 1;
}

async function processJob(job, workerId) {
  try {
    const result = await ingestLight(job);
    await prisma.wikiWriteJob.update({
      where: { id: job.id },
      data: {
        status: "done",
        lastError: null,
        lockedBy: null,
        lockedAt: null,
        completedAt: new Date(),
        notePath: stringOrNull(result.note_path),
        noteUrl: stringOrNull(result.url),
      },
    });
    await recordJobActivity(job, "wikiWriteJob.done", {
      workerId,
      attempts: job.attempts,
      notePath: stringOrNull(result.note_path),
      noteUrl: stringOrNull(result.url),
    });
    return { id: job.id, status: "done", note_path: result.note_path, url: result.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wiki write failed";
    const terminal = job.attempts >= job.maxAttempts;
    const status = terminal ? "failed" : "retry";
    await prisma.wikiWriteJob.update({
      where: { id: job.id },
      data: {
        status,
        lastError: message,
        lockedBy: null,
        lockedAt: null,
        nextRunAt: terminal ? new Date() : new Date(Date.now() + retryDelayMs(job.attempts)),
      },
    });
    await recordJobActivity(job, terminal ? "wikiWriteJob.failed" : "wikiWriteJob.retry", {
      workerId,
      attempts: job.attempts,
      error: message,
    });
    return { id: job.id, status, error: message };
  }
}

async function ingestLight(job) {
  const wikiApiToken = requireEnv("WIKI_API_TOKEN");
  const payload = jobPayload(job);
  const response = await fetch(wikiUrl("/api/ingest?mode=light"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${wikiApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new Error(responseError(body, response.status));
  }
  return body;
}

function jobPayload(job) {
  const payload = asRecord(job.payload);
  return {
    ...payload,
    metadata: {
      ...asRecord(payload.metadata),
      personal_os_wiki_write_job_id: job.id,
      personal_os_wiki_write_idempotency_key: job.idempotencyKey,
    },
  };
}

async function parseResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function responseError(body, status) {
  const message = body.error ?? body.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }
  return `Personal Wiki returned ${status}`;
}

async function recordJobActivity(job, action, after) {
  await prisma.activityLog.create({
    data: {
      actorType: "hermes",
      action,
      targetType: "wikiWriteJob",
      targetId: job.id,
      after: {
        title: job.title,
        ...after,
      },
    },
  });
}

function wikiUrl(path) {
  const base = firstEnv(["NEXT_PUBLIC_WIKI_URL", "WIKI_URL", "PERSONAL_WIKI_URL"]);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/$/, "")}${suffix}`;
}

function firstEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  throw new Error(`${names.join(" or ")} is required`);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

async function loadEnvFile(filePath) {
  let text = "";
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    return;
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    if (!key || process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = unquoteEnv(rest.join("="));
  }
}

function unquoteEnv(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function asRecord(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  return {};
}

function stringOrNull(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function retryDelayMs(attempts) {
  const seconds = Math.min(300, 2 ** Math.max(0, attempts - 1) * 10);
  return seconds * 1000;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
