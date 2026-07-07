#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = {
    taskId: "",
    intake: false,
    out: "",
    projectId: process.env.PERSONAL_OS_PROJECT_ID || "cmqq290nm00040jmj9jwa98ya",
    projectName: process.env.PERSONAL_OS_PROJECT_NAME || "Personal OS / Wiki 知识库升级",
  };

  for (const arg of argv) {
    if (arg === "--intake") args.intake = true;
    else if (arg === "--no-intake" || arg === "--dry-run") args.intake = false;
    else if (arg.startsWith("--task-id=")) args.taskId = arg.slice("--task-id=".length);
    else if (arg.startsWith("--out=")) args.out = arg.slice("--out=".length);
    else if (arg.startsWith("--project-id=")) args.projectId = arg.slice("--project-id=".length);
    else if (arg.startsWith("--project-name=")) args.projectName = arg.slice("--project-name=".length);
    else if (arg === "--help") {
      console.log("Usage: node scripts/archive-agent-run.mjs --task-id=<id> [--intake] [--out=<dir>]");
      process.exit(0);
    }
  }

  if (!args.taskId) {
    throw new Error("--task-id is required");
  }
  if (!args.out) {
    args.out = path.join(".agent-runs", args.taskId, "context-pack");
  }
  return args;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Failed to parse ${filePath}: ${error.message}`);
  }
}

async function readTextIfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function listFiles(root, prefix = root) {
  const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath, prefix));
    } else if (entry.isFile()) {
      files.push(path.relative(process.cwd(), fullPath));
    }
  }
  return files.sort();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeText(text) {
  const secretHints = [
    process.env.PERSONAL_OS_API_TOKEN,
    process.env.PERSONAL_OS_READ_TOKEN,
    process.env.PERSONAL_WIKI_API_TOKEN,
    process.env.PERSONAL_WIKI_WRITE_TOKEN,
    process.env.PERSONAL_WIKI_READ_TOKEN,
    process.env.WIKI_API_TOKEN,
    process.env.WIKI_READ_TOKEN,
    process.env.GITHUB_TOKEN,
  ].filter(Boolean);

  let result = String(text ?? "");
  for (const secret of secretHints) {
    if (secret && secret.length >= 8) {
      result = result.split(secret).join("[REDACTED]");
    }
  }
  result = result.replace(/Bearer\s+[A-Za-z0-9._~+\-/]+=*/g, "Bearer [REDACTED]");
  result = result.replace(/(TOKEN|SECRET|API_KEY|COOKIE)=([^\s]+)/gi, "$1=[REDACTED]");
  return result;
}

function summarizeChecks(gate) {
  return asArray(gate?.checks).map((check) => {
    const detail = check.log ? ` (${check.log})` : check.files ? ` (${check.files.length} files)` : "";
    return `- ${check.name || "check"}: ${check.status || "unknown"}${detail}`;
  });
}

function classifyArtifacts(files) {
  const interesting = files.filter((file) => {
    const lower = file.toLowerCase();
    return lower.endsWith(".json") || lower.endsWith(".md") || lower.endsWith(".log") || lower.endsWith(".diff") || lower.endsWith(".patch");
  });
  const diff = interesting.filter((file) => /diff|patch/i.test(file));
  const tests = interesting.filter((file) => /test|lint|tsc|build|vitest|npm/i.test(file));
  const deploy = interesting.filter((file) => /deploy|release|backup/i.test(file));
  return { interesting, diff, tests, deploy };
}

function buildMarkdown({ taskId, worker, gate, evidence, artifacts, projectName }) {
  const checks = summarizeChecks(gate);
  const remainingRisks = asArray(worker?.remaining_risks);
  const workerArtifacts = asArray(worker?.artifacts);
  const deployment = gate?.deployment || {};
  const lines = [
    `# AgentRun Context Pack：${taskId}`,
    "",
    `任务ID：${taskId}`,
    `项目：${projectName}`,
    `Agent：${worker?.agent_id || "unknown"}`,
    `状态：${worker?.status || "unknown"}`,
    `Gate：${gate?.status || "missing"}`,
    "",
    "## 摘要",
    worker?.summary || "未提供 worker-result summary。",
    "",
    "## 决策",
    worker?.decision || "未记录决策。",
    "",
    "## Gate / 验证",
    checks.length ? checks.join("\n") : "- 未发现 gate checks。",
    "",
    "## Diff / 代码改动",
    artifacts.diff.length ? artifacts.diff.map((file) => `- ${file}`).join("\n") : "- 未发现 diff/patch 文件；本轮可能是 Wiki/source-ledger 任务。",
    "",
    "## 测试 / 构建证据",
    artifacts.tests.length ? artifacts.tests.map((file) => `- ${file}`).join("\n") : "- 未发现测试/构建日志文件。",
    "",
    "## 部署",
    `- 状态：${deployment.status || "unknown"}`,
    deployment.reason ? `- 原因：${deployment.reason}` : "",
    "",
    "## 产物清单",
    ...[...new Set([...workerArtifacts, ...artifacts.interesting])].map((file) => `- ${file}`),
    "",
    "## 残余风险",
    ...(remainingRisks.length ? remainingRisks.map((risk) => `- ${risk}`) : ["- 未记录残余风险。"]),
    "",
  ];

  if (evidence.trim()) {
    lines.push("## 原始 evidence 摘要", "", evidence.trim().slice(0, 6000), "");
  }

  return sanitizeText(lines.filter((line) => line !== "").join("\n"));
}

function buildPayload({ taskId, projectId, projectName, worker, gate, markdown }) {
  const now = new Date().toISOString();
  return {
    source: {
      sourceType: "agent-output",
      sourcePlatform: "cron/personal-os-agent-executor",
      rawText: `AgentRun context pack archived for ${taskId}: gate=${gate?.status || "missing"}`,
      createdBy: "hermes",
    },
    agent: {
      model: "hermes-cron/archive-agent-run",
      classification: {
        kind: "agent-run-context-pack",
        task_id: taskId,
        gate_status: gate?.status || "missing",
      },
      reasoningSummary: "读取 .agent-runs task 产物，生成可检索的 AgentRun context pack。",
      outputSummary: `已归档 ${taskId} 的 worker-result、gate、验证、部署、残余风险和产物索引。`,
    },
    project: {
      id: projectId,
      name: projectName,
    },
    wikiNotes: [
      {
        title: `AgentRun Context Pack：${taskId}`,
        source_type: "agent-run-context-pack",
        tags: ["personal-os", "personal-wiki", "agent-run", "context-pack"],
        metadata: {
          task_id: taskId,
          agent_id: worker?.agent_id || "unknown",
          gate_status: gate?.status || "missing",
          project: projectName,
        },
        frontmatter: {
          title: `AgentRun Context Pack：${taskId}`,
          type: "agent-run-context-pack",
          created_by: "hermes:worker",
          source_type: "agent-output",
          tags: ["personal-os", "personal-wiki", "agent-run", "context-pack"],
          created_at: now,
          task_id: taskId,
          agent_id: worker?.agent_id || "unknown",
          project: projectName,
        },
        content: markdown,
      },
    ],
    tasks: [],
    notes: [],
    ideas: [],
    projectEvents: [
      {
        projectId,
        title: `AgentRun context pack 已归档：${taskId}`,
        body: `gate=${gate?.status || "missing"}；归档内容包含 worker-result、gate、验证、部署、残余风险和产物索引。`,
        eventType: "agent-run-context-pack",
      },
    ],
  };
}

async function postIntake(payload) {
  const baseUrl = (process.env.PERSONAL_OS_BASE_URL || "http://192.168.6.37:3100").replace(/\/$/, "");
  const token = process.env.PERSONAL_OS_API_TOKEN;
  if (!token) throw new Error("PERSONAL_OS_API_TOKEN is required for --intake");
  const response = await fetch(`${baseUrl}/api/intake`, {
    method: "POST",
    headers: {
      Authorization: ["Bearer", token].join(" "),
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
  const runDir = path.join(".agent-runs", args.taskId);
  const worker = await readJsonIfExists(path.join(runDir, "worker-result.json"));
  const gate = await readJsonIfExists(path.join(runDir, "gate.json"));
  const evidence = await readTextIfExists(path.join(runDir, "source-ledger", "evidence.md"));
  const files = await listFiles(runDir);
  const artifacts = classifyArtifacts(files);

  if (!worker) throw new Error(`${runDir}/worker-result.json is required`);
  if (!gate) throw new Error(`${runDir}/gate.json is required`);

  const markdown = buildMarkdown({ taskId: args.taskId, worker, gate, evidence, artifacts, projectName: args.projectName });
  const payload = buildPayload({ taskId: args.taskId, projectId: args.projectId, projectName: args.projectName, worker, gate, markdown });

  await mkdir(args.out, { recursive: true });
  await writeFile(path.join(args.out, "context-pack.md"), `${markdown}\n`);
  await writeFile(path.join(args.out, "intake-payload.json"), `${JSON.stringify(payload, null, 2)}\n`);

  let intakeResult = null;
  if (args.intake) {
    intakeResult = await postIntake(payload);
    await writeFile(path.join(args.out, "intake-result.json"), `${JSON.stringify(intakeResult, null, 2)}\n`);
  }

  console.log(JSON.stringify({ ok: true, taskId: args.taskId, out: args.out, intake: Boolean(intakeResult), wikiStatus: intakeResult?.wiki_write_status?.status || "skipped" }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
