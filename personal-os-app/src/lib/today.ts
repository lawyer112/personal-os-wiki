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

  const [nowCount, reviewCount, waitingCount, blockedCount, doneCount, nowTasks, reviewTasks, waitingTasks, blockedTasks, doneTasks, projects, activity] =
    await Promise.all([
      task.count({ where: { status: { in: ["doing", "todo"] } } }),
      task.count({ where: { status: "review" } }),
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
        where: { status: "review" },
        include: taskInclude,
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
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
      review: reviewCount,
      waiting: waitingCount,
      blocked: blockedCount,
      done: doneCount,
    },
    nowTasks,
    reviewTasks,
    waitingTasks,
    blockedTasks,
    doneTasks,
    projects,
    activity,
  };
}
