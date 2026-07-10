#!/usr/bin/env node
import process from "node:process";

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PERSONAL_OS_BASE_URL ?? "http://localhost:3100",
    token: process.env.PERSONAL_OS_API_TOKEN,
    agentId: process.env.PERSONAL_OS_AGENT_ID ?? "obsidianmanager1",
    taskId: undefined,
    leaseMinutes: Number(process.env.PERSONAL_OS_AGENT_LEASE_MINUTES ?? 90),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      i += 1;
      return value;
    };
    if (arg === "--base-url") args.baseUrl = readValue();
    else if (arg === "--token") args.token = readValue();
    else if (arg === "--agent-id") args.agentId = readValue();
    else if (arg === "--task-id") args.taskId = readValue();
    else if (arg === "--lease-minutes") args.leaseMinutes = Number(readValue());
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.taskId) throw new Error("--task-id is required");
  if (!Number.isFinite(args.leaseMinutes) || args.leaseMinutes < 1 || args.leaseMinutes > 1440) {
    throw new Error("--lease-minutes must be between 1 and 1440");
  }
  args.baseUrl = args.baseUrl.replace(/\/$/, "");
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/agent-heartbeat.mjs --task-id <id> [options]

Renew a Personal OS task lease for a long-running agent worker.

Options:
  --base-url <url>          Personal OS base URL
  --token <token>           Personal OS write token
  --agent-id <id>           Agent profile id
  --task-id <id>            Task id
  --lease-minutes <n>       New lease length, 1-1440 minutes
`);
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: ["Bearer", token].join(" ") } : {}),
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { ok: false, error: text };
  }
  if (!response.ok || body?.ok === false) {
    const error = body?.error ?? response.statusText;
    throw new Error(`${options.method ?? "GET"} ${url} failed: ${response.status} ${error}`);
  }
  return body;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await requestJson(
    `${args.baseUrl}/api/tasks/${encodeURIComponent(args.taskId)}/heartbeat`,
    {
      method: "POST",
      headers: authHeaders(args.token),
      body: JSON.stringify({
        agentId: args.agentId,
        leaseMinutes: args.leaseMinutes,
      }),
    },
  );

  console.log(JSON.stringify({ ok: true, taskId: args.taskId, task: result.task }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
