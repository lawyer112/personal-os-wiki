# AgentRun Context Pack cmqqxalsj000i0jpjtjlqncdo
## 结论
- task_id: cmqqxalsj000i0jpjtjlqncdo
- archive_task_id: cmqqxals8000f0jpj7dgqj12m
- task_title: 给 Personal OS context 增加同类任务 episode 召回 v0
- task_status: doing
- project: Personal OS / Wiki 知识库升级
- gate: pass
- run_dir: .agent-runs/cmqqxalsj000i0jpjtjlqncdo
- generated_at: 2026-06-23T19:28:24.117Z
## 字段映射
| Wiki 字段 | 来源 | 处理规则 |
| --- | --- | --- |
| task_id | Personal OS /api/agent/context.task.id | 作为本 context pack 的主索引 |
| gate | .agent-runs/<task-id>/gate.json | 摘要 status、verifier、deployment、writeback |
| diff | worker-result.diff_stat + diff.patch | 记录变更文件、diff stat 和截断后的安全摘录 |
| 测试 | gate.verifier.commands + worker-result.commands | 保留命令、exit_code、证据路径 |
| 部署 | gate.deployment + production_regression | 保留 backup、rollback、生产回归状态 |
| 残余风险 | worker-result.risks / blocked_reason | 无风险时显式写“未发现新增残余风险” |
| artifact index | run_dir 文件清单 | 只记录相对路径与大小，不写入 token/密钥 |
## Gate
- status: pass
- synthesizer_allowed: true
- definition_of_done_met: unknown
## Diff
- path: diff.patch
- stat:
```text
未提供 diff_stat；查看 diff.patch 或 artifact index。
```
- changed_files:
- 未记录 changed_files。需要查看 diff.patch。

### diff excerpt

```diff
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


...diff excerpt truncated...
```

## 测试 / 验证

- 未发现命令记录；该 pack 标记为 evidence incomplete。

## 部署 / 生产回归

- deployment_status: not_applicable_or_missing
- backup_dir: 未记录
- rollback_path: 未记录
- production_regression_status: 未记录

## 写回

- writeback_status: 未记录
- task_status_after_writeback: 未记录
- wiki_links:
- GitHub 知识雷达 2026-06-23 Personal OS Wiki 自驱候选 — http://192.168.6.37:3100/api/wiki/open?next=%2Fhttp%3A%2F%2F192.168.6.37%3A3422%2Fnote%3Fpath%3D30_projects%252FPersonal-OS-Wiki-%25E7%259F%25A5%25E8%25AF%2586%25E5%25BA%2593%25E5%258D%2587%25E7%25BA%25A7%252FGitHub-%25E7%259F%25A5%25E8%25AF%2586%25E9%259B%25B7%25E8%25BE%25BE-2026-06-23-Personal-OS-Wiki-%25E8%2587%25AA%25E9%25A9%25B1%25E5%2580%2599%25E9%2580%2589-r2.md

## 残余风险

- 未发现新增残余风险；保留源 run_dir 与备份路径用于回溯。

## Artifact index

- context-pack-payload.json (13058 bytes)
- context-pack-result.json (336 bytes)
- context-pack.md (10499 bytes)
- diff.patch (10811 bytes)
- gate.json (768 bytes)
- worker-result.json (856 bytes)