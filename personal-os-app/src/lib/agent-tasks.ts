import { recordActivity } from "@/lib/activity";
import { HttpError } from "@/lib/http";
import type {
  AgentInboxQueryInput,
  TaskClaimInput,
  TaskContributionInput,
  TaskHeartbeatInput,
  TaskReviewInput,
  TaskSubmitInput,
} from "@/lib/validation";

type AgentTaskDb = {
  task: unknown;
  taskClaim: unknown;
  taskContribution: unknown;
  taskArtifact: unknown;
  taskReview: unknown;
  activityLog: unknown;
};

type TaskRecord = {
  id: string;
  title: string;
  status: string;
  ownerAgent?: string | null;
  leaseUntil?: Date | string | null;
};

const agentTaskInclude = {
  project: true,
  sourceInboxItem: true,
  sourceAgentRun: true,
  wikiLinks: true,
  contributions: { orderBy: { createdAt: "desc" }, take: 5 },
  artifacts: { orderBy: { createdAt: "desc" }, take: 5 },
  reviews: { orderBy: { createdAt: "desc" }, take: 3 },
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function isActiveLease(task: TaskRecord, now: Date) {
  if (!task.ownerAgent || !task.leaseUntil) {
    return false;
  }
  return new Date(task.leaseUntil).getTime() > now.getTime();
}

function assertTaskCanBeWorked(task: TaskRecord) {
  if (task.status === "done" || task.status === "archived") {
    throw new HttpError(409, `Task is already ${task.status}`);
  }
}

function assertTaskCanBeClaimed(task: TaskRecord) {
  if (!["todo", "doing"].includes(task.status)) {
    throw new HttpError(
      409,
      `Task is ${task.status}; only todo or expired doing tasks can be claimed`,
    );
  }
}

function assertOwnedByAgent(task: TaskRecord, agentId: string) {
  if (!task.ownerAgent) {
    throw new HttpError(409, "Task is not claimed by an agent");
  }
  if (task.ownerAgent !== agentId) {
    throw new HttpError(409, `Task is owned by ${task.ownerAgent}`);
  }
}

export async function listAgentInboxTasks<TDb extends AgentTaskDb>(
  db: TDb,
  input: AgentInboxQueryInput,
) {
  const now = new Date();
  const taskDelegate = db.task as { findMany(args: unknown): Promise<unknown[]> };
  const tagFilter =
    input.tags.length > 0
      ? {
          OR: [
            { agentTags: { hasSome: input.tags } },
            { agentTags: { isEmpty: true } },
          ],
        }
      : {};

  return taskDelegate.findMany({
    where: {
      AND: [
        tagFilter,
        {
          OR: [
            { status: "todo", ownerAgent: null },
            { status: "todo", leaseUntil: { lt: now } },
            { status: "doing", leaseUntil: { lt: now } },
            {
              ownerAgent: input.agentId,
              status: { in: ["doing", "waiting", "blocked"] },
            },
          ],
        },
      ],
    },
    include: agentTaskInclude,
    orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { updatedAt: "asc" }],
    take: input.limit,
  });
}

export async function claimTask<TDb extends AgentTaskDb>(
  db: TDb,
  taskId: string,
  input: TaskClaimInput,
) {
  const now = new Date();
  const leaseUntil = addMinutes(now, input.leaseMinutes);
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<TaskRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
    update(args: unknown): Promise<unknown>;
  };
  const claimDelegate = db.taskClaim as {
    create(args: unknown): Promise<unknown>;
  };

  const before = await taskDelegate.findUnique({ where: { id: taskId } });
  if (!before) {
    throw new HttpError(404, "Task not found");
  }
  assertTaskCanBeWorked(before);
  assertTaskCanBeClaimed(before);
  if (isActiveLease(before, now) && before.ownerAgent !== input.agentId) {
    throw new HttpError(409, `Task is leased by ${before.ownerAgent}`);
  }

  const claimed = await taskDelegate.updateMany({
    where: {
      id: taskId,
      status: { in: ["todo", "doing"] },
      OR: [
        { ownerAgent: null },
        { ownerAgent: input.agentId },
        { leaseUntil: { lt: now } },
      ],
    },
    data: {
      status: "doing",
      ownerAgent: input.agentId,
      leaseUntil,
      lastHeartbeatAt: now,
    },
  });
  if (claimed.count !== 1) {
    throw new HttpError(409, "Task lease changed before claim completed");
  }

  const task = await taskDelegate.findUnique({
    where: { id: taskId },
    include: agentTaskInclude,
  });
  if (!task) {
    throw new HttpError(404, "Task not found");
  }
  const claim = await claimDelegate.create({
    data: {
      taskId,
      agentId: input.agentId,
      leaseUntil,
    },
  });

  await recordActivity(db, {
    actorType: "system",
    actorId: input.agentId,
    action: "task.claimed",
    targetType: "task",
    targetId: taskId,
    before: before as Record<string, unknown>,
    after: { ownerAgent: input.agentId, leaseUntil, status: "doing" },
  });

  return { task, claim };
}

export async function heartbeatTask<TDb extends AgentTaskDb>(
  db: TDb,
  taskId: string,
  input: TaskHeartbeatInput,
) {
  const now = new Date();
  const leaseUntil = addMinutes(now, input.leaseMinutes);
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<TaskRecord | null>;
    update(args: unknown): Promise<unknown>;
  };

  const before = await taskDelegate.findUnique({ where: { id: taskId } });
  if (!before) {
    throw new HttpError(404, "Task not found");
  }
  assertTaskCanBeWorked(before);
  assertOwnedByAgent(before, input.agentId);

  const task = await taskDelegate.update({
    where: { id: taskId },
    data: {
      ownerAgent: input.agentId,
      leaseUntil,
      lastHeartbeatAt: now,
    },
    include: agentTaskInclude,
  });

  await recordActivity(db, {
    actorType: "system",
    actorId: input.agentId,
    action: "task.heartbeat",
    targetType: "task",
    targetId: taskId,
    after: { leaseUntil, lastHeartbeatAt: now },
  });

  return task;
}

export async function addTaskContribution<TDb extends AgentTaskDb>(
  db: TDb,
  taskId: string,
  input: TaskContributionInput,
) {
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<TaskRecord | null>;
  };
  const contributionDelegate = db.taskContribution as {
    create(args: unknown): Promise<{ id: string } & Record<string, unknown>>;
  };
  const artifactDelegate = db.taskArtifact as {
    create(args: unknown): Promise<unknown>;
  };

  const task = await taskDelegate.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new HttpError(404, "Task not found");
  }
  assertTaskCanBeWorked(task);
  assertOwnedByAgent(task, input.agentId);

  const contribution = await contributionDelegate.create({
    data: {
      taskId,
      agentId: input.agentId,
      summary: input.summary,
      evidenceLinks: input.evidenceLinks,
      artifactUrls: input.artifactUrls,
      nextRecommendation: input.nextRecommendation,
    },
  });
  const artifacts = await Promise.all(
    input.artifactUrls.map((url) =>
      artifactDelegate.create({
        data: {
          taskId,
          contributionId: contribution.id,
          type: "link",
          url,
        },
      }),
    ),
  );

  await recordActivity(db, {
    actorType: "system",
    actorId: input.agentId,
    action: "task.contribution.created",
    targetType: "task",
    targetId: taskId,
    after: {
      contributionId: contribution.id,
      summary: input.summary,
      artifactUrls: input.artifactUrls,
    },
  });

  return { contribution, artifacts };
}

export async function submitTask<TDb extends AgentTaskDb>(
  db: TDb,
  taskId: string,
  input: TaskSubmitInput,
) {
  const contributionResult = await addTaskContribution(db, taskId, input);
  const now = new Date();
  const taskDelegate = db.task as {
    update(args: unknown): Promise<unknown>;
  };

  const task = await taskDelegate.update({
    where: { id: taskId },
    data: {
      status: "review",
      submittedAt: now,
      leaseUntil: null,
      lastHeartbeatAt: now,
    },
    include: agentTaskInclude,
  });

  await recordActivity(db, {
    actorType: "system",
    actorId: input.agentId,
    action: "task.submitted",
    targetType: "task",
    targetId: taskId,
    after: {
      resultType: input.resultType,
      definitionOfDoneMet: input.definitionOfDoneMet,
      needsHumanDecision: input.needsHumanDecision,
      submittedAt: now,
    },
  });

  return { task, ...contributionResult };
}

export async function reviewTask<TDb extends AgentTaskDb>(
  db: TDb,
  taskId: string,
  input: TaskReviewInput,
) {
  const now = new Date();
  const reviewDelegate = db.taskReview as {
    create(args: unknown): Promise<unknown>;
  };
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<TaskRecord | null>;
    update(args: unknown): Promise<unknown>;
  };

  const before = await taskDelegate.findUnique({ where: { id: taskId } });
  if (!before) {
    throw new HttpError(404, "Task not found");
  }

  const review = await reviewDelegate.create({
    data: {
      taskId,
      reviewer: input.reviewer,
      decision: input.decision,
      comment: input.comment,
    },
  });

  const data =
    input.decision === "approve"
      ? {
          status: "done",
          completedAt: now,
          ownerAgent: null,
          leaseUntil: null,
        }
      : input.decision === "request_changes"
        ? {
            status: "todo",
            ownerAgent: null,
            leaseUntil: null,
            submittedAt: null,
          }
        : input.decision === "block"
          ? {
              status: "blocked",
              ownerAgent: null,
              leaseUntil: null,
            }
          : {
              status: "archived",
              ownerAgent: null,
              leaseUntil: null,
            };

  const task = await taskDelegate.update({
    where: { id: taskId },
    data,
    include: agentTaskInclude,
  });

  await recordActivity(db, {
    actorType: input.reviewer === "user" ? "user" : "system",
    actorId: input.reviewer,
    action: "task.reviewed",
    targetType: "task",
    targetId: taskId,
    before: before as Record<string, unknown>,
    after: { decision: input.decision, comment: input.comment, ...data },
  });

  return { task, review };
}
