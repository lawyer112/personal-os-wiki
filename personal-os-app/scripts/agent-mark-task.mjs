#!/usr/bin/env node
import process from "node:process";

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PERSONAL_OS_BASE_URL ?? "http://localhost:3100",
    token: process.env.PERSONAL_OS_API_TOKEN,
    taskId: undefined,
    status: undefined,
    nextAction: undefined,
    definitionOfDone: undefined,
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
    else if (arg === "--task-id") args.taskId = readValue();
    else if (arg === "--status") args.status = readValue();
    else if (arg === "--next") args.nextAction = readValue();
    else if (arg === "--definition-of-done") args.definitionOfDone = readValue();
    else if (arg === "--done") args.status = "done";
    else if (arg === "--blocked") args.status = "blocked";
    else if (arg === "--waiting") args.status = "waiting";
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.taskId) throw new Error("--task-id is required");
  if (!args.status && !args.nextAction && !args.definitionOfDone) {
    throw new Error("Provide --status/--done/--blocked/--waiting or a field update");
  }
  args.baseUrl = args.baseUrl.replace(/\/$/, "");
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/agent-mark-task.mjs --task-id <id> --done

Operator helper for reconciling tasks that were completed outside the agent
claim/submit/review protocol, for example a GitHub PR that was merged manually.
This uses PATCH /api/tasks/:id and records the normal Personal OS activity log.

Options:
  --base-url <url>              Personal OS base URL
  --token <token>               Personal OS write token
  --task-id <id>                Task id
  --status <status>             review|todo|doing|waiting|blocked|done|archived
  --done                        Shortcut for --status done
  --blocked                     Shortcut for --status blocked
  --waiting                     Shortcut for --status waiting
  --next <text>                 Update nextAction
  --definition-of-done <text>   Update definitionOfDone
`);
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: ["Bearer", token].join(" ") } : {}),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const body = {};
  if (args.status) body.status = args.status;
  if (args.nextAction) body.nextAction = args.nextAction;
  if (args.definitionOfDone) body.definitionOfDone = args.definitionOfDone;

  const response = await fetch(`${args.baseUrl}/api/tasks/${encodeURIComponent(args.taskId)}`, {
    method: "PATCH",
    headers: authHeaders(args.token),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, error: text };
  }
  if (!response.ok || data?.ok === false) {
    throw new Error(`PATCH task failed: ${response.status} ${data?.error ?? response.statusText}`);
  }
  console.log(JSON.stringify({ ok: true, task: data.task }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
