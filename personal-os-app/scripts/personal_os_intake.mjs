#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const parseArgs = (argv) => {
  const args = {
    baseUrl: process.env.PERSONAL_OS_BASE_URL,
    token: process.env.PERSONAL_OS_API_TOKEN,
    readToken: process.env.PERSONAL_OS_READ_TOKEN,
    payloadFile: undefined,
    sourceType: "agent-output",
    sourcePlatform: "codex",
    rawText: undefined,
    model: "codex",
    projectName: undefined,
    verifyQuery: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === "--base-url") args.baseUrl = readValue();
    else if (arg === "--token") args.token = readValue();
    else if (arg === "--read-token") args.readToken = readValue();
    else if (arg === "--payload") args.payloadFile = readValue();
    else if (arg === "--source-type") args.sourceType = readValue();
    else if (arg === "--source-platform") args.sourcePlatform = readValue();
    else if (arg === "--text") args.rawText = readValue();
    else if (arg === "--model") args.model = readValue();
    else if (arg === "--project") args.projectName = readValue();
    else if (arg === "--verify-query") args.verifyQuery = readValue();
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.baseUrl) {
    throw new Error("PERSONAL_OS_BASE_URL or --base-url is required");
  }
  args.baseUrl = args.baseUrl.replace(/\/$/, "");
  return args;
};

const helpText = `Usage:
  node scripts/personal_os_intake.mjs --base-url <url> --text <summary> [options]
  node scripts/personal_os_intake.mjs --base-url <url> --payload <payload.json> [options]

The helper always normalizes source to the current /api/intake object contract.
It never prints tokens. Source the approved environment file before running it.

Options:
  --payload <path>           Optional JSON payload with tasks/ideas/wikiNotes/events
  --source-type <type>      Default agent-output
  --source-platform <name>  Default codex
  --text <text>             Source rawText when the payload does not provide it
  --model <name>            Agent model label, default codex
  --project <name>          Project container name
  --verify-query <query>    Read back context after a successful write
`;

const parsePayloadFile = async (path) => {
  if (!path) return {};
  const content = await readFile(path, "utf8");
  return JSON.parse(content);
};

export const buildIntakePayload = (args, payload = {}) => {
  const legacySource = typeof payload.source === "string" ? payload.source : undefined;
  const source =
    payload.source && typeof payload.source === "object" && !Array.isArray(payload.source)
      ? payload.source
      : {};
  const rawText = source.rawText ?? args.rawText ?? legacySource;
  if (!rawText) {
    throw new Error("source.rawText, --text, or a legacy source string is required");
  }

  return {
    ...payload,
    source: {
      ...source,
      sourceType: source.sourceType ?? args.sourceType,
      sourcePlatform: source.sourcePlatform ?? args.sourcePlatform,
      rawText,
      attachments: source.attachments ?? [],
      createdBy: source.createdBy ?? "codex",
    },
    agent: {
      model: args.model,
      ...(payload.agent ?? {}),
    },
    ...(args.projectName
      ? { project: { ...(payload.project ?? {}), name: args.projectName } }
      : {}),
  };
};

const requestJson = async (url, token, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { ok: false, error: text || response.statusText };
  }

  if (!response.ok || body?.ok === false) {
    const issues = Array.isArray(body?.issues)
      ? body.issues.map((issue) => `${issue.path?.join(".") ?? "body"}: ${issue.message}`).join("; ")
      : undefined;
    throw new Error(
      `${init.method ?? "GET"} ${new URL(url).pathname} failed (${response.status}): ${issues ?? body?.error ?? response.statusText}`,
    );
  }
  return body;
};

export const runIntake = async (args) => {
  const payload = buildIntakePayload(args, await parsePayloadFile(args.payloadFile));
  const result = await requestJson(`${args.baseUrl}/api/intake`, args.token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const output = {
    ok: true,
    inboxId: result.inbox?.id,
    agentRunId: result.agentRunId,
    taskIds: (result.tasks ?? []).map((task) => task.id),
    taskProposalIds: (result.taskProposals ?? []).map((task) => task.id),
    wikiWriteStatus: result.wiki_write_status,
  };

  if (args.verifyQuery) {
    const verifyToken = args.readToken ?? args.token;
    const params = new URLSearchParams({ q: args.verifyQuery });
    const verified = await requestJson(
      `${args.baseUrl}/api/agent/context?${params.toString()}`,
      verifyToken,
    );
    output.verification = {
      query: args.verifyQuery,
      memoryItemCount: verified.context?.memoryItems?.length ?? 0,
      wikiCandidateCount: verified.context?.wiki?.candidates?.length ?? 0,
    };
  }

  return output;
};

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(helpText);
    } else {
      console.log(JSON.stringify(await runIntake(args), null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
