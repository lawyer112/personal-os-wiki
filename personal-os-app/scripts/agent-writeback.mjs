#!/usr/bin/env node
import process from "node:process";

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PERSONAL_OS_BASE_URL ?? "http://localhost:3100",
    token: process.env.PERSONAL_OS_API_TOKEN,
    agentId: process.env.PERSONAL_OS_AGENT_ID ?? "obsidianmanager1",
    taskId: undefined,
    summary: undefined,
    evidenceLinks: [],
    artifactUrls: [],
    nextRecommendation: undefined,
    resultType: "artifact",
    definitionOfDoneMet: false,
    needsHumanDecision: true,
    mode: "submit",
    reviewer: "autodrive-verifier",
    reviewComment: undefined,
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
    else if (arg === "--summary") args.summary = readValue();
    else if (arg === "--evidence") args.evidenceLinks.push(readValue());
    else if (arg === "--artifact") args.artifactUrls.push(readValue());
    else if (arg === "--next") args.nextRecommendation = readValue();
    else if (arg === "--result-type") args.resultType = readValue();
    else if (arg === "--dod-met") args.definitionOfDoneMet = true;
    else if (arg === "--needs-human") args.needsHumanDecision = true;
    else if (arg === "--no-human") args.needsHumanDecision = false;
    else if (arg === "--submit") args.mode = "submit";
    else if (arg === "--contribute") args.mode = "contribute";
    else if (arg === "--approve") args.mode = "approve";
    else if (arg === "--reviewer") args.reviewer = readValue();
    else if (arg === "--comment") args.reviewComment = readValue();
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.taskId) throw new Error("--task-id is required");
  if (args.mode !== "approve" && !args.summary) throw new Error("--summary is required unless --approve is used");
  args.baseUrl = args.baseUrl.replace(/\/$/, "");
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/agent-writeback.mjs --task-id <id> --summary <text> [options]

Write an agent contribution back to Personal OS. Use --submit to move the task
to review; use --approve only from a verifier/finalizer after independent checks.

Options:
  --base-url <url>        Personal OS base URL
  --token <token>         Personal OS write token
  --agent-id <id>         Agent profile id
  --summary <text>        Work summary / evidence summary
  --evidence <url>        Evidence link, repeatable
  --artifact <url>        Artifact link, repeatable
  --next <text>           Next recommendation
  --result-type <type>    Result type, default artifact
  --dod-met               Definition of done is met
  --needs-human           Human decision still needed
  --no-human              No human decision needed
  --contribute            Add contribution only; keep lease/status
  --submit                Add contribution and move task to review (default)
  --approve               Approve a submitted review task into done
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
  const taskId = encodeURIComponent(args.taskId);
  const headers = authHeaders(args.token);
  let result;

  if (args.mode === "approve") {
    result = await requestJson(`${args.baseUrl}/api/tasks/${taskId}/review`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reviewer: args.reviewer,
        decision: "approve",
        comment: args.reviewComment ?? "Autodrive verifier approved after independent checks.",
      }),
    });
  } else if (args.mode === "contribute") {
    result = await requestJson(`${args.baseUrl}/api/tasks/${taskId}/contributions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        agentId: args.agentId,
        summary: args.summary,
        evidenceLinks: args.evidenceLinks,
        artifactUrls: args.artifactUrls,
        nextRecommendation: args.nextRecommendation,
      }),
    });
  } else {
    result = await requestJson(`${args.baseUrl}/api/tasks/${taskId}/submit`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        agentId: args.agentId,
        summary: args.summary,
        evidenceLinks: args.evidenceLinks,
        artifactUrls: args.artifactUrls,
        nextRecommendation: args.nextRecommendation,
        resultType: args.resultType,
        definitionOfDoneMet: args.definitionOfDoneMet,
        needsHumanDecision: args.needsHumanDecision,
      }),
    });
  }

  console.log(JSON.stringify({ ok: true, mode: args.mode, taskId: args.taskId, result }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
