import { recordActivity } from "@/lib/activity";
import type { TaskCreateInput, TaskUpdateInput } from "@/lib/validation";

type TaskCreateServiceInput = Omit<
  TaskCreateInput,
  "wikiLinks" | "riskLevel" | "executionMode" | "agentTags"
> &
  Partial<Pick<TaskCreateInput, "riskLevel" | "executionMode" | "agentTags">> & {
  wikiLinks?: TaskCreateInput["wikiLinks"];
};

type TaskDb = {
  task: unknown;
  taskClaim?: unknown;
  taskRun?: unknown;
  agentActionLog?: unknown;
  activityLog: unknown;
};

type TaskRecord = {
  id: string;
  ownerAgent?: string | null;
  leaseUntil?: Date | string | null;
  executionMode?: string | null;
  riskLevel?: string | null;
  agentTags?: string[] | null;
};

const taskInclude = {
  project: true,
  sourceInboxItem: true,
  sourceAgentRun: true,
  wikiLinks: true,
  claims: { orderBy: { claimedAt: "desc" }, take: 3 },
  contributions: { orderBy: { createdAt: "desc" }, take: 5 },
  artifacts: { orderBy: { createdAt: "desc" }, take: 5 },
  runs: { orderBy: { startedAt: "desc" }, take: 3 },
  agentActionLogs: { orderBy: { createdAt: "desc" }, take: 8 },
  reviews: { orderBy: { createdAt: "desc" }, take: 3 },
};

function sameStringSet(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value))
  );
}

export async function listTasks<TDb extends TaskDb>(db: TDb) {
  const taskDelegate = db.task as { findMany(args: unknown): Promise<unknown[]> };
  return taskDelegate.findMany({
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    include: taskInclude,
  });
}

export async function createTask<TDb extends TaskDb>(
  db: TDb,
  input: TaskCreateServiceInput,
) {
  const { wikiLinks = [], ...taskInput } = input;
  const taskDelegate = db.task as {
    create(args: unknown): Promise<{ id: string; title: string; status: string }>;
  };
  const task = await taskDelegate.create({
    data: {
      ...taskInput,
      riskLevel: taskInput.riskLevel ?? "low",
      executionMode: taskInput.executionMode ?? "manual",
      agentTags: taskInput.agentTags ?? [],
      wikiLinks: {
        create: wikiLinks.map((link) => ({
          noteTitle: link.noteTitle,
          notePath: link.notePath,
          noteUrl: link.noteUrl,
          sourceType: link.sourceType,
          sourceInboxItemId: link.sourceInboxItemId ?? input.sourceInboxItemId,
          sourceAgentRunId: link.sourceAgentRunId ?? input.sourceAgentRunId,
        })),
      },
    },
    include: taskInclude,
  });

  await recordActivity(db, {
    actorType: input.createdBy === "user" ? "user" : "hermes",
    action: "task.created",
    targetType: "task",
    targetId: task.id,
    after: {
      title: task.title,
      status: task.status,
      sourceInboxItemId: input.sourceInboxItemId ?? null,
      sourceAgentRunId: input.sourceAgentRunId ?? null,
    },
    undoPayload: { action: "task.archive", id: task.id },
  });

  return task;
}

export async function updateTask<TDb extends TaskDb>(
  db: TDb,
  id: string,
  input: TaskUpdateInput,
) {
  const { wikiLinks: _wikiLinks, ...taskInput } = input;
  void _wikiLinks;
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<TaskRecord | null>;
    update(args: unknown): Promise<{ id: string; title: string; status: string }>;
  };
  const before = await taskDelegate.findUnique({ where: { id } });
  const now = new Date();
  const executionModeChanged =
    taskInput.executionMode !== undefined &&
    taskInput.executionMode !== before?.executionMode;
  const riskLevelChanged =
    taskInput.riskLevel !== undefined &&
    taskInput.riskLevel !== before?.riskLevel;
  const agentTagsChanged =
    taskInput.agentTags !== undefined &&
    !sameStringSet(taskInput.agentTags, before?.agentTags ?? []);
  const shouldRevokeLease =
    executionModeChanged || riskLevelChanged || agentTagsChanged;
  const data = {
    ...taskInput,
    ...(taskInput.status === "done"
      ? { completedAt: now }
      : taskInput.status
        ? { completedAt: null }
        : {}),
    ...(shouldRevokeLease
      ? {
          ownerAgent: null,
          leaseUntil: null,
          lastHeartbeatAt: null,
        }
      : {}),
  };
  const task = await taskDelegate.update({
    where: { id },
    data,
    include: taskInclude,
  });

  await recordActivity(db, {
    actorType: "user",
    action: "task.updated",
    targetType: "task",
    targetId: id,
    before: before as Record<string, unknown> | null,
    after: data,
  });

  if (shouldRevokeLease && (before?.ownerAgent || before?.leaseUntil)) {
    if (before?.ownerAgent) {
      const claimDelegate = db.taskClaim as
        | { updateMany(args: unknown): Promise<unknown> }
        | undefined;
      const runDelegate = db.taskRun as
        | { updateMany(args: unknown): Promise<unknown> }
        | undefined;
      const actionDelegate = db.agentActionLog as
        | { create(args: unknown): Promise<unknown> }
        | undefined;
      await claimDelegate?.updateMany({
        where: { taskId: id, agentId: before.ownerAgent, releasedAt: null },
        data: { releasedAt: now, releaseReason: "policy_change" },
      });
      await runDelegate?.updateMany({
        where: { taskId: id, agentId: before.ownerAgent, status: "running" },
        data: { status: "policy_revoked", endedAt: now },
      });
      await actionDelegate?.create({
        data: {
          taskId: id,
          taskRunId: null,
          agentId: before.ownerAgent,
          action: "task.lease.revoked_by_policy_change",
          summary:
            "Task execution policy changed; active agent lease was revoked.",
          metadata: {
            executionMode: taskInput.executionMode ?? null,
            riskLevel: taskInput.riskLevel ?? null,
          },
        },
      });
    }
    await recordActivity(db, {
      actorType: "user",
      action: "task.lease.revoked_by_policy_change",
      targetType: "task",
      targetId: id,
      before: {
        ownerAgent: before.ownerAgent ?? null,
        leaseUntil: before.leaseUntil ?? null,
      },
      after: {
        ownerAgent: null,
        leaseUntil: null,
        lastHeartbeatAt: null,
      },
    });
  }

  return task;
}

export async function completeTask<TDb extends TaskDb>(db: TDb, id: string) {
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<unknown | null>;
    update(args: unknown): Promise<{
      id: string;
      title: string;
      status: string;
      completedAt?: Date | null;
    }>;
  };
  const before = await taskDelegate.findUnique({ where: { id } });
  const task = await taskDelegate.update({
    where: { id },
    data: {
      status: "done",
      completedAt: new Date(),
    },
    include: taskInclude,
  });

  await recordActivity(db, {
    actorType: "user",
    action: "task.completed",
    targetType: "task",
    targetId: id,
    before: before as Record<string, unknown> | null,
    after: { status: "done", completedAt: task.completedAt ?? null },
  });

  return task;
}
