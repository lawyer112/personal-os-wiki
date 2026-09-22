import { z } from "zod";
import { prisma } from "@/lib/db";
import { claimTask, reviewTask } from "@/lib/agent-tasks";
import { createTask, updateTask } from "@/lib/tasks";
import { handleRouteError, HttpError, json, readJson, requireWriteAccess } from "@/lib/http";
import { taskCreateSchema, taskUpdateSchema, taskReviewSchema } from "@/lib/validation";
import { claimReasons } from "@/lib/workspace";
export const dynamic = "force-dynamic";
const commandSchema = z.object({ action: z.enum(["create", "update", "claim", "confirm", "review"]), taskId: z.string().min(1).optional(), agentId: z.string().min(1).optional(), payload: z.unknown().optional(), expectedSubmittedAt: z.string().optional(), expectedRunId: z.string().nullable().optional(), evidenceChecked: z.boolean().optional() });
/** 浏览器与管理接口只接受管理凭证，智能体使用独立的 /api/agent-v2。 */
export async function POST(request: Request) {
  try {
    requireWriteAccess(request);
    const origin = request.headers.get("origin");
    const expectedOrigin = process.env.PERSONAL_OS_PUBLIC_ORIGIN || new URL(request.url).origin;
    if (origin && origin !== expectedOrigin) throw new HttpError(403, "不允许跨站写入，请检查反向代理的公开地址配置");
    const command = await readJson(request, commandSchema);
    if (command.action === "create") {
      const payload = taskCreateSchema.parse(command.payload);
      if (payload.status === "done") throw new HttpError(400, "新任务不能直接标记为完成");
      const task = await prisma.$transaction(tx => createTask(tx, { ...payload, createdBy: "user" }));
      return json({ ok: true, task }, { status: 201 });
    }
    if (!command.taskId) throw new HttpError(400, "缺少任务编号");
    const taskId = command.taskId;
    const result = await prisma.$transaction(async tx => {
      const task = await tx.task.findUniqueOrThrow({ where: { id: taskId } });
      // 条件更新获得行锁，并拒绝从过期界面提交的状态变更。
      const locked = await tx.task.updateMany({ where: { id: taskId, updatedAt: task.updatedAt }, data: { updatedAt: task.updatedAt } });
      if (locked.count !== 1) throw new HttpError(409, "任务已被其他执行者更新，请刷新后重试");
      if (command.action === "claim") {
        if (!command.agentId) throw new HttpError(400, "请先选择执行者");
        const agent = await tx.agentProfile.findUnique({ where: { id: command.agentId } });
        const reasons = claimReasons(task, agent);
        if (reasons.length) throw new HttpError(409, reasons.join("；"));
        return claimTask(tx, taskId, { agentId: command.agentId, leaseMinutes: 30 });
      }
      if (command.action === "confirm") {
        if (task.status !== "review" || task.submittedAt) throw new HttpError(409, "该任务不是待确认需求");
        return { task: await updateTask(tx, taskId, { status: "todo" }) };
      }
      if (command.action === "review") {
        if (task.status !== "review" || !task.submittedAt) throw new HttpError(409, "该任务没有待验收提交");
        if (command.expectedSubmittedAt !== task.submittedAt.toISOString()) throw new HttpError(409, "提交版本已改变，请重新检查成果");
        const run = await tx.taskRun.findFirst({ where: { taskId }, orderBy: [{ startedAt: "desc" }, { id: "desc" }] });
        if ((command.expectedRunId ?? null) !== (run?.id ?? null)) throw new HttpError(409, "执行批次已改变，请重新检查成果");
        const input = taskReviewSchema.parse(command.payload);
        if (input.decision === "approve") {
          if (!command.evidenceChecked) throw new HttpError(400, "请先核对验收标准与当前批次的证据");
          const evidence = await tx.taskContribution.count({ where: { taskId, ...(run ? { taskRunId: run.id } : {}), OR: [{ artifactUrls: { isEmpty: false } }, { evidenceLinks: { isEmpty: false } }] } });
          if (!evidence) throw new HttpError(409, "当前提交缺少可核验的成果或证据");
        } else if (!input.comment?.trim()) throw new HttpError(400, "请填写复核意见");
        return reviewTask(tx, taskId, { ...input, reviewer: "user" });
      }
      const payload = taskUpdateSchema.parse(command.payload);
      if (payload.status === "done" || (task.status === "review" && task.submittedAt && payload.status)) throw new HttpError(409, "交付状态必须通过复核流程变更");
      if (payload.status === "blocked" && !payload.nextAction?.trim()) throw new HttpError(400, "请记录阻塞原因与解除条件");
      return { task: await updateTask(tx, taskId, payload) };
    });
    return json({ ok: true, ...result });
  } catch (error) { return handleRouteError(error); }
}
