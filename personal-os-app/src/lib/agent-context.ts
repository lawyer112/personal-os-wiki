import { HttpError } from "@/lib/http";
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

export type AgentContextPack = {
  generatedAt: string;
  task: TaskRecord | null;
  searchQueries: string[];
  wiki: WikiContextSearchResult;
  recentTasks: unknown[];
  relatedIdeas: IdeaContextRecord[];
  activity: ActivityRecord[];
  policy: AgentContextPolicy;
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

export async function getQueryAgentContext(query: string) {
  const searchQueries = [query.trim()].filter(Boolean);
  const wiki = await searchWikiContext(
    searchQueries,
    AGENT_CONTEXT_POLICY.maxWikiCandidates,
  );

  return {
    generatedAt: new Date().toISOString(),
    task: null,
    searchQueries,
    wiki,
    recentTasks: [],
    relatedIdeas: [],
    activity: [],
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

  return {
    generatedAt: new Date().toISOString(),
    task,
    searchQueries,
    wiki,
    recentTasks,
    relatedIdeas,
    activity,
    policy: AGENT_CONTEXT_POLICY,
  };
}
