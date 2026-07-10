#!/usr/bin/env node
import process from "node:process";

const smokeSteps = [
  "upsert profile",
  "intake create task",
  "agent inbox before claim",
  "claim task",
  "heartbeat task",
  "write contribution",
  "submit task",
  "review archive",
  "read final task",
  "agent inbox after archive",
];

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PERSONAL_OS_BASE_URL ?? "http://localhost:3100",
    token: process.env.PERSONAL_OS_API_TOKEN,
    agentId: process.env.PERSONAL_OS_AGENT_ID ?? "codex-e2e-verifier",
    tag: process.env.PERSONAL_OS_SMOKE_TAG ?? "codex-e2e-test",
    projectName: "Personal OS / Wiki 知识库升级",
    leaseMinutes: Number(process.env.PERSONAL_OS_AGENT_LEASE_MINUTES ?? 30),
    reviewer: "codex-e2e-verifier",
    dryRun: false,
    format: "markdown",
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
    else if (arg === "--tag") args.tag = readValue();
    else if (arg === "--project-name") args.projectName = readValue();
    else if (arg === "--lease-minutes") args.leaseMinutes = Number(readValue());
    else if (arg === "--reviewer") args.reviewer = readValue();
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--json") args.format = "json";
    else if (arg === "--markdown") args.format = "markdown";
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.leaseMinutes) || args.leaseMinutes < 1 || args.leaseMinutes > 1440) {
    throw new Error("--lease-minutes must be between 1 and 1440");
  }
  args.baseUrl = args.baseUrl.replace(/\/$/, "");
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/agent-protocol-smoke.mjs [options]

Run a live Personal OS task protocol smoke test:
profile -> intake -> inbox -> claim -> heartbeat -> contribution -> submit -> review archive.

Options:
  --base-url <url>          Personal OS base URL
  --token <token>           Personal OS write token
  --agent-id <id>           Temporary/verifier agent profile id
  --tag <tag>               Agent/task tag for the synthetic task
  --project-name <name>     Project name to attach the smoke task
  --lease-minutes <n>       Lease length, 1-1440 minutes
  --reviewer <id>           Reviewer id used for final archive review
  --dry-run                 Print the step plan without network calls
  --json                    Print JSON output
`);
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: ["Bearer", token].join(" ") } : {}),
  };
}

async function requestJson(args, name, path, options = {}) {
  const response = await fetch(`${args.baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: authHeaders(args.token),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { ok: false, error: text };
  }
  const step = { name, status: response.status, ok: response.ok };
  if (!response.ok || body?.ok === false) {
    const error = body?.error ?? response.statusText;
    const failure = new Error(`${name} failed: ${response.status} ${error}`);
    failure.step = step;
    failure.body = body;
    throw failure;
  }
  return { step, body };
}

function dryRunResult(args) {
  return {
    ok: true,
    dryRun: true,
    baseUrl: args.baseUrl,
    agentId: args.agentId,
    tag: args.tag,
    steps: smokeSteps.map((name) => ({ name })),
  };
}

function printResult(result, format) {
  if (format === "json") {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const lines = [
    "# Personal OS Agent Protocol Smoke",
    "",
    `ok: ${result.ok}`,
    `dry_run: ${Boolean(result.dryRun)}`,
    result.taskId ? `task_id: ${result.taskId}` : null,
    result.finalStatus ? `final_status: ${result.finalStatus}` : null,
    "",
    "## Steps",
    ...result.steps.map((step) => `- ${step.name}: ${step.status ?? "planned"}${step.ok === undefined ? "" : step.ok ? " ok" : " failed"}`),
  ].filter(Boolean);
  console.log(lines.join("\n"));
}

function smokeIntakeBody(args, title) {
  return {
    source: {
      sourceType: "agent-smoke-test",
      sourcePlatform: "codex",
      rawText: "Synthetic smoke test for Personal OS task protocol. Archive after verification.",
      attachments: [],
      createdBy: "codex",
    },
    agent: {
      model: "codex-local-smoke",
      classification: { kind: "task_protocol_smoke", temporary: true },
      reasoningSummary: "Verify claim, heartbeat, contribution, submit, and review archive on the live Personal OS API.",
    },
    project: {
      name: args.projectName,
      status: "active",
      priority: "P0",
      currentFocus: "Verify task board, Wiki linkage, agent protocol, and context recall loops.",
    },
    wikiNotes: [],
    tasks: [
      {
        title,
        description: "Temporary synthetic task for live API protocol validation.",
        status: "todo",
        priority: "P3",
        riskLevel: "low",
        executionMode: "agent_allowed",
        agentTags: [args.tag],
        requiredOutput: "Protocol smoke result in contribution trail.",
        nextAction: "Claim, heartbeat, contribute, submit, and archive through review.",
        definitionOfDone: "Live API returns success for each protocol transition and final task status is archived.",
        estimateMinutes: 5,
        wikiLinks: [],
        createdBy: "codex",
      },
    ],
  };
}

async function runSmoke(args) {
  if (!args.token) {
    throw new Error("PERSONAL_OS_API_TOKEN or --token is required unless --dry-run is used");
  }

  const steps = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const title = `Codex E2E task protocol smoke ${stamp}`;
  const call = async (...callArgs) => {
    const result = await requestJson(args, ...callArgs);
    steps.push(result.step);
    return result.body;
  };

  await call("upsert profile", "/api/agent-profiles", {
    method: "POST",
    body: {
      id: args.agentId,
      displayName: "Codex E2E Verifier",
      tags: [args.tag, "personal-os"],
      capabilities: ["read_context", "claim_task", "heartbeat", "write_contribution", "submit_review"],
      allowedRiskLevel: "low",
      canWriteWiki: false,
      canWriteTasks: true,
      canTouchFiles: false,
      canSendNotifications: false,
      enabled: true,
    },
  });
  const intake = await call("intake create task", "/api/intake", {
    method: "POST",
    body: smokeIntakeBody(args, title),
  });
  const task = intake.tasks?.[0];
  if (!task?.id) throw new Error("intake did not return a task id");

  const inboxPath = `/api/agent-inbox?agent_id=${encodeURIComponent(args.agentId)}&tags=${encodeURIComponent(args.tag)}&limit=10`;
  await call("agent inbox before claim", inboxPath);
  await call("claim task", `/api/tasks/${encodeURIComponent(task.id)}/claim`, {
    method: "POST",
    body: { agentId: args.agentId, leaseMinutes: args.leaseMinutes },
  });
  await call("heartbeat task", `/api/tasks/${encodeURIComponent(task.id)}/heartbeat`, {
    method: "POST",
    body: { agentId: args.agentId, leaseMinutes: args.leaseMinutes },
  });
  await call("write contribution", `/api/tasks/${encodeURIComponent(task.id)}/contributions`, {
    method: "POST",
    body: {
      agentId: args.agentId,
      summary: "Live smoke test reached claimed + heartbeat state successfully.",
      evidenceLinks: [`personal-os-task://${task.id}`],
      artifactUrls: [],
      nextRecommendation: "Archive this synthetic smoke task after submit/review.",
    },
  });
  await call("submit task", `/api/tasks/${encodeURIComponent(task.id)}/submit`, {
    method: "POST",
    body: {
      agentId: args.agentId,
      summary: "Live smoke test completed all worker-side protocol calls.",
      evidenceLinks: [`personal-os-task://${task.id}`],
      artifactUrls: [],
      resultType: "smoke-test",
      definitionOfDoneMet: true,
      needsHumanDecision: false,
      nextRecommendation: "Archive test task.",
    },
  });
  const review = await call("review archive", `/api/tasks/${encodeURIComponent(task.id)}/review`, {
    method: "POST",
    body: {
      reviewer: args.reviewer,
      decision: "archive",
      comment: "Synthetic smoke task archived after successful protocol verification.",
    },
  });
  const finalTask = await call("read final task", `/api/tasks/${encodeURIComponent(task.id)}`);
  const inboxAfter = await call("agent inbox after archive", inboxPath);

  return {
    ok: true,
    dryRun: false,
    taskId: task.id,
    title,
    reviewStatus: review.task?.status,
    finalStatus: finalTask.task?.status,
    inboxAfterContainsTask: Boolean(inboxAfter.tasks?.some((item) => item.id === task.id)),
    steps,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = args.dryRun ? dryRunResult(args) : await runSmoke(args);
  printResult(result, args.format);
}

main().catch((error) => {
  const failure = {
    ok: false,
    error: error.message,
    failedStep: error.step,
  };
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
});
