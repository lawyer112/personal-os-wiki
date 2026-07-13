diff --git a/personal-os-app/scripts/github-radar-intake.mjs b/personal-os-app/scripts/github-radar-intake.mjs
index 08088ed..5392df3 100644
--- a/personal-os-app/scripts/github-radar-intake.mjs
+++ b/personal-os-app/scripts/github-radar-intake.mjs
@@ -1,6 +1,6 @@
 #!/usr/bin/env node
 
-import { mkdir, writeFile } from "node:fs/promises";
+import { mkdir, readFile, writeFile } from "node:fs/promises";
 import path from "node:path";
 import process from "node:process";
 
@@ -65,18 +65,22 @@ function parseArgs(argv) {
     includeTasks: true,
     taskId: process.env.GITHUB_RADAR_TASK_ID || `github-radar-${stampDate()}`,
     out: process.env.GITHUB_RADAR_OUT || path.join(".agent-runs", `github-radar-${stampDate()}`),
+    registry: process.env.GITHUB_RADAR_REGISTRY || path.join(".agent-runs", "github-radar-source-registry.json"),
+    skipSeen: false,
   };
 
   for (const arg of argv) {
     if (arg === "--intake") args.intake = true;
     else if (arg === "--no-intake" || arg === "--dry-run") args.intake = false;
     else if (arg === "--no-tasks") args.includeTasks = false;
+    else if (arg === "--skip-seen") args.skipSeen = true;
     else if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=", 2)[1]);
     else if (arg.startsWith("--per-query=")) args.perQuery = Number(arg.split("=", 2)[1]);
     else if (arg.startsWith("--task-id=")) args.taskId = arg.split("=", 2)[1];
     else if (arg.startsWith("--out=")) args.out = arg.split("=", 2)[1];
+    else if (arg.startsWith("--registry=")) args.registry = arg.split("=", 2)[1];
     else if (arg === "--help") {
-      console.log(`Usage: node scripts/github-radar-intake.mjs [--intake] [--no-tasks] [--limit=8] [--task-id=<id>] [--out=<dir>]`);
+      console.log(`Usage: node scripts/github-radar-intake.mjs [--intake] [--no-tasks] [--skip-seen] [--limit=8] [--task-id=<id>] [--out=<dir>] [--registry=<file>]`);
       process.exit(0);
     }
   }
@@ -171,7 +175,74 @@ function excerpt(text) {
   return text.replace(/\s+/g, " ").trim().slice(0, 420);
 }
 
-function buildMarkdown(repos, tasks) {
+async function loadRegistry(registryPath) {
+  try {
+    const content = await readFile(registryPath, "utf8");
+    return JSON.parse(content);
+  } catch {
+    return { created_at: isoNow(), updated_at: isoNow(), entries: [] };
+  }
+}
+
+async function saveRegistry(registryPath, registry) {
+  registry.updated_at = isoNow();
+  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
+}
+
+function mergeRegistry(registry, repos) {
+  const entryMap = new Map(registry.entries.map((e) => [e.full_name, e]));
+  for (const repo of repos) {
+    const existing = entryMap.get(repo.full_name);
+    if (existing) {
+      existing.times_seen = (existing.times_seen || 1) + 1;
+      existing.last_seen = isoNow();
+      existing.last_score = repo.score;
+      existing.signals = [...new Set([...existing.signals, ...repo.signals])];
+    } else {
+      entryMap.set(repo.full_name, {
+        full_name: repo.full_name,
+        url: repo.url,
+        description: repo.description,
+        stars: repo.stars,
+        first_seen: isoNow(),
+        last_seen: isoNow(),
+        times_seen: 1,
+        first_score: repo.score,
+        last_score: repo.score,
+        signals: repo.signals,
+        status: "new",
+      });
+    }
+  }
+  registry.entries = [...entryMap.values()];
+  return registry;
+}
+
+function filterSeenRepos(repos, registry, skipSeen) {
+  if (!skipSeen) return repos;
+  const seen = new Set(registry.entries.filter((e) => e.times_seen > 1).map((e) => e.full_name));
+  return repos.filter((repo) => !seen.has(repo.full_name));
+}
+
+async function fetchExistingTasks(baseUrl, token) {
+  try {
+    const response = await fetch(`${baseUrl}/api/tasks?owner=agent&status=todo,doing,review&limit=50`, {
+      headers: { Authorization: `Bearer ${token}` },
+    });
+    if (!response.ok) return [];
+    const data = await response.json();
+    return data.tasks || [];
+  } catch {
+    return [];
+  }
+}
+
+function deduplicateTasks(tasks, existingTasks) {
+  const existingTitles = new Set(existingTasks.map((t) => t.title));
+  return tasks.filter((task) => !existingTitles.has(task.title));
+}
+
+function buildMarkdown(repos, tasks, registryStats) {
   const lines = [
     `# GitHub 知识雷达 ${new Date().toISOString().slice(0, 10)}`,
     "",
@@ -179,6 +250,8 @@ function buildMarkdown(repos, tasks) {
     "",
     "本轮输出不是链接列表，而是可执行吸收判断。优先吸收 Source Registry、Context Pack、Hot/Warm/Cold Context、Graph Recall、Agent Hooks。",
     "",
+    `Source Registry 累计 ${registryStats.total} 个 repo，本轮新增 ${registryStats.new} 个。`,
+    "",
     "## 已筛选项目",
     "",
   ];
@@ -327,7 +400,7 @@ async function postIntake(payload) {
   const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/intake`, {
     method: "POST",
     headers: {
-      Authorization: ["Bearer", token].join(" "),
+      Authorization: `Bearer ${token}`,
       "Content-Type": "application/json",
     },
     body: JSON.stringify(payload),
@@ -343,6 +416,7 @@ async function main() {
   const args = parseArgs(process.argv.slice(2));
   await mkdir(args.out, { recursive: true });
 
+  const registry = await loadRegistry(args.registry);
   const candidates = await searchRepos(args.perQuery);
   const analyzed = [];
   for (const repo of candidates) {
@@ -354,14 +428,38 @@ async function main() {
     .filter((repo) => repo.signals.length > 0)
     .sort((a, b) => b.score - a.score)
     .slice(0, args.limit);
-  const tasks = buildTasks(selected);
-  const markdown = buildMarkdown(selected, tasks);
-  const payload = buildIntakePayload({ markdown, tasks, repos: selected, includeTasks: args.includeTasks, taskId: args.taskId });
 
-  await writeFile(path.join(args.out, "repos.json"), `${JSON.stringify({ generated_at: isoNow(), repos: selected }, null, 2)}\n`);
+  const mergedRegistry = mergeRegistry(registry, selected);
+  const registryStats = {
+    total: mergedRegistry.entries.length,
+    new: selected.filter((repo) => {
+      const entry = mergedRegistry.entries.find((e) => e.full_name === repo.full_name);
+      return entry && entry.times_seen === 1;
+    }).length,
+  };
+
+  const filteredRepos = filterSeenRepos(selected, mergedRegistry, args.skipSeen);
+  let tasks = buildTasks(filteredRepos);
+
+  if (args.intake) {
+    const baseUrl = process.env.PERSONAL_OS_BASE_URL || "http://192.168.6.37:3100";
+    const token = process.env.PERSONAL_OS_API_TOKEN;
+    if (token) {
+      const existingTasks = await fetchExistingTasks(baseUrl, token);
+      const deduped = deduplicateTasks(tasks, existingTasks);
+      console.log(`[dedup] ${tasks.length} tasks -> ${deduped.length} after dedup`);
+      tasks = deduped;
+    }
+  }
+
+  const markdown = buildMarkdown(filteredRepos, tasks, registryStats);
+  const payload = buildIntakePayload({ markdown, tasks, repos: filteredRepos, includeTasks: args.includeTasks, taskId: args.taskId });
+
+  await writeFile(path.join(args.out, "repos.json"), `${JSON.stringify({ generated_at: isoNow(), repos: filteredRepos }, null, 2)}\n`);
   await writeFile(path.join(args.out, "evidence.md"), markdown);
   await writeFile(path.join(args.out, "adoption-tasks.json"), `${JSON.stringify(tasks, null, 2)}\n`);
   await writeFile(path.join(args.out, "intake-payload.json"), `${JSON.stringify(payload, null, 2)}\n`);
+  await saveRegistry(args.registry, mergedRegistry);
 
   let intake = null;
   if (args.intake) {
@@ -369,7 +467,7 @@ async function main() {
     await writeFile(path.join(args.out, "intake-result.json"), `${JSON.stringify(intake, null, 2)}\n`);
   }
 
-  console.log(JSON.stringify({ out: args.out, repos: selected.length, tasks: tasks.length, intake: intake ? { ok: intake.ok, agentRunId: intake.agentRunId, wiki_write_status: intake.wiki_write_status } : null }, null, 2));
+  console.log(JSON.stringify({ out: args.out, repos: filteredRepos.length, tasks: tasks.length, registry: registryStats, intake: intake ? { ok: intake.ok, agentRunId: intake.agentRunId, wiki_write_status: intake.wiki_write_status } : null }, null, 2));
 }
 
 main().catch((error) => {
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
+        },
+        {
+          priority: { in: ["P0", "P1"] },
+          status: { in: ["blocked", "waiting"] },
+        },
+      ],
+    },
+    include: { project: true },
+    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
+    take: 5,
+  });
+}
+
 export async function searchWikiContext(
   queries: string[],
   limit = 8,
@@ -374,21 +645,32 @@ export async function searchWikiContextCandidates(queries: string[], limit = 8)
   return result.candidates;
 }
 
-export async function getQueryAgentContext(query: string) {
+export async function getQueryAgentContext(query: string, db?: QueryContextDb) {
   const searchQueries = [query.trim()].filter(Boolean);
-  const wiki = await searchWikiContext(
-    searchQueries,
-    AGENT_CONTEXT_POLICY.maxWikiCandidates,
-  );
+  const [wiki, queryTasks] = await Promise.all([
+    searchWikiContext(searchQueries, AGENT_CONTEXT_POLICY.maxWikiCandidates),
+    getQueryHotTasks(db),
+  ]);
+  const recentTasks: unknown[] = [];
+  const relatedIdeas: IdeaContextRecord[] = [];
+  const activity: ActivityRecord[] = [];
 
   return {
     generatedAt: new Date().toISOString(),
     task: null,
     searchQueries,
     wiki,
-    recentTasks: [],
-    relatedIdeas: [],
-    activity: [],
+    recentTasks,
+    relatedIdeas,
+    activity,
+    tiers: buildContextTiers({
+      task: null,
+      wiki,
+      recentTasks,
+      relatedIdeas,
+      activity,
+      queryTasks,
+    }),
     policy: AGENT_CONTEXT_POLICY,
   } satisfies AgentContextPack;
 }
@@ -471,6 +753,13 @@ export async function getAgentContext<TDb extends ContextDb>(
     recentTasks,
     relatedIdeas,
     activity,
+    tiers: buildContextTiers({
+      task,
+      wiki,
+      recentTasks,
+      relatedIdeas,
+      activity,
+    }),
     policy: AGENT_CONTEXT_POLICY,
   };
 }
diff --git a/personal-os-app/src/lib/validation.ts b/personal-os-app/src/lib/validation.ts
index 40b5864..fd962a1 100644
--- a/personal-os-app/src/lib/validation.ts
+++ b/personal-os-app/src/lib/validation.ts
@@ -118,8 +118,24 @@ export const taskCreateSchema = z.object({
   wikiLinks: z.array(wikiLinkSchema).default([]),
 });
 
-export const taskUpdateSchema = taskCreateSchema.partial().extend({
+export const taskUpdateSchema = z.object({
+  title: z.string().min(1).optional(),
+  description: z.string().optional(),
   status: z.enum(taskStatuses).optional(),
+  priority: z.enum(priorities).optional(),
+  riskLevel: z.enum(taskRiskLevels).optional(),
+  executionMode: z.enum(taskExecutionModes).optional(),
+  agentTags: z.array(z.string().min(1)).optional(),
+  requiredOutput: z.string().optional(),
+  nextAction: z.string().min(1).optional(),
+  definitionOfDone: z.string().min(1).optional(),
+  dueDate: z.coerce.date().optional(),
+  estimateMinutes: z.number().int().positive().optional(),
+  projectId: z.string().min(1).optional(),
+  sourceInboxItemId: z.string().min(1).optional(),
+  sourceAgentRunId: z.string().min(1).optional(),
+  createdBy: z.string().min(1).optional(),
+  wikiLinks: z.array(wikiLinkSchema).optional(),
 });
 
 export const agentInboxQuerySchema = z.object({
@@ -275,15 +291,35 @@ export const dailyPlanSnapshotSchema = z.object({
   sourcePlannerPacket: jsonRecord.optional(),
 });
 
-export const wikiIngestSchema = z.object({
-  title: z.string().min(1),
-  content: z.string().min(1),
-  source_type: z.string().min(1).default("telegram"),
-  source_url: z.string().optional(),
+export const wikiFrontmatterSchema = z.object({
+  title: z.string().min(1).optional(),
+  type: z.string().min(1).default("project"),
+  created_by: z.literal("hermes:worker").default("hermes:worker"),
+  source_type: z.literal("agent-output").default("agent-output"),
   tags: z.array(z.string().min(1)).default([]),
-  metadata: jsonRecord.default({}),
+  created_at: z.string().min(1).optional(),
+  task_id: z.string().min(1).optional(),
+  agent_id: z.string().min(1).optional(),
+  project: z.string().min(1).optional(),
+  last_reviewed: z.string().min(1).optional(),
+  migration: z.string().min(1).optional(),
 });
 
+export const wikiIngestSchema = z
+  .object({
+    title: z.string().min(1).optional(),
+    content: z.string().min(1),
+    source_type: z.string().min(1).optional(),
+    source_url: z.string().optional(),
+    tags: z.array(z.string().min(1)).default([]),
+    metadata: jsonRecord.default({}),
+    frontmatter: wikiFrontmatterSchema.optional(),
+  })
+  .refine((input) => Boolean(input.title ?? input.frontmatter?.title), {
+    message: "Wiki note needs title or frontmatter.title.",
+    path: ["title"],
+  });
+
 export const intakeSchema = z.object({
   source: inboxCreateSchema,
   agent: z.object({
diff --git a/personal-os-app/src/lib/wiki-ingest.ts b/personal-os-app/src/lib/wiki-ingest.ts
index 3640e34..5ab3220 100644
--- a/personal-os-app/src/lib/wiki-ingest.ts
+++ b/personal-os-app/src/lib/wiki-ingest.ts
@@ -1,6 +1,9 @@
 import { wikiOpenUrl } from "@/lib/app-config";
 import { wikiClient } from "@/lib/wiki-client";
 
+const WIKI_CREATED_BY = "hermes:worker";
+const WIKI_SOURCE_TYPE = "agent-output";
+
 export type WikiIngestResult = {
   ok: boolean;
   title: string;
@@ -18,20 +21,36 @@ type WikiIngestResponse = {
   message?: string;
 };
 
+type WikiFrontmatterInput = {
+  title?: string;
+  type?: string;
+  created_by?: string;
+  source_type?: string;
+  tags?: string[];
+  created_at?: string;
+  task_id?: string;
+  agent_id?: string;
+  project?: string;
+  last_reviewed?: string;
+  migration?: string;
+};
+
+type WikiFrontmatter = {
+  title: string;
+  type: string;
+  created_by: typeof WIKI_CREATED_BY;
+  source_type: typeof WIKI_SOURCE_TYPE;
+  tags: string[];
+  created_at?: string;
+  task_id?: string;
+  agent_id?: string;
+  project?: string;
+  last_reviewed?: string;
+  migration?: string;
+};
+
 type WikiIngestNoteInput = {
-  frontmatter?: {
-    title: string;
-    type: string;
-    created_by: string;
-    source_type: string;
-    tags: string[];
-    created_at?: string;
-    task_id?: string;
-    agent_id?: string;
-    project?: string;
-    last_reviewed?: string;
-    migration?: string;
-  };
+  frontmatter?: WikiFrontmatterInput;
   title?: string;
   content: string;
   source_type?: string;
@@ -40,17 +59,105 @@ type WikiIngestNoteInput = {
   metadata?: Record<string, unknown>;
 };
 
-const wikiIngestTitle = (input: WikiIngestNoteInput) =>
-  input.frontmatter?.title ?? input.title ?? "untitled-wiki-note";
+type WikiIngestPayload = WikiIngestNoteInput & {
+  title: string;
+  source_type: string;
+  tags: string[];
+  metadata: Record<string, unknown>;
+  frontmatter: WikiFrontmatter;
+};
 
-export async function ingestWikiNote(
+function compactFrontmatter(frontmatter: WikiFrontmatter): WikiFrontmatter {
+  return Object.fromEntries(
+    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
+  ) as WikiFrontmatter;
+}
+
+function optionalString(value: unknown) {
+  if (typeof value !== "string") {
+    return undefined;
+  }
+  const trimmed = value.trim();
+  return trimmed.length > 0 ? trimmed : undefined;
+}
+
+function metadataString(
+  metadata: Record<string, unknown>,
+  key: string,
+): string | undefined {
+  return optionalString(metadata[key]);
+}
+
+function uniqueTags(...groups: Array<string[] | undefined>) {
+  return [...new Set(groups.flatMap((group) => group ?? []).map((tag) => tag.trim()).filter(Boolean))];
+}
+
+function titleFromContent(content: string) {
+  for (const line of content.split(/\r?\n/)) {
+    const trimmed = line.trim();
+    if (!trimmed) {
+      continue;
+    }
+    const heading = trimmed.match(/^#+\s+(.+)$/)?.[1]?.trim();
+    return (heading ?? trimmed).slice(0, 180);
+  }
+  return undefined;
+}
+
+function wikiIngestTitle(input: WikiIngestNoteInput) {
+  return (
+    optionalString(input.frontmatter?.title) ??
+    optionalString(input.title) ??
+    titleFromContent(input.content) ??
+    "untitled-wiki-note"
+  );
+}
+
+export function buildWikiIngestPayload(
   input: WikiIngestNoteInput,
-): Promise<WikiIngestResult> {
+  now: Date = new Date(),
+): WikiIngestPayload {
+  const metadata = input.metadata ?? {};
   const title = wikiIngestTitle(input);
-  const payload = {
+  const createdAt = optionalString(input.frontmatter?.created_at) ?? now.toISOString();
+  const tags = uniqueTags(input.tags, input.frontmatter?.tags);
+  const frontmatter = compactFrontmatter({
+    title,
+    type: optionalString(input.frontmatter?.type) ?? "project",
+    created_by: WIKI_CREATED_BY,
+    source_type: WIKI_SOURCE_TYPE,
+    tags,
+    created_at: createdAt,
+    task_id:
+      optionalString(input.frontmatter?.task_id) ??
+      metadataString(metadata, "task_id") ??
+      metadataString(metadata, "personal_os_task_id"),
+    agent_id:
+      optionalString(input.frontmatter?.agent_id) ??
+      metadataString(metadata, "agent_id"),
+    project:
+      optionalString(input.frontmatter?.project) ??
+      metadataString(metadata, "project"),
+    last_reviewed:
+      optionalString(input.frontmatter?.last_reviewed) ?? createdAt.slice(0, 10),
+    migration: optionalString(input.frontmatter?.migration),
+  });
+
+  return {
     ...input,
-    metadata: input.metadata ?? {},
+    title,
+    source_type: optionalString(input.source_type) ?? frontmatter.source_type,
+    tags,
+    metadata,
+    frontmatter,
   };
+}
+
+export async function ingestWikiNote(
+  input: WikiIngestNoteInput,
+): Promise<WikiIngestResult> {
+  const payload = buildWikiIngestPayload(input);
+  const title = payload.frontmatter.title;
 
   try {
     const result = await wikiClient.write<WikiIngestResponse>("/api/ingest", {
diff --git a/personal-os-app/tests/routes/intake-wiki-fallback.test.ts b/personal-os-app/tests/routes/intake-wiki-fallback.test.ts
index 36efac4..81fa2f7 100644
--- a/personal-os-app/tests/routes/intake-wiki-fallback.test.ts
+++ b/personal-os-app/tests/routes/intake-wiki-fallback.test.ts
@@ -176,4 +176,106 @@ describe("POST /api/intake Wiki fallback", () => {
       }),
     );
   });
+
+  it("accepts frontmatter-only wikiNotes and links successful Wiki writes to created tasks", async () => {
+    vi.stubEnv("NODE_ENV", "production");
+    vi.stubEnv("PERSONAL_OS_API_TOKEN", "os-write-token-0000");
+    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://os.local");
+
+    const { POST, mocks } = await loadIntakeRoute();
+    mocks.ingestWikiNote.mockResolvedValueOnce({
+      ok: true,
+      title: "Frontmatter contract demo",
+      status: "created",
+      note_path: "notes/2026-06-23/frontmatter-contract-demo.md",
+      url: "http://wiki.local/note?path=notes/2026-06-23/frontmatter-contract-demo.md",
+    });
+
+    const response = await POST(
+      intakeRequest({
+        source: {
+          sourceType: "cron",
+          sourcePlatform: "hermes",
+          rawText: "check frontmatter contract",
+          attachments: [],
+          createdBy: "hermes",
+        },
+        agent: {
+          model: "hermes-cron",
+          classification: { kind: "frontmatter-contract" },
+          reasoningSummary: "Verify frontmatter-only Wiki notes survive intake validation.",
+        },
+        wikiNotes: [
+          {
+            frontmatter: {
+              title: "Frontmatter contract demo",
+              type: "project",
+              created_by: "hermes:worker",
+              source_type: "agent-output",
+              tags: ["personal-os", "frontmatter"],
+              task_id: "task_frontmatter_1",
+            },
+            content: "Body",
+          },
+        ],
+        tasks: [
+          {
+            title: "OS frontmatter contract task",
+            description: "This task proves /api/intake accepts Wiki frontmatter payloads.",
+            status: "todo",
+            priority: "P1",
+            riskLevel: "low",
+            executionMode: "agent_allowed",
+            agentTags: ["personal-os", "wiki"],
+            nextAction: "Run the focused intake frontmatter test.",
+            definitionOfDone: "The intake response is 201 and the created task carries the Wiki link.",
+            wikiLinks: [],
+          },
+        ],
+      }),
+    );
+
+    const body = await response.json();
+
+    expect(response.status).toBe(201);
+    expect(body.ok).toBe(true);
+    expect(body.wiki_write_status).toMatchObject({
+      status: "ok",
+      requested: 1,
+      succeeded: 1,
+      failed: 0,
+    });
+    expect(mocks.ingestWikiNote).toHaveBeenCalledWith(
+      expect.objectContaining({
+        content: "Body",
+        frontmatter: expect.objectContaining({
+          title: "Frontmatter contract demo",
+          created_by: "hermes:worker",
+          source_type: "agent-output",
+          task_id: "task_frontmatter_1",
+        }),
+        metadata: expect.objectContaining({
+          personal_os_inbox_id: "inbox_1",
+          personal_os_agent_run_id: "run_1",
+        }),
+      }),
+    );
+    expect(mocks.createTask).toHaveBeenCalledWith(
+      expect.anything(),
+      expect.objectContaining({
+        title: "OS frontmatter contract task",
+        wikiLinks: [
+          expect.objectContaining({
+            noteTitle: "Frontmatter contract demo",
+            notePath: "notes/2026-06-23/frontmatter-contract-demo.md",
+            noteUrl:
+              "http://wiki.local/note?path=notes/2026-06-23/frontmatter-contract-demo.md",
+            sourceType: "personal-wiki",
+            sourceInboxItemId: "inbox_1",
+            sourceAgentRunId: "run_1",
+          }),
+        ],
+      }),
+    );
+  });
 });
diff --git a/personal-os-app/tests/services/agent-context.test.ts b/personal-os-app/tests/services/agent-context.test.ts
index 4451681..d043db3 100644
--- a/personal-os-app/tests/services/agent-context.test.ts
+++ b/personal-os-app/tests/services/agent-context.test.ts
@@ -1,6 +1,7 @@
 import { beforeEach, describe, expect, it, vi } from "vitest";
 import {
   buildContextSearchQueries,
+  getAgentContext,
   getQueryAgentContext,
   searchWikiContext,
 } from "@/lib/agent-context";
@@ -101,7 +102,117 @@ describe("agent context harness", () => {
     expect(context.recentTasks).toEqual([]);
     expect(context.relatedIdeas).toEqual([]);
     expect(context.activity).toEqual([]);
+    expect(context.tiers.hot).toEqual([]);
+    expect(context.tiers.warm).toEqual([]);
+    expect(context.tiers.cold[0]).toMatchObject({ type: "policy" });
     expect(context.policy.canReadWiki).toBe(true);
     expect(context.wiki.status).toBe("empty");
   });
+
+  it("adds P0/P1 agent executable tasks to hot tier for keyword lookups", async () => {
+    mockedSearchWikiNotes.mockResolvedValue([
+      {
+        title: "Personal OS context memory tiering",
+        path: "projects/personal-os/context-tiering.md",
+        tags: ["personal-os", "context"],
+        concepts: ["hot warm cold"],
+        excerpt: "Historical Wiki evidence for hot/warm/cold context packs.",
+      },
+    ]);
+    const taskFindMany = vi.fn().mockResolvedValue([
+      {
+        id: "task_hot",
+        title: "把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0",
+        status: "todo",
+        priority: "P0",
+        riskLevel: "low",
+        executionMode: "agent_allowed",
+        ownerAgent: null,
+        leaseUntil: null,
+        nextAction: "Add tiers to the context response.",
+        definitionOfDone: "Query context returns tiers.hot/warm/cold.",
+        project: { id: "project_1", name: "Personal OS" },
+      },
+    ]);
+
+    const context = await getQueryAgentContext("personal os wiki", {
+      task: { findMany: taskFindMany },
+    });
+
+    expect(taskFindMany).toHaveBeenCalledWith(
+      expect.objectContaining({
+        take: 5,
+        include: { project: true },
+      }),
+    );
+    expect(context.tiers.hot[0]).toMatchObject({
+      type: "task",
+      id: "task_hot",
+      priority: "P0",
+      status: "todo",
+    });
+    expect(context.tiers.warm[0]).toMatchObject({
+      type: "wiki",
+      path: "projects/personal-os/context-tiering.md",
+    });
+  });
+
+  it("puts the current task in hot tier and historical wiki hits in warm tier", async () => {
+    mockedSearchWikiNotes.mockResolvedValue([
+      {
+        title: "Agent context tiering decision record",
+        path: "projects/personal-os/context-tiering-decision.md",
+        tags: ["personal-os", "wiki"],
+        concepts: ["Agent Context"],
+        excerpt: "Decision record for current task plus historical Wiki hit.",
+      },
+    ]);
+
+    const task = {
+      id: "task_current",
+      title: "把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0",
+      description: "Add context tiers.",
+      status: "doing",
+      priority: "P0",
+      riskLevel: "low",
+      executionMode: "agent_allowed",
+      agentTags: ["personal-os", "context"],
+      ownerAgent: "hermes",
+      leaseUntil: new Date(Date.now() + 60_000).toISOString(),
+      nextAction: "Implement tiers.",
+      definitionOfDone: "Context response keeps old fields and adds tiers.",
+      projectId: "project_1",
+      sourceInboxItemId: null,
+      sourceAgentRunId: null,
+      project: { id: "project_1", name: "Personal OS" },
+      sourceInboxItem: null,
+      sourceAgentRun: null,
+      wikiLinks: [],
+      contributions: [],
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
+    expect(context.tiers.hot[0]).toMatchObject({
+      type: "task",
+      id: "task_current",
+      reason: "current task being executed",
+    });
+    expect(context.tiers.warm[0]).toMatchObject({
+      type: "wiki",
+      path: "projects/personal-os/context-tiering-decision.md",
+    });
+  });
 });
diff --git a/personal-os-app/tests/services/tasks.test.ts b/personal-os-app/tests/services/tasks.test.ts
index ac6d24b..d4626f4 100644
--- a/personal-os-app/tests/services/tasks.test.ts
+++ b/personal-os-app/tests/services/tasks.test.ts
@@ -1,5 +1,6 @@
 import { describe, expect, it, vi } from "vitest";
 import { completeTask, createTask, updateTask } from "@/lib/tasks";
+import { taskUpdateSchema } from "@/lib/validation";
 
 describe("task services", () => {
   it("creates a task and records an undoable activity entry", async () => {
@@ -141,4 +142,13 @@ describe("task services", () => {
       }),
     );
   });
+
+  it("parses partial task updates without injecting create defaults", () => {
+    const parsed = taskUpdateSchema.parse({ agentTags: ["wiki"] });
+
+    expect(parsed).toEqual({ agentTags: ["wiki"] });
+    expect(parsed).not.toHaveProperty("priority");
+    expect(parsed).not.toHaveProperty("executionMode");
+    expect(parsed).not.toHaveProperty("riskLevel");
+  });
 });
diff --git a/personal-os-app/tests/services/wiki-ingest.test.ts b/personal-os-app/tests/services/wiki-ingest.test.ts
index 0688001..4896a16 100644
--- a/personal-os-app/tests/services/wiki-ingest.test.ts
+++ b/personal-os-app/tests/services/wiki-ingest.test.ts
@@ -43,7 +43,96 @@ describe("ingestWikiNote", () => {
       title: "Wiki fallback demo",
       error: "missing write auth",
     });
-    expect(write).toHaveBeenCalledWith("/api/ingest", { body: wikiInput });
+    const body = write.mock.calls[0]?.[1]?.body;
+    expect(body).toMatchObject({
+      ...wikiInput,
+      title: "Wiki fallback demo",
+      source_type: "telegram",
+      metadata: {},
+      frontmatter: {
+        title: "Wiki fallback demo",
+        type: "project",
+        created_by: "hermes:worker",
+        source_type: "agent-output",
+        tags: [],
+      },
+    });
+    expect(body.frontmatter.created_at).toEqual(expect.any(String));
+    expect(body.frontmatter.last_reviewed).toEqual(expect.any(String));
+  });
+
+  it("sends Personal Wiki frontmatter contract on successful writes", async () => {
+    const write = vi.fn().mockResolvedValue({
+      ok: true,
+      status: 201,
+      body: {
+        status: "created",
+        note_path: "notes/2026-06-23/frontmatter-demo.md",
+        url: "/note?path=notes/2026-06-23/frontmatter-demo.md",
+      },
+      url: "http://wiki.local/api/ingest",
+    });
+    const { ingestWikiNote } = await loadWikiIngest(write);
+
+    const result = await ingestWikiNote({
+      content: "# Frontmatter contract demo\n\nBody",
+      frontmatter: {
+        title: "Frontmatter contract demo",
+        type: "project",
+        created_by: "classic",
+        source_type: "telegram",
+        tags: ["personal-os", "frontmatter"],
+        task_id: "task_frontmatter_1",
+        migration: "frontmatter-contract-v0",
+      },
+      metadata: {
+        agent_id: "obsidianmanager1",
+        project: "Personal OS / Wiki 知识库升级",
+      },
+    });
+
+    expect(result).toEqual({
+      ok: true,
+      title: "Frontmatter contract demo",
+      status: "created",
+      note_path: "notes/2026-06-23/frontmatter-demo.md",
+      url: "http://wiki.local/note?path=notes/2026-06-23/frontmatter-demo.md",
+    });
+
+    const body = write.mock.calls[0]?.[1]?.body;
+    expect(body).toMatchObject({
+      title: "Frontmatter contract demo",
+      source_type: "agent-output",
+      tags: ["personal-os", "frontmatter"],
+      metadata: {
+        agent_id: "obsidianmanager1",
+        project: "Personal OS / Wiki 知识库升级",
+      },
+      frontmatter: {
+        title: "Frontmatter contract demo",
+        type: "project",
+        created_by: "hermes:worker",
+        source_type: "agent-output",
+        tags: ["personal-os", "frontmatter"],
+        task_id: "task_frontmatter_1",
+        agent_id: "obsidianmanager1",
+        project: "Personal OS / Wiki 知识库升级",
+        migration: "frontmatter-contract-v0",
+      },
+    });
+    expect(Object.keys(body.frontmatter).sort()).toEqual([
+      "agent_id",
+      "created_at",
+      "created_by",
+      "last_reviewed",
+      "migration",
+      "project",
+      "source_type",
+      "tags",
+      "task_id",
+      "title",
+      "type",
+    ]);
   });
 
   it("returns a failed result instead of throwing when Wiki is unreachable", async () => {
