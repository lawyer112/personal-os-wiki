diff --git a/personal-os-app/src/lib/agent-context.ts b/personal-os-app/src/lib/agent-context.ts
index 58e5235..bf4c5e7 100644
--- a/personal-os-app/src/lib/agent-context.ts
+++ b/personal-os-app/src/lib/agent-context.ts
@@ -170,6 +170,7 @@ export type AgentContextPack = {
   evidence: AgentContextEvidence;
   tiers: AgentContextTiers;
   policy: AgentContextPolicy;
+  nextAction: string;
 };
 
 export const AGENT_CONTEXT_POLICY: AgentContextPolicy = {
@@ -556,6 +557,49 @@ function buildContextTiers(input: {
   };
 }
 
+function computeNextAction(input: {
+  task?: TaskRecord | null;
+  queryTasks?: unknown[];
+  globalActivity?: ActivityRecord[];
+}): string {
+  const { task, queryTasks = [], globalActivity = [] } = input;
+
+  if (task) {
+    if (task.status === "doing") {
+      return `继续执行当前任务：${task.title}`;
+    }
+    if (task.status === "review") {
+      return `当前任务 ${task.title} 待 review，等待 Classic 确认`;
+    }
+    if (["blocked", "waiting"].includes(task.status)) {
+      return `当前任务 ${task.title} 被阻塞，需要调查原因`;
+    }
+  }
+
+  for (const rawTask of queryTasks) {
+    const t = asTaskLike(rawTask);
+    if (t && isAgentExecutableHotTask(t)) {
+      return `执行 ${t.priority} Agent 任务：${t.title}`;
+    }
+  }
+
+  for (const rawTask of queryTasks) {
+    const t = asTaskLike(rawTask);
+    if (t && isRecentBlocker(t)) {
+      return `调查阻塞任务：${t.title}`;
+    }
+  }
+
+  const failedRuns = (globalActivity ?? []).filter(
+    (act) => act.action === "agentRun.failed",
+  );
+  if (failedRuns.length > 0) {
+    return `调查最近 ${failedRuns.length} 个失败的 AgentRun`;
+  }
+
+  return "无高优先级可执行任务；运行 GitHub 雷达获取新任务";
+}
+
 type QueryContextDb = {
   task?: unknown;
   activityLog?: unknown;
@@ -774,6 +818,12 @@ export async function getQueryAgentContext(query: string, db?: QueryContextDb) {
     episodes: findEpisodes(query, searchQueries, wiki, globalActivity, null),
   };
 
+  const nextAction = computeNextAction({
+    task: null,
+    queryTasks,
+    globalActivity,
+  });
+
   return {
     generatedAt: new Date().toISOString(),
     task: null,
@@ -783,6 +833,7 @@ export async function getQueryAgentContext(query: string, db?: QueryContextDb) {
     relatedIdeas,
     activity,
     evidence,
+    nextAction,
     tiers: buildContextTiers({
       task: null,
       wiki,
@@ -869,6 +920,12 @@ export async function getAgentContext<TDb extends ContextDb>(
     episodes: findEpisodes("", searchQueries, wiki, activity, task),
   };
 
+  const nextAction = computeNextAction({
+    task,
+    queryTasks: [],
+    globalActivity: activity,
+  });
+
   return {
     generatedAt: new Date().toISOString(),
     task,
@@ -878,6 +935,7 @@ export async function getAgentContext<TDb extends ContextDb>(
     relatedIdeas,
     activity,
     evidence,
+    nextAction,
     tiers: buildContextTiers({
       task,
       wiki,
diff --git a/personal-os-app/tests/services/agent-context.test.ts b/personal-os-app/tests/services/agent-context.test.ts
index 6e9c701..bf08d89 100644
--- a/personal-os-app/tests/services/agent-context.test.ts
+++ b/personal-os-app/tests/services/agent-context.test.ts
@@ -108,6 +108,7 @@ describe("agent context harness", () => {
     expect(context.tiers.cold[0]).toMatchObject({ type: "policy" });
     expect(context.policy.canReadWiki).toBe(true);
     expect(context.wiki.status).toBe("empty");
+    expect(context.nextAction).toBe("无高优先级可执行任务；运行 GitHub 雷达获取新任务");
   });
 
   it("adds P0/P1 agent executable tasks to hot tier for keyword lookups", async () => {
@@ -162,6 +163,7 @@ describe("agent context harness", () => {
       type: "wiki",
       id: "projects/personal-os/context-tiering.md",
     });
+    expect(context.nextAction).toBe("执行 P0 Agent 任务：把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0");
   });
 
   it("puts the current task in hot tier and historical wiki hits in warm tier", async () => {
@@ -225,6 +227,7 @@ describe("agent context harness", () => {
       type: "wiki",
       id: "projects/personal-os/context-tiering-decision.md",
     });
+    expect(context.nextAction).toBe("继续执行当前任务：把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0");
   });
 
   it("recalls related activity episodes for query keywords", async () => {
@@ -261,6 +264,36 @@ describe("agent context harness", () => {
     });
   });
 
+  it("recommends investigating failed agent runs when recent failures exist", async () => {
+    mockedSearchWikiNotes.mockResolvedValue([]);
+    const taskFindMany = vi.fn().mockResolvedValue([]);
+    const activityLogFindMany = vi.fn().mockResolvedValue([
+      {
+        id: "act_fail_1",
+        actorType: "hermes",
+        action: "agentRun.failed",
+        targetType: "agentRun",
+        targetId: "run_1",
+        createdAt: "2026-06-23T22:08:27.000Z",
+      },
+      {
+        id: "act_fail_2",
+        actorType: "hermes",
+        action: "agentRun.failed",
+        targetType: "agentRun",
+        targetId: "run_2",
+        createdAt: "2026-06-23T22:08:02.000Z",
+      },
+    ]);
+
+    const context = await getQueryAgentContext("agent executable tasks", {
+      task: { findMany: taskFindMany },
+      activityLog: { findMany: activityLogFindMany },
+    });
+
+    expect(context.nextAction).toBe("调查最近 2 个失败的 AgentRun");
+  });
+
   it("recalls task contribution episodes when task has matching history", async () => {
     mockedSearchWikiNotes.mockResolvedValue([
       {
