#!/usr/bin/env node

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_PROJECT = "Personal OS / Wiki Upgrade";
const DEFAULT_AGENT_ID = "obsidianmanager1";
const MAX_TEXT_EXCERPT = 8000;
const REDACTED = "[REDACTED]";

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /((?:PERSONAL_OS|WIKI|GITHUB|OPENAI|ANTHROPIC|DATABASE|POSTGRES)[A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|URL)\s*[=:]\s*)[^\s"']+/gi,
  /([?&](?:token|key|secret|password)=)[^\s&#"']+/gi,
];

function isoNow() {
  return new Date().toISOString();
}

function todayStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = {
    targetTaskId: process.env.CONTEXT_PACK_TARGET_TASK_ID || "",
    archiveTaskId: process.env.CONTEXT_PACK_ARCHIVE_TASK_ID || "",
    runDir: "",
    out: "",
    intake: false,
    baseUrl: process.env.PERSONAL_OS_BASE_URL || DEFAULT_BASE_URL,
    agentId: process.env.CONTEXT_PACK_AGENT_ID || DEFAULT_AGENT_ID,
    projectName: process.env.CONTEXT_PACK_PROJECT || DEFAULT_PROJECT,
  };

  for (const arg of argv) {
    if (arg === "--intake") args.intake = true;
    else if (arg === "--no-intake" || arg === "--dry-run") args.intake = false;
    else if (arg.startsWith("--task-id=")) args.targetTaskId = arg.split("=", 2)[1];
    else if (arg.startsWith("--target-task-id=")) args.targetTaskId = arg.split("=", 2)[1];
    else if (arg.startsWith("--archive-task-id=")) args.archiveTaskId = arg.split("=", 2)[1];
    else if (arg.startsWith("--run-dir=")) args.runDir = arg.split("=", 2)[1];
    else if (arg.startsWith("--out=")) args.out = arg.split("=", 2)[1];
    else if (arg.startsWith("--base-url=")) args.baseUrl = arg.split("=", 2)[1];
    else if (arg.startsWith("--agent-id=")) args.agentId = arg.split("=", 2)[1];
    else if (arg.startsWith("--project=")) args.projectName = arg.split("=", 2)[1];
    else if (arg === "--help") {
      console.log(`Usage: node scripts/archive-agent-run-context-pack.mjs --task-id=<archived-task-id> [--archive-task-id=<current-task-id>] [--run-dir=.agent-runs/<archived-task-id>] [--out=.agent-runs/<current-task-id>/artifacts/context-pack-<archived-task-id>] [--intake]`);
      process.exit(0);
    }
  }

  if (!args.targetTaskId) {
    throw new Error("--task-id is required");
  }
  if (!args.runDir) {
    args.runDir = path.join(".agent-runs", args.targetTaskId);
  }
  if (!args.out) {
    args.out = args.runDir;
  }

  return args;
}

export function redact(value) {
  let text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, (...match) => {
      if (match.length > 2 && typeof match[1] === "string" && match[1]) {
        return `${match[1]}${REDACTED}`;
      }
      return REDACTED;
    });
  }
  return text;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return isRecord(value) ? value : {};
}

async function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return { exists: false, data: null, error: null };
  }
  try {
    const text = await readFile(filePath, "utf8");
    return { exists: true, data: JSON.parse(redact(text)), error: null };
  } catch (error) {
    return {
      exists: true,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readTextIfExists(filePath, maxChars = MAX_TEXT_EXCERPT) {
  if (!existsSync(filePath)) {
    return { exists: false, text: "", truncated: false, error: null };
  }
  try {
    const text = redact(await readFile(filePath, "utf8"));
    return {
      exists: true,
      text: text.slice(0, maxChars),
      truncated: text.length > maxChars,
      error: null,
    };
  } catch (error) {
    return {
      exists: true,
      text: "",
      truncated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function listFilesRecursive(rootDir, currentDir = rootDir) {
  if (!existsSync(currentDir)) {
    return [];
  }
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(rootDir, fullPath));
    } else if (entry.isFile()) {
      const info = await stat(fullPath);
      files.push({
        path: path.relative(rootDir, fullPath),
        bytes: info.size,
      });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function collectRunArtifacts(runDir) {
  const [workerResult, gate, reviewResult, finalMarkdown, diffPatch, runJson] = await Promise.all([
    readJsonIfExists(path.join(runDir, "worker-result.json")),
    readJsonIfExists(path.join(runDir, "gate.json")),
    readJsonIfExists(path.join(runDir, "review-result.json")),
    readTextIfExists(path.join(runDir, "final.md"), 4000),
    readTextIfExists(path.join(runDir, "diff.patch"), MAX_TEXT_EXCERPT),
    readJsonIfExists(path.join(runDir, "run.json")),
  ]);

  return {
    runDir,
    exists: existsSync(runDir),
    files: await listFilesRecursive(runDir),
    workerResult,
    gate,
    reviewResult,
    finalMarkdown,
    diffPatch,
    runJson,
  };
}

function commandKey(command) {
  return [command?.cmd, command?.evidence].filter(Boolean).join("::");
}

function summarizeCommands(artifacts) {
  const commands = [];
  const seen = new Set();
  const add = (command) => {
    if (!isRecord(command)) return;
    const normalized = {
      cmd: String(command.cmd ?? command.command ?? "").trim(),
      exit_code: command.exit_code ?? command.exitCode ?? null,
      evidence: command.evidence ?? command.log ?? null,
    };
    if (!normalized.cmd) return;
    const key = commandKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    commands.push(normalized);
  };

  for (const command of asArray(asRecord(asRecord(artifacts.gate.data).verifier).commands)) add(command);
  for (const command of asArray(asRecord(artifacts.workerResult.data).commands)) add(command);
  return commands;
}

function summarizeRisks(artifacts) {
  const risks = [];
  for (const risk of asArray(asRecord(artifacts.workerResult.data).risks)) {
    if (typeof risk === "string" && risk.trim()) risks.push(risk.trim());
  }
  const blockedReason = asRecord(artifacts.workerResult.data).blocked_reason;
  if (typeof blockedReason === "string" && blockedReason.trim()) {
    risks.push(`Blocked reason: ${blockedReason.trim()}`);
  }
  if (risks.length === 0) {
    risks.push("未发现新增残余风险；保留源 run_dir 与备份路径用于回溯。");
  }
  return risks;
}

function diffSummary(artifacts) {
  const worker = asRecord(artifacts.workerResult.data);
  const changedFiles = asArray(worker.changed_files).filter((item) => typeof item === "string");
  return {
    path: worker.diff_path ?? (artifacts.diffPatch.exists ? "diff.patch" : "missing"),
    stat: worker.diff_stat ?? "未提供 diff_stat；查看 diff.patch 或 artifact index。",
    changedFiles,
    excerpt: artifacts.diffPatch.text,
    truncated: artifacts.diffPatch.truncated,
  };
}

function taskFromContext(taskContext) {
  const context = asRecord(taskContext?.context ?? taskContext);
  return asRecord(context.task);
}

function wikiLinksFromContext(taskContext) {
  const task = taskFromContext(taskContext);
  return asArray(task.wikiLinks).filter(isRecord);
}

function bullet(lines, values, fallback = "无。") {
  if (!values.length) {
    lines.push(`- ${fallback}`);
    return;
  }
  for (const value of values) {
    lines.push(`- ${value}`);
  }
}

export function buildContextPackMarkdown({
  targetTaskId,
  archiveTaskId,
  taskContext,
  artifacts,
  projectName = DEFAULT_PROJECT,
  generatedAt = isoNow(),
}) {
  const task = taskFromContext(taskContext);
  const gate = asRecord(artifacts.gate.data);
  const worker = asRecord(artifacts.workerResult.data);
  const deployment = asRecord(gate.deployment ?? worker.deployment);
  const writeback = asRecord(gate.writeback ?? worker.writeback);
  const productionRegression = asRecord(gate.production_regression ?? worker.production_regression);
  const commands = summarizeCommands(artifacts);
  const diff = diffSummary(artifacts);
  const risks = summarizeRisks(artifacts);
  const wikiLinks = wikiLinksFromContext(taskContext);
  const title = task.title ? String(task.title) : targetTaskId;
  const gateStatus = gate.status ?? worker.status ?? "unknown";

  const lines = [
    `# AgentRun Context Pack ${targetTaskId}`,
    "",
    "## 结论",
    "",
    `- task_id: ${targetTaskId}`,
    archiveTaskId ? `- archive_task_id: ${archiveTaskId}` : null,
    `- task_title: ${title}`,
    `- task_status: ${task.status ?? "unknown"}`,
    `- project: ${task.project?.name ?? projectName}`,
    `- gate: ${gateStatus}`,
    `- run_dir: ${artifacts.runDir}`,
    `- generated_at: ${generatedAt}`,
    "",
    "## 字段映射",
    "",
    "| Wiki 字段 | 来源 | 处理规则 |",
    "| --- | --- | --- |",
    "| task_id | Personal OS /api/agent/context.task.id | 作为本 context pack 的主索引 |",
    "| gate | .agent-runs/<task-id>/gate.json | 摘要 status、verifier、deployment、writeback |",
    "| diff | worker-result.diff_stat + diff.patch | 记录变更文件、diff stat 和截断后的安全摘录 |",
    "| 测试 | gate.verifier.commands + worker-result.commands | 保留命令、exit_code、证据路径 |",
    "| 部署 | gate.deployment + production_regression | 保留 backup、rollback、生产回归状态 |",
    "| 残余风险 | worker-result.risks / blocked_reason | 无风险时显式写“未发现新增残余风险” |",
    "| artifact index | run_dir 文件清单 | 只记录相对路径与大小，不写入 token/密钥 |",
    "",
    "## Gate",
    "",
    `- status: ${gateStatus}`,
    `- synthesizer_allowed: ${asRecord(gate.synthesizer).allowed_to_announce_done ?? "unknown"}`,
    `- definition_of_done_met: ${worker.writeback?.definitionOfDoneMet ?? writeback.definitionOfDoneMet ?? "unknown"}`,
    "",
    "## Diff",
    "",
    `- path: ${diff.path}`,
    "- stat:",
    "```text",
    String(diff.stat),
    "```",
    "- changed_files:",
  ].filter(Boolean);

  bullet(lines, diff.changedFiles, "未记录 changed_files。需要查看 diff.patch。" );
  lines.push("", "### diff excerpt", "", "```diff", diff.excerpt || "diff.patch 不存在或为空。", diff.truncated ? "\n...diff excerpt truncated..." : "", "```", "");

  lines.push("## 测试 / 验证", "");
  if (commands.length === 0) {
    lines.push("- 未发现命令记录；该 pack 标记为 evidence incomplete。", "");
  } else {
    for (const command of commands) {
      lines.push(`- ${command.cmd}`);
      lines.push(`  - exit_code: ${command.exit_code}`);
      lines.push(`  - evidence: ${command.evidence ?? "未记录"}`);
    }
    lines.push("");
  }

  lines.push("## 部署 / 生产回归", "");
  lines.push(`- deployment_status: ${deployment.status ?? "not_applicable_or_missing"}`);
  lines.push(`- backup_dir: ${deployment.backup_dir ?? "未记录"}`);
  lines.push(`- rollback_path: ${deployment.rollback_path ?? worker.deployment?.rollback_path ?? "未记录"}`);
  lines.push(`- production_regression_status: ${productionRegression.status ?? "未记录"}`);
  lines.push("");

  lines.push("## 写回", "");
  lines.push(`- writeback_status: ${writeback.status ?? "未记录"}`);
  lines.push(`- task_status_after_writeback: ${writeback.task_status ?? worker.writeback?.task_status_after_review ?? "未记录"}`);
  lines.push("- wiki_links:");
  bullet(lines, wikiLinks.map((link) => `${link.noteTitle ?? "untitled"} — ${link.notePath ?? link.noteUrl ?? "no-path"}`), "暂无已关联 Wiki 链接。" );
  lines.push("");

  lines.push("## 残余风险", "");
  bullet(lines, risks);
  lines.push("");

  lines.push("## Artifact index", "");
  if (artifacts.files.length === 0) {
    lines.push("- run_dir 不存在或没有文件。", "");
  } else {
    for (const file of artifacts.files) {
      lines.push(`- ${file.path} (${file.bytes} bytes)`);
    }
    lines.push("");
  }

  if (artifacts.finalMarkdown.exists && artifacts.finalMarkdown.text.trim()) {
    lines.push("## Final summary excerpt", "", "```text", artifacts.finalMarkdown.text, artifacts.finalMarkdown.truncated ? "\n...final excerpt truncated..." : "", "```", "");
  }

  return redact(lines.join("\n"));
}

export function buildIntakePayload({
  markdown,
  title,
  targetTaskId,
  archiveTaskId,
  agentId = DEFAULT_AGENT_ID,
  projectName = DEFAULT_PROJECT,
  generatedAt = isoNow(),
}) {
  const date = generatedAt.slice(0, 10);
  return {
    source: {
      sourceType: "agent-output",
      sourcePlatform: "cron/context-pack",
      rawText: `AgentRun context pack archived for ${targetTaskId}${archiveTaskId ? ` by ${archiveTaskId}` : ""}.`,
      createdBy: "hermes",
    },
    agent: {
      model: "hermes-context-pack-archiver",
      classification: {
        kind: "agent-run-context-pack",
        task_id: archiveTaskId || targetTaskId,
        archived_task_id: targetTaskId,
      },
      reasoningSummary: "将 .agent-runs 目录中的 gate、worker-result、diff、测试、部署和残余风险压缩成可检索 Wiki context pack。",
      outputSummary: `已生成 ${targetTaskId} 的 AgentRun context pack。`,
    },
    project: {
      name: projectName,
      status: "active",
      priority: "P0",
      currentFocus: "Personal OS / Wiki 自驱闭环生产化",
    },
    wikiNotes: [
      {
        frontmatter: {
          title,
          type: "project",
          created_by: "hermes:worker",
          source_type: "agent-output",
          tags: ["personal-os", "personal-wiki", "agent-run", "context-pack", "evidence"],
          created_at: generatedAt,
          task_id: targetTaskId,
          agent_id: agentId,
          project: projectName,
          last_reviewed: date,
        },
        metadata: {
          task_id: targetTaskId,
          archive_task_id: archiveTaskId || null,
          agent_id: agentId,
          project: projectName,
        },
        content: markdown,
      },
    ],
    projectEvents: [
      {
        projectName,
        title: `AgentRun context pack archived ${targetTaskId}`,
        body: `已将 ${targetTaskId} 的 gate、diff、测试、部署、残余风险写成 Wiki context pack。归档任务：${archiveTaskId || "未指定"}。`,
        eventType: "agent-context-pack",
      },
    ],
  };
}

async function fetchJson(url, token) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GET ${url} returned ${response.status}: ${JSON.stringify(body).slice(0, 400)}`);
  }
  return body;
}

async function postIntake(baseUrl, token, payload) {
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
  const token = process.env.PERSONAL_OS_API_TOKEN;
  const generatedAt = isoNow();
  await mkdir(args.out, { recursive: true });

  const contextUrl = `${args.baseUrl.replace(/\/$/, "")}/api/agent/context?${new URLSearchParams({ taskId: args.targetTaskId })}`;
  const [taskContext, artifacts] = await Promise.all([
    fetchJson(contextUrl, token),
    collectRunArtifacts(args.runDir),
  ]);

  const task = taskFromContext(taskContext);
  const title = `AgentRun context pack ${args.targetTaskId} ${todayStamp(new Date(generatedAt))}`;
  const markdown = buildContextPackMarkdown({
    targetTaskId: args.targetTaskId,
    archiveTaskId: args.archiveTaskId,
    taskContext,
    artifacts,
    projectName: args.projectName,
    generatedAt,
  });
  const payload = buildIntakePayload({
    markdown,
    title,
    targetTaskId: args.targetTaskId,
    archiveTaskId: args.archiveTaskId,
    agentId: args.agentId,
    projectName: task.project?.name ?? args.projectName,
    generatedAt,
  });

  await writeFile(path.join(args.out, "context-pack.md"), `${markdown}\n`);
  await writeFile(path.join(args.out, "context-pack-payload.json"), `${redact(JSON.stringify(payload, null, 2))}\n`);

  let intake = null;
  if (args.intake) {
    intake = await postIntake(args.baseUrl, token, payload);
    await writeFile(path.join(args.out, "context-pack-intake-result.json"), `${redact(JSON.stringify(intake, null, 2))}\n`);
  }

  const result = {
    ok: true,
    targetTaskId: args.targetTaskId,
    archiveTaskId: args.archiveTaskId || null,
    out: args.out,
    runDir: args.runDir,
    taskTitle: task.title ?? null,
    gateStatus: artifacts.gate.data?.status ?? artifacts.workerResult.data?.status ?? null,
    intake: intake ? {
      ok: intake.ok,
      agentRunId: intake.agentRunId,
      wiki_write_status: intake.wiki_write_status,
      wiki: Array.isArray(intake.wiki) ? intake.wiki.map((item) => ({ ok: item.ok, title: item.title, note_path: item.note_path, status: item.status, error: item.error })) : [],
    } : null,
  };
  await writeFile(path.join(args.out, "context-pack-result.json"), `${redact(JSON.stringify(result, null, 2))}\n`);
  console.log(redact(JSON.stringify(result, null, 2)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(redact(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });
}
