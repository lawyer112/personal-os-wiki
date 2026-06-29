#!/usr/bin/env node
import process from "node:process";

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PERSONAL_OS_BASE_URL ?? "http://localhost:3100",
    token: process.env.PERSONAL_OS_API_TOKEN,
    agentId: process.env.PERSONAL_OS_AGENT_ID ?? "obsidianmanager1",
    tags: process.env.PERSONAL_OS_AGENT_TAGS ?? "",
    limit: Number(process.env.PERSONAL_OS_AGENT_LIMIT ?? 10),
    leaseMinutes: Number(process.env.PERSONAL_OS_AGENT_LEASE_MINUTES ?? 90),
    mode: "peek",
    format: "markdown",
    taskId: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      i += 1;
      return value;
    };
    if (arg === "--base-url") args.baseUrl = readValue();
    else if (arg === "--token") args.token = readValue();
    else if (arg === "--agent-id") args.agentId = readValue();
    else if (arg === "--tags") args.tags = readValue();
    else if (arg === "--limit") args.limit = Number(readValue());
    else if (arg === "--lease-minutes") args.leaseMinutes = Number(readValue());
    else if (arg === "--claim") args.mode = "claim";
    else if (arg === "--peek") args.mode = "peek";
    else if (arg === "--json") args.format = "json";
    else if (arg === "--markdown") args.format = "markdown";
    else if (arg === "--task-id") args.taskId = readValue();
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.limit) || args.limit < 1 || args.limit > 50) {
    throw new Error("--limit must be between 1 and 50");
  }
  if (!Number.isFinite(args.leaseMinutes) || args.leaseMinutes < 1 || args.leaseMinutes > 1440) {
    throw new Error("--lease-minutes must be between 1 and 1440");
  }
  args.baseUrl = args.baseUrl.replace(/\/$/, "");
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/agent-run-next.mjs [options]

Find the next agent_allowed Personal OS task for an agent, optionally claim it,
and print a compact execution brief for Hermes/Codex/Claude workers.

Options:
  --base-url <url>          Personal OS base URL (default: PERSONAL_OS_BASE_URL or http://localhost:3100)
  --token <token>           Personal OS write token (default: PERSONAL_OS_API_TOKEN)
  --agent-id <id>           Agent profile id (default: PERSONAL_OS_AGENT_ID or obsidianmanager1)
  --tags <csv>              Optional tag filter
  --limit <n>               Inbox limit, 1-50 (default: 10)
  --claim                   Claim the selected task and create a lease
  --peek                    Do not claim; only print the next task (default)
  --lease-minutes <n>       Lease length when --claim is used (default: 90)
  --task-id <id>            Prefer a specific task id from the inbox
  --json                    Print JSON instead of Markdown
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

function firstClaimable(tasks, taskId) {
  if (taskId) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Task ${taskId} was not returned by /api/agent-inbox`);
    return task;
  }
  return tasks[0] ?? null;
}

function taskBrief(task, args, claimResult) {
  const contextUrl = task.contextUrl?.startsWith("http")
    ? task.contextUrl
    : `${args.baseUrl}${task.contextUrl ?? `/api/agent/context?taskId=${encodeURIComponent(task.id)}`}`;
  const lines = [
    `# Personal OS Agent Run Brief`,
    ``,
    `task_id: ${task.id}`,
    `title: ${task.title}`,
    `status: ${task.status}`,
    `priority: ${task.priority}`,
    `risk_level: ${task.riskLevel}`,
    `execution_mode: ${task.executionMode}`,
    `agent_id: ${args.agentId}`,
    `claimed: ${claimResult ? "yes" : "no"}`,
    claimResult?.task?.leaseUntil ? `lease_until: ${claimResult.task.leaseUntil}` : null,
    `context_url: ${contextUrl}`,
    ``,
    `## Next action`,
    task.nextAction ?? "",
    ``,
    `## Definition of done`,
    task.definitionOfDone ?? "",
    ``,
    `## Required output`,
    task.requiredOutput ?? "未填写。",
    ``,
    `## Project`,
    task.project?.name ?? "未关联项目。",
    ``,
    `## Source / evidence`,
    ...(task.wikiLinks ?? []).map((link) => `- ${link.noteTitle}${link.noteUrl ? ` — ${link.noteUrl}` : ""}`),
    ...(task.artifacts ?? []).map((artifact) => `- ${artifact.title ?? artifact.type}: ${artifact.url}`),
    ``,
    `## Mandatory writeback`,
    `When the work is finished, call scripts/agent-writeback.mjs with --task-id ${task.id}.`,
  ].filter((line) => line !== null);
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const query = new URLSearchParams({
    agent_id: args.agentId,
    limit: String(args.limit),
  });
  if (args.tags) query.set("tags", args.tags);

  const inbox = await requestJson(`${args.baseUrl}/api/agent-inbox?${query}`, {
    headers: authHeaders(args.token),
  });
  const task = firstClaimable(inbox.tasks ?? [], args.taskId);
  if (!task) {
    const result = { ok: true, agentId: args.agentId, claimed: false, task: null, message: "No claimable agent_allowed tasks." };
    console.log(args.format === "json" ? JSON.stringify(result, null, 2) : "没有可接的 agent_allowed 任务。");
    return;
  }

  let claimResult = null;
  if (args.mode === "claim") {
    claimResult = await requestJson(`${args.baseUrl}/api/tasks/${encodeURIComponent(task.id)}/claim`, {
      method: "POST",
      headers: authHeaders(args.token),
      body: JSON.stringify({ agentId: args.agentId, leaseMinutes: args.leaseMinutes }),
    });
  }

  if (args.format === "json") {
    console.log(JSON.stringify({ ok: true, agentId: args.agentId, claimed: Boolean(claimResult), task, claim: claimResult?.claim }, null, 2));
  } else {
    console.log(taskBrief(claimResult?.task ?? task, args, claimResult));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
