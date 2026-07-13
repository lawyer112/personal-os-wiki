import { spawn } from "node:child_process";

export type SwarmVaultContextHit = {
  id: string;
  title: string;
  summary: string;
  relevanceScore: number;
  type: "file" | "symbol" | "reference";
  filePath?: string;
  lineNumber?: number;
};

type SwarmVaultSearchOptions = {
  projectRoot?: string;
  limit?: number;
  timeoutMs?: number;
};

const DEFAULT_SWARMVAULT_LIMIT = 5;
const MAX_SWARMVAULT_LIMIT = 10;
const DEFAULT_SWARMVAULT_TIMEOUT_MS = 2_000;
const MAX_SWARMVAULT_TIMEOUT_MS = 5_000;
const MAX_SWARMVAULT_QUERY_LENGTH = 500;

const getOptionalEnv = (name: string) => {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value.trim();
};

const getPositiveInteger = (
  value: string | undefined,
  fallback: number,
  max: number,
) => {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.trunc(parsed), max);
};

const isSwarmVaultEnabled = () =>
  process.env.AGENT_CONTEXT_SWARMVAULT_ENABLED === "true";

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const asString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const asNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/**
 * Send a single JSON-RPC request to a swarmvault MCP process over stdio
 * and collect the response. The process is started fresh for each call
 * (stateless, no long-lived daemon needed).
 */
async function callSwarmVaultMcp(
  method: string,
  params: Record<string, unknown>,
  opts: { projectRoot?: string; timeoutMs: number },
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const projectRoot =
      opts.projectRoot ??
      getOptionalEnv("AGENT_CONTEXT_SWARMVAULT_PROJECT_ROOT") ??
      process.cwd();

    const child = spawn("swarmvault", ["mcp"], {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;

    const done = (err?: Error, result?: unknown) => {
      if (timer !== undefined) clearTimeout(timer);
      child.stdin.destroy();
      child.kill();
      if (err) reject(err);
      else resolve(result);
    };

    timer = setTimeout(() => {
      done(new Error("SwarmVault MCP timeout"));
    }, opts.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      // Each MCP response is a newline-delimited JSON object
      const lines = stdout.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed) as unknown;
          const record = asRecord(msg);
          // JSON-RPC 2.0: look for a response with an id
          if (record && "result" in record) {
            done(undefined, record.result);
            return;
          }
          if (record && "error" in record) {
            const errorRecord = asRecord(record.error);
            done(
              new Error(
                asString(errorRecord?.message) ?? "SwarmVault MCP error",
              ),
            );
            return;
          }
        } catch {
          // not yet a complete JSON line — keep buffering
        }
      }
    });

    child.on("error", (err) => done(err));
    child.on("close", (code) => {
      if (code !== 0) {
        done(new Error(`SwarmVault MCP exited with code ${code}`));
      }
    });

    // Send JSON-RPC initialise then tools/call
    const initMsg = JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "personal-os", version: "1.0.0" },
      },
    });
    const callMsg = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: method, arguments: params },
    });

    child.stdin.write(initMsg + "\n");
    child.stdin.write(callMsg + "\n");
  });
}

function mapSwarmVaultHit(raw: unknown): SwarmVaultContextHit | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = asString(record.id) ?? asString(record.path);
  if (!id) return null;

  const title =
    asString(record.title) ??
    asString(record.name) ??
    asString(record.path) ??
    `swarmvault:${id}`;
  const filePath = asString(record.path) ?? asString(record.filePath);
  const lineNumber =
    asNumber(record.line) ??
    asNumber(record.lineNumber) ??
    asNumber(record.startLine);
  const rawType = asString(record.type) ?? "file";
  const type: SwarmVaultContextHit["type"] =
    rawType === "symbol" || rawType === "reference" ? rawType : "file";

  const rawScore = asNumber(record.score) ?? asNumber(record.relevance) ?? 0;
  const relevanceScore =
    rawScore > 1
      ? Math.round(rawScore)
      : Math.max(1, Math.round(rawScore * 1_000));

  const summaryParts = [
    `swarmvault:${type}`,
    filePath ? `file:${filePath}` : undefined,
    lineNumber !== undefined ? `line:${lineNumber}` : undefined,
  ].filter(Boolean);

  return {
    id,
    title: title.slice(0, 200),
    summary: summaryParts.join(" "),
    relevanceScore,
    type,
    filePath,
    lineNumber,
  };
}

/**
 * Search SwarmVault via MCP context tool.
 * Falls back to empty array when disabled or on any error.
 */
export async function searchSwarmVaultContext(
  query: string,
  options: SwarmVaultSearchOptions = {},
): Promise<SwarmVaultContextHit[]> {
  const enabled =
    options.projectRoot !== undefined ? true : isSwarmVaultEnabled();
  const trimmedQuery = query.trim().replace(/\s+/g, " ");

  if (!enabled || trimmedQuery.length === 0) {
    return [];
  }

  const limit = getPositiveInteger(
    options.limit?.toString() ??
      getOptionalEnv("AGENT_CONTEXT_SWARMVAULT_LIMIT"),
    DEFAULT_SWARMVAULT_LIMIT,
    MAX_SWARMVAULT_LIMIT,
  );

  const timeoutMs = getPositiveInteger(
    options.timeoutMs?.toString() ??
      getOptionalEnv("AGENT_CONTEXT_SWARMVAULT_TIMEOUT_MS"),
    DEFAULT_SWARMVAULT_TIMEOUT_MS,
    MAX_SWARMVAULT_TIMEOUT_MS,
  );

  try {
    const result = await callSwarmVaultMcp(
      "context",
      { query: trimmedQuery.slice(0, MAX_SWARMVAULT_QUERY_LENGTH), limit },
      { projectRoot: options.projectRoot, timeoutMs },
    );

    const record = asRecord(result);
    const hits = Array.isArray(record?.results)
      ? (record.results as unknown[])
      : Array.isArray(result)
        ? (result as unknown[])
        : [];

    return hits.flatMap((hit) => {
      const mapped = mapSwarmVaultHit(hit);
      return mapped === null ? [] : [mapped];
    });
  } catch {
    return [];
  }
}
