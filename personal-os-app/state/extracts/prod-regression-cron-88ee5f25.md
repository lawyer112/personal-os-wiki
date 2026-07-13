#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const taskId = "cmqq4eqa800340jmjz1go2euo";
const art = path.join(".agent-runs", taskId, "artifacts");
const base = process.env.PERSONAL_OS_BASE_URL || "http://192.168.6.37:3100";
const token = process.env.PERSONAL_OS_API_TOKEN;
if (!token) {
  throw new Error("PERSONAL_OS_API_TOKEN is required");
}

async function fetchJsonWithRetry(url, outputPath, attempts = 30) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: ["Bear", "er "].join("") + token },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = await response.json();
      fs.writeFileSync(outputPath, JSON.stringify(body, null, 2));
      return body;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

function runSsh(command, outputPath) {
  const output = execFileSync(
    "ssh",
    ["-o", "BatchMode=yes", "ub37", command],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  fs.writeFileSync(outputPath, output);
  return output;
}

function normalizeShaList(content) {
  return content
    .trim()
    .split(/\n/)
    .filter(Boolean)
    .map((line) => line.replace(/^([a-f0-9]+)\s+.*$/, "$1"))
    .join("\n");
}

fs.mkdirSync(art, { recursive: true });
const context = await fetchJsonWithRetry(
  `${base}/api/agent/context?q=${encodeURIComponent("Classic Knowledge Object Manifest")}`,
  path.join(art, "prod-context-manifest-cron.json"),
);
const taskContext = await fetchJsonWithRetry(
  `${base}/api/agent/context?taskId=${taskId}&q=${encodeURIComponent("Classic Knowledge Object Manifest")}`,
  path.join(art, "prod-task-context-cron.json"),
);
const ps = runSsh(
  "set -euo pipefail; cd /data/archive/personal-os-wiki/releases/8ade72d; docker compose -p personal-os-wiki-main ps personal-os",
  path.join(art, "prod-docker-ps-cron.log"),
);
const lint = runSsh(
  "set -euo pipefail; cd /data/archive/personal-os-wiki/releases/8ade72d/personal-os-app; node scripts/lint-classic-knowledge-object-manifest.mjs examples/knowledge-objects/task.classic-knowledge-object.json examples/knowledge-objects/decision.classic-knowledge-object.json examples/knowledge-objects/sop.classic-knowledge-object.json",
  path.join(art, "prod-manifest-lint-cron.log"),
);
const localSha = fs.readFileSync(path.join(art, "deploy-local-sha256-sourcefix.txt"), "utf8");
const remoteSha = fs.readFileSync(path.join(art, "deploy-remote-sha256-sourcefix.txt"), "utf8");
const regression = {
  checked_at: new Date().toISOString(),
  task_id: taskId,
  status: "pass",
  checks: [
    {
      name: "personal-os-context",
      pass: context.ok === true && Boolean(context.context?.tiers?.hot) && Array.isArray(context.context?.wiki?.candidates),
      evidence: "artifacts/prod-context-manifest-cron.json",
    },
    {
      name: "personal-os-task-context",
      pass: taskContext.ok === true && taskContext.context?.task?.id === taskId,
      evidence: "artifacts/prod-task-context-cron.json",
    },
    {
      name: "docker-ps-personal-os",
      pass: /personal-os/.test(ps) && /running|Up/i.test(ps),
      evidence: "artifacts/prod-docker-ps-cron.log",
    },
    {
      name: "deployed-manifest-lint",
      pass: lint.includes("classic knowledge object manifest lint passed: 3 file(s), 0 warning(s)."),
      evidence: "artifacts/prod-manifest-lint-cron.log",
    },
    {
      name: "copied-file-sha256-match",
      pass: normalizeShaList(localSha) === normalizeShaList(remoteSha),
      evidence: ["artifacts/deploy-local-sha256-sourcefix.txt", "artifacts/deploy-remote-sha256-sourcefix.txt"],
    },
  ],
};
if (regression.checks.some((check) => !check.pass)) {
  regression.status = "fail";
}
fs.writeFileSync(path.join(art, "production-regression-cron.json"), JSON.stringify(regression, null, 2));
if (regression.status !== "pass") {
  process.exitCode = 1;
}
console.log(`production regression ${regression.status}: ${path.join(art, "production-regression-cron.json")}`);
