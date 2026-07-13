diff --git a/personal-os-app/src/lib/agent-context.ts b/personal-os-app/src/lib/agent-context.ts
index c8ca256..58e5235 100644
--- a/personal-os-app/src/lib/agent-context.ts
+++ b/personal-os-app/src/lib/agent-context.ts
@@ -145,6 +145,20 @@ export type AgentContextTiers = {
   cold: AgentContextTierItem[];
 };
 
+export type ContextEpisode = {
+  type: "agent_run" | "task" | "wiki" | "activity";
+  id: string;
+  title: string;
+  summary: string;
+  relevanceScore: number;
+  sourceUrl?: string;
+  createdAt?: string;
+};
+
+export type AgentContextEvidence = {
+  episodes: ContextEpisode[];
+};
+
 export type AgentContextPack = {
   generatedAt: string;
   task: TaskRecord | null;
@@ -153,6 +167,7 @@ export type AgentContextPack = {
   recentTasks: unknown[];
   relatedIdeas: IdeaContextRecord[];
   activity: ActivityRecord[];
+  evidence: AgentContextEvidence;
   tiers: AgentContextTiers;
   policy: AgentContextPolicy;
 };
@@ -543,6 +558,7 @@ function buildContextTiers(input: {
 
 type QueryContextDb = {
   task?: unknown;
+  activityLog?: unknown;
 };
 
 async function getQueryHotTasks(db?: QueryContextDb) {
@@ -573,6 +589,105 @@ async function getQueryHotTasks(db?: QueryContextDb) {
   });
 }
 
+async function getQueryActivity(db?: QueryContextDb, limit = 15) {
+  const activityLog = db?.activityLog as
+    | { findMany(args: unknown): Promise<ActivityRecord[]> }
+    | undefined;
+  if (!activityLog) {
+    return [];
+  }
+  return activityLog.findMany({
+    orderBy: { createdAt: "desc" },
+    take: limit,
+  });
+}
+
+function episodeMatches(text: string, keywords: string[]): boolean {
+  const lower = text.toLowerCase();
+  return keywords.some((k) => {
+    const kLower = k.toLowerCase();
+    if (lower.includes(kLower)) return true;
+    const words = kLower.split(/\s+/).filter((w) => w.length >= 3);
+    return words.some((w) => lower.includes(w));
+  });
+}
+
+function findEpisodes(
+  query: string,
+  searchQueries: string[],
+  wiki: WikiContextSearchResult,
+  activity: ActivityRecord[],
+  task: TaskRecord | null,
+): ContextEpisode[] {
+  const keywords = [...searchQueries, query].filter(Boolean);
+  const episodes: ContextEpisode[] = [];
+
+  for (const candidate of wiki.candidates) {
+    episodes.push({
+      type: "wiki",
+      id: candidate.path,
+      title: candidate.title,
+      summary: candidate.excerpt ?? "",
+      relevanceScore: candidate.score ?? 0,
+      sourceUrl: candidate.url,
+      createdAt: candidate.created,
+    });
+  }
+
+  for (const act of activity) {
+    const text = `${act.action} ${act.targetType} ${act.targetId}`;
+    if (episodeMatches(text, keywords)) {
+      episodes.push({
+        type: "activity",
+        id: act.id,
+        title: `${act.action} on ${act.targetType}`,
+        summary: `${act.action} ${act.targetType} ${act.targetId}`,
+        relevanceScore: 12,
+        createdAt:
+          typeof act.createdAt === "string"
+            ? act.createdAt
+            : act.createdAt?.toISOString(),
+      });
+    }
+  }
+
+  if (task?.sourceAgentRun) {
+    const run = task.sourceAgentRun;
+    const text = `${run.model} ${run.reasoningSummary} ${run.outputSummary}`;
+    if (episodeMatches(text, keywords) || task.sourceAgentRunId) {
+      episodes.push({
+        type: "agent_run",
+        id: task.sourceAgentRunId ?? "unknown",
+        title: run.model ?? "Agent Run",
+        summary: run.outputSummary ?? run.reasoningSummary ?? "",
+        relevanceScore: 18,
+      });
+    }
+  }
+
+  if (task?.contributions) {
+    for (const contrib of task.contributions) {
+      if (episodeMatches(contrib.summary, keywords)) {
+        episodes.push({
+          type: "task",
+          id: task.id,
+          title: task.title,
+          summary: contrib.summary,
+          relevanceScore: 22,
+          createdAt:
+            typeof contrib.createdAt === "string"
+              ? contrib.createdAt
+              : contrib.createdAt?.toISOString(),
+        });
+      }
+    }
+  }
+
+  return episodes
+    .sort((a, b) => b.relevanceScore - a.relevanceScore)
+    .slice(0, 8);
+}
+
 export async function searchWikiContext(
   queries: string[],
   limit = 8,
@@ -647,13 +762,17 @@ export async function searchWikiContextCandidates(queries: string[], limit = 8)
 
 export async function getQueryAgentContext(query: string, db?: QueryContextDb) {
   const searchQueries = [query.trim()].filter(Boolean);
-  const [wiki, queryTasks] = await Promise.all([
+  const [wiki, queryTasks, globalActivity] = await Promise.all([
     searchWikiContext(searchQueries, AGENT_CONTEXT_POLICY.maxWikiCandidates),
     getQueryHotTasks(db),
+    getQueryActivity(db),
   ]);
   const recentTasks: unknown[] = [];
   const relatedIdeas: IdeaContextRecord[] = [];
   const activity: ActivityRecord[] = [];
+  const evidence = {
+    episodes: findEpisodes(query, searchQueries, wiki, globalActivity, null),
+  };
 
   return {
     generatedAt: new Date().toISOString(),
@@ -663,6 +782,7 @@ export async function getQueryAgentContext(query: string, db?: QueryContextDb) {
     recentTasks,
     relatedIdeas,
     activity,
+    evidence,
     tiers: buildContextTiers({
       task: null,
       wiki,
@@ -745,6 +865,10 @@ export async function getAgentContext<TDb extends ContextDb>(
     }),
   ]);
 
+  const evidence = {
+    episodes: findEpisodes("", searchQueries, wiki, activity, task),
+  };
+
   return {
     generatedAt: new Date().toISOString(),
     task,
@@ -753,6 +877,7 @@ export async function getAgentContext<TDb extends ContextDb>(
     recentTasks,
     relatedIdeas,
     activity,
+    evidence,
     tiers: buildContextTiers({
       task,
       wiki,
diff --git a/personal-os-app/tests/services/agent-context.test.ts b/personal-os-app/tests/services/agent-context.test.ts
index d043db3..6e9c701 100644
--- a/personal-os-app/tests/services/agent-context.test.ts
+++ b/personal-os-app/tests/services/agent-context.test.ts
@@ -102,6 +102,7 @@ describe("agent context harness", () => {
     expect(context.recentTasks).toEqual([]);
     expect(context.relatedIdeas).toEqual([]);
     expect(context.activity).toEqual([]);
+    expect(context.evidence.episodes).toEqual([]);
     expect(context.tiers.hot).toEqual([]);
     expect(context.tiers.warm).toEqual([]);
     expect(context.tiers.cold[0]).toMatchObject({ type: "policy" });
@@ -134,9 +135,11 @@ describe("agent context harness", () => {
         project: { id: "project_1", name: "Personal OS" },
       },
     ]);
+    const activityLogFindMany = vi.fn().mockResolvedValue([]);
 
     const context = await getQueryAgentContext("personal os wiki", {
       task: { findMany: taskFindMany },
+      activityLog: { findMany: activityLogFindMany },
     });
 
     expect(taskFindMany).toHaveBeenCalledWith(
@@ -155,6 +158,10 @@ describe("agent context harness", () => {
       type: "wiki",
       path: "projects/personal-os/context-tiering.md",
     });
+    expect(context.evidence.episodes[0]).toMatchObject({
+      type: "wiki",
+      id: "projects/personal-os/context-tiering.md",
+    });
   });
 
   it("puts the current task in hot tier and historical wiki hits in warm tier", async () => {
@@ -214,5 +221,108 @@ describe("agent context harness", () => {
       type: "wiki",
       path: "projects/personal-os/context-tiering-decision.md",
     });
+    expect(context.evidence.episodes[0]).toMatchObject({
+      type: "wiki",
+      id: "projects/personal-os/context-tiering-decision.md",
+    });
+  });
+
+  it("recalls related activity episodes for query keywords", async () => {
+    mockedSearchWikiNotes.mockResolvedValue([]);
+    const activityLogFindMany = vi.fn().mockResolvedValue([
+      {
+        id: "act_1",
+        actorType: "system",
+        action: "wiki.ingest.failed",
+        targetType: "wiki",
+        targetId: "wiki_1",
+        createdAt: "2026-06-23T12:00:00.000Z",
+      },
+      {
+        id: "act_2",
+        actorType: "system",
+        action: "task.submitted",
+        targetType: "task",
+        targetId: "task_1",
+        createdAt: "2026-06-23T11:00:00.000Z",
+      },
+    ]);
+
+    const context = await getQueryAgentContext("wiki write failed", {
+      activityLog: { findMany: activityLogFindMany },
+    });
+
+    expect(context.evidence.episodes).toHaveLength(1);
+    expect(context.evidence.episodes[0]).toMatchObject({
+      type: "activity",
+      id: "act_1",
+      title: "wiki.ingest.failed on wiki",
+      relevanceScore: 12,
+    });
+  });
+
+  it("recalls task contribution episodes when task has matching history", async () => {
+    mockedSearchWikiNotes.mockResolvedValue([
+      {
+        title: "Wiki write failure runbook",
+        path: "runbooks/wiki-write-failure.md",
+        tags: ["runbook"],
+        concepts: ["wiki"],
+        excerpt: "Steps to recover from wiki write failures.",
+      },
+    ]);
+
+    const task = {
+      id: "task_current",
+      title: "Fix wiki write pipeline",
+      description: "Debug and fix wiki write failures.",
+      status: "doing",
+      priority: "P0",
+      riskLevel: "low",
+      executionMode: "agent_allowed",
+      agentTags: ["personal-os", "wiki"],
+      ownerAgent: "hermes",
+      leaseUntil: new Date(Date.now() + 60_000).toISOString(),
+      nextAction: "Apply the fix from previous runbook.",
+      definitionOfDone: "Wiki writes succeed.",
+      projectId: "project_1",
+      sourceInboxItemId: null,
+      sourceAgentRunId: null,
+      project: { id: "project_1", name: "Personal OS" },
+      sourceInboxItem: null,
+      sourceAgentRun: {
+        model: "hermes-agent",
+        reasoningSummary: "Wiki write failed due to timeout.",
+        outputSummary: "Applied retry logic and succeeded.",
+      },
+      wikiLinks: [],
+      contributions: [
+        {
+          agentId: "obsidianmanager1",
+          summary: "Fixed wiki write timeout by adding retry logic.",
+          createdAt: "2026-06-23T10:00:00.000Z",
+        },
+      ],
+      artifacts: [],
+      reviews: [],
+    };
+
+    const context = await getAgentContext(
+      {
+        task: {
+          findUnique: vi.fn().mockResolvedValue(task),
+          findMany: vi.fn().mockResolvedValue([]),
+        },
+        idea: { findMany: vi.fn().mockResolvedValue([]) },
+        activityLog: { findMany: vi.fn().mockResolvedValue([]) },
+      },
+      "task_current",
+    );
+
+    const episodes = context.evidence.episodes;
+    expect(episodes.length).toBeGreaterThanOrEqual(3);
+    expect(episodes.some((e) => e.type === "wiki")).toBe(true);
+    expect(episodes.some((e) => e.type === "agent_run")).toBe(true);
+    expect(episodes.some((e) => e.type === "task" && e.summary.includes("retry logic"))).toBe(true);
   });
 });
