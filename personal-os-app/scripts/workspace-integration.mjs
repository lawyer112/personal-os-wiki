#!/usr/bin/env node
/** 隔离数据库集成验证。必须明确启用，并使用专门的本地测试数据库。 */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";

if (process.env.ALLOW_WORKSPACE_INTEGRATION !== "1") throw new Error("集成测试需要显式设置 ALLOW_WORKSPACE_INTEGRATION=1");
const database = new URL(process.env.DATABASE_URL || "");
if (!["localhost", "127.0.0.1"].includes(database.hostname) || database.pathname !== "/personal_os_ci") throw new Error("只允许使用本地专用 personal_os_ci 测试库");
const output = path.resolve(process.env.UI_OUTPUT_DIR || "../artifacts/workspace");
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(path.join(os.tmpdir(), "personal-os-ci-"));
const base = "http://127.0.0.1:3180";
const management = randomBytes(24).toString("hex"), readonly = randomBytes(24).toString("hex");
const wikiRead = randomBytes(24).toString("hex"), wikiWrite = randomBytes(24).toString("hex");
const actors = ["ci-worker-a", "ci-worker-b", "ci-reviewer"].map((agentId, index) => ({ agentId, token: randomBytes(24).toString("hex"), role: index === 2 ? "reviewer" : "worker" }));
const credentials = actors.map(actor => ({ agentId: actor.agentId, role: actor.role, tokenHash: createHash("sha256").update(actor.token).digest("hex"), maxConcurrent: 1 }));
const environment = { ...process.env, PERSONAL_OS_API_TOKEN: management, PERSONAL_OS_READ_TOKEN: readonly, PERSONAL_OS_AGENT_CREDENTIALS: JSON.stringify(credentials), WIKI_READ_TOKEN: wikiRead, WIKI_API_TOKEN: wikiWrite, WIKI_INTERNAL_URL: "http://127.0.0.1:3429", NEXT_PUBLIC_WIKI_URL: "http://127.0.0.1:3429" };
const children = [];
function start(command, args, env, name) { const log = createWriteStream(path.join(output, name)); const child = spawn(command, args, { env, stdio: ["ignore", "pipe", "pipe"] }); child.stdout.pipe(log); child.stderr.pipe(log); children.push(child); return child; }
async function waitFor(url) { for (let i = 0; i < 100; i++) { try { const response = await fetch(url); if (response.status < 500) return; } catch { /* 等待测试服务启动。 */ } await sleep(100); } throw new Error(`测试服务未启动：${url}`); }
async function api(route, token = management, payload, expected = 200, headers = {}) {
  const response = await fetch(base + route, { method: payload === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...headers }, body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  assert.equal(response.status, expected, `${route}：${JSON.stringify(body)}`);
  return body;
}
const cases = [];
const pass = name => { cases.push({ name, passed: true }); console.log(`通过：${name}`); };
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  start("python", ["../personal-wiki/api/workspace_server.py"], { ...environment, WIKI_DATA_DIR: temporary, WIKI_HOST: "127.0.0.1", WIKI_PORT: "3429" }, "wiki-test.log");
  start(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3180"], environment, "app-test.log");
  await waitFor(base + "/auth/read"); await waitFor("http://127.0.0.1:3429/api/health"); await client.connect();
  for (const actor of actors) await api("/api/agent-profiles", management, { id: actor.agentId, displayName: actor.role === "reviewer" ? "测试复核者" : "测试执行者", tags: ["测试"], allowedRiskLevel: "low", enabled: true, canWriteTasks: true });
  async function newTask(title, wikiLinks = []) {
    const result = await api("/api/workspace/actions", management, { action: "create", payload: { title, status: "todo", nextAction: "执行隔离验证", definitionOfDone: "提供测试报告并独立复核", riskLevel: "low", executionMode: "agent_allowed", agentTags: ["测试"], wikiLinks } }, 201);
    return result.task;
  }
  const task = await newTask("并发认领测试任务");
  const claims = await Promise.all(actors.slice(0, 2).map(async actor => {
    const response = await fetch(base + "/api/agent-v2", { method: "POST", headers: { Authorization: `Bearer ${actor.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim", taskId: task.id }) });
    return { actor, status: response.status, body: await response.json() };
  }));
  assert.deepEqual(claims.map(result => result.status).sort(), [200, 409]);
  const winner = claims.find(result => result.status === 200); const identity = { taskId: task.id, runId: winner.body.runId };
  assert.ok(identity.runId); pass("两个执行者并发认领，仅一个成功");
  await api("/api/agent-v2", winner.actor.token, { action: "heartbeat", ...identity, runId: "old-run" }, 409); pass("拒绝错误执行批次");
  await api("/api/agent-v2", winner.actor.token, { action: "review", ...identity, payload: { decision: "approve", comment: "自审" } }, 403); pass("执行者不能审批自己的成果");
  await api("/api/agent-v2", winner.actor.token, { action: "heartbeat", ...identity });
  await api("/api/agent-v2", winner.actor.token, { action: "submit", ...identity, payload: { summary: "没有证据的结果" } }, 400); pass("没有证据不能提交成果");
  await api("/api/agent-v2", winner.actor.token, { action: "submit", ...identity, payload: { summary: "隔离验证已完成", artifactUrls: ["https://example.invalid/test-report"], definitionOfDoneMet: true, needsHumanDecision: false } });
  const submitted = await api(`/api/workspace?view=task&id=${task.id}`); assert.equal(submitted.task.status, "review"); pass("提交进入验收，不直接变成已完成");
  await api("/api/agent-v2", actors[2].token, { action: "review", ...identity, expectedSubmittedAt: "wrong", payload: { decision: "approve", comment: "核对结果" } }, 409); pass("验收绑定当前提交版本");
  await api("/api/agent-v2", actors[2].token, { action: "review", ...identity, expectedSubmittedAt: submitted.task.submittedAt, payload: { decision: "approve", comment: "已核对测试证据与验收标准" } });
  assert.equal((await api(`/api/workspace?view=task&id=${task.id}`)).task.status, "done"); pass("独立复核通过后完成任务");
  const retryTask = await newTask("过期执行器隔离测试");
  const first = await api("/api/agent-v2", actors[0].token, { action: "claim", taskId: retryTask.id });
  await client.query('UPDATE "Task" SET "leaseUntil" = NOW() - INTERVAL \'1 minute\' WHERE id = $1', [retryTask.id]);
  const replacement = await api("/api/agent-v2", actors[1].token, { action: "claim", taskId: retryTask.id });
  assert.notEqual(first.runId, replacement.runId);
  await api("/api/agent-v2", actors[0].token, { action: "submit", taskId: retryTask.id, runId: first.runId, payload: { summary: "旧结果", evidenceLinks: ["https://example.invalid/old"] } }, 409); pass("重新认领后拒绝旧执行器写入");
  await api("/api/agent-v2", actors[1].token, { action: "block", taskId: retryTask.id, runId: replacement.runId, reason: "隔离验证结束，等待人工处理" });
  const knowledgeInput = { requestId: randomUUID(), title: "集成测试操作手册", content: "旧版验收依据", metadata: { space: "隔离测试", book: "测试手册", chapter: "执行", status: "draft" } };
  const knowledge = await api("/api/workspace/knowledge", management, knowledgeInput);
  const replay = await api("/api/workspace/knowledge", management, knowledgeInput);
  assert.equal(knowledge.note.id, replay.note.id); pass("创建手册重试不重复入库");
  const edits = await Promise.all([1, 2].map(async index => {
    const response = await fetch(base + "/api/workspace/knowledge", { method: "POST", headers: { Authorization: `Bearer ${management}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...knowledgeInput, path: knowledge.note.path, expectedRevision: knowledge.note.revision, content: `新版内容 ${index}` }) });
    return { status: response.status, body: await response.json() };
  }));
  assert.deepEqual(edits.map(result => result.status).sort(), [200, 409]); pass("手册并发编辑不会互相覆盖");
  const historical = await api(`/api/workspace/knowledge?path=${encodeURIComponent(knowledge.note.path)}&revision=${knowledge.note.revision}`);
  assert.equal(historical.note.content, knowledgeInput.content); pass("历史知识版本可准确读取");
  const linkedTask = await newTask("固定知识版本测试", [{ noteTitle: knowledge.note.title, notePath: knowledge.note.path, noteUrl: `${base}/wiki?path=${encodeURIComponent(knowledge.note.path)}&revision=${knowledge.note.revision}` }]);
  const linkedClaim = await api("/api/agent-v2", actors[0].token, { action: "claim", taskId: linkedTask.id });
  const packet = await api(`/api/agent-v2?action=context&taskId=${linkedTask.id}&runId=${linkedClaim.runId}`, actors[0].token);
  assert.equal(packet.context.knowledge[0].status, "pinned"); assert.equal(packet.context.knowledge[0].content, knowledgeInput.content); pass("智能体上下文采用任务绑定的知识版本");
  await api("/api/workspace?view=tasks", readonly);
  await api("/api/workspace/actions", readonly, { action: "create", payload: {} }, 401); pass("只读凭证不能写入任务");
  await api("/api/workspace/actions", management, { action: "create", payload: {} }, 403, { Origin: "https://untrusted.invalid" }); pass("跨站写入被拒绝");
  await api("/api/workspace/actions", management, { action: "update", taskId: linkedTask.id, payload: { status: "done" } }, 409); pass("不能绕过复核直接标记完成");
  for (let index = 0; index < 31; index++) await client.query('INSERT INTO "Task" (id, title, "nextAction", "definitionOfDone", "updatedAt") VALUES ($1,$2,$3,$4,NOW())', [randomUUID(), `分页演示任务 ${index}`, "下一步", "验收要求"]);
  const listed = await api("/api/workspace?view=tasks&page=1"); assert.equal(listed.tasks.length, 30); assert.ok(listed.total > 30); assert.equal(listed.tasks[0].runs, undefined); pass("任务列表分页且不加载完整执行历史");
  const system = await api("/api/workspace?view=system"); assert.equal(system.database, true); assert.equal(system.wiki.ok, true);
  for (const secret of [management, readonly, wikiRead, wikiWrite]) assert.ok(!JSON.stringify(system).includes(secret)); pass("运行状态不返回密钥");
  await writeFile(path.join(output, "integration-report.json"), JSON.stringify({ database: "隔离本地测试库", cases }, null, 2));
  if (process.env.RUN_UI_SMOKE === "1") {
    const child = spawn("python", ["tests/ui/smoke.py"], { env: { ...environment, UI_BASE_URL: base, UI_ACCESS_TOKEN: management, UI_OUTPUT_DIR: output }, stdio: "inherit" });
    const exit = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
    assert.equal(exit, 0, "界面回归检查失败");
  }
} finally {
  await client.end().catch(() => {});
  for (const child of children) child.kill("SIGTERM");
}
