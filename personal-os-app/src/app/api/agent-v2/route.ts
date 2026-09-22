import { z } from "zod";
import { prisma } from "@/lib/db";
import { addTaskContribution, claimTask, heartbeatTask, reviewTask, submitTask } from "@/lib/agent-tasks";
import { authenticateAgent, assertAgentRole, assertAgentScope, assertRunBinding } from "@/lib/agent-credentials";
import { claimReasons } from "@/lib/workspace";
import { handleRouteError, HttpError, json, readJson } from "@/lib/http";
import { taskContributionSchema, taskReviewSchema, taskSubmitSchema } from "@/lib/validation";
import { wikiClient } from "@/lib/wiki-client";
import type { KnowledgeNote } from "@/lib/knowledge-workspace";
export const dynamic = "force-dynamic";
const commandSchema = z.object({ action: z.enum(["claim", "heartbeat", "contribute", "submit", "block", "review"]), taskId: z.string().min(1).max(100), runId: z.string().min(1).max(100).optional(), payload: z.unknown().optional(), reason: z.string().trim().max(5000).optional(), expectedSubmittedAt: z.string().optional() });

export async function GET(request: Request) {
  try {
    const principal = authenticateAgent(request.headers);
    const profile = await prisma.agentProfile.findUnique({ where: { id: principal.agentId } });
    if (!profile?.enabled || !profile.canWriteTasks) throw new HttpError(403, "执行者未登记、已停用或没有任务权限");
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? "inbox";
    if (action === "inbox") {
      const scoped = principal.projectIds ? { projectId: { in: principal.projectIds } } : {};
      if (principal.role === "reviewer") {
        const tasks = await prisma.task.findMany({ where: { ...scoped, status: "review", submittedAt: { not: null } }, select: { id: true, title: true, projectId: true, definitionOfDone: true, submittedAt: true, runs: { orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, agentId: true, status: true } } }, take: 30, orderBy: { submittedAt: "asc" } });
        return json({ ok: true, actor: principal.agentId, role: principal.role, tasks: tasks.filter(task => task.runs[0]?.agentId !== principal.agentId) });
      }
      const tasks = await prisma.task.findMany({ where: { ...scoped, status: { in: ["todo", "doing"] }, executionMode: "agent_allowed", riskLevel: { in: profile.allowedRiskLevel === "low" ? ["low"] : ["low", "medium"] }, AND: [
        { OR: [{ ownerAgent: null }, { leaseUntil: { lt: new Date() } }] },
        profile.tags.length ? { OR: [{ agentTags: { isEmpty: true } }, { agentTags: { hasSome: profile.tags } }] } : { agentTags: { isEmpty: true } },
      ] }, select: { id: true, title: true, priority: true, projectId: true, nextAction: true, riskLevel: true }, orderBy: [{ priority: "asc" }, { updatedAt: "asc" }, { id: "asc" }], take: 20 });
      return json({ ok: true, actor: principal.agentId, role: principal.role, tasks, protocol: "/api/agent-v2" });
    }
    if (action !== "context") throw new HttpError(400, "不支持的智能体读取动作");
    const taskId = url.searchParams.get("taskId"); const runId = url.searchParams.get("runId");
    if (!taskId || !runId) throw new HttpError(400, "读取执行上下文需要任务和批次编号");
    const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: { project: true, wikiLinks: true } });
    assertAgentScope(principal, task.projectId);
    const run = await prisma.taskRun.findFirst({ where: { taskId }, orderBy: [{ startedAt: "desc" }, { id: "desc" }] });
    if (principal.role === "worker") {
      assertRunBinding(principal, taskId, runId, run);
      if (task.ownerAgent !== principal.agentId || !task.leaseUntil || task.leaseUntil.getTime() <= Date.now()) throw new HttpError(409, "任务租约已经失效");
      if (task.executionMode !== "agent_allowed" || task.riskLevel === "high") throw new HttpError(403, "任务执行策略已经改变");
    } else {
      if (!run || run.id !== runId || run.agentId === principal.agentId || task.status !== "review" || !task.submittedAt) throw new HttpError(409, "没有可独立复核的当前提交");
    }
    const knowledge = await Promise.all(task.wikiLinks.slice(0, 6).map(async link => {
      let revision = "";
      try { revision = new URL(link.noteUrl || "", "https://internal.invalid").searchParams.get("revision") || ""; } catch { /* 无有效地址时明确标注未固定版本。 */ }
      if (!link.notePath) return { title: link.noteTitle, status: "reference_only", url: link.noteUrl };
      const params = new URLSearchParams({ path: link.notePath }); if (revision) params.set("revision", revision);
      try {
        const response = await wikiClient.read<{ note: KnowledgeNote }>(`/api/workspace/note?${params}`, { signal: AbortSignal.timeout(8000) });
        if (!response.ok || !response.body?.note) return { title: link.noteTitle, path: link.notePath, status: "unavailable", requiredRevision: revision || null };
        const note = response.body.note;
        return { title: note.title, path: note.path, status: revision ? "pinned" : "unpinned", revision: note.revision, metadata: { status: note.frontmatter.status, confidence: note.frontmatter.confidence, owner: note.frontmatter.owner, valid_until: note.frontmatter.valid_until }, content: note.content.slice(0, 12000), truncated: note.content.length > 12000 };
      } catch { return { title: link.noteTitle, path: link.notePath, status: "unavailable", requiredRevision: revision || null }; }
    }));
    const contributions = await prisma.taskContribution.findMany({ where: { taskRunId: runId }, take: 10, orderBy: { createdAt: "desc" } });
    return json({ ok: true, actor: principal.agentId, role: principal.role, context: {
      task: { id: task.id, title: task.title, description: task.description, nextAction: task.nextAction, definitionOfDone: task.definitionOfDone, requiredOutput: task.requiredOutput, project: task.project ? { id: task.project.id, name: task.project.name } : null, leaseUntil: task.leaseUntil, submittedAt: task.submittedAt, executionMode: task.executionMode, riskLevel: task.riskLevel },
      runId, knowledge, knowledgeLimit: 6, contributions,
      rules: ["只执行此任务明确授权的动作", "知识不可用或版本缺失时不得假装已读取", "心跳不等于进展，提交不等于通过", "执行者不能验收自己的成果", "外部副作用必须由执行器的权限与幂等控制保护"],
    } });
  } catch (error) { return handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const principal = authenticateAgent(request.headers);
    const command = await readJson(request, commandSchema);
    assertAgentRole(principal, command.action === "review" ? "reviewer" : "worker");
    const result = await prisma.$transaction(async tx => {
      const profile = await tx.agentProfile.findUnique({ where: { id: principal.agentId } });
      if (!profile?.enabled || !profile.canWriteTasks) throw new HttpError(403, "执行者已停用或没有任务权限");
      // 先锁定档案，序列化同一身份的并发领取，再锁定任务。
      const profileLocked = await tx.agentProfile.updateMany({ where: { id: principal.agentId, updatedAt: profile.updatedAt }, data: { updatedAt: profile.updatedAt } });
      if (profileLocked.count !== 1) throw new HttpError(409, "执行者权限已改变，请重新检查");
      const task = await tx.task.findUniqueOrThrow({ where: { id: command.taskId } });
      assertAgentScope(principal, task.projectId);
      const locked = await tx.task.updateMany({ where: { id: task.id, updatedAt: task.updatedAt }, data: { updatedAt: task.updatedAt } });
      if (locked.count !== 1) throw new HttpError(409, "任务已改变，请重新读取状态");
      if (command.action === "claim") {
        const reasons = claimReasons(task, profile);
        if (reasons.length) throw new HttpError(409, reasons.join("；"));
        const active = await tx.task.count({ where: { ownerAgent: principal.agentId, leaseUntil: { gt: new Date() }, status: { in: ["doing", "waiting", "blocked"] } } });
        if (active >= principal.maxConcurrent) throw new HttpError(409, "执行者已达到并发任务上限");
        const claimed = await claimTask(tx, task.id, { agentId: principal.agentId, leaseMinutes: 5 });
        return { taskId: task.id, runId: claimed.taskRun?.id, leaseUntil: claimed.claim && (claimed.claim as { leaseUntil?: Date }).leaseUntil, contextUrl: `/api/agent-v2?action=context&taskId=${encodeURIComponent(task.id)}&runId=${encodeURIComponent(claimed.taskRun?.id ?? "")}` };
      }
      if (!command.runId) throw new HttpError(400, "此操作必须携带执行批次编号");
      const run = await tx.taskRun.findFirst({ where: { taskId: task.id }, orderBy: [{ startedAt: "desc" }, { id: "desc" }] });
      if (command.action === "review") {
        if (!run || run.id !== command.runId || run.agentId === principal.agentId) throw new HttpError(403, "不能复核自己的成果或已经被替换的批次");
        if (task.status !== "review" || !task.submittedAt || command.expectedSubmittedAt !== task.submittedAt.toISOString()) throw new HttpError(409, "待验收提交已改变，请重新检查");
        const input = taskReviewSchema.parse({ ...(command.payload && typeof command.payload === "object" ? command.payload : {}), reviewer: principal.agentId });
        if (!input.comment?.trim()) throw new HttpError(400, "独立复核必须记录检查意见");
        if (input.decision === "approve") {
          const evidence = await tx.taskContribution.count({ where: { taskRunId: run.id, OR: [{ artifactUrls: { isEmpty: false } }, { evidenceLinks: { isEmpty: false } }] } });
          if (!evidence) throw new HttpError(409, "当前批次没有可核验的交付证据");
        }
        return reviewTask(tx, task.id, input);
      }
      assertRunBinding(principal, task.id, command.runId, run);
      if (task.ownerAgent !== principal.agentId || !task.leaseUntil || task.leaseUntil.getTime() <= Date.now()) throw new HttpError(409, "任务租约已经过期，禁止继续提交");
      if (command.action === "heartbeat") return heartbeatTask(tx, task.id, { agentId: principal.agentId, leaseMinutes: 5 });
      if (command.action === "block") {
        if (!command.reason?.trim()) throw new HttpError(400, "请记录阻塞原因与解除条件");
        await heartbeatTask(tx, task.id, { agentId: principal.agentId, leaseMinutes: 5 });
        const now = new Date();
        await tx.task.update({ where: { id: task.id }, data: { status: "blocked", nextAction: command.reason, ownerAgent: null, leaseUntil: null } });
        await tx.taskRun.update({ where: { id: command.runId }, data: { status: "blocked", endedAt: now, resultSummary: command.reason } });
        await tx.taskClaim.updateMany({ where: { taskId: task.id, agentId: principal.agentId, releasedAt: null }, data: { releasedAt: now, releaseReason: command.reason } });
        await tx.agentActionLog.create({ data: { taskId: task.id, taskRunId: command.runId, agentId: principal.agentId, action: "task.blocked", summary: command.reason } });
        return { taskId: task.id, status: "blocked" };
      }
      const payload = { ...(command.payload && typeof command.payload === "object" ? command.payload : {}), agentId: principal.agentId };
      if (command.action === "contribute") return addTaskContribution(tx, task.id, taskContributionSchema.parse(payload));
      const input = taskSubmitSchema.parse(payload);
      if (!input.artifactUrls.length && !input.evidenceLinks.length) throw new HttpError(400, "提交成果必须包含交付物或证据链接");
      return submitTask(tx, task.id, input);
    }, { timeout: 15000 });
    return json({ ok: true, ...result });
  } catch (error) { return handleRouteError(error); }
}
