export type RecallSource =
  | {
      track: "user";
      user_id: string;
    }
  | {
      track: "agent";
      agent_id: string;
    }
  | {
      track: "wiki";
      wiki_path: string;
    }
  | {
      track: "source";
      source_id: string;
    };

export type MemoryProvenance = {
  backend_id: string;
  retrieval_source: string;
  evidence_id?: string;
  source_url?: string;
  created_at?: string;
  title?: string;
};

export type MemorySource = {
  id: string;
  text: string;
  score: number;
  recallSource: RecallSource;
  provenance: MemoryProvenance;
  backendMetadata?: Record<string, unknown>;
};

export type ReadOnlyMemoryRecallRequest = {
  query: string;
  source: RecallSource;
  topK: number;
};

export type ReadOnlyMemoryAdapter = {
  recall(request: ReadOnlyMemoryRecallRequest): Promise<MemorySource[]>;
};

export const recallSourceMatches = (
  left: RecallSource,
  right: RecallSource,
) => {
  if (left.track !== right.track) {
    return false;
  }

  if (left.track === "user" && right.track === "user") {
    return left.user_id === right.user_id;
  }

  if (left.track === "agent" && right.track === "agent") {
    return left.agent_id === right.agent_id;
  }

  if (left.track === "wiki" && right.track === "wiki") {
    return left.wiki_path === right.wiki_path;
  }

  if (left.track === "source" && right.track === "source") {
    return left.source_id === right.source_id;
  }

  return false;
};

const recallStopWords = new Set([
  "agent",
  "api",
  "context",
  "memory",
  "os",
  "personal",
  "wiki",
  "上下文",
  "知识库",
  "记忆",
]);

const recallTokens = (query: string) => {
  const tokens = new Set<string>();
  const normalized = query.trim().toLowerCase();

  for (const token of normalized.match(/[a-z0-9][a-z0-9_.-]{1,}/g) ?? []) {
    if (!recallStopWords.has(token)) {
      tokens.add(token);
    }
  }

  for (const sequence of normalized.match(/[\p{Script=Han}]{2,}/gu) ?? []) {
    if (!recallStopWords.has(sequence)) {
      tokens.add(sequence);
    }
    for (let index = 0; index < sequence.length - 1; index += 1) {
      const token = sequence.slice(index, index + 2);
      if (!recallStopWords.has(token)) {
        tokens.add(token);
      }
    }
  }

  return Array.from(tokens);
};

const recallTextScore = (source: MemorySource, tokens: string[]) => {
  if (tokens.length === 0) {
    return source.score;
  }

  const text = source.text.toLowerCase();
  const matches = tokens.filter((token) => text.includes(token)).length;
  return matches === 0 ? 0 : source.score + matches * 10;
};

export const createReadOnlyMemoryAdapter = (
  sources: readonly MemorySource[],
): ReadOnlyMemoryAdapter => ({
  recall: async ({ query, source, topK }) => {
    const tokens = recallTokens(query);
    const limit = Math.max(0, Math.floor(topK));

    return sources
      .filter((candidate) => recallSourceMatches(candidate.recallSource, source))
      .map((candidate) => ({
        candidate,
        score: recallTextScore(candidate, tokens),
      }))
      .filter(({ score }) => tokens.length === 0 || score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.candidate.id.localeCompare(right.candidate.id);
      })
      .slice(0, limit)
      .map(({ candidate }) => candidate);
  },
});
