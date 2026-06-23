#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_QUERIES = [
  "AI personal knowledge management RAG memory stars:>50",
  "agent memory knowledge graph stars:>50",
  "Obsidian AI knowledge base agent stars:>20",
  "self maintaining wiki RAG agent stars:>20",
  "OpenClaw Hermes Codex memory agent",
];

const SIGNALS = [
  {
    id: "source-registry",
    label: "Source Registry / evidence ledger",
    pattern: /source|ingest|raw|provenance|evidence|capture|registry/i,
    nextAction:
      "把外部来源写成 source ledger：repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki + Task。",
  },
  {
    id: "context-pack",
    label: "Agent context pack / task ledger",
    pattern: /context pack|task ledger|agent task|handoff|runbook|artifact|memory\/tasks/i,
    nextAction:
      "把 .agent-runs/<task-id>/ 自动归档成 Wiki note，包含 gate、diff、测试、部署、风险和下一步。",
  },
  {
    id: "memory-tiering",
    label: "Hot / warm / cold memory tiering",
    pattern: /hot|warm|cold|tier|priority|token.optim|context briefing|90%\+ token/i,
    nextAction:
      "让 /api/agent/context 输出 tiers.hot、tiers.warm、tiers.cold，优先喂给自驱执行器。",
  },
  {
    id: "graph-recall",
    label: "Graph recall: FTS/vector/community/PPR/episodic traces",
    pattern: /graph|pagerank|PPR|community|FTS5|vector|embedding|episodic|semantic search/i,
    nextAction:
      "给 context 检索加入同类任务 episode 和图谱邻接证据，避免空候选和重复踩坑。",
  },
  {
    id: "agent-hooks",
    label: "Agent lifecycle hooks / MCP integration",
    pattern: /MCP|hook|SessionStart|PostToolUse|pre_llm|post_llm|OpenClaw|Hermes|Codex|Claude Code/i,
    nextAction:
      "把雷达发现和任务执行接进 cron / hooks，形成“无任务→检索→建任务→执行”的闭环。",
  },
  {
    id: "doctor-next",
    label: "Doctor / next-command guidance",
    pattern: /doctor|next command|status|health|repair|workbench/i,
    nextAction:
      "给自驱执行器增加 next-action 诊断输出：当前应执行的一个命令、阻塞、验证命令。",
  },
];

function parseArgs(argv) {
  const args = {
    limit: 8,
    perQuery: 5,
    intake: false,
    includeTasks: true,
    taskId: process.env.GITHUB_RADAR_TASK_ID || `github-radar-${stampDate()}`,
    out: process.env.GITHUB_RADAR_OUT || path.join(".agent-runs", `github-radar-${stampDate()}`),
    registry: process.env.GITHUB_RADAR_REGISTRY || path.join(".agent-runs", "github-radar-source-registry.json"),
    skipSeen: false,
  };

  for (const arg of argv) {
    if (arg === "--intake") args.intake = true;
    else if (arg === "--no-intake" || arg === "--dry-run") args.intake = false;
    else if (arg === "--no-tasks") args.includeTasks = false;
    else if (arg === "--skip-seen") args.skipSeen = true;
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.split("=", 2)[1]);
    else if (arg.startsWith("--per-query=")) args.perQuery = Number(arg.split("=", 2)[1]);
    else if (arg.startsWith("--task-id=")) args.taskId = arg.split("=", 2)[1];
    else if (arg.startsWith("--out=")) args.out = arg.split("=", 2)[1];
    else if (arg.startsWith("--registry=")) args.registry = arg.split("=", 2)[1];
    else if (arg === "--help") {
      console.log(`Usage: node scripts/github-radar-intake.mjs [--intake] [--no-tasks] [--skip-seen] [--limit=8] [--task-id=<id>] [--out=<dir>] [--registry=<file>]`);
      process.exit(0);
    }
  }

  if (!Number.isFinite(args.limit) || args.limit <= 0) args.limit = 8;
  if (!Number.isFinite(args.perQuery) || args.perQuery <= 0) args.perQuery = 5;
  return args;
}

function stampDate() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function isoNow() {
  return new Date().toISOString();
}

async function githubJson(apiPath) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "personal-os-github-radar",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(`https://api.github.com${apiPath}`, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub ${response.status} ${apiPath}: ${text.slice(0, 240)}`);
  }
  return response.json();
}

async function searchRepos(perQuery) {
  const byName = new Map();
  for (const query of DEFAULT_QUERIES) {
    const params = new URLSearchParams({ q: query, sort: "updated", order: "desc", per_page: String(perQuery) });
    const result = await githubJson(`/search/repositories?${params.toString()}`);
    for (const item of result.items || []) {
      if (!byName.has(item.full_name)) {
        byName.set(item.full_name, {
          full_name: item.full_name,
          url: item.html_url,
          description: item.description || "",
          stars: item.stargazers_count || 0,
          pushed_at: item.pushed_at,
          query,
          default_branch: item.default_branch || "main",
        });
      }
    }
  }
  return [...byName.values()];
}

async function fetchReadme(repo) {
  try {
    const data = await githubJson(`/repos/${repo.full_name}/readme`);
    if (!data.content) return "";
    return Buffer.from(data.content, data.encoding || "base64").toString("utf8");
  } catch (error) {
    repo.readme_error = error instanceof Error ? error.message : String(error);
    return "";
  }
}

function analyzeRepo(repo, readme) {
  const haystack = `${repo.description}\n${readme}`;
  const signals = SIGNALS.filter((signal) => signal.pattern.test(haystack));
  const score = signals.length * 10 + Math.min(repo.stars, 5000) / 1000 + recencyBoost(repo.pushed_at);
  return {
    ...repo,
    score: Number(score.toFixed(2)),
    signals: signals.map((signal) => signal.id),
    signalLabels: signals.map((signal) => signal.label),
    adoption: signals.slice(0, 3).map((signal) => signal.nextAction),
    readme_excerpt: excerpt(readme || repo.description),
  };
}

function recencyBoost(pushedAt) {
  if (!pushedAt) return 0;
  const days = (Date.now() - Date.parse(pushedAt)) / 86_400_000;
  if (days <= 14) return 5;
  if (days <= 60) return 3;
  if (days <= 180) return 1;
  return 0;
}

function excerpt(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 420);
}

async function loadRegistry(registryPath) {
  try {
    const content = await readFile(registryPath, "utf8");
    return JSON.parse(content);
  } catch {
    return { created_at: isoNow(), updated_at: isoNow(), entries: [] };
  }
}

async function saveRegistry(registryPath, registry) {
  registry.updated_at = isoNow();
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}

function mergeRegistry(registry, repos) {
  const entryMap = new Map(registry.entries.map((e) => [e.full_name, e]));
  for (const repo of repos) {
    const existing = entryMap.get(repo.full_name);
    if (existing) {
      existing.times_seen = (existing.times_seen || 1) + 1;
      existing.last_seen = isoNow();
      existing.last_score = repo.score;
      existing.signals = [...new Set([...existing.signals, ...repo.signals])];
    } else {
      entryMap.set(repo.full_name, {
        full_name: repo.full_name,
        url: repo.url,
        description: repo.description,
        stars: repo.stars,
        first_seen: isoNow(),
        last_seen: isoNow(),
        times_seen: 1,
        first_score: repo.score,
        last_score: repo.score,
        signals: repo.signals,
        status: "new",
      });
    }
  }
  registry.entries = [...entryMap.values()];
  return registry;
}

function filterSeenRepos(repos, registry, skipSeen) {
  if (!skipSeen) return repos;
  const seen = new Set(registry.entries.filter((e) => e.times_seen > 1).map((e) => e.full_name));
  return repos.filter((repo) => !seen.has(repo.full_name));
}

async function fetchExistingTasks(baseUrl, token) {
  try {
    const response = await fetch(`${baseUrl}/api/tasks?owner=agent&status=todo,doing,review&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.tasks || [];
  } catch {
    return [];
  }
}

function deduplicateTasks(tasks, existingTasks) {
  const existingTitles = new Set(existingTasks.map((t) => t.title));
  return tasks.filter((task) => !existingTitles.has(task.title));
}

function buildMarkdown(repos, tasks, registryStats) {
  const lines = [
    `# GitHub 知识雷达 ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## 结论",
    "",
    "本轮输出不是链接列表，而是可执行吸收判断。优先吸收 Source Registry、Context Pack、Hot/Warm/Cold Context、Graph Recall、Agent Hooks。",
    "",
    `Source Registry 累计 ${registryStats.total} 个 repo，本轮新增 ${registryStats.new} 个。`,
    "",
    "## 已筛选项目",
    "",
  ];

  for (const repo of repos) {
    lines.push(`### ${repo.full_name}`);
    lines.push(`- URL: ${repo.url}`);
    lines.push(`- Score: ${repo.score}`);
    lines.push(`- Signals: ${repo.signalLabels.join("；") || "未命中"}`);
    lines.push(`- Why: ${repo.description || repo.readme_excerpt || "无描述"}`);
    lines.push("- Absorb:");
    for (const action of repo.adoption) lines.push(`  - ${action}`);
    lines.push("");
  }

  lines.push("## 已生成 Agent 任务");
  lines.push("");
  for (const task of tasks) {
    lines.push(`- ${task.title} — ${task.definitionOfDone}`);
  }
  lines.push("");
  lines.push("## Classic 需要做");
  lines.push("");
  lines.push("无。Agent 负责继续执行、验证、写回。");
  return lines.join("\n");
}

function buildTasks(repos) {
  const seenSignals = new Set(repos.flatMap((repo) => repo.signals));
  const tasks = [];

  if (seenSignals.has("source-registry")) {
    tasks.push(task(
      "实现 GitHub 雷达 Source Registry 写回 v0",
      "对象是 GitHub 雷达运行结果；动作是保存 repos.json、evidence.md、adoption-tasks.json，并通过 /api/intake 写回 Wiki 与 Task；产物是可复跑脚本和一次真实写回记录。",
      "运行 github-radar-intake.mjs --intake 后，生成本地证据目录，并在 Personal OS 出现 Wiki note、ProjectEvent、至少 1 个 agent_allowed 任务；日志不含 token。",
      "github-radar"
    ));
  }

  if (seenSignals.has("memory-tiering")) {
    tasks.push(task(
      "把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0",
      "对象是 Personal OS agent context API；动作是按执行优先级给任务、Wiki、Activity、Idea 分层；产物是 tiers 字段和回归测试。",
      "query=personal os wiki 时返回 tiers.hot、tiers.warm、tiers.cold；hot 含当前 P0/P1 agent_allowed task 或最近阻塞；npm test/tsc/lint/build 通过。",
      "memory-tiering"
    ));
  }

  if (seenSignals.has("context-pack")) {
    tasks.push(task(
      "实现 AgentRun context pack 自动归档 v0",
      "对象是 .agent-runs/<task-id>/ 产物；动作是提取 gate、worker-result、diff、测试、部署和风险并生成 Wiki note；产物是归档入口。",
      "对真实 task-id 运行后，Wiki note 包含 task_id、gate、diff、测试、部署、残余风险；Personal OS 返回 201；不泄露 token。",
      "context-pack"
    ));
  }

  if (seenSignals.has("graph-recall")) {
    tasks.push(task(
      "给 Personal OS context 增加同类任务 episode 召回 v0",
      "对象是 /api/agent/context；动作是把最近同类 AgentRun/Wiki 记录作为可复用 episode 返回；产物是 context.evidence.episodes。",
      "query=wiki write failed 时返回最近修复记录、相关 Wiki note、可执行 runbook；新增测试通过。",
      "graph-recall"
    ));
  }

  return tasks.slice(0, 4);
}

function task(title, description, definitionOfDone, tag) {
  return {
    title,
    description,
    status: "todo",
    priority: tag === "github-radar" || tag === "memory-tiering" ? "P0" : "P1",
    riskLevel: "low",
    executionMode: "agent_allowed",
    agentTags: ["personal-os", "personal-wiki", tag, "agent-self-improvement"],
    requiredOutput: definitionOfDone,
    nextAction: description,
    definitionOfDone,
    estimateMinutes: 120,
    createdBy: "hermes",
  };
}

function buildIntakePayload({ markdown, tasks, repos, includeTasks, taskId }) {
  const now = isoNow();
  return {
    source: {
      sourceType: "agent-output",
      sourcePlatform: "cron/github-radar",
      rawText: `GitHub 雷达运行：筛选 ${repos.length} 个 repo，生成 ${tasks.length} 个候选任务。`,
      createdBy: "hermes",
    },
    agent: {
      model: "hermes-github-radar-script",
      classification: {
        kind: "github-radar",
        repos: repos.map((repo) => repo.full_name),
      },
      reasoningSummary: "GitHub 雷达脚本检索开源 Personal OS/Wiki/Agent Memory/RAG 项目，抽取可吸收设计并转成 Agent 可执行任务。",
      outputSummary: `已筛选 ${repos.length} 个 repo，写入 Wiki，并生成 ${tasks.length} 个任务候选。`,
    },
    project: {
      name: "Personal OS / Wiki 知识库升级",
      status: "active",
      priority: "P0",
      currentFocus: "GitHub 外部方案转成 Agent 自驱执行闭环",
    },
    wikiNotes: [
      {
        frontmatter: {
          title: `GitHub 知识雷达 ${now.slice(0, 10)} Personal OS Wiki 自驱候选`,
          type: "project",
          created_by: "hermes:worker",
          source_type: "agent-output",
          tags: ["personal-os", "personal-wiki", "github-radar", "agent-memory", "idea"],
          created_at: now,
          task_id: taskId,
          agent_id: "hermes:github-radar",
          project: "Personal OS / Wiki 知识库升级",
          last_reviewed: now.slice(0, 10),
        },
        content: markdown,
      },
    ],
    tasks: includeTasks ? tasks : [],
    projectEvents: [
      {
        projectName: "Personal OS / Wiki 知识库升级",
        title: "GitHub 雷达已生成可执行吸收候选",
        body: `筛选 ${repos.length} 个 repo；主要信号：${[...new Set(repos.flatMap((repo) => repo.signals))].join(", ")}`,
        eventType: "github-radar",
      },
    ],
  };
}

async function postIntake(payload) {
  const baseUrl = process.env.PERSONAL_OS_BASE_URL || "http://192.168.6.37:3100";
  const token = process.env.PERSONAL_OS_API_TOKEN;
  if (!token) throw new Error("PERSONAL_OS_API_TOKEN is required for --intake");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/intake`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Personal OS intake ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.out, { recursive: true });

  const registry = await loadRegistry(args.registry);
  const candidates = await searchRepos(args.perQuery);
  const analyzed = [];
  for (const repo of candidates) {
    const readme = await fetchReadme(repo);
    analyzed.push(analyzeRepo(repo, readme));
  }

  const selected = analyzed
    .filter((repo) => repo.signals.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, args.limit);

  const mergedRegistry = mergeRegistry(registry, selected);
  const registryStats = {
    total: mergedRegistry.entries.length,
    new: selected.filter((repo) => {
      const entry = mergedRegistry.entries.find((e) => e.full_name === repo.full_name);
      return entry && entry.times_seen === 1;
    }).length,
  };

  const filteredRepos = filterSeenRepos(selected, mergedRegistry, args.skipSeen);
  let tasks = buildTasks(filteredRepos);

  if (args.intake) {
    const baseUrl = process.env.PERSONAL_OS_BASE_URL || "http://192.168.6.37:3100";
    const token = process.env.PERSONAL_OS_API_TOKEN;
    if (token) {
      const existingTasks = await fetchExistingTasks(baseUrl, token);
      const deduped = deduplicateTasks(tasks, existingTasks);
      console.log(`[dedup] ${tasks.length} tasks -> ${deduped.length} after dedup`);
      tasks = deduped;
    }
  }

  const markdown = buildMarkdown(filteredRepos, tasks, registryStats);
  const payload = buildIntakePayload({ markdown, tasks, repos: filteredRepos, includeTasks: args.includeTasks, taskId: args.taskId });

  await writeFile(path.join(args.out, "repos.json"), `${JSON.stringify({ generated_at: isoNow(), repos: filteredRepos }, null, 2)}\n`);
  await writeFile(path.join(args.out, "evidence.md"), markdown);
  await writeFile(path.join(args.out, "adoption-tasks.json"), `${JSON.stringify(tasks, null, 2)}\n`);
  await writeFile(path.join(args.out, "intake-payload.json"), `${JSON.stringify(payload, null, 2)}\n`);
  await saveRegistry(args.registry, mergedRegistry);

  let intake = null;
  if (args.intake) {
    intake = await postIntake(payload);
    await writeFile(path.join(args.out, "intake-result.json"), `${JSON.stringify(intake, null, 2)}\n`);
  }

  console.log(JSON.stringify({ out: args.out, repos: filteredRepos.length, tasks: tasks.length, registry: registryStats, intake: intake ? { ok: intake.ok, agentRunId: intake.agentRunId, wiki_write_status: intake.wiki_write_status } : null }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
