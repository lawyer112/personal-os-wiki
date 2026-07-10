import { readFile } from "node:fs/promises";

import { HttpError } from "@/lib/http";
import {
  createReadOnlyMemoryAdapter,
  type MemoryProvenance,
  type MemorySource as BackendMemorySource,
  type RecallSource,
} from "@/lib/memory_backend_contract";
import {
  emptySwarmVaultContext,
  searchSwarmVaultContext,
  type SwarmVaultContextCandidate,
  type SwarmVaultContextClient,
  type SwarmVaultContextResult,
} from "@/lib/swarmvault_context";
import {
  readWikiNote,
  searchWikiNotes,
  wikiNoteUrl,
  type WikiContextCandidate,
  type WikiNoteDocument,
  type WikiNoteSummary,
} from "@/lib/wiki-client";

type ContextDb = {
  task: unknown;
  idea?: unknown;
  activityLog: unknown;
  projectEvent?: unknown;
  sourceRegistry?: SourceRegistryClient;
};

type TaskRecord = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  riskLevel?: string;
  executionMode?: string;
  agentTags?: string[];
  ownerAgent?: string | null;
  leaseUntil?: Date | string | null;
  lastHeartbeatAt?: Date | string | null;
  requiredOutput?: string | null;
  nextAction: string;
  definitionOfDone: string;
  projectId?: string | null;
  sourceInboxItemId?: string | null;
  sourceAgentRunId?: string | null;
  project?: {
    id: string;
    name: string;
    goal?: string | null;
    status?: string;
    currentFocus?: string | null;
  } | null;
  sourceInboxItem?: {
    rawText?: string | null;
    sourceType?: string | null;
    sourcePlatform?: string | null;
    sourceUrl?: string | null;
  } | null;
  sourceAgentRun?: {
    model?: string | null;
    reasoningSummary?: string | null;
    outputSummary?: string | null;
  } | null;
  wikiLinks?: {
    noteTitle: string;
    notePath?: string | null;
    noteUrl?: string | null;
    sourceType?: string | null;
  }[];
  contributions?: {
    agentId: string;
    summary: string;
    evidenceLinks?: string[];
    artifactUrls?: string[];
    nextRecommendation?: string | null;
    createdAt?: Date | string;
  }[];
  artifacts?: {
    type: string;
    title?: string | null;
    url: string;
    verification?: string;
    createdAt?: Date | string;
  }[];
  reviews?: {
    reviewer: string;
    decision: string;
    comment?: string | null;
    createdAt?: Date | string;
  }[];
};

type ActivityRecord = {
  id: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt?: Date | string;
};

type QueryAgentRunRecord = {
  id: string;
  model?: string | null;
  status?: string | null;
  reasoningSummary?: string | null;
  outputSummary?: string | null;
  error?: string | null;
  startedAt?: Date | string;
  completedAt?: Date | string | null;
  inboxItem?: {
    rawText?: string | null;
    sourceUrl?: string | null;
  } | null;
};

type QueryInboxRecord = {
  id: string;
  rawText?: string | null;
  sourceType?: string | null;
  sourcePlatform?: string | null;
  sourceUrl?: string | null;
  receivedAt?: Date | string;
};

type QueryProjectEventRecord = {
  id: string;
  title: string;
  body?: string | null;
  eventType?: string | null;
  createdAt?: Date | string;
  project?: { id: string; name: string } | null;
  sourceInboxItem?: {
    rawText?: string | null;
    sourceUrl?: string | null;
  } | null;
  sourceAgentRun?: {
    model?: string | null;
    reasoningSummary?: string | null;
    outputSummary?: string | null;
  } | null;
};

type IdeaContextRecord = {
  id: string;
  title: string;
  body?: string | null;
  status: string;
  priority: string;
  nextAction?: string | null;
  project?: { id: string; name: string } | null;
};

type SourceRegistryCandidate = {
  id: string;
  title: string;
  summary: string;
  score?: number;
  sourceUrl?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
};

type SourceRegistryResult = {
  status: "ok" | "empty" | "unavailable";
  candidates: SourceRegistryCandidate[];
  searchedQueries: string[];
  failedQueries: {
    query: string;
    message: string;
  }[];
};

type SourceRegistryClient = {
  search(query: string, limit: number): Promise<SourceRegistryResult>;
};

export type WikiContextStatus = "ok" | "empty" | "partial" | "unavailable";

export type WikiContextSearchResult = {
  status: WikiContextStatus;
  candidates: WikiContextCandidate[];
  searchedQueries: string[];
  successfulQueries: number;
  failedQueries: {
    query: string;
    message: string;
  }[];
};

export type AgentContextPolicy = {
  canReadWiki: boolean;
  canSuggestWikiUpdates: boolean;
  canAutoArchiveKnowledge: boolean;
  mustConfirmDelete: boolean;
  maxWikiCandidates: number;
  note: string;
};

type AgentContextCitationType =
  | "agent_run"
  | "task"
  | "wiki"
  | "activity"
  | "inbox"
  | "idea"
  | "project_event"
  | "source_registry"
  | "swarmvault"
  | "policy";

export type AgentContextCitation = {
  id: string;
  type: AgentContextCitationType;
  title: string;
  evidenceId?: string;
  path?: string;
  sourceUrl?: string;
  source?: SwarmVaultContextCandidate["source"];
  recallSource?: RecallSource;
  provenance?: MemoryProvenance;
  backendMetadata?: Record<string, unknown>;
};

export type AgentContextTierItem = {
  type: "task" | "wiki" | "idea" | "activity" | "swarmvault" | "policy";
  reason: string;
  id?: string;
  title?: string;
  source?: SwarmVaultContextCandidate["source"];
  status?: string;
  priority?: string;
  path?: string;
  url?: string;
  score?: number;
  excerpt?: string;
  matchedQueries?: string[];
  action?: string;
  targetType?: string;
  targetId?: string;
  projectName?: string;
  ownerAgent?: string | null;
  leaseUntil?: Date | string | null;
  nextAction?: string | null;
  definitionOfDone?: string | null;
  cited?: AgentContextCitation[];
};

export type AgentContextTierArchivedReference = {
  id: string;
  type: AgentContextTierItem["type"];
  title: string;
  reason: "tier_token_budget_exceeded";
  estimatedTokens: number;
  retrieve: {
    evidenceId?: string;
    path?: string;
    sourceUrl?: string;
    source?: SwarmVaultContextCandidate["source"];
    targetType?: string;
    targetId?: string;
  };
};

export type AgentContextTier = {
  items: AgentContextTierItem[];
  tokenBudget: number;
  usedTokens: number;
  remainingTokens: number;
  itemCount: number;
  archivedCount: number;
  archived: AgentContextTierArchivedReference[];
};

export type AgentContextTiers = {
  hot: AgentContextTier;
  warm: AgentContextTier;
  cold: AgentContextTier;
};

export type ContextEpisode = {
  type: "agent_run" | "task" | "wiki" | "activity" | "inbox";
  id: string;
  title: string;
  summary: string;
  relevanceScore: number;
  sourceUrl?: string;
  createdAt?: string;
};

export type AgentMemoryItem = {
  id: string;
  type:
    | "agent_run"
    | "task"
    | "wiki"
    | "activity"
    | "inbox"
    | "idea"
    | "project_event"
    | "source_registry"
    | "swarmvault";
  title: string;
  summary: string;
  tier: "hot" | "warm" | "cold";
  score: number;
  keywordScore: number;
  semanticScore: number;
  tokenEstimate: number;
  evidenceId?: string;
  sourceUrl?: string;
  createdAt?: string;
  recallSource: RecallSource;
  provenance: MemoryProvenance;
  backendMetadata?: Record<string, unknown>;
  metadata: {
    path?: string;
    status?: string;
    priority?: string;
    sourceType?: string;
    projectName?: string;
    matchedQueries?: string[];
    tags?: string[];
    concepts?: string[];
    source?: string;
    sourceWeights?: Record<string, number>;
    contributing_sources?: string[];
    dedupReason?: string;
    dedupKey?: string;
    rrfScore?: number;
    fusionScore?: number;
    sourceRanks?: Record<string, number>;
    required?: boolean;
    memoryId?: string;
    version?: number;
    chunkId?: string;
  };
  flags: {
    isStale: boolean;
    isExpired: boolean;
    hasConflict: boolean;
  };
};

export type AgentContextTokenBudget = {
  maxTokens: number;
  reservedTokens: number;
  estimatedTokens: number;
  remainingTokens: number;
  itemCount: number;
};

export type AgentContextBudget = {
  maxTokens: number;
  reservedTokens: number;
  estimatedTokens: number;
  remainingTokens: number;
  includedCount: number;
  omittedCount: number;
};

export type AgentContextOmission = {
  id: string;
  type: AgentContextCitationType;
  title: string;
  reason: "token_budget_exceeded";
  estimatedTokens: number;
  tier?: AgentMemoryItem["tier"];
  evidenceId?: string;
  path?: string;
  sourceUrl?: string;
};

export type AgentContextEvidence = {
  episodes: ContextEpisode[];
};

export type ContextRetrievalDebug = {
  source:
    | "wiki"
    | "task"
    | "project_event"
    | "activity"
    | "agent_run"
    | "inbox"
    | "source_registry"
    | "swarmvault"
    | "memory";
  query?: string;
  status: "ok" | "empty" | "unavailable";
  candidateCount: number;
  searchedCount?: number;
  failedQueries?: {
    query: string;
    message: string;
  }[];
};

export type AgentContextDebug = {
  retrieval: ContextRetrievalDebug[];
};

export type AgentContextScope = {
  projectId?: string;
  projectName?: string;
  domain?: string;
  sourceType?: string;
  validAt?: string;
};

export type AgentContextRequiredRef = {
  memoryId?: string;
  path?: string;
  title?: string;
  version?: number;
  chunkId?: string;
  onMissing?: "fail" | "omit";
};

export type AgentContextRequiredResolution = {
  memoryId: string;
  path?: string;
  title?: string;
  version?: number;
  chunkId?: string;
  status: "resolved" | "omitted";
  reason?: string;
};

export type AgentContextQueryPlan = {
  original: string;
  scope: AgentContextScope;
  searchedQueries: string[];
  suppressedGenericTerms: string[];
  requiredRefCount: number;
};

export type AgentContextPack = {
  generatedAt: string;
  task: TaskRecord | null;
  searchQueries: string[];
  queryPlan: AgentContextQueryPlan;
  requiredRefs: AgentContextRequiredResolution[];
  wiki: WikiContextSearchResult;
  swarmvault: SwarmVaultContextResult;
  recentTasks: unknown[];
  relatedIdeas: IdeaContextRecord[];
  activity: ActivityRecord[];
  evidence: AgentContextEvidence;
  debug: AgentContextDebug;
  memoryItems: AgentMemoryItem[];
  tokenBudget: AgentContextTokenBudget;
  budget: AgentContextBudget;
  cited: AgentContextCitation[];
  omissions: AgentContextOmission[];
  tiers: AgentContextTiers;
  policy: AgentContextPolicy;
  nextAction: string;
};

export type AgentContextOptions = {
  budgetTokens?: number;
  scope?: AgentContextScope;
  requiredRefs?: AgentContextRequiredRef[];
  topK?: number;
};

export const AGENT_CONTEXT_POLICY: AgentContextPolicy = {
  canReadWiki: true,
  canSuggestWikiUpdates: true,
  canAutoArchiveKnowledge: false,
  mustConfirmDelete: true,
  maxWikiCandidates: 8,
  note: "Personal OS 只做机械检索和规则约束；Hermes 负责判断候选知识是否可用。",
};

const DEFAULT_CONTEXT_BUDGET_TOKENS = 3000;
const MIN_CONTEXT_BUDGET_TOKENS = 200;
const MAX_CONTEXT_BUDGET_TOKENS = 20000;
const DEFAULT_CONTEXT_RESERVED_TOKENS = 500;
const MEMORY_CONTEXT_TARGET_ITEMS = 20;
const MEMORY_SOURCE_OVER_FETCH_FACTOR = 2;
const MEMORY_RRF_K = 60;
const WIKI_SEARCH_CONCURRENCY = 4;
const SOURCE_REGISTRY_PATH = ".agent-runs/github-radar-source-registry.json";

type AgentContextTierName = "hot" | "warm" | "cold";

type AgentContextTierItemBuckets = Record<
  AgentContextTierName,
  AgentContextTierItem[]
>;

const TIER_TOKEN_BUDGET_WEIGHTS: Record<AgentContextTierName, number> = {
  hot: 0.45,
  warm: 0.4,
  cold: 0.15,
};

type MemoryRetrievalSource =
  | "current_task"
  | "wiki"
  | "task"
  | "project_event"
  | "idea"
  | "activity"
  | "agent_run"
  | "inbox"
  | "swarmvault"
  | "source_registry";

const MEMORY_SOURCE_WEIGHTS = {
  current_task: 2,
  wiki: 1.6,
  task: 1.35,
  project_event: 1.25,
  swarmvault: 1.25,
  source_registry: 1.15,
  agent_run: 1.05,
  inbox: 0.95,
  idea: 0.9,
  activity: 0.8,
} satisfies Record<MemoryRetrievalSource, number>;

export const normalizeAgentContextBudgetTokens = (budgetTokens?: number) => {
  if (budgetTokens === undefined || !Number.isFinite(budgetTokens)) {
    return DEFAULT_CONTEXT_BUDGET_TOKENS;
  }

  return Math.min(
    MAX_CONTEXT_BUDGET_TOKENS,
    Math.max(MIN_CONTEXT_BUDGET_TOKENS, Math.floor(budgetTokens)),
  );
};

const knownContextTerms = [
  "Hermes",
  "Personal OS",
  "Personal Wiki",
  "DeepTalk",
  "Telegram",
  "Obsidian",
  "OpenCode",
  "SwarmVault",
  "OpenViking",
  "Graphiti",
  "Cognee",
  "钉钉",
  "知识库",
  "入库",
  "语音转文字",
  "火山方舟",
  "向量",
  "记忆",
  "长期记忆",
  "Codex",
  "Code X",
  "episode",
  "hybrid recall",
  "context 召回",
  "提示词",
  "星耀星图馆",
  "qihuo-628",
];

const stopWords = new Set([
  "http",
  "https",
  "com",
  "www",
  "api",
  "agent",
  "bot",
  "note",
  "notes",
  "personal",
  "task",
  "tasks",
  "the",
  "today",
  "and",
  "for",
  "wiki",
  "with",
  "os",
  "context",
]);

const lowInformationQueries = new Set([
  "agent",
  "context",
  "memory",
  "os",
  "personal os",
  "personal wiki",
  "wiki",
  "上下文",
  "个人知识库",
  "知识库",
  "记忆",
  "知识库管理员",
  "提示词",
  "任务",
  "想法",
  "决策",
  "优化",
]);

const queryExpansionRules = [
  {
    when: ["wiki", "write", "failed"],
    add: ["wiki 写入失败", "wiki write failure runbook", "WikiWriteJob"],
  },
  {
    when: ["wiki", "write", "failure"],
    add: ["wiki 写入失败", "wiki write failure runbook", "WikiWriteJob"],
  },
];

const normalizedQuery = (query: string) => query.trim().toLowerCase();

const isLowInformationQuery = (query: string) => {
  const normalized = normalizedQuery(query);
  if (lowInformationQueries.has(normalized)) {
    return true;
  }

  if (/\p{Script=Han}/u.test(normalized)) {
    return false;
  }

  const asciiTokens = normalized.match(/[a-z0-9][a-z0-9_.-]*/g) ?? [];
  return asciiTokens.length > 0 && asciiTokens.every((token) => stopWords.has(token));
};

const scoringQueries = (queryText: string, searchQueries: string[]) => {
  const queries = Array.from(
    new Set(
      [queryText, ...searchQueries]
        .map((query) => query.trim())
        .filter(Boolean),
    ),
  );
  const discriminative = queries.filter((query) => !isLowInformationQuery(query));

  return discriminative.length > 0 ? discriminative : queries;
};

export function buildContextSearchQueries(task: TaskRecord, limit = 8) {
  const text = [
    task.title,
    task.description,
    task.nextAction,
    task.definitionOfDone,
    task.project?.name,
    task.project?.goal,
    task.project?.currentFocus,
    task.sourceInboxItem?.rawText,
    task.sourceInboxItem?.sourceUrl,
    task.sourceAgentRun?.reasoningSummary,
    ...(task.wikiLinks ?? []).flatMap((link) => [
      link.noteTitle,
      link.notePath,
      link.noteUrl,
    ]),
  ]
    .filter(Boolean)
    .join("\n");

  const queries = new Set<string>();
  addQuery(queries, task.title);
  addQuery(queries, task.project?.name ?? "");

  for (const term of knownContextTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) {
      addQuery(queries, term);
    }
  }

  for (const match of text.matchAll(/[A-Za-z][A-Za-z0-9_.-]{2,}/g)) {
    const token = match[0];
    if (!stopWords.has(token.toLowerCase())) {
      addQuery(queries, token);
    }
  }

  return Array.from(queries).slice(0, limit);
}

export function buildQuerySearchQueries(
  query: string,
  limit = 12,
  scope: AgentContextScope = {},
) {
  const queries = new Set<string>();
  const normalized = query.trim().replace(/\s+/g, " ");
  addQuery(queries, normalized);

  const scopedAnchor = [scope.projectName, scope.domain, normalized]
    .filter(definedString)
    .join(" ");
  if (scopedAnchor !== normalized) {
    addQuery(queries, scopedAnchor);
  }
  addQuery(queries, scope.projectName ?? "");
  addQuery(queries, scope.domain ?? "");

  const lower = normalized.toLowerCase();
  for (const term of knownContextTerms) {
    if (lower.includes(term.toLowerCase()) && !isLowInformationQuery(term)) {
      addQuery(queries, term);
    }
  }

  for (const rule of queryExpansionRules) {
    if (rule.when.every((term) => lower.includes(term.toLowerCase()))) {
      for (const expandedQuery of rule.add) {
        addQuery(queries, expandedQuery);
      }
    }
  }

  for (const token of normalized.split(/\s+/)) {
    if (!stopWords.has(token.toLowerCase()) && !isLowInformationQuery(token)) {
      addQuery(queries, token);
    }
  }

  for (const match of normalized.matchAll(/[A-Za-z][A-Za-z0-9_.-]{2,}/g)) {
    const token = match[0];
    if (!stopWords.has(token.toLowerCase())) {
      addQuery(queries, token);
    }
  }

  return Array.from(queries).slice(0, limit);
}

function addQuery(queries: Set<string>, value: string) {
  const query = value.trim().replace(/\s+/g, " ");
  if (query.length >= 2 && query.length <= 80) {
    queries.add(query);
  }
}

function scoreNote(
  note: WikiNoteSummary,
  queries: string[],
  retrievedByQuery: string,
) {
  const matchedQueries = new Set<string>();
  let score = 0;
  const title = note.title?.toLowerCase() ?? "";
  const excerpt = note.excerpt?.toLowerCase() ?? "";
  const tags = (note.tags ?? []).map((tag) => tag.toLowerCase());
  const concepts = (note.concepts ?? []).map((concept) => concept.toLowerCase());

  queries.forEach((query, index) => {
    const normalized = normalizedQuery(query);
    const weight = index === 0 ? 1.5 : isLowInformationQuery(query) ? 0.2 : 1;

    if (title.includes(normalized)) {
      score += 30 * weight;
      matchedQueries.add(query);
    }

    if (concepts.some((concept) => concept.includes(normalized))) {
      score += 20 * weight;
      matchedQueries.add(query);
    }

    if (tags.some((tag) => tag.includes(normalized))) {
      score += 14 * weight;
      matchedQueries.add(query);
    }

    if (excerpt.includes(normalized)) {
      score += 8 * weight;
      matchedQueries.add(query);
    }
  });

  if (!isLowInformationQuery(retrievedByQuery) && !matchedQueries.has(retrievedByQuery)) {
    score += 2;
    matchedQueries.add(retrievedByQuery);
  }

  return { matchedQueries, score: Math.round(score) };
}

const inactiveWikiStatuses = new Set(["archived", "deleted", "retracted"]);

const wikiCandidateIsActive = (
  note: WikiNoteSummary,
  scope: AgentContextScope,
) => {
  const status = note.status?.trim().toLowerCase();
  if (status && inactiveWikiStatuses.has(status)) {
    return false;
  }

  if (scope.sourceType && note.source_type !== scope.sourceType) {
    return false;
  }

  return true;
};

const suppressedGenericTermsForQuery = (query: string) => {
  const candidates = [
    ...knownContextTerms.filter((term) =>
      query.toLowerCase().includes(term.toLowerCase()),
    ),
    ...query.trim().split(/\s+/),
  ];

  return Array.from(
    new Set(
      candidates
        .map((term) => term.trim())
        .filter((term) => term.length > 0 && isLowInformationQuery(term)),
    ),
  );
};

const normalizeChunkId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

const selectMarkdownChunk = (content: string, requestedChunkId?: string) => {
  if (!requestedChunkId) {
    return { content, chunkId: undefined };
  }

  const lines = content.split("\n");
  const requested = normalizeChunkId(requestedChunkId);
  let start = -1;
  let level = 7;
  let heading = "";

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (!match) {
      continue;
    }

    const candidateHeading = match[2].trim();
    if (
      normalizeChunkId(candidateHeading) === requested ||
      candidateHeading.toLowerCase() === requestedChunkId.trim().toLowerCase()
    ) {
      start = index;
      level = match[1].length;
      heading = candidateHeading;
      break;
    }
  }

  if (start < 0) {
    return null;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+/);
    if (match && match[1].length <= level) {
      end = index;
      break;
    }
  }

  return {
    content: lines.slice(start, end).join("\n").trim(),
    chunkId: normalizeChunkId(heading),
  };
};

const frontmatterString = (
  document: WikiNoteDocument,
  key: string,
) => asString(document.frontmatter?.[key]);

const frontmatterVersion = (document: WikiNoteDocument) => {
  const value = document.frontmatter?.version;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return 1;
};

type ResolvedRequiredMemory = {
  resolution: AgentContextRequiredResolution;
  source?: MemorySource;
};

const resolveRequiredWikiRef = async (
  ref: AgentContextRequiredRef,
): Promise<ResolvedRequiredMemory> => {
  const requestedMemoryId = ref.memoryId?.trim();
  let path = ref.path?.trim();

  if (!path && requestedMemoryId?.startsWith("wiki:")) {
    path = requestedMemoryId.slice("wiki:".length);
  }

  if (!path) {
    const lookup = ref.title ?? requestedMemoryId;
    if (lookup) {
      const candidates = await searchWikiNotes(lookup, 8);
      const normalizedLookup = lookup.trim().toLowerCase();
      const exact = candidates.find((candidate) => {
        const candidateMemoryId = asString(candidate.metadata?.memory_id);
        return (
          candidate.path.toLowerCase() === normalizedLookup ||
          candidate.title.toLowerCase() === normalizedLookup ||
          candidateMemoryId?.toLowerCase() === normalizedLookup
        );
      });
      path = exact?.path;
    }
  }

  const memoryId = requestedMemoryId ?? (path ? `wiki:${path}` : ref.title ?? "unknown");
  const omit = (reason: string): ResolvedRequiredMemory => ({
    resolution: {
      memoryId,
      path,
      title: ref.title,
      version: ref.version,
      chunkId: ref.chunkId,
      status: "omitted",
      reason,
    },
  });

  if (!path) {
    return omit("required memory could not be resolved to a Wiki path");
  }

  let document: WikiNoteDocument;
  try {
    document = await readWikiNote(path);
  } catch (error) {
    return omit(errorMessage(error));
  }

  const status = frontmatterString(document, "status")?.toLowerCase();
  if (status && inactiveWikiStatuses.has(status)) {
    return omit(`required memory is ${status}`);
  }
  if (status === "superseded") {
    return omit("required memory is superseded; request the replacement memory_id");
  }

  const version = frontmatterVersion(document);
  if (ref.version !== undefined && ref.version !== version) {
    return omit(`required memory version mismatch: requested ${ref.version}, current ${version}`);
  }

  const chunk = selectMarkdownChunk(
    document.content ?? document.raw_body ?? "",
    ref.chunkId,
  );
  if (!chunk) {
    return omit(`required chunk not found: ${ref.chunkId}`);
  }

  const resolvedMemoryId =
    frontmatterString(document, "memory_id") ?? requestedMemoryId ?? `wiki:${path}`;
  const title = document.title || frontmatterString(document, "title") || ref.title || path;
  return {
    resolution: {
      memoryId: resolvedMemoryId,
      path,
      title,
      version,
      chunkId: chunk.chunkId,
      status: "resolved",
    },
    source: {
      id: `${resolvedMemoryId}@${version}${chunk.chunkId ? `#${chunk.chunkId}` : ""}`,
      type: "wiki",
      retrievalSource: "wiki",
      title,
      summary: chunk.content,
      sourceBoost: 160,
      forceTier: "hot",
      evidenceId: path,
      sourceUrl: wikiNoteUrl(path),
      createdAt: frontmatterString(document, "created_at") ?? frontmatterString(document, "created"),
      recallSource: wikiRecallSource(path),
      provenance: memoryProvenance({
        retrievalSource: "wiki",
        evidenceId: path,
        sourceUrl: wikiNoteUrl(path),
        title,
      }),
      metadata: {
        path,
        status: status ?? "active",
        sourceType: frontmatterString(document, "source_type"),
        tags: Array.isArray(document.frontmatter?.tags)
          ? document.frontmatter.tags.filter(definedString)
          : undefined,
        required: true,
        memoryId: resolvedMemoryId,
        version,
        chunkId: chunk.chunkId,
      },
      rawMetadata: document.frontmatter,
    },
  };
};

const resolveRequiredWikiRefs = async (
  refs: AgentContextRequiredRef[],
) => {
  const resolved = await mapWithConcurrency(refs, WIKI_SEARCH_CONCURRENCY, (ref) =>
    resolveRequiredWikiRef(ref),
  );
  const blocking = resolved.find(
    (item, index) =>
      item.resolution.status === "omitted" &&
      (refs[index].onMissing ?? "fail") === "fail",
  );

  if (blocking) {
    throw new HttpError(
      422,
      `Required memory unavailable: ${blocking.resolution.memoryId}: ${blocking.resolution.reason}`,
    );
  }

  return resolved;
};

function getWikiStatus(
  candidates: WikiContextCandidate[],
  successfulQueries: number,
  failedQueries: WikiContextSearchResult["failedQueries"],
  queryCount: number,
): WikiContextStatus {
  if (queryCount > 0 && successfulQueries === 0) {
    return "unavailable";
  }

  if (failedQueries.length > 0) {
    return "partial";
  }

  if (candidates.length === 0) {
    return "empty";
  }

  return "ok";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown wiki search error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function asTaskLike(value: unknown): Partial<TaskRecord> | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id);
  const title = asString(value.title);
  const status = asString(value.status);
  const priority = asString(value.priority);

  if (!id || !title || !status || !priority) {
    return null;
  }

  const project = isRecord(value.project)
    ? {
        id: asString(value.project.id) ?? "",
        name: asString(value.project.name) ?? "",
      }
    : null;

  return {
    id,
    title,
    status,
    priority,
    riskLevel: asString(value.riskLevel),
    executionMode: asString(value.executionMode),
    ownerAgent: asString(value.ownerAgent) ?? null,
    leaseUntil: asString(value.leaseUntil),
    nextAction: asString(value.nextAction) ?? "",
    definitionOfDone: asString(value.definitionOfDone) ?? "",
    project,
  };
}

function isAgentExecutableHotTask(task: Partial<TaskRecord>) {
  return (
    task.executionMode === "agent_allowed" &&
    ["P0", "P1"].includes(task.priority ?? "") &&
    ["todo", "doing", "review"].includes(task.status ?? "")
  );
}

function isRecentBlocker(task: Partial<TaskRecord>) {
  return ["blocked", "waiting"].includes(task.status ?? "");
}

function taskTierItem(
  task: Partial<TaskRecord>,
  reason: string,
): AgentContextTierItem {
  return {
    type: "task",
    reason,
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    projectName: task.project?.name,
    ownerAgent: task.ownerAgent,
    leaseUntil: task.leaseUntil,
    nextAction: task.nextAction,
    definitionOfDone: task.definitionOfDone,
  };
}

function wikiTierItem(
  candidate: WikiContextCandidate,
  reason: string,
): AgentContextTierItem {
  return {
    type: "wiki",
    reason,
    title: candidate.title,
    path: candidate.path,
    url: candidate.url,
    score: candidate.score,
    status: candidate.status,
    matchedQueries: candidate.matchedQueries,
  };
}

function swarmVaultTierItem(
  candidate: SwarmVaultContextCandidate,
): AgentContextTierItem {
  return {
    type: "swarmvault",
    reason: "matched SwarmVault graph context",
    id: candidate.id,
    title: candidate.title,
    source: candidate.source,
    path: candidate.path,
    url: candidate.url,
    score: candidate.score,
    excerpt: candidate.excerpt,
    matchedQueries: candidate.matchedQueries,
  };
}

function ideaTierItem(
  idea: IdeaContextRecord,
  reason: string,
): AgentContextTierItem {
  return {
    type: "idea",
    reason,
    id: idea.id,
    title: idea.title,
    status: idea.status,
    priority: idea.priority,
    projectName: idea.project?.name,
    nextAction: idea.nextAction,
  };
}

function activityTierItem(
  activity: ActivityRecord,
  reason: string,
): AgentContextTierItem {
  return {
    type: "activity",
    reason,
    id: activity.id,
    action: activity.action,
    targetType: activity.targetType,
    targetId: activity.targetId,
  };
}

const citationTitle = (item: AgentContextTierItem) =>
  item.title ?? item.action ?? item.targetId ?? item.reason;

const citationId = (item: AgentContextTierItem) => {
  if (item.type === "wiki") {
    return `wiki:${item.path ?? citationTitle(item)}`;
  }

  if (item.type === "policy") {
    return "policy:agent-context";
  }

  if (item.type === "swarmvault") {
    return `swarmvault:${item.id ?? item.path ?? citationTitle(item)}`;
  }

  return `${item.type}:${item.id ?? item.targetId ?? citationTitle(item)}`;
};

const citationForTierItem = (
  item: AgentContextTierItem,
): AgentContextCitation => ({
  id: citationId(item),
  type: item.type,
  title: citationTitle(item),
  evidenceId: item.id ?? item.path ?? item.targetId,
  path: item.path,
  sourceUrl: item.url,
  source: item.source,
});

const estimateTierItemTokens = (item: AgentContextTierItem) =>
  estimateMemoryTokens(
    citationTitle(item),
    [
      item.reason,
      item.excerpt,
      item.nextAction,
      item.definitionOfDone,
      item.projectName,
      item.path,
      item.url,
      item.action,
      item.targetType,
      item.targetId,
    ]
      .filter(definedString)
      .join(" "),
  );

const archivedReferenceForTierItem = (
  item: AgentContextTierItem,
  estimatedTokens: number,
): AgentContextTierArchivedReference => ({
  id: citationId(item),
  type: item.type,
  title: citationTitle(item),
  reason: "tier_token_budget_exceeded",
  estimatedTokens,
  retrieve: {
    evidenceId: item.id ?? item.path ?? item.targetId,
    path: item.path,
    sourceUrl: item.url,
    source: item.source,
    targetType: item.targetType,
    targetId: item.targetId,
  },
});

const tierTokenBudgets = (budgetTokens?: number) => {
  const maxTokens = normalizeAgentContextBudgetTokens(budgetTokens);
  const contentBudget = Math.max(0, maxTokens - reservedTokensForBudget(maxTokens));
  const hot = Math.floor(contentBudget * TIER_TOKEN_BUDGET_WEIGHTS.hot);
  const warm = Math.floor(contentBudget * TIER_TOKEN_BUDGET_WEIGHTS.warm);
  return {
    hot,
    warm,
    cold: Math.max(0, contentBudget - hot - warm),
  } satisfies Record<AgentContextTierName, number>;
};

const applyTierBudget = (
  items: AgentContextTierItem[],
  tokenBudget: number,
): AgentContextTier => {
  const included: AgentContextTierItem[] = [];
  const archived: AgentContextTierArchivedReference[] = [];
  let usedTokens = 0;

  for (const item of items) {
    const estimatedTokens = estimateTierItemTokens(item);
    if (usedTokens + estimatedTokens > tokenBudget) {
      archived.push(archivedReferenceForTierItem(item, estimatedTokens));
      continue;
    }

    included.push(item);
    usedTokens += estimatedTokens;
  }

  return {
    items: included,
    tokenBudget,
    usedTokens,
    remainingTokens: Math.max(0, tokenBudget - usedTokens),
    itemCount: included.length,
    archivedCount: archived.length,
    archived,
  };
};

const applyTierBudgets = (
  tiers: AgentContextTierItemBuckets,
  budgetTokens?: number,
): AgentContextTiers => {
  const budgets = tierTokenBudgets(budgetTokens);
  return {
    hot: applyTierBudget(tiers.hot, budgets.hot),
    warm: applyTierBudget(tiers.warm, budgets.warm),
    cold: applyTierBudget(tiers.cold, budgets.cold),
  };
};

const citationForMemoryItem = (
  item: AgentMemoryItem,
): AgentContextCitation => ({
  id: item.id,
  type: item.type,
  title: item.title,
  evidenceId: item.evidenceId,
  path: item.metadata.path,
  sourceUrl: item.sourceUrl,
  recallSource: item.recallSource,
  provenance: item.provenance,
  backendMetadata: item.backendMetadata,
});

const withCitedHotTier = (
  tiers: AgentContextTierItemBuckets,
): AgentContextTierItemBuckets => ({
  hot: tiers.hot.map((item) => ({
    ...item,
    cited:
      item.cited && item.cited.length > 0
        ? item.cited
        : [citationForTierItem(item)],
  })),
  warm: tiers.warm,
  cold: tiers.cold,
});

const collectContextCitations = (
  tiers: AgentContextTiers,
  memoryItems: AgentMemoryItem[],
) => {
  const citations = new Map<string, AgentContextCitation>();
  const addCitation = (citation: AgentContextCitation) => {
    if (!citations.has(citation.id)) {
      citations.set(citation.id, citation);
    }
  };

  for (const item of tiers.hot.items) {
    for (const citation of item.cited ?? [citationForTierItem(item)]) {
      addCitation(citation);
    }
  }

  for (const item of memoryItems) {
    addCitation(citationForMemoryItem(item));
  }

  return Array.from(citations.values());
};

function tierKey(item: AgentContextTierItem) {
  return [item.type, item.id, item.path, item.action, item.targetId]
    .filter(Boolean)
    .join(":");
}

function pushUnique(
  tier: AgentContextTierItem[],
  seen: Set<string>,
  item: AgentContextTierItem,
) {
  const key = tierKey(item);
  if (!key || seen.has(key)) {
    return;
  }
  seen.add(key);
  tier.push(item);
}

function buildContextTierItems(input: {
  task: TaskRecord | null;
  wiki: WikiContextSearchResult;
  swarmvault?: SwarmVaultContextResult;
  recentTasks: unknown[];
  relatedIdeas: IdeaContextRecord[];
  activity: ActivityRecord[];
  queryTasks?: unknown[];
}): AgentContextTierItemBuckets {
  const hot: AgentContextTierItem[] = [];
  const warm: AgentContextTierItem[] = [];
  const cold: AgentContextTierItem[] = [];
  const seen = new Set<string>();

  if (input.task) {
    pushUnique(hot, seen, taskTierItem(input.task, "current task being executed"));
  }

  for (const rawTask of input.queryTasks ?? []) {
    const task = asTaskLike(rawTask);
    if (!task) {
      continue;
    }
    if (isAgentExecutableHotTask(task)) {
      pushUnique(hot, seen, taskTierItem(task, "P0/P1 agent_allowed task ready for execution"));
    } else if (isRecentBlocker(task)) {
      pushUnique(hot, seen, taskTierItem(task, "recent blocked or waiting task"));
    } else {
      pushUnique(warm, seen, taskTierItem(task, "related task context"));
    }
  }

  for (const rawTask of input.recentTasks) {
    const task = asTaskLike(rawTask);
    if (!task) {
      continue;
    }
    const item = taskTierItem(
      task,
      isRecentBlocker(task) ? "recent related blocker" : "recent related task",
    );
    pushUnique(isRecentBlocker(task) ? hot : warm, seen, item);
  }

  for (const candidate of input.swarmvault?.candidates ?? []) {
    pushUnique(hot, seen, swarmVaultTierItem(candidate));
  }

  input.wiki.candidates.forEach((candidate, index) => {
    const item = wikiTierItem(candidate, "matched Personal Wiki evidence");
    const status = candidate.status?.toLowerCase();
    const isHistorical =
      status === "expired" ||
      status === "stale" ||
      status === "superseded" ||
      status === "retired" ||
      status === "deprecated";
    const targetTier = isHistorical
      ? cold
      : index < 3 || (candidate.score ?? 0) >= 30
        ? warm
        : cold;
    pushUnique(targetTier, seen, item);
  });

  for (const idea of input.relatedIdeas) {
    const targetTier = ["P0", "P1"].includes(idea.priority) ? warm : cold;
    pushUnique(targetTier, seen, ideaTierItem(idea, "related idea or future task seed"));
  }

  input.activity.forEach((activity, index) => {
    const targetTier = index < 3 ? warm : cold;
    pushUnique(targetTier, seen, activityTierItem(activity, "recent task activity evidence"));
  });

  pushUnique(cold, seen, {
    type: "policy",
    reason: "standing Personal OS / Wiki agent policy",
    title: "Agent context policy",
  });

  return {
    hot,
    warm,
    cold,
  };
}

function buildContextTiers(
  input: Parameters<typeof buildContextTierItems>[0],
  budgetTokens?: number,
): AgentContextTiers {
  return applyTierBudgets(withCitedHotTier(buildContextTierItems(input)), budgetTokens);
}

function computeNextAction(input: {
  task?: TaskRecord | null;
  queryTasks?: unknown[];
  globalActivity?: ActivityRecord[];
}): string {
  const { task, queryTasks = [], globalActivity = [] } = input;

  if (task) {
    if (task.status === "doing") {
      return `继续执行当前任务：${task.title}`;
    }
    if (task.status === "review") {
      return `当前任务 ${task.title} 待 review，等待用户确认`;
    }
    if (["blocked", "waiting"].includes(task.status)) {
      return `当前任务 ${task.title} 被阻塞，需要调查原因`;
    }
  }

  for (const rawTask of queryTasks) {
    const t = asTaskLike(rawTask);
    if (t && isAgentExecutableHotTask(t)) {
      return `执行 ${t.priority} Agent 任务：${t.title}`;
    }
  }

  for (const rawTask of queryTasks) {
    const t = asTaskLike(rawTask);
    if (t && isRecentBlocker(t)) {
      return `调查阻塞任务：${t.title}`;
    }
  }

  const failedRuns = (globalActivity ?? []).filter(
    (act) => act.action === "agentRun.failed",
  );
  if (failedRuns.length > 0) {
    return `调查最近 ${failedRuns.length} 个失败的 AgentRun`;
  }

  return "无高优先级可执行任务；运行 GitHub 雷达获取新任务";
}

type QueryContextDb = {
  task?: unknown;
  activityLog?: unknown;
  agentRun?: unknown;
  inboxItem?: unknown;
  projectEvent?: unknown;
  swarmVault?: SwarmVaultContextClient;
  sourceRegistry?: SourceRegistryClient;
};

async function getQueryHotTasks(db?: QueryContextDb) {
  const taskDelegate = db?.task as
    | { findMany(args: unknown): Promise<unknown[]> }
    | undefined;
  if (!taskDelegate) {
    return [];
  }

  return taskDelegate.findMany({
    where: {
      OR: [
        {
          executionMode: "agent_allowed",
          priority: { in: ["P0", "P1"] },
          status: { in: ["todo", "doing", "review"] },
        },
        {
          priority: { in: ["P0", "P1"] },
          status: { in: ["blocked", "waiting"] },
        },
      ],
    },
    include: { project: true },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    take: 5,
  });
}

const filterTasksByQuery = (tasks: unknown[], keywords: string[]) =>
  tasks.filter((rawTask) => {
    const task = asTaskLike(rawTask);
    if (!task) {
      return false;
    }

    return episodeMatches(
      [
        task.title,
        task.description,
        task.nextAction,
        task.definitionOfDone,
        task.project?.name,
        task.project?.goal,
        task.project?.currentFocus,
      ]
        .filter(definedString)
        .join(" "),
      keywords,
    );
  });

async function getQueryActivity(db?: QueryContextDb, limit = 15) {
  const activityLog = db?.activityLog as
    | { findMany(args: unknown): Promise<ActivityRecord[]> }
    | undefined;
  if (!activityLog) {
    return [];
  }
  return activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

async function getQueryAgentRuns(
  db: QueryContextDb | undefined,
  keywords: string[],
  limit = 8,
) {
  const agentRun = db?.agentRun as
    | { findMany(args: unknown): Promise<QueryAgentRunRecord[]> }
    | undefined;
  if (!agentRun) {
    return [];
  }

  const runs = await agentRun.findMany({
    include: { inboxItem: true },
    orderBy: { startedAt: "desc" },
    take: 40,
  });

  return runs
    .filter((run) =>
      episodeMatches(
        [
          run.model,
          run.status,
          run.reasoningSummary,
          run.outputSummary,
          run.error,
          run.inboxItem?.rawText,
          run.inboxItem?.sourceUrl,
        ]
          .filter(Boolean)
          .join(" "),
        keywords,
      ),
    )
    .slice(0, limit);
}

async function getQueryInboxItems(
  db: QueryContextDb | undefined,
  keywords: string[],
  limit = 8,
) {
  const inboxItem = db?.inboxItem as
    | { findMany(args: unknown): Promise<QueryInboxRecord[]> }
    | undefined;
  if (!inboxItem) {
    return [];
  }

  const items = await inboxItem.findMany({
    orderBy: { receivedAt: "desc" },
    take: 40,
  });

  return items
    .filter((item) =>
      episodeMatches(
        [
          item.rawText,
          item.sourceType,
          item.sourcePlatform,
          item.sourceUrl,
        ]
          .filter(Boolean)
          .join(" "),
        keywords,
      ),
    )
    .slice(0, limit);
}

const getQueryProjectEvents = async (
  db: QueryContextDb | undefined,
  keywords: string[],
  limit = 8,
) => {
  const projectEvent = db?.projectEvent as
    | { findMany(args: unknown): Promise<QueryProjectEventRecord[]> }
    | undefined;
  if (!projectEvent) {
    return [];
  }

  const events = await projectEvent.findMany({
    include: { project: true, sourceInboxItem: true, sourceAgentRun: true },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return events
    .filter((event) =>
      episodeMatches(
        [
          event.title,
          event.body,
          event.eventType,
          event.project?.name,
          event.sourceInboxItem?.rawText,
          event.sourceAgentRun?.model,
          event.sourceAgentRun?.reasoningSummary,
          event.sourceAgentRun?.outputSummary,
        ]
          .filter(Boolean)
          .join(" "),
        keywords,
      ),
    )
    .slice(0, limit);
};

const getTaskProjectEvents = async (
  db: ContextDb,
  task: TaskRecord,
  keywords: string[],
  limit = 8,
) => {
  const projectEvent = db.projectEvent as
    | { findMany(args: unknown): Promise<QueryProjectEventRecord[]> }
    | undefined;
  if (!projectEvent || !task.projectId) {
    return [];
  }

  const events = await projectEvent.findMany({
    where: { projectId: task.projectId },
    include: { project: true, sourceInboxItem: true, sourceAgentRun: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return events
    .filter((event) =>
      episodeMatches(
        [
          event.title,
          event.body,
          event.eventType,
          event.project?.name,
          event.sourceInboxItem?.rawText,
          event.sourceAgentRun?.model,
          event.sourceAgentRun?.reasoningSummary,
          event.sourceAgentRun?.outputSummary,
        ]
          .filter(Boolean)
          .join(" "),
        keywords,
      ),
    )
    .slice(0, limit);
};

const emptySourceRegistryContext = (
  searchedQueries: string[] = [],
): SourceRegistryResult => ({
  status: "empty",
  candidates: [],
  searchedQueries,
  failedQueries: [],
});

const unavailableSourceRegistryContext = (
  query: string,
  error: unknown,
): SourceRegistryResult => ({
  status: "unavailable",
  candidates: [],
  searchedQueries: [query],
  failedQueries: [
    {
      query,
      message: limitSummary(errorMessage(error), 300),
    },
  ],
});

const sourceRegistryEntryText = (entry: Record<string, unknown>) =>
  [
    asString(entry.full_name),
    asString(entry.name),
    asString(entry.description),
    asString(entry.decision),
    asString(entry.status),
    ...(Array.isArray(entry.signals)
      ? entry.signals.filter((signal): signal is string => typeof signal === "string")
      : []),
    ...(Array.isArray(entry.topics)
      ? entry.topics.filter((topic): topic is string => typeof topic === "string")
      : []),
  ]
    .filter(Boolean)
    .join(" ");

const sourceRegistryCandidate = (
  entry: Record<string, unknown>,
): SourceRegistryCandidate | null => {
  const fullName = asString(entry.full_name);
  if (!fullName) {
    return null;
  }

  const score = typeof entry.last_score === "number" ? entry.last_score : undefined;
  const htmlUrl = asString(entry.html_url) ?? asString(entry.url);

  return {
    id: `github:${fullName}`,
    title: fullName,
    summary: limitSummary(sourceRegistryEntryText(entry)),
    score,
    sourceUrl: htmlUrl,
    createdAt: asString(entry.last_seen) ?? asString(entry.first_seen),
    metadata: {
      decision: asString(entry.decision),
      status: asString(entry.status),
      signals: Array.isArray(entry.signals) ? entry.signals : undefined,
      topics: Array.isArray(entry.topics) ? entry.topics : undefined,
    },
  };
};

const searchLocalSourceRegistry = async (
  query: string,
  searchQueries: string[],
  limit = 8,
): Promise<SourceRegistryResult> => {
  if (process.env.NODE_ENV === "test") {
    return emptySourceRegistryContext(searchQueries);
  }

  const searchedQueries = Array.from(new Set([query, ...searchQueries].filter(Boolean)));

  try {
    const raw = await readFile(SOURCE_REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const entries =
      isRecord(parsed) && Array.isArray(parsed.entries) ? parsed.entries : [];
    const candidates = entries
      .filter(isRecord)
      .filter((entry) => episodeMatches(sourceRegistryEntryText(entry), searchedQueries))
      .map(sourceRegistryCandidate)
      .filter((candidate): candidate is SourceRegistryCandidate => candidate !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);

    return {
      status: candidates.length > 0 ? "ok" : "empty",
      candidates,
      searchedQueries,
      failedQueries: [],
    };
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return emptySourceRegistryContext(searchedQueries);
    }

    return unavailableSourceRegistryContext(query, error);
  }
};

const searchSourceRegistryContext = async (
  query: string,
  searchQueries: string[],
  db?: QueryContextDb,
) => {
  if (db?.sourceRegistry) {
    return db.sourceRegistry.search(query, 8);
  }

  return searchLocalSourceRegistry(query, searchQueries, 8);
};

const unavailableRetrievalDebug = (
  source: ContextRetrievalDebug["source"],
  query: string,
  error: unknown,
): ContextRetrievalDebug => ({
  source,
  query,
  status: "unavailable",
  candidateCount: 0,
  searchedCount: 0,
  failedQueries: [
    {
      query,
      message: limitSummary(errorMessage(error), 300),
    },
  ],
});

const safeContextSource = async <T>(
  source: ContextRetrievalDebug["source"],
  query: string,
  fallback: T,
  load: () => Promise<T>,
) => {
  try {
    return { value: await load(), failure: null };
  } catch (error) {
    return { value: fallback, failure: unavailableRetrievalDebug(source, query, error) };
  }
};

const queryRelevanceTerms = (keywords: string[]) => {
  const terms = new Set<string>();

  for (const keyword of keywords) {
    const normalized = normalizedQuery(keyword);
    if (normalized.length >= 2 && !isLowInformationQuery(normalized)) {
      terms.add(normalized);
    }

    for (const token of normalized.match(/[a-z0-9][a-z0-9_.-]{1,}/g) ?? []) {
      if (!stopWords.has(token)) {
        terms.add(token);
      }
    }

    for (const sequence of normalized.match(/[\p{Script=Han}]{2,}/gu) ?? []) {
      if (!isLowInformationQuery(sequence)) {
        terms.add(sequence);
      }
    }
  }

  if (terms.size === 0) {
    for (const keyword of keywords) {
      for (const token of normalizedQuery(keyword).split(/\s+/)) {
        if (token.length >= 2) {
          terms.add(token);
        }
      }
    }
  }

  return Array.from(terms).sort((left, right) => right.length - left.length);
};

const episodeMatches = (text: string, keywords: string[]): boolean => {
  const lower = text.toLowerCase();
  return queryRelevanceTerms(keywords).some((term) => lower.includes(term));
};

function findEpisodes(
  query: string,
  searchQueries: string[],
  wiki: WikiContextSearchResult,
  activity: ActivityRecord[],
  task: TaskRecord | null,
  agentRuns: QueryAgentRunRecord[] = [],
  inboxItems: QueryInboxRecord[] = [],
): ContextEpisode[] {
  const keywords = [...searchQueries, query].filter(Boolean);
  const episodes: ContextEpisode[] = [];

  for (const candidate of wiki.candidates) {
    episodes.push({
      type: "wiki",
      id: candidate.path,
      title: candidate.title,
      summary: candidate.excerpt ?? "",
      relevanceScore: candidate.score ?? 0,
      sourceUrl: candidate.url,
      createdAt: candidate.created,
    });
  }

  for (const act of activity) {
    const text = `${act.action} ${act.targetType} ${act.targetId}`;
    if (episodeMatches(text, keywords)) {
      episodes.push({
        type: "activity",
        id: act.id,
        title: `${act.action} on ${act.targetType}`,
        summary: `${act.action} ${act.targetType} ${act.targetId}`,
        relevanceScore: 12,
        createdAt:
          typeof act.createdAt === "string"
            ? act.createdAt
            : act.createdAt?.toISOString(),
      });
    }
  }

  for (const run of agentRuns) {
    const summary =
      run.outputSummary ??
      run.reasoningSummary ??
      run.error ??
      run.inboxItem?.rawText ??
      "";
    episodes.push({
      type: "agent_run",
      id: run.id,
      title: run.model ?? "Agent Run",
      summary,
      relevanceScore: 20,
      sourceUrl: run.inboxItem?.sourceUrl ?? undefined,
      createdAt:
        typeof run.startedAt === "string"
          ? run.startedAt
          : run.startedAt?.toISOString(),
    });
  }

  for (const item of inboxItems) {
    episodes.push({
      type: "inbox",
      id: item.id,
      title: item.sourceType ?? "Inbox Item",
      summary: item.rawText ?? "",
      relevanceScore: 16,
      sourceUrl: item.sourceUrl ?? undefined,
      createdAt:
        typeof item.receivedAt === "string"
          ? item.receivedAt
          : item.receivedAt?.toISOString(),
    });
  }

  if (task?.sourceAgentRun) {
    const run = task.sourceAgentRun;
    const text = `${run.model} ${run.reasoningSummary} ${run.outputSummary}`;
    if (episodeMatches(text, keywords) || task.sourceAgentRunId) {
      episodes.push({
        type: "agent_run",
        id: task.sourceAgentRunId ?? "unknown",
        title: run.model ?? "Agent Run",
        summary: run.outputSummary ?? run.reasoningSummary ?? "",
        relevanceScore: 18,
      });
    }
  }

  if (task?.contributions) {
    for (const contrib of task.contributions) {
      if (episodeMatches(contrib.summary, keywords)) {
        episodes.push({
          type: "task",
          id: task.id,
          title: task.title,
          summary: contrib.summary,
          relevanceScore: 22,
          createdAt:
            typeof contrib.createdAt === "string"
              ? contrib.createdAt
              : contrib.createdAt?.toISOString(),
        });
      }
    }
  }

  return episodes
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 8);
}

const mapWithConcurrency = async <Input, Output>(
  items: Input[],
  concurrency: number,
  worker: (item: Input, index: number) => Promise<Output>,
) => {
  const results = new Array<Output>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      () => runWorker(),
    ),
  );

  return results;
};

export async function searchWikiContext(
  queries: string[],
  limit = 8,
  scope: AgentContextScope = {},
): Promise<WikiContextSearchResult> {
  const searchedQueries = Array.from(
    new Set(queries.map((query) => query.trim()).filter(Boolean)),
  );
  const noteMap = new Map<string, WikiContextCandidate>();
  const failedQueries: WikiContextSearchResult["failedQueries"] = [];
  let successfulQueries = 0;
  const genericOnlyFallback = searchedQueries.every(isLowInformationQuery);

  const results = await mapWithConcurrency(
    searchedQueries,
    WIKI_SEARCH_CONCURRENCY,
    async (query) => {
      try {
        const notes = await searchWikiNotes(query, 6);
        return { query, notes };
      } catch (error) {
        return { query, error };
      }
    },
  );

  for (const result of results) {
    if ("error" in result) {
      failedQueries.push({
        query: result.query,
        message: errorMessage(result.error),
      });
      continue;
    }

    successfulQueries += 1;

    for (const note of result.notes) {
      if (!wikiCandidateIsActive(note, scope)) {
        continue;
      }
      const existing = noteMap.get(note.path);
      const scored = scoreNote(note, searchedQueries, result.query);
      if (scored.score <= 0 && genericOnlyFallback) {
        scored.score = 1;
        scored.matchedQueries.add(result.query);
      }
      if (scored.score <= 0) {
        continue;
      }
      const candidate: WikiContextCandidate = {
        ...note,
        url: wikiNoteUrl(note.path),
        matchedQueries: Array.from(scored.matchedQueries),
        score: scored.score,
      };

      if (!existing || candidate.score > existing.score) {
        noteMap.set(note.path, candidate);
      }
    }
  }

  const candidates = Array.from(noteMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    status: getWikiStatus(
      candidates,
      successfulQueries,
      failedQueries,
      searchedQueries.length,
    ),
    candidates,
    searchedQueries,
    successfulQueries,
    failedQueries,
  };
}

function buildRetrievalDebug(input: {
  wiki: WikiContextSearchResult;
  activity: ActivityRecord[];
  queryTasks?: unknown[];
  projectEvents?: QueryProjectEventRecord[];
  agentRuns?: QueryAgentRunRecord[];
  inboxItems?: QueryInboxRecord[];
  sourceRegistry?: SourceRegistryResult;
  sourceFailures?: ContextRetrievalDebug[];
}): AgentContextDebug {
  const failedQueryMap = new Map(
    input.wiki.failedQueries.map((failed) => [failed.query, failed]),
  );
  const wikiRows: ContextRetrievalDebug[] = input.wiki.searchedQueries.map(
    (query) => {
      const failed = failedQueryMap.get(query);
      const candidateCount = input.wiki.candidates.filter((candidate) =>
        candidate.matchedQueries?.includes(query),
      ).length;

      return {
        source: "wiki",
        query,
        status: failed ? "unavailable" : candidateCount > 0 ? "ok" : "empty",
        candidateCount,
        failedQueries: failed ? [failed] : [],
      };
    },
  );

  const sourceFailures = input.sourceFailures ?? [];
  const failedSources = new Set(sourceFailures.map((failure) => failure.source));
  const sourceRows: ContextRetrievalDebug[] = [];

  const pushSourceRow = (row: ContextRetrievalDebug) => {
    if (!failedSources.has(row.source)) {
      sourceRows.push(row);
    }
  };

  pushSourceRow({
    source: "task",
    status: (input.queryTasks?.length ?? 0) > 0 ? "ok" : "empty",
    candidateCount: input.queryTasks?.length ?? 0,
  });
  pushSourceRow({
    source: "project_event",
    status: (input.projectEvents?.length ?? 0) > 0 ? "ok" : "empty",
    candidateCount: input.projectEvents?.length ?? 0,
  });
  pushSourceRow({
    source: "agent_run",
    status: (input.agentRuns?.length ?? 0) > 0 ? "ok" : "empty",
    candidateCount: input.agentRuns?.length ?? 0,
  });
  pushSourceRow({
    source: "inbox",
    status: (input.inboxItems?.length ?? 0) > 0 ? "ok" : "empty",
    candidateCount: input.inboxItems?.length ?? 0,
  });
  pushSourceRow({
    source: "activity",
    status: input.activity.length > 0 ? "ok" : "empty",
    candidateCount: input.activity.length,
  });

  if (input.sourceRegistry) {
    pushSourceRow({
      source: "source_registry",
      query: input.sourceRegistry.searchedQueries[0],
      status: input.sourceRegistry.status,
      candidateCount: input.sourceRegistry.candidates.length,
      searchedCount: input.sourceRegistry.searchedQueries.length,
      failedQueries: input.sourceRegistry.failedQueries,
    });
  }

  return {
    retrieval: [...wikiRows, ...sourceRows, ...sourceFailures],
  };
}

type MemorySource = {
  id: string;
  type: AgentMemoryItem["type"];
  retrievalSource: MemoryRetrievalSource;
  title: string;
  summary: string;
  sourceBoost: number;
  forceTier?: AgentMemoryItem["tier"];
  evidenceId?: string;
  sourceUrl?: string;
  createdAt?: string;
  recallSource: RecallSource;
  provenance: MemoryProvenance;
  backendMetadata?: Record<string, unknown>;
  metadata: AgentMemoryItem["metadata"];
  rawMetadata?: Record<string, unknown>;
};

const definedString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");

const sanitizeMemoryText = (value: string) =>
  normalizeText(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(
      /\b(authorization|token|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]");

const limitSummary = (value: string, maxLength = 700) => {
  const sanitized = sanitizeMemoryText(value);
  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  return sanitized.slice(0, maxLength - 1).trimEnd() + "...";
};

const addVectorToken = (tokens: Map<string, number>, token: string) => {
  const normalized = token.trim().toLowerCase();
  if (normalized.length < 2 || stopWords.has(normalized)) {
    return;
  }

  tokens.set(normalized, (tokens.get(normalized) ?? 0) + 1);
};

const buildTokenVector = (text: string) => {
  const tokens = new Map<string, number>();
  const lower = text.toLowerCase();

  for (const term of knownContextTerms) {
    if (!isLowInformationQuery(term) && lower.includes(term.toLowerCase())) {
      addVectorToken(tokens, term);
    }
  }

  for (const match of lower.matchAll(/[a-z0-9][a-z0-9_.-]{1,}/g)) {
    if (!stopWords.has(match[0])) {
      addVectorToken(tokens, match[0]);
    }
  }

  for (const match of text.matchAll(/[\p{Script=Han}]{2,}/gu)) {
    const sequence = match[0];
    if (!isLowInformationQuery(sequence)) {
      addVectorToken(tokens, sequence);
    }
    for (let index = 0; index < sequence.length - 1; index += 1) {
      const token = sequence.slice(index, index + 2);
      if (!isLowInformationQuery(token)) {
        addVectorToken(tokens, token);
      }
    }
  }

  return tokens;
};

const vectorCosineSimilarity = (
  left: Map<string, number>,
  right: Map<string, number>,
) => {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (const value of left.values()) {
    leftNorm += value * value;
  }

  for (const value of right.values()) {
    rightNorm += value * value;
  }

  for (const [token, value] of left) {
    dot += value * (right.get(token) ?? 0);
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / Math.sqrt(leftNorm * rightNorm);
};

const scoreKeywordText = (text: string, queries: string[]) => {
  const lower = text.toLowerCase();
  let score = 0;

  for (const query of queries) {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) {
      continue;
    }

    if (lower.includes(normalized)) {
      score += Math.min(35, 8 + normalized.length);
      continue;
    }

    const queryVector = buildTokenVector(normalized);
    for (const token of queryVector.keys()) {
      if (lower.includes(token)) {
        score += 5;
      }
    }
  }

  return score;
};

const parseMemoryDate = (value?: Date | string) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const cstMatch = value.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?\s+CST$/,
  );
  if (cstMatch) {
    const [, date, time, seconds] = cstMatch;
    const parsed = new Date(`${date}T${time}:${seconds ?? "00"}+08:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isoDateString = (value?: Date | string) => {
  const parsed = parseMemoryDate(value);
  return parsed ? parsed.toISOString() : undefined;
};

const PERSONAL_OS_BACKEND_ID = "personal-os";
const PERSONAL_OS_USER_ID = "personal-os";
const UNKNOWN_AGENT_ID = "unknown-agent";

const userRecallSource = (userId = PERSONAL_OS_USER_ID): RecallSource => ({
  track: "user",
  user_id: userId,
});

const agentRecallSource = (agentId?: string | null): RecallSource => ({
  track: "agent",
  agent_id: agentId?.trim() ? agentId.trim() : UNKNOWN_AGENT_ID,
});

const wikiRecallSource = (wikiPath: string): RecallSource => ({
  track: "wiki",
  wiki_path: wikiPath,
});

const externalRecallSource = (sourceId: string): RecallSource => ({
  track: "source",
  source_id: sourceId,
});

const memoryProvenance = (input: {
  retrievalSource: MemoryRetrievalSource;
  evidenceId?: string;
  sourceUrl?: string;
  createdAt?: string;
  title?: string;
}): MemoryProvenance => ({
  backend_id: PERSONAL_OS_BACKEND_ID,
  retrieval_source: input.retrievalSource,
  evidence_id: input.evidenceId,
  source_url: input.sourceUrl,
  created_at: isoDateString(input.createdAt),
  title: input.title,
});

const memoryBackendMetadata = (source: MemorySource) => ({
  backend_id: PERSONAL_OS_BACKEND_ID,
  source: source.retrievalSource,
  ...source.metadata,
  ...(source.rawMetadata ?? {}),
});

const metadataNumber = (
  metadata: Record<string, unknown> | undefined,
  key: string,
) => {
  const value = metadata?.[key];
  return typeof value === "number" ? value : undefined;
};

const metadataHasValue = (
  metadata: Record<string, unknown> | undefined,
  key: string,
) => {
  const value = metadata?.[key];
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== undefined && value !== null && value !== "";
};

const memoryFlags = (source: MemorySource): AgentMemoryItem["flags"] => {
  const status = source.metadata.status?.toLowerCase();
  const createdAt = parseMemoryDate(source.createdAt);
  const now = Date.now();
  const ttlDays = metadataNumber(source.rawMetadata, "freshness_ttl_days");
  const explicitExpiresAt =
    asString(source.rawMetadata?.expires_at) ??
    asString(source.rawMetadata?.expiresAt);
  const expiresAt = parseMemoryDate(explicitExpiresAt);
  const isTtlExpired =
    createdAt !== null && ttlDays !== undefined
      ? createdAt.getTime() + ttlDays * 24 * 60 * 60 * 1000 < now
      : false;
  const isExpired =
    isTtlExpired ||
    (expiresAt !== null ? expiresAt.getTime() < now : false) ||
    status === "expired";
  const hasConflict =
    status === "superseded" ||
    status === "conflict" ||
    status === "conflicting" ||
    metadataHasValue(source.rawMetadata, "conflicts_with") ||
    metadataHasValue(source.rawMetadata, "superseded_by");
  const isOld =
    createdAt !== null
      ? now - createdAt.getTime() > 180 * 24 * 60 * 60 * 1000
      : false;

  return {
    isStale:
      isExpired ||
      isOld ||
      status === "stale" ||
      status === "superseded" ||
      status === "retired" ||
      status === "deprecated",
    isExpired,
    hasConflict,
  };
};

const filteredMemoryStatuses = new Set([
  "archived",
  "deleted",
  "promoted",
  "rejected",
]);

const shouldSkipMemorySource = (source: MemorySource) => {
  const status = source.metadata.status?.toLowerCase();
  return status !== undefined && filteredMemoryStatuses.has(status);
};

const estimateMemoryTokens = (title: string, summary: string) => {
  const latinish = `${title} ${summary}`.replace(/[\p{Script=Han}]/gu, "");
  const hanCount = (`${title} ${summary}`.match(/[\p{Script=Han}]/gu) ?? [])
    .length;
  return Math.max(1, Math.ceil(latinish.length / 4) + hanCount);
};

const memoryTierForScore = (
  score: number,
  flags: AgentMemoryItem["flags"],
  forceTier?: AgentMemoryItem["tier"],
): AgentMemoryItem["tier"] => {
  if (forceTier) {
    return forceTier;
  }

  if (flags.isExpired || flags.hasConflict) {
    return "cold";
  }

  if (score >= 45) {
    return "hot";
  }

  if (score >= 18) {
    return "warm";
  }

  return "cold";
};

const sourceSearchText = (source: MemorySource) =>
  [
    source.title,
    source.summary,
    source.metadata.path,
    source.metadata.status,
    source.metadata.priority,
    source.metadata.sourceType,
    source.metadata.projectName,
    ...(source.metadata.matchedQueries ?? []),
    ...(source.metadata.tags ?? []),
    ...(source.metadata.concepts ?? []),
  ]
    .filter(definedString)
    .join(" ");

const buildMemoryItem = (
  source: MemorySource,
  queries: string[],
) => {
  if (shouldSkipMemorySource(source)) {
    return null;
  }

  const text = sourceSearchText(source);
  const queryVector = buildTokenVector(queries.join(" "));
  const itemVector = buildTokenVector(text);
  const semanticScore = Math.round(
    vectorCosineSimilarity(queryVector, itemVector) * 100,
  );
  const keywordScore = scoreKeywordText(text, queries);
  if (
    keywordScore === 0 &&
    semanticScore === 0 &&
    source.metadata.required !== true &&
    source.retrievalSource !== "current_task"
  ) {
    return null;
  }

  const flags = memoryFlags(source);
  const freshnessPenalty = flags.isExpired ? 60 : flags.isStale ? 25 : 0;
  const conflictPenalty = flags.hasConflict ? 60 : 0;
  const score = Math.round(
    keywordScore +
      semanticScore +
      source.sourceBoost -
      freshnessPenalty -
      conflictPenalty,
  );
  const title = limitSummary(source.title, 180);
  const summary = limitSummary(source.summary);

  return {
    id: source.id,
    type: source.type,
    title,
    summary,
    tier: memoryTierForScore(score, flags, source.forceTier),
    score,
    keywordScore,
    semanticScore,
    tokenEstimate: estimateMemoryTokens(title, summary),
    evidenceId: source.evidenceId,
    sourceUrl: source.sourceUrl,
    createdAt: isoDateString(source.createdAt),
    recallSource: source.recallSource,
    provenance: source.provenance,
    backendMetadata: source.backendMetadata ?? memoryBackendMetadata(source),
    metadata: {
      ...source.metadata,
      source: source.retrievalSource,
    },
    flags,
  } satisfies AgentMemoryItem;
};

const memorySourceName = (item: AgentMemoryItem): MemoryRetrievalSource => {
  const source = item.metadata.source;
  return source && source in MEMORY_SOURCE_WEIGHTS
    ? (source as MemoryRetrievalSource)
    : "wiki";
};

const normalizeDedupKeyText = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const memoryDedupKey = (item: AgentMemoryItem) => {
  const title = normalizeDedupKeyText(item.title);
  if (title.length >= 4) {
    return `title:${title}`;
  }

  return `id:${item.id}`;
};

const memoryDedupReason = (key: string, merged: boolean) => {
  const by = key.startsWith("title:") ? "title" : "id";
  return merged ? `merged_by_${by}` : `unique_by_${by}`;
};

const mergeSourceTelemetry = (
  entries: {
    source: MemoryRetrievalSource;
    rank: number;
    weight: number;
  }[],
) => {
  const contributing_sources: string[] = [];
  const sourceWeights: Record<string, number> = {};
  const sourceRanks: Record<string, number> = {};

  for (const entry of entries) {
    if (!contributing_sources.includes(entry.source)) {
      contributing_sources.push(entry.source);
    }
    sourceWeights[entry.source] = entry.weight;
    sourceRanks[entry.source] = entry.rank;
  }

  return { contributing_sources, sourceWeights, sourceRanks };
};

const fuseMemoryItemsWithWeightedRrf = (
  items: AgentMemoryItem[],
  limit = MEMORY_CONTEXT_TARGET_ITEMS,
) => {
  const perSourceLimit = limit * MEMORY_SOURCE_OVER_FETCH_FACTOR;
  const bySource = new Map<MemoryRetrievalSource, AgentMemoryItem[]>();
  const bestPerSourceKey = new Map<string, AgentMemoryItem>();

  for (const item of items) {
    const source = memorySourceName(item);
    const sourceKey = `${source}:${memoryDedupKey(item)}`;
    const existing = bestPerSourceKey.get(sourceKey);
    if (!existing || item.score > existing.score) {
      bestPerSourceKey.set(sourceKey, item);
    }
  }

  for (const item of bestPerSourceKey.values()) {
    const source = memorySourceName(item);
    const sourceItems = bySource.get(source) ?? [];
    sourceItems.push(item);
    bySource.set(source, sourceItems);
  }

  const rrfScores = new Map<string, number>();
  const bestItems = new Map<string, AgentMemoryItem>();
  const telemetry = new Map<
    string,
    {
      firstSeen: number;
      entries: {
        source: MemoryRetrievalSource;
        rank: number;
        weight: number;
      }[];
    }
  >();
  let firstSeen = 0;

  for (const [source, sourceItems] of bySource) {
    const weight = MEMORY_SOURCE_WEIGHTS[source];
    const rankedSourceItems = [...sourceItems]
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.id.localeCompare(b.id);
      })
      .slice(0, perSourceLimit);

    rankedSourceItems.forEach((item, index) => {
      const rank = index + 1;
      const key = memoryDedupKey(item);
      const score = weight / (MEMORY_RRF_K + rank);
      const previousScore = rrfScores.get(key) ?? 0;
      rrfScores.set(key, previousScore + score);

      const previousItem = bestItems.get(key);
      if (!previousItem || item.score > previousItem.score) {
        bestItems.set(key, item);
      }

      const existingTelemetry = telemetry.get(key);
      if (existingTelemetry) {
        existingTelemetry.entries.push({ source, rank, weight });
      } else {
        telemetry.set(key, {
          firstSeen,
          entries: [{ source, rank, weight }],
        });
        firstSeen += 1;
      }
    });
  }

  const fused: AgentMemoryItem[] = [];
  const fusionScores = new Map<string, number>();
  for (const [key, rrfScore] of rrfScores) {
    const item = bestItems.get(key);
    const entries = telemetry.get(key)?.entries ?? [];
    const strongestWeight = Math.max(1, ...entries.map((entry) => entry.weight));
    const multiSourceBonus = Math.max(0, entries.length - 1) * 5;
    fusionScores.set(
      key,
      Math.max(0, item?.score ?? 0) * strongestWeight +
        rrfScore * 100 +
        multiSourceBonus,
    );
  }

  const ranked = Array.from(rrfScores.entries())
    .sort((a, b) => {
      const scoreDifference =
        (fusionScores.get(b[0]) ?? 0) - (fusionScores.get(a[0]) ?? 0);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return (
        (telemetry.get(a[0])?.firstSeen ?? 0) -
        (telemetry.get(b[0])?.firstSeen ?? 0)
      );
    })
    .slice(0, limit);

  for (const [key, rrfScore] of ranked) {
    const item = bestItems.get(key);
    const sourceTelemetry = telemetry.get(key);
    if (!item || !sourceTelemetry) {
      continue;
    }

    const mergedTelemetry = mergeSourceTelemetry(sourceTelemetry.entries);
    const merged = mergedTelemetry.contributing_sources.length > 1;

    fused.push({
      ...item,
      metadata: {
        ...item.metadata,
        ...mergedTelemetry,
        dedupReason: memoryDedupReason(key, merged),
        dedupKey: key,
        rrfScore,
        fusionScore: fusionScores.get(key),
      },
    });
  }

  return fused;
};

const pushMemorySource = (
  sources: MemorySource[],
  source: MemorySource | null,
) => {
  if (source) {
    sources.push(source);
  }
};

const taskMemorySource = (
  rawTask: unknown,
  options: {
    sourceBoost: number;
    forceTier?: AgentMemoryItem["tier"];
    retrievalSource?: MemoryRetrievalSource;
  },
) => {
  const task = asTaskLike(rawTask);
  if (!task?.id || !task.title) {
    return null;
  }

  const retrievalSource = options.retrievalSource ?? "task";

  return {
    id: `task:${task.id}`,
    type: "task",
    retrievalSource,
    title: task.title,
    summary: [task.nextAction, task.definitionOfDone].filter(definedString).join(" "),
    sourceBoost: options.sourceBoost,
    forceTier: options.forceTier,
    evidenceId: task.id,
    recallSource: userRecallSource(),
    provenance: memoryProvenance({
      retrievalSource,
      evidenceId: task.id,
      title: task.title,
    }),
    metadata: {
      status: task.status,
      priority: task.priority,
      projectName: task.project?.name,
    },
  } satisfies MemorySource;
};

const activityMemorySource = (activity: ActivityRecord) =>
  ({
    id: `activity:${activity.id}`,
    type: "activity",
    retrievalSource: "activity",
    title: `${activity.action} on ${activity.targetType}`,
    summary: `${activity.action} ${activity.targetType} ${activity.targetId}`,
    sourceBoost: 6,
    evidenceId: activity.id,
    createdAt:
      typeof activity.createdAt === "string"
        ? activity.createdAt
        : activity.createdAt?.toISOString(),
    recallSource: userRecallSource(),
    provenance: memoryProvenance({
      retrievalSource: "activity",
      evidenceId: activity.id,
      createdAt:
        typeof activity.createdAt === "string"
          ? activity.createdAt
          : activity.createdAt?.toISOString(),
      title: `${activity.action} on ${activity.targetType}`,
    }),
    metadata: {
      status: "active",
      sourceType: activity.actorType,
    },
  }) satisfies MemorySource;

const reservedTokensForBudget = (maxTokens: number) =>
  Math.min(DEFAULT_CONTEXT_RESERVED_TOKENS, Math.floor(maxTokens * 0.2));

const omissionForMemoryItem = (item: AgentMemoryItem): AgentContextOmission => ({
  id: item.id,
  type: item.type,
  title: item.title,
  reason: "token_budget_exceeded",
  estimatedTokens: item.tokenEstimate,
  tier: item.tier,
  evidenceId: item.evidenceId,
  path: item.metadata.path,
  sourceUrl: item.sourceUrl,
});

const buildMemoryContext = (input: {
  queryText: string;
  searchQueries: string[];
  task: TaskRecord | null;
  wiki: WikiContextSearchResult;
  recentTasks: unknown[];
  relatedIdeas: IdeaContextRecord[];
  activity: ActivityRecord[];
  queryTasks?: unknown[];
  projectEvents?: QueryProjectEventRecord[];
  agentRuns?: QueryAgentRunRecord[];
  inboxItems?: QueryInboxRecord[];
  swarmvault?: SwarmVaultContextResult;
  sourceRegistry?: SourceRegistryResult;
  requiredMemorySources?: MemorySource[];
  budgetTokens?: number;
  topK?: number;
}) => {
  const sources: MemorySource[] = [];

  for (const source of input.requiredMemorySources ?? []) {
    pushMemorySource(sources, source);
  }

  if (input.task) {
    pushMemorySource(
      sources,
      taskMemorySource(input.task, {
        sourceBoost: 40,
        forceTier: "hot",
        retrievalSource: "current_task",
      }),
    );
    if (input.task.sourceAgentRun) {
      pushMemorySource(sources, {
        id: `agent_run:${input.task.sourceAgentRunId ?? input.task.id}`,
        type: "agent_run",
        retrievalSource: "agent_run",
        title: input.task.sourceAgentRun.model ?? "Agent Run",
        summary:
          input.task.sourceAgentRun.outputSummary ??
          input.task.sourceAgentRun.reasoningSummary ??
          "",
        sourceBoost: 18,
        evidenceId: input.task.sourceAgentRunId ?? input.task.id,
        recallSource: agentRecallSource(input.task.sourceAgentRun.model),
        provenance: memoryProvenance({
          retrievalSource: "agent_run",
          evidenceId: input.task.sourceAgentRunId ?? input.task.id,
          title: input.task.sourceAgentRun.model ?? "Agent Run",
        }),
        metadata: {
          status: "linked",
          sourceType: "task.sourceAgentRun",
        },
      });
    }
  }

  for (const candidate of input.wiki.candidates) {
    pushMemorySource(sources, {
      id: `wiki:${candidate.path}`,
      type: "wiki",
      retrievalSource: "wiki",
      title: candidate.title,
      summary: candidate.excerpt ?? "",
      sourceBoost: 22,
      evidenceId: candidate.path,
      sourceUrl: candidate.url,
      createdAt: candidate.created,
      recallSource: wikiRecallSource(candidate.path),
      provenance: memoryProvenance({
        retrievalSource: "wiki",
        evidenceId: candidate.path,
        sourceUrl: candidate.url,
        createdAt: candidate.created,
        title: candidate.title,
      }),
      metadata: {
        path: candidate.path,
        status: candidate.status,
        sourceType: candidate.source_type,
        matchedQueries: candidate.matchedQueries,
        tags: candidate.tags,
        concepts: candidate.concepts,
      },
      rawMetadata: candidate.metadata,
    });
  }

  for (const rawTask of input.queryTasks ?? []) {
    const task = asTaskLike(rawTask);
    const forceTier = task && isAgentExecutableHotTask(task) ? "hot" : undefined;
    pushMemorySource(
      sources,
      taskMemorySource(rawTask, {
        sourceBoost: forceTier ? 26 : 12,
        forceTier,
      }),
    );
  }

  for (const rawTask of input.recentTasks) {
    pushMemorySource(
      sources,
      taskMemorySource(rawTask, { sourceBoost: 12 }),
    );
  }

  for (const idea of input.relatedIdeas) {
    pushMemorySource(sources, {
      id: `idea:${idea.id}`,
      type: "idea",
      retrievalSource: "idea",
      title: idea.title,
      summary: [idea.body, idea.nextAction].filter(definedString).join(" "),
      sourceBoost: ["P0", "P1"].includes(idea.priority) ? 14 : 8,
      evidenceId: idea.id,
      recallSource: userRecallSource(),
      provenance: memoryProvenance({
        retrievalSource: "idea",
        evidenceId: idea.id,
        title: idea.title,
      }),
      metadata: {
        status: idea.status,
        priority: idea.priority,
        projectName: idea.project?.name,
      },
    });
  }

  for (const activity of input.activity) {
    pushMemorySource(sources, activityMemorySource(activity));
  }

  for (const event of input.projectEvents ?? []) {
    pushMemorySource(sources, {
      id: `project_event:${event.id}`,
      type: "project_event",
      retrievalSource: "project_event",
      title: event.title,
      summary: [event.body, event.eventType, event.project?.name]
        .filter(definedString)
        .join(" "),
      sourceBoost: 13,
      evidenceId: event.id,
      createdAt:
        typeof event.createdAt === "string"
          ? event.createdAt
          : event.createdAt?.toISOString(),
      recallSource: userRecallSource(),
      provenance: memoryProvenance({
        retrievalSource: "project_event",
        evidenceId: event.id,
        createdAt:
          typeof event.createdAt === "string"
            ? event.createdAt
            : event.createdAt?.toISOString(),
        title: event.title,
      }),
      metadata: {
        status: event.eventType ?? undefined,
        projectName: event.project?.name,
        sourceType: "ProjectEvent",
      },
    });
  }

  for (const run of input.agentRuns ?? []) {
    pushMemorySource(sources, {
      id: `agent_run:${run.id}`,
      type: "agent_run",
      retrievalSource: "agent_run",
      title: run.model ?? "Agent Run",
      summary:
        run.outputSummary ??
        run.reasoningSummary ??
        run.error ??
        run.inboxItem?.rawText ??
        "",
      sourceBoost: 16,
      evidenceId: run.id,
      sourceUrl: run.inboxItem?.sourceUrl ?? undefined,
      createdAt:
        typeof run.startedAt === "string"
          ? run.startedAt
          : run.startedAt?.toISOString(),
      recallSource: agentRecallSource(run.model),
      provenance: memoryProvenance({
        retrievalSource: "agent_run",
        evidenceId: run.id,
        sourceUrl: run.inboxItem?.sourceUrl ?? undefined,
        createdAt:
          typeof run.startedAt === "string"
            ? run.startedAt
            : run.startedAt?.toISOString(),
        title: run.model ?? "Agent Run",
      }),
      metadata: {
        status: run.status ?? undefined,
        sourceType: "AgentRun",
      },
    });
  }

  for (const candidate of input.swarmvault?.candidates ?? []) {
    pushMemorySource(sources, {
      id: `swarmvault:${candidate.id}`,
      type: "swarmvault",
      retrievalSource: "swarmvault",
      title: candidate.title,
      summary: candidate.excerpt ?? "",
      sourceBoost: 15,
      evidenceId: candidate.id,
      sourceUrl: candidate.url,
      recallSource: externalRecallSource(candidate.id),
      provenance: memoryProvenance({
        retrievalSource: "swarmvault",
        evidenceId: candidate.id,
        sourceUrl: candidate.url,
        title: candidate.title,
      }),
      metadata: {
        path: candidate.path,
        source: candidate.source,
        sourceType: `SwarmVault:${candidate.source}`,
        matchedQueries: candidate.matchedQueries,
      },
      rawMetadata: candidate.metadata,
    });
  }

  for (const candidate of input.sourceRegistry?.candidates ?? []) {
    pushMemorySource(sources, {
      id: `source_registry:${candidate.id}`,
      type: "source_registry",
      retrievalSource: "source_registry",
      title: candidate.title,
      summary: candidate.summary,
      sourceBoost: 11,
      evidenceId: candidate.id,
      sourceUrl: candidate.sourceUrl,
      createdAt: candidate.createdAt,
      recallSource: externalRecallSource(candidate.id),
      provenance: memoryProvenance({
        retrievalSource: "source_registry",
        evidenceId: candidate.id,
        sourceUrl: candidate.sourceUrl,
        createdAt: candidate.createdAt,
        title: candidate.title,
      }),
      metadata: {
        status: asString(candidate.metadata?.status),
        sourceType: "source_registry",
      },
      rawMetadata: candidate.metadata,
    });
  }

  for (const item of input.inboxItems ?? []) {
    pushMemorySource(sources, {
      id: `inbox:${item.id}`,
      type: "inbox",
      retrievalSource: "inbox",
      title: item.sourceType ?? "Inbox Item",
      summary: item.rawText ?? "",
      sourceBoost: 10,
      evidenceId: item.id,
      sourceUrl: item.sourceUrl ?? undefined,
      createdAt:
        typeof item.receivedAt === "string"
          ? item.receivedAt
          : item.receivedAt?.toISOString(),
      recallSource: externalRecallSource(item.id),
      provenance: memoryProvenance({
        retrievalSource: "inbox",
        evidenceId: item.id,
        sourceUrl: item.sourceUrl ?? undefined,
        createdAt:
          typeof item.receivedAt === "string"
            ? item.receivedAt
            : item.receivedAt?.toISOString(),
        title: item.sourceType ?? "Inbox Item",
      }),
      metadata: {
        status: "processed",
        sourceType: item.sourcePlatform ?? item.sourceType ?? undefined,
      },
    });
  }

  const queries = scoringQueries(input.queryText, input.searchQueries);
  const deduped = new Map<string, AgentMemoryItem>();

  for (const source of sources) {
    const item = buildMemoryItem(source, queries);
    if (!item) {
      continue;
    }

    const existing = deduped.get(item.id);
    if (!existing || item.score > existing.score) {
      deduped.set(item.id, item);
    }
  }

  const targetItems = Math.min(50, Math.max(1, input.topK ?? MEMORY_CONTEXT_TARGET_ITEMS));
  const dedupedItems = Array.from(deduped.values());
  const requiredItems = dedupedItems
    .filter((item) => item.metadata.required === true)
    .sort((left, right) => right.score - left.score);
  const requiredDedupKeys = new Set(requiredItems.map(memoryDedupKey));
  const ranked = [
    ...requiredItems,
    ...fuseMemoryItemsWithWeightedRrf(
      dedupedItems.filter((item) => !requiredDedupKeys.has(memoryDedupKey(item))),
      Math.max(0, targetItems - requiredItems.length),
    ),
  ].slice(0, Math.max(targetItems, requiredItems.length));
  const maxTokens = normalizeAgentContextBudgetTokens(input.budgetTokens);
  const reservedTokens = reservedTokensForBudget(maxTokens);
  const itemBudget = Math.max(0, maxTokens - reservedTokens);
  const memoryItems: AgentMemoryItem[] = [];
  const omissions: AgentContextOmission[] = [];
  let estimatedTokens = 0;

  for (const item of ranked) {
    if (
      item.metadata.required !== true &&
      estimatedTokens + item.tokenEstimate > itemBudget &&
      memoryItems.length > 0
    ) {
      omissions.push(omissionForMemoryItem(item));
      continue;
    }

    memoryItems.push(item);
    estimatedTokens += item.tokenEstimate;
  }

  return {
    memoryItems,
    omissions,
    tokenBudget: {
      maxTokens,
      reservedTokens,
      estimatedTokens,
      remainingTokens: Math.max(0, itemBudget - estimatedTokens),
      itemCount: memoryItems.length,
    } satisfies AgentContextTokenBudget,
  };
};

const contextBudgetFromMemory = (memory: {
  tokenBudget: AgentContextTokenBudget;
  omissions: AgentContextOmission[];
}): AgentContextBudget => ({
  maxTokens: memory.tokenBudget.maxTokens,
  reservedTokens: memory.tokenBudget.reservedTokens,
  estimatedTokens: memory.tokenBudget.estimatedTokens,
  remainingTokens: memory.tokenBudget.remainingTokens,
  includedCount: memory.tokenBudget.itemCount,
  omittedCount: memory.omissions.length,
});

export const memoryItemToMemorySource = (
  item: AgentMemoryItem,
): BackendMemorySource => ({
  id: item.id,
  text: [item.title, item.summary].filter(definedString).join("\n"),
  score: item.score,
  recallSource: item.recallSource,
  provenance: item.provenance,
  backendMetadata: item.backendMetadata,
});

export const createAgentContextReadOnlyMemoryAdapter = (
  memoryItems: readonly AgentMemoryItem[],
) => createReadOnlyMemoryAdapter(memoryItems.map(memoryItemToMemorySource));

const appendMemoryRetrievalDebug = (
  debug: AgentContextDebug,
  memoryItems: AgentMemoryItem[],
) => ({
  retrieval: [
    ...debug.retrieval,
    {
      source: "memory",
      status: memoryItems.length > 0 ? "ok" : "empty",
      candidateCount: memoryItems.length,
      searchedCount: memoryItems.length,
    } satisfies ContextRetrievalDebug,
  ],
});

const appendSwarmVaultRetrievalDebug = (
  debug: AgentContextDebug,
  swarmvault: SwarmVaultContextResult,
) => ({
  retrieval: [
    ...debug.retrieval,
    {
      source: "swarmvault",
      query: swarmvault.searchedQueries[0],
      status: swarmvault.status,
      candidateCount: swarmvault.candidates.length,
      searchedCount: swarmvault.searchedQueries.length,
      failedQueries: swarmvault.failedQueries,
    } satisfies ContextRetrievalDebug,
  ],
});

export async function searchWikiContextCandidates(queries: string[], limit = 8) {
  const result = await searchWikiContext(queries, limit);
  return result.candidates;
}

export async function getQueryAgentContext(
  query: string,
  db?: QueryContextDb,
  options: AgentContextOptions = {},
) {
  const required = await resolveRequiredWikiRefs(options.requiredRefs ?? []);
  const requiredMemorySources = required
    .map((item) => item.source)
    .filter((source): source is MemorySource => source !== undefined);
  const searchQueries = buildQuerySearchQueries(query, 12, options.scope);
  const [
    wiki,
    queryTasksResult,
    globalActivityResult,
    agentRunsResult,
    inboxItemsResult,
    projectEventsResult,
    swarmvault,
    sourceRegistryResult,
  ] = await Promise.all([
    searchWikiContext(
      searchQueries,
      AGENT_CONTEXT_POLICY.maxWikiCandidates,
      options.scope,
    ),
    safeContextSource("task", query, [], () => getQueryHotTasks(db)),
    safeContextSource("activity", query, [], () => getQueryActivity(db)),
    safeContextSource("agent_run", query, [], () =>
      getQueryAgentRuns(db, searchQueries),
    ),
    safeContextSource("inbox", query, [], () =>
      getQueryInboxItems(db, searchQueries),
    ),
    safeContextSource("project_event", query, [], () =>
      getQueryProjectEvents(db, searchQueries),
    ),
    searchSwarmVaultContext(query, { client: db?.swarmVault }),
    safeContextSource("source_registry", query, emptySourceRegistryContext(searchQueries), () =>
      searchSourceRegistryContext(query, searchQueries, db),
    ),
  ]);
  const operationalTasks = queryTasksResult.value;
  const queryTasks = filterTasksByQuery(operationalTasks, searchQueries);
  const globalActivity = globalActivityResult.value;
  const agentRuns = agentRunsResult.value;
  const inboxItems = inboxItemsResult.value;
  const projectEvents = projectEventsResult.value;
  const sourceRegistry = sourceRegistryResult.value;
  const sourceFailures = [
    queryTasksResult.failure,
    globalActivityResult.failure,
    agentRunsResult.failure,
    inboxItemsResult.failure,
    projectEventsResult.failure,
    sourceRegistryResult.failure,
  ].filter((failure): failure is ContextRetrievalDebug => failure !== null);
  const recentTasks: unknown[] = [];
  const relatedIdeas: IdeaContextRecord[] = [];
  const activity: ActivityRecord[] = [];
  const evidence = {
    episodes: findEpisodes(
      query,
      searchQueries,
      wiki,
      globalActivity,
      null,
      agentRuns,
      inboxItems,
    ),
  };
  const debug = buildRetrievalDebug({
    wiki,
    activity: globalActivity,
    queryTasks,
    projectEvents,
    agentRuns,
    inboxItems,
    sourceRegistry,
    sourceFailures,
  });
  const memory = buildMemoryContext({
    queryText: query,
    searchQueries,
    task: null,
    wiki,
    recentTasks,
    relatedIdeas,
    activity: globalActivity,
    queryTasks,
    projectEvents,
    agentRuns,
    inboxItems,
    swarmvault,
    sourceRegistry,
    requiredMemorySources,
    budgetTokens: options.budgetTokens,
    topK: options.topK,
  });

  const nextAction = computeNextAction({
    task: null,
    queryTasks: operationalTasks,
    globalActivity,
  });
  const tiers = buildContextTiers(
    {
      task: null,
      wiki,
      swarmvault,
      recentTasks,
      relatedIdeas,
      activity,
      queryTasks,
    },
    options.budgetTokens,
  );

  return {
    generatedAt: new Date().toISOString(),
    task: null,
    searchQueries,
    queryPlan: {
      original: query,
      scope: options.scope ?? {},
      searchedQueries: searchQueries,
      suppressedGenericTerms: suppressedGenericTermsForQuery(query),
      requiredRefCount: options.requiredRefs?.length ?? 0,
    },
    requiredRefs: required.map((item) => item.resolution),
    wiki,
    swarmvault,
    recentTasks,
    relatedIdeas,
    activity,
    evidence,
    debug: appendMemoryRetrievalDebug(
      appendSwarmVaultRetrievalDebug(debug, swarmvault),
      memory.memoryItems,
    ),
    memoryItems: memory.memoryItems,
    tokenBudget: memory.tokenBudget,
    budget: contextBudgetFromMemory(memory),
    cited: collectContextCitations(tiers, memory.memoryItems),
    omissions: memory.omissions,
    nextAction,
    tiers,
    policy: AGENT_CONTEXT_POLICY,
  } satisfies AgentContextPack;
}

export async function getAgentContext<TDb extends ContextDb>(
  db: TDb,
  taskId: string,
  options: AgentContextOptions = {},
): Promise<AgentContextPack> {
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<TaskRecord | null>;
    findMany(args: unknown): Promise<unknown[]>;
  };
  const activityLog = db.activityLog as {
    findMany(args: unknown): Promise<ActivityRecord[]>;
  };
  const ideaDelegate = db.idea as
    | { findMany(args: unknown): Promise<IdeaContextRecord[]> }
    | undefined;

  const task = await taskDelegate.findUnique({
    where: { id: taskId },
    include: {
      project: true,
      sourceInboxItem: true,
      sourceAgentRun: true,
      wikiLinks: true,
      contributions: { orderBy: { createdAt: "desc" }, take: 10 },
      artifacts: { orderBy: { createdAt: "desc" }, take: 10 },
      reviews: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!task) {
    throw new HttpError(404, "Task not found");
  }

  const searchQueries = buildContextSearchQueries(task);
  const ideaFilters: Array<{ projectId?: string; sourceInboxItemId?: string }> = [];
  if (task.projectId) {
    ideaFilters.push({ projectId: task.projectId });
  }
  if (task.sourceInboxItemId) {
    ideaFilters.push({ sourceInboxItemId: task.sourceInboxItemId });
  }
  const [
    wiki,
    recentTasksResult,
    relatedIdeas,
    activityResult,
    projectEventsResult,
    sourceRegistryResult,
  ] = await Promise.all([
    searchWikiContext(searchQueries, AGENT_CONTEXT_POLICY.maxWikiCandidates),
    safeContextSource("task", task.title, [], () =>
      taskDelegate.findMany({
        where: {
          id: { not: task.id },
          status: { not: "archived" },
          ...(task.projectId ? { projectId: task.projectId } : {}),
        },
        include: { project: true },
        orderBy: [{ updatedAt: "desc" }],
        take: 5,
      }),
    ),
    ideaDelegate && ideaFilters.length > 0
      ? ideaDelegate.findMany({
          where: {
            status: { notIn: ["archived", "promoted"] },
            OR: ideaFilters,
          },
          include: { project: true, sourceInboxItem: true },
          orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
          take: 5,
        })
      : Promise.resolve([]),
    safeContextSource("activity", task.title, [], () =>
      activityLog.findMany({
        where: { targetType: "task", targetId: task.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ),
    safeContextSource("project_event", task.title, [], () =>
      getTaskProjectEvents(db, task, searchQueries),
    ),
    safeContextSource("source_registry", task.title, emptySourceRegistryContext(searchQueries), () =>
      searchSourceRegistryContext(task.title, searchQueries, db),
    ),
  ]);
  const recentTasks = recentTasksResult.value;
  const activity = activityResult.value;
  const projectEvents = projectEventsResult.value;
  const sourceRegistry = sourceRegistryResult.value;
  const sourceFailures = [
    recentTasksResult.failure,
    activityResult.failure,
    projectEventsResult.failure,
    sourceRegistryResult.failure,
  ].filter((failure): failure is ContextRetrievalDebug => failure !== null);

  const evidence = {
    episodes: findEpisodes("", searchQueries, wiki, activity, task),
  };
  const debug = buildRetrievalDebug({
    wiki,
    activity,
    queryTasks: recentTasks,
    projectEvents,
    sourceRegistry,
    sourceFailures,
  });
  const swarmvault = emptySwarmVaultContext(searchQueries);
  const memory = buildMemoryContext({
    queryText: task.title,
    searchQueries,
    task,
    wiki,
    recentTasks,
    relatedIdeas,
    activity,
    projectEvents,
    sourceRegistry,
    budgetTokens: options.budgetTokens,
    topK: options.topK,
  });

  const nextAction = computeNextAction({
    task,
    queryTasks: [],
    globalActivity: activity,
  });
  const tiers = buildContextTiers(
    {
      task,
      wiki,
      swarmvault,
      recentTasks,
      relatedIdeas,
      activity,
    },
    options.budgetTokens,
  );

  return {
    generatedAt: new Date().toISOString(),
    task,
    searchQueries,
    queryPlan: {
      original: task.title,
      scope: task.project
        ? { projectId: task.project.id, projectName: task.project.name }
        : {},
      searchedQueries: searchQueries,
      suppressedGenericTerms: suppressedGenericTermsForQuery(task.title),
      requiredRefCount: 0,
    },
    requiredRefs: [],
    wiki,
    swarmvault,
    recentTasks,
    relatedIdeas,
    activity,
    evidence,
    debug: appendMemoryRetrievalDebug(debug, memory.memoryItems),
    memoryItems: memory.memoryItems,
    tokenBudget: memory.tokenBudget,
    budget: contextBudgetFromMemory(memory),
    cited: collectContextCitations(tiers, memory.memoryItems),
    omissions: memory.omissions,
    nextAction,
    tiers,
    policy: AGENT_CONTEXT_POLICY,
  } satisfies AgentContextPack;
}
