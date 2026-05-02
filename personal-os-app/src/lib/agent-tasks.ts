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
  agentProfile?: unknown;
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
  riskLevel?: string;
  executionMode?: string;
  agentTags?: string[];
  ownerAgent?: string | null;
  leaseUntil?: Date | string | null;
};

type AgentProfileRecord = {
  id: string;
  tags?: string[];
  allowedRiskLevel?: string;
  canWriteTasks?: boolean;
  enabled?: boolean;
};

const riskRank: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
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

function assertTaskPolicyAllowsClaim(task: TaskRecord) {
  if ((task.executionMode ?? "manual") !== "agent_allowed") {
    throw new HttpError(
      409,
      `Task executionMode is ${task.executionMode ?? "manual"}; agent claims require agent_allowed`,
    );
  }
  if (task.riskLevel === "high") {
    throw new HttpError(
      409,
      "High-risk tasks require explicit approval before an agent can claim them",
    );
  }
}

async function getAgentProfile<TDb extends AgentTaskDb>(
  db: TDb,
  agentId: string,
) {
  const profileDelegate = db.agentProfile as
    | { findUnique(args: unknown): Promise<AgentProfileRecord | null> }
    | undefined;
  if (!profileDelegate) {
    return null;
  }
  return profileDelegate.findUnique({ where: { id: agentId } });
}

function assertAgentCanWorkTask(
  profile: AgentProfileRecord | null,
  task: TaskRecord,
) {
  if (!profile || profile.enabled === false) {
    throw new HttpError(403, "Agent profile is missing or disabled");
  }
  if (profile.canWriteTasks === false) {
    throw new HttpError(403, "Agent profile cannot write tasks");
  }

  const taskRisk = riskRank[task.riskLevel ?? "low"] ?? riskRank.high;
  const allowedRisk =
    riskRank[profile.allowedRiskLevel ?? "low"] ?? riskRank.low;
  if (taskRisk > allowedRisk) {
    throw new HttpError(
      403,
      `Agent profile allows ${profile.allowedRiskLevel ?? "low"} risk, task is ${task.riskLevel ?? "low"}`,
    );
  }

  const taskTags = task.agentTags ?? [];
  if (
    taskTags.length > 0 &&
    !taskTags.some((tag) => (profile.tags ?? []).includes(tag))
  ) {
    throw new HttpError(403, "Agent profile does not match task tags");
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

function assertActiveLeaseForAgent(
  task: TaskRecord,
  agentId: string,
  now: Date,
) {
  assertOwnedByAgent(task, agentId);
  if (!task.leaseUntil || new Date(task.leaseUntil).getTime() <= now.getTime()) {
    throw new HttpError(
      409,
      "Task lease expired; claim the task again before continuing work",
    );
  }
}

export async function listAgentInboxTasks<TDb extends AgentTaskDb>(
  db: TDb,
  input: AgentInboxQueryInput,
) {
  const now = new Date();
  const taskDelegate = db.task as { findMany(args: unknown): Promise<unknown[]> };
  const profile = await getAgentProfile(db, input.agentId);
  if (!profile || profile.enabled === false || profile.canWriteTasks === false) {
    return [];
  }
  const effectiveTags = input.tags.length > 0 ? input.tags : (profile.tags ?? []);
  const claimablePolicyFilter = {
    executionMode: "agent_allowed",
    riskLevel:
      profile.allowedRiskLevel === "medium"
        ? { in: ["low", "medium"] }
        : { in: ["low"] },
  };
  const tagFilter =
    effectiveTags.length > 0
      ? {
          OR: [
            { agentTags: { hasSome: effectiveTags } },
            { agentTags: { isEmpty: true } },
          ],
        }
      : { agentTags: { isEmpty: true } };

  return taskDelegate.findMany({
    where: {
      AND: [
        tagFilter,
        {
          OR: [
            { status: "todo", ownerAgent: null, ...claimablePolicyFilter },
            { status: "todo", leaseUntil: { lt: now }, ...claimablePolicyFilter },
            { status: "doing", leaseUntil: { lt: now }, ...claimablePolicyFilter },
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
  assertTaskPolicyAllowsClaim(before);
  const profile = await getAgentProfile(db, input.agentId);
  assertAgentCanWorkTask(profile, before);
  if (isActiveLease(before, now) && before.ownerAgent !== input.agentId) {
    throw new HttpError(409, `Task is leased by ${before.ownerAgent}`);
  }

  const claimed = await taskDelegate.updateMany({
    where: {
      id: taskId,
      status: { in: ["todo", "doing"] },
      executionMode: "agent_allowed",
      riskLevel:
        profile?.allowedRiskLevel === "medium"
          ? { in: ["low", "medium"] }
          : { in: ["low"] },
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
  assertActiveLeaseForAgent(before, input.agentId, now);

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
  assertActiveLeaseForAgent(task, input.agentId, new Date());

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
