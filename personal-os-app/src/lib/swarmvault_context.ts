import { spawn } from "node:child_process";

export type SwarmVaultContextStatus = "ok" | "empty" | "unavailable";

export type SwarmVaultContextCandidate = {
  id: string;
  title: string;
  source: "graph" | "page" | "context_pack";
  score?: number;
  path?: string;
  url?: string;
  excerpt?: string;
  matchedQueries?: string[];
  metadata?: Record<string, unknown>;
};

export type SwarmVaultContextResult = {
  status: SwarmVaultContextStatus;
  candidates: SwarmVaultContextCandidate[];
  searchedQueries: string[];
  failedQueries: {
    query: string;
    message: string;
  }[];
};

export type SwarmVaultContextClient = {
  search(query: string, limit: number): Promise<SwarmVaultContextResult>;
};

type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: {
    message?: string;
  };
};

type SwarmVaultMcpOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
};

const SWARMVAULT_MCP_TIMEOUT_MS = 5000;
const SWARMVAULT_CONTEXT_LIMIT = 5;
const MCP_PROTOCOL_VERSION = "2025-06-18";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;

const asNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const sanitizeSwarmVaultText = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(
      /\b(authorization|token|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]");

const limitText = (value: string, maxLength = 700) => {
  const sanitized = sanitizeSwarmVaultText(value);
  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  return `${sanitized.slice(0, maxLength - 1).trimEnd()}...`;
};

export const emptySwarmVaultContext = (
  searchedQueries: string[] = [],
): SwarmVaultContextResult => ({
  status: "empty",
  candidates: [],
  searchedQueries,
  failedQueries: [],
});

const unavailableSwarmVaultContext = (
  query: string,
  error: unknown,
): SwarmVaultContextResult => ({
  status: "unavailable",
  candidates: [],
  searchedQueries: [query],
  failedQueries: [
    {
      query,
      message: limitText(error instanceof Error ? error.message : String(error), 300),
    },
  ],
});

const resolveSwarmVaultCwd = (options: SwarmVaultMcpOptions) => {
  const configured = options.env?.SWARMVAULT_WORKSPACE_DIR?.trim();
  if (configured) {
    return configured;
  }

  if (options.cwd) {
    return options.cwd;
  }

  return process.cwd();
};

const decodeToolResult = (value: unknown) => {
  if (!isRecord(value)) {
    return null;
  }

  const content = Array.isArray(value.content) ? value.content : [];
  const textItem = content.find((item) => isRecord(item) && item.type === "text");
  const text = isRecord(textItem) ? asString(textItem.text) : undefined;

  if (value.isError === true) {
    throw new Error(text ? limitText(text, 500) : "SwarmVault MCP tool failed");
  }

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const callSwarmVaultMcpTool = (
  toolName: string,
  args: Record<string, unknown>,
  options: SwarmVaultMcpOptions = {},
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const child = spawn("swarmvault", ["mcp"], {
      cwd: resolveSwarmVaultCwd(options),
      env: options.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const timeoutMs = options.timeoutMs ?? SWARMVAULT_MCP_TIMEOUT_MS;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let settled = false;
    let toolCallSent = false;

    const send = (message: Record<string, unknown>) => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    const cleanup = () => {
      clearTimeout(timer);
      if (!child.killed) {
        child.kill("SIGINT");
      }
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const finish = (value: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const sendToolCall = () => {
      if (toolCallSent) {
        return;
      }
      toolCallSent = true;
      send({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      });
      send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      });
    };

    const timer = setTimeout(() => {
      fail(new Error(`SwarmVault MCP timed out while calling ${toolName}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");

      for (;;) {
        const newlineIndex = stdoutBuffer.indexOf("\n");
        if (newlineIndex < 0) {
          break;
        }

        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);

        if (!line) {
          continue;
        }

        let message: JsonRpcResponse;
        try {
          message = JSON.parse(line) as JsonRpcResponse;
        } catch (error) {
          fail(error);
          return;
        }

        if (message.id === 1) {
          if (message.error) {
            fail(new Error(message.error.message ?? "SwarmVault MCP initialize failed"));
            return;
          }
          sendToolCall();
          continue;
        }

        if (message.id === 2) {
          if (message.error) {
            fail(new Error(message.error.message ?? "SwarmVault MCP tool call failed"));
            return;
          }

          try {
            finish(decodeToolResult(message.result));
          } catch (error) {
            fail(error);
          }
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer = limitText(`${stderrBuffer}${chunk.toString("utf8")}`, 500);
    });

    child.on("error", fail);
    child.on("exit", (code, signal) => {
      if (settled) {
        return;
      }
      const exitDetail = code !== null ? `code ${code}` : `signal ${signal ?? "unknown"}`;
      const detail = stderrBuffer ? `: ${stderrBuffer}` : "";
      fail(new Error(`SwarmVault MCP exited before response (${exitDetail})${detail}`));
    });

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: "personal-os-agent-context",
          version: "0.1.0",
        },
      },
    });
  });

const graphCandidates = (
  payload: unknown,
  query: string,
): SwarmVaultContextCandidate[] => {
  if (!isRecord(payload)) {
    return [];
  }

  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  return matches
    .filter(isRecord)
    .map((match): SwarmVaultContextCandidate | null => {
      const id = asString(match.id);
      const label = asString(match.label);
      if (!id || !label) {
        return null;
      }

      const type = asString(match.type);
      return {
        id,
        title: limitText(label, 180),
        source: type === "page" ? "page" : "graph",
        score: asNumber(match.score),
        path: type === "page" ? asString(payload.topMatchPagePath) : undefined,
        excerpt: asString(payload.summary)
          ? limitText(String(payload.summary))
          : undefined,
        matchedQueries: [query],
        metadata: {
          matchType: type,
          seedNodeIds: payload.seedNodeIds,
          seedPageIds: payload.seedPageIds,
          pageIds: payload.pageIds,
        },
      } satisfies SwarmVaultContextCandidate;
    })
    .filter((candidate): candidate is SwarmVaultContextCandidate => candidate !== null);
};

const pageCandidates = (
  payload: unknown,
  query: string,
): SwarmVaultContextCandidate[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter(isRecord)
    .map((page): SwarmVaultContextCandidate | null => {
      const path = asString(page.path);
      const pageId = asString(page.pageId);
      const title = asString(page.title);
      if (!title || (!path && !pageId)) {
        return null;
      }

      return {
        id: pageId ?? `page:${path}`,
        title: limitText(title, 180),
        source: "page",
        score: asNumber(page.rank),
        path,
        excerpt: asString(page.snippet) ? limitText(String(page.snippet)) : undefined,
        matchedQueries: [query],
        metadata: {
          kind: page.kind,
          status: page.status,
          projectIds: page.projectIds,
          sourceType: page.sourceType,
          sourceClass: page.sourceClass,
        },
      } satisfies SwarmVaultContextCandidate;
    })
    .filter((candidate): candidate is SwarmVaultContextCandidate => candidate !== null);
};

const dedupeCandidates = (candidates: SwarmVaultContextCandidate[], limit: number) => {
  const byKey = new Map<string, SwarmVaultContextCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.source}:${candidate.path ?? candidate.id}`;
    const existing = byKey.get(key);
    if (!existing || (candidate.score ?? 0) > (existing.score ?? 0)) {
      byKey.set(key, candidate);
    }
  }

  return Array.from(byKey.values())
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, limit);
};

const defaultSwarmVaultClient = (
  options: SwarmVaultMcpOptions = {},
): SwarmVaultContextClient => ({
  async search(query, limit) {
    const graph = await Promise.allSettled([
      callSwarmVaultMcpTool(
        "query_graph",
        {
          question: query,
          traversal: "bfs",
          budget: Math.max(3, Math.min(50, limit)),
        },
        options,
      ),
      callSwarmVaultMcpTool(
        "search_pages",
        {
          query,
          limit: Math.min(25, limit),
        },
        options,
      ),
    ]);
    const candidates: SwarmVaultContextCandidate[] = [];
    const failedQueries: SwarmVaultContextResult["failedQueries"] = [];

    const [graphResult, pageResult] = graph;
    if (graphResult?.status === "fulfilled") {
      candidates.push(...graphCandidates(graphResult.value, query));
    } else if (graphResult) {
      failedQueries.push({
        query,
        message: limitText(
          graphResult.reason instanceof Error
            ? graphResult.reason.message
            : String(graphResult.reason),
          300,
        ),
      });
    }

    if (pageResult?.status === "fulfilled") {
      candidates.push(...pageCandidates(pageResult.value, query));
    } else if (pageResult) {
      failedQueries.push({
        query,
        message: limitText(
          pageResult.reason instanceof Error
            ? pageResult.reason.message
            : String(pageResult.reason),
          300,
        ),
      });
    }

    const deduped = dedupeCandidates(candidates, limit);
    return {
      status:
        deduped.length > 0
          ? "ok"
          : failedQueries.length > 0
            ? "unavailable"
            : "empty",
      candidates: deduped,
      searchedQueries: [query],
      failedQueries,
    };
  },
});

const shouldSkipDefaultSwarmVaultClient = (env: NodeJS.ProcessEnv) =>
  env.NODE_ENV === "test" ||
  env.VITEST === "true" ||
  env.SWARMVAULT_MCP_DISABLED === "1" ||
  env.SWARMVAULT_MCP_DISABLED === "true";

export const searchSwarmVaultContext = async (
  query: string,
  options: {
    client?: SwarmVaultContextClient;
    limit?: number;
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  } = {},
): Promise<SwarmVaultContextResult> => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return emptySwarmVaultContext([]);
  }

  const limit = options.limit ?? SWARMVAULT_CONTEXT_LIMIT;
  const client = options.client;
  if (client) {
    try {
      return await client.search(normalizedQuery, limit);
    } catch (error) {
      return unavailableSwarmVaultContext(normalizedQuery, error);
    }
  }

  const env = options.env ?? process.env;
  if (shouldSkipDefaultSwarmVaultClient(env)) {
    return emptySwarmVaultContext([normalizedQuery]);
  }

  try {
    return await defaultSwarmVaultClient({
      cwd: options.cwd,
      env,
    }).search(normalizedQuery, limit);
  } catch (error) {
    return unavailableSwarmVaultContext(normalizedQuery, error);
  }
};
