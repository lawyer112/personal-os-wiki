type TodayDb = {
  task: unknown;
  project: unknown;
  activityLog: unknown;
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

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getToday<TDb extends TodayDb>(db: TDb) {
  const task = db.task as {
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<unknown[]>;
  };
  const project = db.project as { findMany(args: unknown): Promise<unknown[]> };
  const activityLog = db.activityLog as {
    findMany(args: unknown): Promise<unknown[]>;
  };

  const intakeReviewWhere = { status: "review", submittedAt: null };
  const executionReviewWhere = { status: "review", submittedAt: { not: null } };

  const [
    nowCount,
    intakeReviewCount,
    executionReviewCount,
    waitingCount,
    blockedCount,
    doneCount,
    nowTasks,
    reviewTasks,
    executionReviewTasks,
    waitingTasks,
    blockedTasks,
    doneTasks,
    projects,
    activity,
  ] =
    await Promise.all([
      task.count({ where: { status: { in: ["doing", "todo"] } } }),
      task.count({ where: intakeReviewWhere }),
      task.count({ where: executionReviewWhere }),
      task.count({ where: { status: "waiting" } }),
      task.count({ where: { status: "blocked" } }),
      task.count({
        where: {
          status: "done",
          completedAt: { gte: startOfToday() },
        },
      }),
      task.findMany({
        where: { status: { in: ["doing", "todo"] } },
        include: taskInclude,
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        take: 5,
      }),
      task.findMany({
        where: intakeReviewWhere,
        include: taskInclude,
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: 8,
      }),
      task.findMany({
        where: executionReviewWhere,
        include: taskInclude,
        orderBy: [{ priority: "asc" }, { submittedAt: "desc" }],
        take: 8,
      }),
      task.findMany({
        where: { status: "waiting" },
        include: taskInclude,
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        take: 8,
      }),
      task.findMany({
        where: { status: "blocked" },
        include: taskInclude,
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        take: 8,
      }),
      task.findMany({
        where: {
          status: "done",
          completedAt: { gte: startOfToday() },
        },
        include: taskInclude,
        orderBy: { completedAt: "desc" },
        take: 8,
      }),
      project.findMany({
        where: { status: { in: ["active", "waiting", "blocked"] } },
        include: {
          tasks: {
            where: { status: { notIn: ["done", "archived"] } },
            orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
            take: 5,
          },
        },
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        take: 6,
      }),
      activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

  return {
    metrics: {
      now: nowCount,
      review: intakeReviewCount + executionReviewCount,
      intakeReview: intakeReviewCount,
      executionReview: executionReviewCount,
      waiting: waitingCount,
      blocked: blockedCount,
      done: doneCount,
    },
    nowTasks,
    reviewTasks,
    executionReviewTasks,
    waitingTasks,
    blockedTasks,
    doneTasks,
    projects,
    activity,
  };
}
