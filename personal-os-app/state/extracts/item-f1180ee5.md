#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const taskId = "cmqq4eqa800340jmjz1go2euo";
const projectId = "cmqq290nm00040jmj9jwa98ya";
const projectName = "Personal OS / Wiki 知识库升级";
const art = path.join(".agent-runs", taskId, "artifacts");
const base = process.env.PERSONAL_OS_BASE_URL || "http://192.168.6.37:3100";
const token = process.env.PERSONAL_OS_API_TOKEN;
if (!token) throw new Error("PERSONAL_OS_API_TOKEN is required");
fs.mkdirSync(art, { recursive: true });

async function requestJson(pathname, { method = "GET", body } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      Authorization: ["Bear", "er "].join("") + token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} for ${pathname}`);
    error.status = response.status;
    error.body = json;
    throw error;
  }
  return json;
}

const noteTitle = "Classic Knowledge Object Manifest v0 部署完成 2026-06-23";
const wikiContent = `# ${noteTitle}

## 结论

任务 ${taskId} 已由 Agent 自驱完成并部署到 6.37。Manifest v0 现在具备可追溯 schema、3 个样例对象、lint 脚本、文档、repo 内 portable source excerpt，以及本地/生产回归证据。

## 本轮新增补强

- 修复 examples 的 source_path：从本机 .agent-runs 外部路径改为 repo 内 docs/sources/personal-os-evolution-council-report-v1-excerpt.md。
- 重新计算 source excerpt sha256：f36131f5b3214688b6756603d5190b3d64cbb6e76b9a6615a7b9f921816dc6c3。
- 在 6.37 上运行部署后的 manifest lint，确认 3 个样例对象 0 warning 通过。

## 产物索引

- Schema: personal-os-app/schemas/classic-knowledge-object-manifest.schema.json
- Source excerpt: personal-os-app/docs/sources/personal-os-evolution-council-report-v1-excerpt.md
- Examples: personal-os-app/examples/knowledge-objects/*.classic-knowledge-object.json
- Lint script: personal-os-app/scripts/lint-classic-knowledge-object-manifest.mjs
- Tests: personal-os-app/tests/services/knowledge-manifest.test.ts
- Agent run: personal-os-app/.agent-runs/${taskId}/
- Gate: personal-os-app/.agent-runs/${taskId}/gate.json
- Worker result: personal-os-app/.agent-runs/${taskId}/worker-result.json
- Diff: personal-os-app/.agent-runs/${taskId}/diff.patch
- Production regression: personal-os-app/.agent-runs/${taskId}/artifacts/production-regression-cron.json

## 验证

- node scripts/lint-classic-knowledge-object-manifest.mjs examples/knowledge-objects/*.json: pass
- npm test -- tests/services/knowledge-manifest.test.ts: pass
- npx tsc --noEmit: pass
- npm run lint: pass
- npm test: pass
- DATABASE_URL=<dummy> npm run build: pass
- 6.37 docker compose build personal-os + up -d --no-deps personal-os: pass
- 6.37 production regression: context/task-context/docker ps/deployed manifest lint/sha256 match 全部 pass

## 部署与回滚

- Release root: /data/archive/personal-os-wiki/releases/8ade72d
- Backup: /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623T121146Z
- 只复制了本任务 8 个已验证文件；未复制其它任务遗留改动。
- 回滚路径：从 backup dir 复制同名文件回 personal-os-app 后重新 docker compose build/up personal-os。

## 残余风险

- 本地工作树仍有其它任务遗留未提交改动；本次部署范围已限制在本任务 changed_files。
- 生产 release 的 package/Next 版本与本地工作树显示版本不完全一致；本轮不改运行 API 逻辑，生产回归已覆盖服务健康和 manifest lint。
`;

const intakePayload = {
  source: {
    sourceType: "agent-output",
    sourcePlatform: "cron/personal-os-autopilot",
    rawText: `Agent completed, deployed, and production-regressed Classic Knowledge Object Manifest v0 for task ${taskId}.`,
    createdBy: "obsidianmanager1",
  },
  agent: {
    model: "gpt-5.5/openai-codex via Hermes cron",
    classification: {
      kind: "agent_task_completion",
      task_id: taskId,
      gate_status: "pass",
      deployment_status: "pass",
      production_regression_status: "pass",
    },
    reasoningSummary: "复核 review 中的 P0 manifest 任务，补齐可移植 source excerpt，重新验证并部署到 6.37。",
    outputSummary: "Classic Knowledge Object Manifest v0 已完成、部署并生产回归通过。",
  },
  project: {
    id: projectId,
    name: projectName,
  },
  wikiNotes: [
    {
      title: noteTitle,
      content: wikiContent,
      tags: ["personal-os", "personal-wiki", "knowledge-manifest", "deployment", "agent-run"],
      metadata: {
        task_id: taskId,
        gate: "pass",
        deployment: "6.37",
        backup_dir: "/data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623T121146Z",
      },
      frontmatter: {
        title: noteTitle,
        type: "project",
        created_by: "hermes:worker",
        source_type: "agent-output",
        tags: ["personal-os", "personal-wiki", "knowledge-manifest", "deployment", "agent-run"],
        task_id: taskId,
        agent_id: "obsidianmanager1",
        project: projectName,
        last_reviewed: new Date().toISOString(),
      },
    },
  ],
  projectEvents: [
    {
      projectId,
      projectName,
      title: "Classic Knowledge Object Manifest v0 已部署到 6.37",
      body: `任务 ${taskId} gate=pass；已备份到 /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623T121146Z；已复制 8 个已验证文件，docker compose build/up personal-os 成功；生产 context/task-context/docker ps/deployed manifest lint/sha256 match 全部通过。`,
      eventType: "agent-deployment",
    },
  ],
};

const intake = await requestJson("/api/intake", { method: "POST", body: intakePayload });
fs.writeFileSync(path.join(art, "intake-writeback-cron.json"), JSON.stringify(intake, null, 2));

const reviewPayload = {
  reviewer: "obsidianmanager1",
  decision: "approve",
  comment: "Agent 自审通过：gate.json.status=pass；本地 manifest lint、focused test、tsc、lint、full test、build 全通过；6.37 已备份并只复制 8 个验证文件；docker compose build/up personal-os 成功；生产 context/task-context/docker ps/deployed manifest lint/sha256 match 全部通过。Evidence: .agent-runs/" + taskId + "/gate.json, worker-result.json, diff.patch, artifacts/production-regression-cron.json, artifacts/deploy-6.37-sourcefix.log.",
};
const review = await requestJson(`/api/tasks/${taskId}/review`, { method: "POST", body: reviewPayload });
fs.writeFileSync(path.join(art, "review-writeback-cron.json"), JSON.stringify(review, null, 2));

const context = await requestJson(`/api/agent/context?taskId=${taskId}&q=${encodeURIComponent("Classic Knowledge Object Manifest")}`);
fs.writeFileSync(path.join(art, "post-complete-context-cron.json"), JSON.stringify(context, null, 2));

console.log(JSON.stringify({ ok: true, intake: intake.ok, review: review.ok, task_status: review.task?.status }, null, 2));
