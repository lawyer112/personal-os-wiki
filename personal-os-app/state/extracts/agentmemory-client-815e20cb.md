export type AgentMemoryContextHit = {
  id: string;
  title: string;
  summary: string;
  relevanceScore: number;
  createdAt?: string;
  sessionId?: string;
  memoryType?: string;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type AgentMemorySearchOptions = {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  limit?: number;
  timeoutMs?: number;
};

const DEFAULT_AGENTMEMORY_LIMIT = 5;
const MAX_AGENTMEMORY_LIMIT = 10;
const DEFAULT_AGENTMEMORY_TIMEOUT_MS = 1_500;
const MAX_AGENTMEMORY_TIMEOUT_MS = 5_000;
const MAX_AGENTMEMORY_QUERY_LENGTH = 500;
const MAX_AGENTMEMORY_TITLE_LENGTH = 180;

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

const isAgentMemoryEnabled = () =>
  process.env.AGENT_CONTEXT_AGENTMEMORY_ENABLED === "true";

const buildAgentMemoryEndpoint = (baseUrl: string) =>
  `${baseUrl.replace(/\/+$/, "")}/agentmemory/smart-search`;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;

const asString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const asNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
};

const toRelevanceScore = (score: unknown) => {
  const numericScore = asNumber(score);
  if (numericScore === undefined) {
    return 1;
  }

  if (numericScore > 1) {
    return Math.round(numericScore);
  }

  return Math.max(1, Math.round(numericScore * 1_000));
};

const hitToContextHit = (hit: unknown): AgentMemoryContextHit | null => {
  const record = asRecord(hit);
  if (record === undefined) {
    return null;
  }

  const id = asString(record.obsId) ?? asString(record.id);
  if (id === undefined) {
    return null;
  }

  const memoryType = asString(record.type);
  const sessionId = asString(record.sessionId);
  const title = truncateText(
    asString(record.title) ?? `agentmemory ${id}`,
    MAX_AGENTMEMORY_TITLE_LENGTH,
  );
  const summaryParts = [
    memoryType ? `agentmemory:${memoryType}` : "agentmemory",
    sessionId ? `session:${sessionId}` : undefined,
  ].filter(Boolean);

  return {
    id,
    title,
    summary: summaryParts.join(" "),
    relevanceScore: toRelevanceScore(record.score),
    createdAt: asString(record.timestamp),
    sessionId,
    memoryType,
  };
};

const fetchWithTimeout = async (
  fetchImpl: FetchLike,
  endpoint: string,
  query: string,
  limit: number,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    return await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
};

export const searchAgentMemoryEpisodes = async (
  query: string,
  options: AgentMemorySearchOptions = {},
): Promise<AgentMemoryContextHit[]> => {
  const baseUrl = options.baseUrl ?? getOptionalEnv("AGENT_CONTEXT_AGENTMEMORY_URL");
  const enabled =
    options.baseUrl !== undefined ? true : isAgentMemoryEnabled();
  const trimmedQuery = query.trim().replace(/\s+/g, " ");

  if (!enabled || baseUrl === undefined || trimmedQuery.length === 0) {
    return [];
  }

  const limit = getPositiveInteger(
    options.limit?.toString() ?? getOptionalEnv("AGENT_CONTEXT_AGENTMEMORY_LIMIT"),
    DEFAULT_AGENTMEMORY_LIMIT,
    MAX_AGENTMEMORY_LIMIT,
  );
  const timeoutMs = getPositiveInteger(
    options.timeoutMs?.toString() ??
      getOptionalEnv("AGENT_CONTEXT_AGENTMEMORY_TIMEOUT_MS"),
    DEFAULT_AGENTMEMORY_TIMEOUT_MS,
    MAX_AGENTMEMORY_TIMEOUT_MS,
  );
  const endpoint = buildAgentMemoryEndpoint(baseUrl);

  try {
    const response = await fetchWithTimeout(
      options.fetchImpl ?? fetch,
      endpoint,
      trimmedQuery.slice(0, MAX_AGENTMEMORY_QUERY_LENGTH),
      limit,
      timeoutMs,
    );
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as unknown;
    const results = asRecord(payload)?.results;
    if (!Array.isArray(results)) {
      return [];
    }

    return results.flatMap((hit) => {
      const contextHit = hitToContextHit(hit);
      return contextHit === null ? [] : [contextHit];
    });
  } catch {
    return [];
  }
};
