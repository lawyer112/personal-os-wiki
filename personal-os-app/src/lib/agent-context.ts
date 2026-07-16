import { HttpError } from "@/lib/http";
import { searchMemoryVectors } from "@/lib/memory-vector-store";
import {
  searchWikiNotes,
  wikiNoteUrl,
  type WikiContextCandidate,
  type WikiNoteSummary,
} from "@/lib/wiki-client";

type ContextDb = {
  task: unknown;
  idea?: unknown;
  activityLog: unknown;
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

type IdeaContextRecord = {
  id: string;
  title: string;
  body?: string | null;
  status: string;
  priority: string;
  nextAction?: string | null;
  project?: { id: string; name: string } | null;
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

export type AgentContextTierItem = {
  type: "task" | "wiki" | "idea" | "activity" | "policy";
  reason: string;
  id?: string;
  title?: string;
  status?: string;
  priority?: string;
  path?: string;
  url?: string;
  score?: number;
  matchedQueries?: string[];
  action?: string;
  targetType?: string;
  targetId?: string;
  projectName?: string;
  ownerAgent?: string | null;
  leaseUntil?: Date | string | null;
  nextAction?: string | null;
  definitionOfDone?: string | null;
};

export type AgentContextTiers = {
  hot: AgentContextTierItem[];
  warm: AgentContextTierItem[];
  cold: AgentContextTierItem[];
};

export type ContextEpisode = {
  type: "agent_run" | "task" | "wiki" | "activity" | "memory";
  id: string;
  title: string;
  summary: string;
  relevanceScore: number;
  sourceUrl?: string;
  createdAt?: string;
};

export type AgentContextEvidence = {
  episodes: ContextEpisode[];
};

export type AgentContextPack = {
  generatedAt: string;
  task: TaskRecord | null;
  searchQueries: string[];
  wiki: WikiContextSearchResult;
  recentTasks: unknown[];
  relatedIdeas: IdeaContextRecord[];
  activity: ActivityRecord[];
  evidence: AgentContextEvidence;
  tiers: AgentContextTiers;
  policy: AgentContextPolicy;
  nextAction: string;
};

export const AGENT_CONTEXT_POLICY: AgentContextPolicy = {
  canReadWiki: true,
  canSuggestWikiUpdates: true,
  canAutoArchiveKnowledge: false,
  mustConfirmDelete: true,
  maxWikiCandidates: 8,
  note: "Personal OS 只做机械检索和规则约束；Hermes 负责判断候选知识是否可用。",
};

const knownContextTerms = [
  "Hermes",
  "Personal OS",
  "Personal Wiki",
  "DeepTalk",
  "Telegram",
  "Obsidian",
  "OpenCode",
  "钉钉",
  "知识库",
  "入库",
  "语音转文字",
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
]);

// Low-information role/structural terms that should not dominate ranking when
// mixed with concrete technical concepts. Keep in sync with tests.
const BROAD_ROLE_TERMS = new Set([
  "用户",
  "管理员",
  "知识库管理员",
  "管理员",
  "assistant",
  "助手",
  "agent",
  "bot",
  "classic",
  "hermes",
  "xingqiwu",
  "我",
  "你",
  "我们",
  "大家",
  "所有人",
  "每个人",
  "someone",
  "everyone",
  "anyone",
  "user",
  "admin",
  "manager",
  "operator",
  "owner",
  "viewer",
  "reader",
  "writer",
  "executor",
  "worker",
  "observer",
]);

// Penalty applied per broad role term match. Tuned so a note whose title only
// matches broad terms still scores lower than a note whose title matches a
// concrete concept.
const BROAD_ROLE_PENALTY = 18;

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

  const tokens = text.match(/[A-Za-z][A-Za-z0-9_.-]{2,}/g) ?? [];
  for (const token of tokens) {
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

function isBroadRoleTerm(term: string): boolean {
  return BROAD_ROLE_TERMS.has(term.toLowerCase().trim());
}

function countBroadRoleMatches(text: string, queries: string[]): number {
  const lowerText = text.toLowerCase();
  return queries.filter((q) => isBroadRoleTerm(q) && lowerText.includes(q.toLowerCase())).length;
}

function scoreNote(
  note: WikiNoteSummary,
  queries: string[],
  retrievedByQuery: string,
) {
  const matchedQueries = new Set<string>();
  let score = 0;

  for (const query of queries) {
    const normalizedQuery = query.toLowerCase();
    const title = note.title?.toLowerCase() ?? "";
    const excerpt = note.excerpt?.toLowerCase() ?? "";
    const sourceType = note.source_type?.toLowerCase() ?? "";
    const sourceUrl = note.source_url?.toLowerCase() ?? "";
    const tags = (note.tags ?? []).map((tag) => tag.toLowerCase());
    const concepts = (note.concepts ?? []).map((concept) =>
      concept.toLowerCase(),
    );

    if (title.includes(normalizedQuery)) {
      score += 30;
      matchedQueries.add(query);
    }

    if (concepts.some((concept) => concept.includes(normalizedQuery))) {
      score += 20;
      matchedQueries.add(query);
    }

    if (tags.some((tag) => tag.includes(normalizedQuery))) {
      score += 14;
      matchedQueries.add(query);
    }

    if (excerpt.includes(normalizedQuery)) {
      score += 8;
      matchedQueries.add(query);
    }

    if (
      sourceType.includes(normalizedQuery) ||
      sourceUrl.includes(normalizedQuery)
    ) {
      score += 4;
      matchedQueries.add(query);
    }
  }

  if (!matchedQueries.has(retrievedByQuery)) {
    score += 5;
    matchedQueries.add(retrievedByQuery);
  }

  // Down-rank notes whose signal comes mainly from broad role/structural terms.
  const broadTitleHits = countBroadRoleMatches(note.title ?? "", queries);
  const broadExcerptHits = countBroadRoleMatches(note.excerpt ?? "", queries);
  score -= BROAD_ROLE_PENALTY * (broadTitleHits + broadExcerptHits * 0.5);

  return { matchedQueries, score };
}

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

function buildContextTiers(input: {
  task: TaskRecord | null;
  wiki: WikiContextSearchResult;
  recentTasks: unknown[];
  relatedIdeas: IdeaContextRecord[];
  activity: ActivityRecord[];
  queryTasks?: unknown[];
}): AgentContextTiers {
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

  input.wiki.candidates.forEach((candidate, index) => {
    const item = wikiTierItem(candidate, "matched Personal Wiki evidence");
    const targetTier = index < 3 || (candidate.score ?? 0) >= 30 ? warm : cold;
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
    hot: hot.slice(0, 8),
    warm: warm.slice(0, 12),
    cold: cold.slice(0, 12),
  };
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

function episodeMatches(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => {
    const kLower = k.toLowerCase();
    if (lower.includes(kLower)) return true;
    const words = kLower.split(/\s+/).filter((w) => w.length >= 3);
    return words.some((w) => lower.includes(w));
  });
}

async function findMemoryEpisodes(
  query: string,
  searchQueries: string[],
): Promise<ContextEpisode[]> {
  // Read-only vector candidate recall. Degrades to [] if the MemoryItem
  // table is empty, missing, or the search fails - never breaks context.
  //
  // Can be disabled via MEMORY_VECTOR_RECALL_ENABLED=false for safe rollback.
  if (
    (process.env.MEMORY_VECTOR_RECALL_ENABLED ?? "true").toLowerCase() ===
    "false"
  ) {
    return [];
  }
  const probe = [query, ...searchQueries].map((q) => q.trim()).filter(Boolean);
  if (probe.length === 0) return [];
  try {
    const hits = await searchMemoryVectors(probe.join(" "), {
      limit: 5,
      minSimilarity: 0.1,
    });
    return hits.map((hit) => ({
      type: "memory" as const,
      id: `vec:${hit.id}`,
      title: hit.title,
      summary: hit.body.slice(0, 240),
      relevanceScore: Math.round(hit.similarity * 60),
      createdAt:
        typeof hit.createdAt === "string"
          ? hit.createdAt
          : hit.createdAt?.toISOString(),
    }));
  } catch {
    return [];
  }
}

function findEpisodes(
  query: string,
  searchQueries: string[],
  wiki: WikiContextSearchResult,
  activity: ActivityRecord[],
  task: TaskRecord | null,
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

export async function searchWikiContext(
  queries: string[],
  limit = 8,
): Promise<WikiContextSearchResult> {
  const searchedQueries = Array.from(
    new Set(queries.map((query) => query.trim()).filter(Boolean)),
  );
  const noteMap = new Map<string, WikiContextCandidate>();
  const failedQueries: WikiContextSearchResult["failedQueries"] = [];
  let successfulQueries = 0;

  const results = await Promise.all(
    searchedQueries.map(async (query) => {
      try {
        const notes = await searchWikiNotes(query, 6);
        return { query, notes };
      } catch (error) {
        return { query, error };
      }
    }),
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
      const existing = noteMap.get(note.path);
      const scored = scoreNote(note, searchedQueries, result.query);
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

export async function searchWikiContextCandidates(queries: string[], limit = 8) {
  const result = await searchWikiContext(queries, limit);
  return result.candidates;
}

export async function getQueryAgentContext(query: string, db?: QueryContextDb) {
  const searchQueries = [query.trim()].filter(Boolean);
  const [wiki, queryTasks, globalActivity] = await Promise.all([
    searchWikiContext(searchQueries, AGENT_CONTEXT_POLICY.maxWikiCandidates),
    getQueryHotTasks(db),
    getQueryActivity(db),
  ]);
  const recentTasks: unknown[] = [];
  const relatedIdeas: IdeaContextRecord[] = [];
  const activity: ActivityRecord[] = [];
  const memoryEpisodes = await findMemoryEpisodes(query, searchQueries);
  const evidence = {
    episodes: [
      ...findEpisodes(query, searchQueries, wiki, globalActivity, null),
      ...memoryEpisodes,
    ]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8),
  };

  const nextAction = computeNextAction({
    task: null,
    queryTasks,
    globalActivity,
  });

  return {
    generatedAt: new Date().toISOString(),
    task: null,
    searchQueries,
    wiki,
    recentTasks,
    relatedIdeas,
    activity,
    evidence,
    nextAction,
    tiers: buildContextTiers({
      task: null,
      wiki,
      recentTasks,
      relatedIdeas,
      activity,
      queryTasks,
    }),
    policy: AGENT_CONTEXT_POLICY,
  } satisfies AgentContextPack;
}

export async function getAgentContext<TDb extends ContextDb>(
  db: TDb,
  taskId: string,
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
      runs: { orderBy: { startedAt: "desc" }, take: 5 },
      agentActionLogs: { orderBy: { createdAt: "desc" }, take: 12 },
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
  const [wiki, recentTasks, relatedIdeas, activity] = await Promise.all([
    searchWikiContext(searchQueries, AGENT_CONTEXT_POLICY.maxWikiCandidates),
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
    activityLog.findMany({
      where: { targetType: "task", targetId: task.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const memoryEpisodes = await findMemoryEpisodes("", searchQueries);
  const evidence = {
    episodes: [
      ...findEpisodes("", searchQueries, wiki, activity, task),
      ...memoryEpisodes,
    ]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8),
  };

  const nextAction = computeNextAction({
    task,
    queryTasks: [],
    globalActivity: activity,
  });

  return {
    generatedAt: new Date().toISOString(),
    task,
    searchQueries,
    wiki,
    recentTasks,
    relatedIdeas,
    activity,
    evidence,
    nextAction,
    tiers: buildContextTiers({
      task,
      wiki,
      recentTasks,
      relatedIdeas,
      activity,
    }),
    policy: AGENT_CONTEXT_POLICY,
  };
}
