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
  taskRun?: unknown;
  taskContribution: unknown;
  taskArtifact: unknown;
  taskReview: unknown;
  agentActionLog?: unknown;
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
  submittedAt?: Date | string | null;
};

type AgentProfileRecord = {
  id: string;
  tags?: string[];
  allowedRiskLevel?: string;
  canWriteTasks?: boolean;
  enabled?: boolean;
};

type TaskRunRecord = {
  id: string;
  taskId: string;
  agentId: string;
  status: string;
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
  runs: { orderBy: { startedAt: "desc" }, take: 3 },
  agentActionLogs: { orderBy: { createdAt: "desc" }, take: 8 },
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

function assertTaskPolicyAllowsAgentWork(task: TaskRecord) {
  if ((task.executionMode ?? "manual") !== "agent_allowed") {
    throw new HttpError(
      409,
      `Task executionMode is ${task.executionMode ?? "manual"}; agent work requires agent_allowed`,
    );
  }
  if (task.riskLevel === "high") {
    throw new HttpError(
      409,
      "High-risk tasks require explicit approval before an agent can work them",
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

function allowedAgentRiskLevels(profile: AgentProfileRecord | null) {
  return profile?.allowedRiskLevel === "medium" ||
    profile?.allowedRiskLevel === "high"
    ? ["low", "medium"]
    : ["low"];
}

function agentPolicyWhere(profile: AgentProfileRecord | null) {
  const profileTags = profile?.tags ?? [];
  const tagFilter =
    profileTags.length > 0
      ? {
          OR: [
            { agentTags: { hasSome: profileTags } },
            { agentTags: { isEmpty: true } },
          ],
        }
      : { agentTags: { isEmpty: true } };

  return {
    executionMode: "agent_allowed",
    riskLevel: { in: allowedAgentRiskLevels(profile) },
    ...tagFilter,
  };
}

function buildPolicySnapshot(
  task: TaskRecord,
  profile: AgentProfileRecord | null,
  extra: Record<string, unknown> = {},
) {
  return {
    task: {
      status: task.status,
      riskLevel: task.riskLevel ?? "low",
      executionMode: task.executionMode ?? "manual",
      agentTags: task.agentTags ?? [],
    },
    profile: profile
      ? {
          id: profile.id,
          tags: profile.tags ?? [],
          allowedRiskLevel: profile.allowedRiskLevel ?? "low",
          canWriteTasks: profile.canWriteTasks !== false,
          enabled: profile.enabled !== false,
        }
      : null,
    ...extra,
  };
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

async function assertAgentStillAllowedToWork<TDb extends AgentTaskDb>(
  db: TDb,
  task: TaskRecord,
  agentId: string,
  now: Date,
) {
  assertActiveLeaseForAgent(task, agentId, now);
  assertTaskPolicyAllowsAgentWork(task);
  const profile = await getAgentProfile(db, agentId);
  assertAgentCanWorkTask(profile, task);
  return profile;
}

async function withAgentTaskTransaction<T>(
  db: AgentTaskDb,
  fn: (tx: AgentTaskDb) => Promise<T>,
) {
  const transactionalDb = db as AgentTaskDb & {
    $transaction?: <TResult>(fn: (tx: unknown) => Promise<TResult>) => Promise<TResult>;
  };
  if (typeof transactionalDb.$transaction === "function") {
    return transactionalDb.$transaction((tx) => fn(tx as AgentTaskDb));
  }
  return fn(db);
}

async function assertAndLockAgentMutation(
  db: AgentTaskDb,
  taskId: string,
  agentId: string,
  now: Date,
) {
  const taskDelegate = db.task as {
    findUnique(args: unknown): Promise<TaskRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  const task = await taskDelegate.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new HttpError(404, "Task not found");
  }
  assertTaskCanBeWorked(task);
  const profile = await assertAgentStillAllowedToWork(db, task, agentId, now);

  const locked = await taskDelegate.updateMany({
    where: {
      id: taskId,
      ownerAgent: agentId,
      leaseUntil: { gt: now },
      status: { notIn: ["done", "archived"] },
      ...agentPolicyWhere(profile),
    },
    data: { lastHeartbeatAt: now },
  });
  if (locked.count !== 1) {
    throw new HttpError(409, "Policy or lease changed before mutation completed");
  }

  const taskRun = await ensureRunningTaskRun(db, task, profile, agentId, now);

  return { task, taskRun };
}

async function createContributionWithArtifacts(
  db: AgentTaskDb,
  taskId: string,
  input: TaskContributionInput,
  taskRun?: TaskRunRecord | null,
) {
  const contributionDelegate = db.taskContribution as {
    create(args: unknown): Promise<{ id: string } & Record<string, unknown>>;
  };
  const artifactDelegate = db.taskArtifact as {
    create(args: unknown): Promise<unknown>;
  };

  const contribution = await contributionDelegate.create({
    data: {
      taskId,
      taskRunId: taskRun?.id ?? null,
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

  await logAgentAction(db, {
    taskId,
    taskRunId: taskRun?.id ?? null,
    agentId: input.agentId,
    action: "task.contribution.created",
    summary: input.summary,
    metadata: {
      contributionId: contribution.id,
      evidenceLinks: input.evidenceLinks,
      artifactUrls: input.artifactUrls,
    },
  });

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

async function createTaskRun(
  db: AgentTaskDb,
  task: TaskRecord,
  profile: AgentProfileRecord | null,
  agentId: string,
  now: Date,
  extra: Record<string, unknown> = {},
) {
  const taskRunDelegate = db.taskRun as
    | { create(args: unknown): Promise<TaskRunRecord> }
    | undefined;
  if (!taskRunDelegate) {
    return null;
  }

  return taskRunDelegate.create({
    data: {
      taskId: task.id,
      agentId,
      status: "running",
      policySnapshot: buildPolicySnapshot(task, profile, extra),
      lastHeartbeatAt: now,
    },
  });
}

async function ensureRunningTaskRun(
  db: AgentTaskDb,
  task: TaskRecord,
  profile: AgentProfileRecord | null,
  agentId: string,
  now: Date,
) {
  const taskRunDelegate = db.taskRun as
    | {
        findFirst(args: unknown): Promise<TaskRunRecord | null>;
        create(args: unknown): Promise<TaskRunRecord>;
      }
    | undefined;
  if (!taskRunDelegate) {
    return null;
  }

  const existing = await taskRunDelegate.findFirst({
    where: { taskId: task.id, agentId, status: "running" },
    orderBy: { startedAt: "desc" },
  });
  if (existing) {
    return existing;
  }

  return createTaskRun(db, task, profile, agentId, now, {
    adoptedActiveLease: true,
  });
}

async function updateTaskRun(
  db: AgentTaskDb,
  id: string | undefined,
  data: Record<string, unknown>,
) {
  if (!id) {
    return;
  }
  const taskRunDelegate = db.taskRun as
    | { update(args: unknown): Promise<unknown> }
    | undefined;
  if (!taskRunDelegate) {
    return;
  }
  await taskRunDelegate.update({ where: { id }, data });
}

async function updateSubmittedTaskRuns(
  db: AgentTaskDb,
  taskId: string,
  data: Record<string, unknown>,
) {
  const taskRunDelegate = db.taskRun as
    | { updateMany(args: unknown): Promise<unknown> }
    | undefined;
  if (!taskRunDelegate) {
    return;
  }
  await taskRunDelegate.updateMany({
    where: { taskId, status: "submitted" },
    data,
  });
}

async function releaseActiveTaskClaims(
  db: AgentTaskDb,
  taskId: string,
  agentId: string,
  now: Date,
  releaseReason: string,
) {
  const claimDelegate = db.taskClaim as
    | { updateMany(args: unknown): Promise<unknown> }
    | undefined;
  if (!claimDelegate) {
    return;
  }
  await claimDelegate.updateMany({
    where: { taskId, agentId, releasedAt: null },
    data: { releasedAt: now, releaseReason },
  });
}

async function logAgentAction(
  db: AgentTaskDb,
  input: {
    taskId: string;
    taskRunId?: string | null;
    agentId: string;
    action: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const agentActionLogDelegate = db.agentActionLog as
    | { create(args: unknown): Promise<unknown> }
    | undefined;
  if (!agentActionLogDelegate) {
    return;
  }

  await agentActionLogDelegate.create({
    data: {
      taskId: input.taskId,
      taskRunId: input.taskRunId ?? null,
      agentId: input.agentId,
      action: input.action,
      summary: input.summary,
      metadata: input.metadata,
    },
  });
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
    riskLevel: { in: allowedAgentRiskLevels(profile) },
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
              ...claimablePolicyFilter,
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
  assertTaskPolicyAllowsAgentWork(before);
  const profile = await getAgentProfile(db, input.agentId);
  assertAgentCanWorkTask(profile, before);
  if (isActiveLease(before, now) && before.ownerAgent !== input.agentId) {
    throw new HttpError(409, `Task is leased by ${before.ownerAgent}`);
  }

  const claimed = await taskDelegate.updateMany({
    where: {
      id: taskId,
      status: { in: ["todo", "doing"] },
      AND: [
        agentPolicyWhere(profile),
        {
          OR: [
            { ownerAgent: null },
            { ownerAgent: input.agentId },
            { leaseUntil: { lt: now } },
          ],
        },
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
  const taskRun = await createTaskRun(db, before, profile, input.agentId, now, {
    leaseUntil: leaseUntil.toISOString(),
  });
  await logAgentAction(db, {
    taskId,
    taskRunId: taskRun?.id ?? null,
    agentId: input.agentId,
    action: "task.claimed",
    summary: `Claimed task lease until ${leaseUntil.toISOString()}`,
    metadata: { leaseUntil: leaseUntil.toISOString() },
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

  return { task, claim, taskRun };
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
    updateMany(args: unknown): Promise<{ count: number }>;
  };

  const before = await taskDelegate.findUnique({ where: { id: taskId } });
  if (!before) {
    throw new HttpError(404, "Task not found");
  }
  assertTaskCanBeWorked(before);
  const profile = await assertAgentStillAllowedToWork(
    db,
    before,
    input.agentId,
    now,
  );

  const renewed = await taskDelegate.updateMany({
    where: {
      id: taskId,
      ownerAgent: input.agentId,
      leaseUntil: { gt: now },
      status: { notIn: ["done", "archived"] },
      ...agentPolicyWhere(profile),
    },
    data: {
      ownerAgent: input.agentId,
      leaseUntil,
      lastHeartbeatAt: now,
    },
  });
  if (renewed.count !== 1) {
    throw new HttpError(409, "Policy or lease changed before heartbeat completed");
  }

  const task = await taskDelegate.findUnique({
    where: { id: taskId },
    include: agentTaskInclude,
  });
  if (!task) {
    throw new HttpError(404, "Task not found");
  }
  const taskRun = await ensureRunningTaskRun(
    db,
    before,
    profile,
    input.agentId,
    now,
  );
  await updateTaskRun(db, taskRun?.id, { lastHeartbeatAt: now });
  await logAgentAction(db, {
    taskId,
    taskRunId: taskRun?.id ?? null,
    agentId: input.agentId,
    action: "task.heartbeat",
    summary: `Renewed task lease until ${leaseUntil.toISOString()}`,
    metadata: { leaseUntil: leaseUntil.toISOString() },
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
  return withAgentTaskTransaction(db, async (tx) => {
    const now = new Date();
    const { taskRun } = await assertAndLockAgentMutation(
      tx,
      taskId,
      input.agentId,
      now,
    );
    return createContributionWithArtifacts(tx, taskId, input, taskRun);
  });
}

export async function submitTask<TDb extends AgentTaskDb>(
  db: TDb,
  taskId: string,
  input: TaskSubmitInput,
) {
  return withAgentTaskTransaction(db, async (tx) => {
    const now = new Date();
    const { taskRun } = await assertAndLockAgentMutation(
      tx,
      taskId,
      input.agentId,
      now,
    );
    const taskDelegate = tx.task as {
      update(args: unknown): Promise<unknown>;
    };
    const contributionResult = await createContributionWithArtifacts(
      tx,
      taskId,
      input,
      taskRun,
    );

    const task = await taskDelegate.update({
      where: { id: taskId },
      data: {
        status: "review",
        submittedAt: now,
        ownerAgent: null,
        leaseUntil: null,
        lastHeartbeatAt: now,
      },
      include: agentTaskInclude,
    });
    await updateTaskRun(tx, taskRun?.id, {
      status: "submitted",
      submittedAt: now,
      endedAt: now,
      resultSummary: input.summary,
    });
    await releaseActiveTaskClaims(
      tx,
      taskId,
      input.agentId,
      now,
      "submitted_for_review",
    );
    await logAgentAction(tx, {
      taskId,
      taskRunId: taskRun?.id ?? null,
      agentId: input.agentId,
      action: "task.submitted",
      summary: input.summary,
      metadata: {
        resultType: input.resultType,
        definitionOfDoneMet: input.definitionOfDoneMet,
        needsHumanDecision: input.needsHumanDecision,
      },
    });

    await recordActivity(tx, {
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
  });
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
  if (before.status !== "review" || !before.submittedAt) {
    throw new HttpError(409, "Only submitted review tasks can be reviewed");
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
        : input.decision === "reject"
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
  const runStatus =
    input.decision === "approve"
      ? "approved"
      : input.decision === "request_changes"
        ? "changes_requested"
        : input.decision === "reject"
          ? "rejected"
          : input.decision === "block"
            ? "blocked"
            : "archived";
  await updateSubmittedTaskRuns(db, taskId, { status: runStatus });

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
