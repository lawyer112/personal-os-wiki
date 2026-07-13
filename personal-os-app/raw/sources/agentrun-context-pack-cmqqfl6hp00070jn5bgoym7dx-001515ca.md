# AgentRun Context Pack cmqqfl6hp00070jn5bgoym7dx
## 结论
- task_id: cmqqfl6hp00070jn5bgoym7dx
- archive_task_id: cmqqfl6rk00090jn58kastmq9
- task_title: 把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0
- task_status: done
- project: Personal OS / Wiki 知识库升级
- gate: pass
- run_dir: .agent-runs/cmqqfl6hp00070jn5bgoym7dx
- generated_at: 2026-06-23T11:15:29.333Z
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
- definition_of_done_met: true
## Diff
- path: diff.patch
- stat:
```text
personal-os-app/src/app/api/agent/context/route.ts |   2 +-
 personal-os-app/src/lib/agent-context.ts           | 305 ++++++++++++++++++++-
 .../tests/services/agent-context.test.ts           | 111 ++++++++
 3 files changed, 409 insertions(+), 9 deletions(-)
```
- changed_files:
- personal-os-app/src/app/api/agent/context/route.ts
- personal-os-app/src/lib/agent-context.ts
- personal-os-app/tests/services/agent-context.test.ts

### diff excerpt

```diff
diff --git a/personal-os-app/src/app/api/agent/context/route.ts b/personal-os-app/src/app/api/agent/context/route.ts
index 529ae78..a92f887 100644
--- a/personal-os-app/src/app/api/agent/context/route.ts
+++ b/personal-os-app/src/app/api/agent/context/route.ts
@@ -17,7 +17,7 @@ export async function GET(request: Request) {
     }
 
     if (query) {
-      const context = await getQueryAgentContext(query);
+      const context = await getQueryAgentContext(query, prisma);
       return json({
         ok: true,
         context,
diff --git a/personal-os-app/src/lib/agent-context.ts b/personal-os-app/src/lib/agent-context.ts
index 28c2af7..c8ca256 100644
--- a/personal-os-app/src/lib/agent-context.ts
+++ b/personal-os-app/src/lib/agent-context.ts
@@ -118,6 +118,33 @@ export type AgentContextPolicy = {
   note: string;
 };
 
+export type AgentContextTierItem = {
+  type: "task" | "wiki" | "idea" | "activity" | "policy";
+  reason: string;
+  id?: string;
+  title?: string;
+  status?: string;
+  priority?: string;
+  path?: string;
+  url?: string;
+  score?: number;
+  matchedQueries?: string[];
+  action?: string;
+  targetType?: string;
+  targetId?: string;
+  projectName?: string;
+  ownerAgent?: string | null;
+  leaseUntil?: Date | string | null;
+  nextAction?: string | null;
+  definitionOfDone?: string | null;
+};
+
+export type AgentContextTiers = {
+  hot: AgentContextTierItem[];
+  warm: AgentContextTierItem[];
+  cold: AgentContextTierItem[];
+};
+
 export type AgentContextPack = {
   generatedAt: string;
   task: TaskRecord | null;
@@ -126,6 +153,7 @@ export type AgentContextPack = {
   recentTasks: unknown[];
   relatedIdeas: IdeaContextRecord[];
   activity: ActivityRecord[];
+  tiers: AgentContextTiers;
   policy: AgentContextPolicy;
 };
 
@@ -302,6 +330,249 @@ function errorMessage(error: unknown) {
   return error instanceof Error ? error.message : "Unknown wiki search error";
 }
 
+function isRecord(value: unknown): value is Record<string, unknown> {
+  return typeof value === "object" && value !== null;
+}
+
+function asString(value: unknown) {
+  return typeof value === "string" ? value : undefined;
+}
+
+function asTaskLike(value: unknown): Partial<TaskRecord> | null {
+  if (!isRecord(value)) {
+    return null;
+  }
+
+  const id = asString(value.id);
+  const title = asString(value.title);
+  const status = asString(value.status);
+  const priority = asString(value.priority);
+
+  if (!id || !title || !status || !priority) {
+    return null;
+  }
+
+  const project = isRecord(value.project)
+    ? {
+        id: asString(value.project.id) ?? "",
+        name: asString(value.project.name) ?? "",
+      }
+    : null;
+
+  return {
+    id,
+    title,
+    status,
+    priority,
+    riskLevel: asString(value.riskLevel),
+    executionMode: asString(value.executionMode),
+    ownerAgent: asString(value.ownerAgent) ?? null,
+    leaseUntil: asString(value.leaseUntil),
+    nextAction: asString(value.nextAction) ?? "",
+    definitionOfDone: asString(value.definitionOfDone) ?? "",
+    project,
+  };
+}
+
+function isAgentExecutableHotTask(task: Partial<TaskRecord>) {
+  return (
+    task.executionMode === "agent_allowed" &&
+    ["P0", "P1"].includes(task.priority ?? "") &&
+    ["todo", "doing", "review"].includes(task.status ?? "")
+  );
+}
+
+function isRecentBlocker(task: Partial<TaskRecord>) {
+  return ["blocked", "waiting"].includes(task.status ?? "");
+}
+
+function taskTierItem(
+  task: Partial<TaskRecord>,
+  reason: string,
+): AgentContextTierItem {
+  return {
+    type: "task",
+    reason,
+    id: task.id,
+    title: task.title,
+    status: task.status,
+    priority: task.priority,
+    projectName: task.project?.name,
+    ownerAgent: task.ownerAgent,
+    leaseUntil: task.leaseUntil,
+    nextAction: task.nextAction,
+    definitionOfDone: task.definitionOfDone,
+  };
+}
+
+function wikiTierItem(
+  candidate: WikiContextCandidate,
+  reason: string,
+): AgentContextTierItem {
+  return {
+    type: "wiki",
+    reason,
+    title: candidate.title,
+    path: candidate.path,
+    url: candidate.url,
+    score: candidate.score,
+    matchedQueries: candidate.matchedQueries,
+  };
+}
+
+function ideaTierItem(
+  idea: IdeaContextRecord,
+  reason: string,
+): AgentContextTierItem {
+  return {
+    type: "idea",
+    reason,
+    id: idea.id,
+    title: idea.title,
+    status: idea.status,
+    priority: idea.priority,
+    projectName: idea.project?.name,
+    nextAction: idea.nextAction,
+  };
+}
+
+function activityTierItem(
+  activity: ActivityRecord,
+  reason: string,
+): AgentContextTierItem {
+  return {
+    type: "activity",
+    reason,
+    id: activity.id,
+    action: activity.action,
+    targetType: activity.targetType,
+    targetId: activity.targetId,
+  };
+}
+
+function tierKey(item: AgentContextTierItem) {
+  return [item.type, item.id, item.path, item.action, item.targetId]
+    .filter(Boolean)
+    .join(":");
+}
+
+function pushUnique(
+  tier: AgentContextTierItem[],
+  seen: Set<string>,
+  item: AgentContextTierItem,
+) {
+  const key = tierKey(item);
+  if (!key || seen.has(key)) {
+    return;
+  }
+  seen.add(key);
+  tier.push(item);
+}
+
+function buildContextTiers(input: {
+  task: TaskRecord | null;
+  wiki: WikiContextSearchResult;
+  recentTasks: unknown[];
+  relatedIdeas: IdeaContextRecord[];
+  activity: ActivityRecord[];
+  queryTasks?: unknown[];
+}): AgentContextTiers {
+  const hot: AgentContextTierItem[] = [];
+  const warm: AgentContextTierItem[] = [];
+  const cold: AgentContextTierItem[] = [];
+  const seen = new Set<string>();
+
+  if (input.task) {
+    pushUnique(hot, seen, taskTierItem(input.task, "current task being executed"));
+  }
+
+  for (const rawTask of input.queryTasks ?? []) {
+    const task = asTaskLike(rawTask);
+    if (!task) {
+      continue;
+    }
+    if (isAgentExecutableHotTask(task)) {
+      pushUnique(hot, seen, taskTierItem(task, "P0/P1 agent_allowed task ready for execution"));
+    } else if (isRecentBlocker(task)) {
+      pushUnique(hot, seen, taskTierItem(task, "recent blocked or waiting task"));
+    } else {
+      pushUnique(warm, seen, taskTierItem(task, "related task context"));
+    }
+  }
+
+  for (const rawTask of input.recentTasks) {
+    const task = asTaskLike(rawTask);
+    if (!task) {
+      continue;
+    }
+    const item = taskTierItem(
+      task,
+      isRecentBlocker(task) ? "recent related blocker" : "recent related task",
+    );
+    pushUnique(isRecentBlocker(task) ? hot : warm, seen, item);
+  }
+
+  input.wiki.candidates.forEach((candidate, index) => {
+    const item = wikiTierItem(candidate, "matched Personal Wiki evidence");
+    const targetTier = index < 3 || (candidate.score ?? 0) >= 30 ? warm : cold;
+    pushUnique(targetTier, seen, item);
+  });
+
+  for (const idea of input.relatedIdeas) {
+    const targetTier = ["P0", "P1"].includes(idea.priority) ? warm : cold;
+    pushUnique(targetTier, seen, ideaTierItem(idea, "related idea or future task seed"));
+  }
+
+  input.activity.forEach((activity, index) => {
+    const targetTier = index < 3 ? warm : cold;
+    pushUnique(targetTier, seen, activityTierItem(activity, "recent task activity evidence"));
+  });
+
+  pushUnique(cold, seen, {
+    type: "policy",
+    reason: "standing Personal OS / Wiki agent policy",
+    title: "Agent context policy",
+  });
+
+  return {
+    hot: hot.slice(0, 8),
+    warm: warm.slice(0, 12),
+    cold: cold.slice(0, 12),
+  };
+}
+
+type QueryContextDb = {
+  task?: unknown;
+};
+
+async function getQueryHotTasks(db?: QueryContextDb) {
+  const taskDelegate = db?.task as
+    | { findMany(args: unknown): Promise<unknown[]> }
+    | undefined;
+  if (!taskDelegate) {
+    return [];
+  }
+
+  return taskDelegate.findMany({
+    where: {
+      OR: [
+        {
+          executionMode: "agent_allowed",
+          priority: { in: ["P0", "P1"] },
+          status: { in: ["todo", "doing", "review"] },

...diff excerpt truncated...
```

## 测试 / 验证

- npm test -- tests/services/agent-context.test.ts
  - exit_code: 0
  - evidence: artifacts/test-agent-context.log
- npx tsc --noEmit
  - exit_code: 0
  - evidence: artifacts/tsc.log
- npm run lint
  - exit_code: 0
  - evidence: artifacts/lint.log
- npm test
  - exit_code: 0
  - evidence: artifacts/npm-test.log
- DATABASE_URL=[REDACTED] npm run build
  - exit_code: 0
  - evidence: artifacts/build-with-database-url-stub.log
- deployment prerequisite checks for /data, SSH 192.168.6.37, docker ps
  - exit_code: 1
  - evidence: artifacts/deployment-prereq.log
- production /api/agent/context?q=personal os wiki shape check before deploy
  - exit_code: 0
  - evidence: artifacts/production-context-before-deploy.json
- writeback intake-result.json
  - exit_code: 0
  - evidence: intake-result.json
- writeback submit-result.json
  - exit_code: 0
  - evidence: submit-result.json
- backup verified files and copy to 6.37 release tree
  - exit_code: 0
  - evidence: artifacts/deploy-copy.log
- sha256 verify local files match remote files
  - exit_code: 0
  - evidence: artifacts/deploy-hash-verify.log
- docker compose -p personal-os-wiki-main build personal-os && up -d --no-deps personal-os
  - exit_code: 0
  - evidence: artifacts/deploy-build-up.log
- production health and /api/agent/context tiers regression
  - exit_code: 0
  - evidence: artifacts/production-regression.json
- write deployment completion intake to Personal OS/Wiki
  - exit_code: 0
  - evidence: deployment-intake-result.json
- review approve task in Personal OS
  - exit_code: 0
  - evidence: review-result.json

## 部署 / 生产回归

- deployment_status: pass
- backup_dir: /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623-102853
- rollback_path: /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623-102853
- production_regression_status: pass

## 写回

- writeback_status: pass
- task_status_after_writeback: done
- wiki_links:
- 暂无已关联 Wiki 链接。

## 残余风险

- Worktree still contains unrelated pre-existing uncommitted files from other tasks; this deployment copied only the three files listed in deployment.copied_files.

## Artifact index

- artifacts/build-with-database-url-stub.log (2071 bytes)
- artifacts/build.log (1234 bytes)
- artifacts/deploy-build-up.log (6890 bytes)
- artifacts/deploy-copy.log (189 bytes)
- artifacts/deploy-hash-verify.log (642 bytes)
- artifacts/deployment-prereq.log (413 bytes)
- artifacts/lint.log (42 bytes)
- artifacts/npm-test.log (2447 bytes)
- artifacts/production-context-before-deploy.json (268 bytes)
- artifacts/production-regression.json (418 bytes)
- artifacts/test-agent-context.log (597 bytes)
- artifacts/tsc.log (0 bytes)
- claim-result.json (5598 bytes)
- deploy-backup-dir.txt (80 bytes)
- deployment-intake-result.json (2447 bytes)
- diff.patch (14340 bytes)
- final.md (118 bytes)
- gate.json (2017 bytes)
- intake-result.json (2495 bytes)
- review-result.json (13987 bytes)
- run.json (351 bytes)
- submit-result.json (16429 bytes)
- worker-result.json (4266 bytes)

## Final summary excerpt

```text
任务 cmqqfl6hp00070jn5bgoym7dx 已完成：/api/agent/context 已上线 hot/warm/cold tiers，生产回归通过。


```

