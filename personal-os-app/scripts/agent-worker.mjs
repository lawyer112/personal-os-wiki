#!/usr/bin/env node
/** 独立任务执行器。命令由管理员配置，任务数据只经标准输入传入，不拼接成命令。 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const base = process.env.PERSONAL_OS_BASE_URL;
const token = process.env.PERSONAL_OS_WORKER_TOKEN;
const rawCommand = process.env.PERSONAL_OS_WORKER_COMMAND;
const workRoot = path.resolve(process.env.PERSONAL_OS_WORKER_DIR || ".agent-runs");
const once = process.argv.includes("--once");
const maximumMinutes = Math.min(240, Math.max(1, Number(process.env.PERSONAL_OS_WORKER_TIMEOUT_MINUTES) || 30));
const pollingSeconds = Math.max(15, Number(process.env.PERSONAL_OS_WORKER_POLL_SECONDS) || 30);
let stopping = false;
let activeChild;
let forceStopTimer;
function stopChild() {
  if (!activeChild || activeChild.exitCode !== null || activeChild.signalCode !== null) return;
  const child = activeChild;
  child.kill("SIGTERM");
  forceStopTimer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); }, 5000);
  forceStopTimer.unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { stopping = true; stopChild(); });

async function call(action, input, method = "POST") {
  const url = new URL("/api/agent-v2", base);
  if (method === "GET") { url.searchParams.set("action", action); for (const [key, value] of Object.entries(input || {})) url.searchParams.set(key, value); }
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ action, ...input }) : undefined, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) { const error = new Error(body.error || `接口返回 ${response.status}`); error.status = response.status; throw error; }
  return body;
}
function commandArguments() {
  let command;
  try { command = JSON.parse(rawCommand || "null"); } catch { throw new Error("执行命令必须是 JSON 字符串数组"); }
  if (!Array.isArray(command) || command.length < 1 || command.some(part => typeof part !== "string" || !part.length)) throw new Error("请通过 PERSONAL_OS_WORKER_COMMAND 配置管理员批准的命令数组");
  return command;
}
async function execute(task, command) {
  let claimed;
  try { claimed = await call("claim", { taskId: task.id }); } catch (error) { if (error.status === 409) return; throw error; }
  if (!claimed.runId) throw new Error("认领响应没有执行批次，停止执行");
  const identity = { taskId: task.id, runId: claimed.runId };
  const directory = path.join(workRoot, task.id, claimed.runId);
  await mkdir(directory, { recursive: true });
  let heartbeat;
  let heartbeating = false;
  let abortReason = "";
  try {
    const context = await call("context", identity, "GET");
    if (context.context.knowledge.some(item => item.status === "unavailable")) throw new Error("执行依据不可读取，需要人工检查知识或历史版本");
    await writeFile(path.join(directory, "context.json"), JSON.stringify(context.context, null, 2));
    // 默认不把管理、执行者或复核凭证传给子进程；额外环境必须由管理员显式配置。
    const extraEnv = JSON.parse(process.env.PERSONAL_OS_WORKER_ENV || "{}");
    if (!extraEnv || Array.isArray(extraEnv) || typeof extraEnv !== "object") throw new Error("执行环境必须是 JSON 对象");
    for (const key of Object.keys(extraEnv)) if (/^PERSONAL_OS_.*(TOKEN|CREDENTIALS)/.test(key)) throw new Error("不能向子进程传入平台管理或执行凭证");
    const child = spawn(command[0], command.slice(1), { cwd: directory, shell: false, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: "C.UTF-8", ...extraEnv }, stdio: ["pipe", "pipe", "pipe"] });
    activeChild = child;
    const chunks = []; const errors = []; let bytes = 0;
    child.stdout.on("data", chunk => { bytes += chunk.length; if (bytes > 2 * 1024 * 1024) { abortReason = "执行结果超过 2 MB 限制"; stopChild(); } else chunks.push(chunk); });
    child.stderr.on("data", chunk => { if (errors.reduce((sum, value) => sum + value.length, 0) < 2 * 1024 * 1024) errors.push(chunk); });
    child.stdin.on("error", () => { /* 子进程提前退出由退出状态处理。 */ });
    child.stdin.end(JSON.stringify({ taskId: task.id, runId: claimed.runId, context: context.context }));
    heartbeat = setInterval(async () => {
      if (heartbeating) return;
      heartbeating = true;
      try { await call("heartbeat", identity); } catch (error) { abortReason = `执行授权或心跳失效：${error.message}`; stopChild(); }
      finally { heartbeating = false; }
    }, 30000);
    const deadline = setTimeout(() => { abortReason = "执行超过设定时限"; stopChild(); }, maximumMinutes * 60000);
    let code;
    try { code = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); }); }
    finally { clearTimeout(deadline); clearInterval(heartbeat); if (forceStopTimer) clearTimeout(forceStopTimer); activeChild = undefined; }
    await writeFile(path.join(directory, "stderr.log"), Buffer.concat(errors));
    const output = Buffer.concat(chunks).toString("utf8");
    await writeFile(path.join(directory, "result.json"), output);
    if (abortReason || stopping) throw new Error(abortReason || "执行器已收到停止指令");
    if (code !== 0) throw new Error(`执行命令非正常结束，退出码 ${code}`);
    let result;
    try { result = JSON.parse(output); } catch { throw new Error("执行命令必须在标准输出返回一份 JSON 结果，诊断日志请写到标准错误"); }
    if (typeof result.summary !== "string" || !result.summary.trim()) throw new Error("执行结果缺少成果摘要");
    if ((!Array.isArray(result.artifactUrls) || !result.artifactUrls.length) && (!Array.isArray(result.evidenceLinks) || !result.evidenceLinks.length)) throw new Error("执行结果缺少交付物或证据链接");
    await call("submit", { ...identity, payload: { summary: result.summary, artifactUrls: result.artifactUrls || [], evidenceLinks: result.evidenceLinks || [], nextRecommendation: result.nextRecommendation, definitionOfDoneMet: result.definitionOfDoneMet === true, needsHumanDecision: result.needsHumanDecision !== false } });
    console.log(`任务 ${task.id} 已提交，等待独立验收。`);
  } catch (error) {
    await writeFile(path.join(directory, "failure.txt"), String(error.message));
    try { await call("block", { ...identity, reason: error.message }); } catch { console.error(`任务 ${task.id} 无法写回阻塞状态，可能已撤销授权或租约过期，请人工检查。`); }
    console.error(`任务 ${task.id} 未完成：${error.message}`);
  } finally { if (heartbeat) clearInterval(heartbeat); }
}
async function main() {
  if (!base || !token) throw new Error("必须配置平台地址和独立执行者凭证");
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("平台地址必须是 HTTP 或 HTTPS");
  const command = commandArguments();
  while (!stopping) {
    try {
      const inbox = await call("inbox", {}, "GET");
      if (inbox.role !== "worker") throw new Error("本执行器只能使用执行者凭证，不能使用复核凭证");
      if (inbox.tasks?.length) await execute(inbox.tasks[0], command);
    } catch (error) {
      console.error(`执行器本轮停止：${error.message}`);
      if (error.status === 401 || error.status === 403 || once) throw error;
    }
    if (once) break;
    await sleep(pollingSeconds * 1000);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
