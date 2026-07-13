import { formatTaskStatus } from "@/lib/task-labels";

export const reminderModes = ["morning", "checkin", "evening"] as const;
export type ReminderMode = (typeof reminderModes)[number];

type ReminderDb = {
  task: unknown;
  idea: unknown;
};

type ReminderTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  nextAction?: string | null;
  updatedAt?: Date | string;
  completedAt?: Date | string | null;
  project?: { id: string; name: string } | null;
};

type ReminderIdea = {
  id: string;
  title: string;
  status: string;
  priority: string;
  nextAction?: string | null;
  project?: { id: string; name: string } | null;
};

export type ReminderPayload = {
  text: string;
  buttons: Array<{ label: string; url: string }>;
};

export type TodayReminder = {
  mode: ReminderMode;
  shouldSend: boolean;
  generatedAt: string;
  metrics: {
    now: number;
    review: number;
    waiting: number;
    blocked: number;
    doneToday: number;
    ideas: number;
  };
  tasks: {
    now: ReminderTask[];
    review: ReminderTask[];
    waiting: ReminderTask[];
    blocked: ReminderTask[];
    doneToday: ReminderTask[];
  };
  ideas: ReminderIdea[];
  payload: ReminderPayload;
};

const taskInclude = { project: true };
const activeTaskWhere = { status: { in: ["doing", "todo"] } };

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function normalizeReminderMode(value: string | null): ReminderMode {
  return reminderModes.includes(value as ReminderMode)
    ? (value as ReminderMode)
    : "checkin";
}

export async function getTodayReminder<TDb extends ReminderDb>(
  db: TDb,
  options: { mode?: ReminderMode; appUrl?: string } = {},
): Promise<TodayReminder> {
  const mode = options.mode ?? "checkin";
  const appUrl = (options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(
    /\/$/,
    "",
  );
  const today = startOfToday();
  const task = db.task as {
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<ReminderTask[]>;
  };
  const idea = db.idea as {
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<ReminderIdea[]>;
  };

  const [
    nowCount,
    reviewCount,
    waitingCount,
    blockedCount,
    doneTodayCount,
    ideaCount,
    nowTasks,
    reviewTasks,
    waitingTasks,
    blockedTasks,
    doneTodayTasks,
    ideas,
  ] = await Promise.all([
    task.count({ where: activeTaskWhere }),
    task.count({ where: { status: "review" } }),
    task.count({ where: { status: "waiting" } }),
    task.count({ where: { status: "blocked" } }),
    task.count({ where: { status: "done", completedAt: { gte: today } } }),
    idea.count({ where: { status: { in: ["captured", "shaping"] } } }),
    task.findMany({
      where: activeTaskWhere,
      include: taskInclude,
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 5,
    }),
    task.findMany({
      where: { status: "review" },
      include: taskInclude,
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 5,
    }),
    task.findMany({
      where: { status: "waiting" },
      include: taskInclude,
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 3,
    }),
    task.findMany({
      where: { status: "blocked" },
      include: taskInclude,
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 3,
    }),
    task.findMany({
      where: { status: "done", completedAt: { gte: today } },
      include: taskInclude,
      orderBy: { completedAt: "desc" },
      take: 5,
    }),
    idea.findMany({
      where: { status: { in: ["captured", "shaping"] } },
      include: { project: true },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 5,
    }),
  ]);

  const metrics = {
    now: nowCount,
    review: reviewCount,
    waiting: waitingCount,
    blocked: blockedCount,
    doneToday: doneTodayCount,
    ideas: ideaCount,
  };
  const payload = buildTodayReminderPayload({
    mode,
    appUrl,
    metrics,
    nowTasks,
    reviewTasks,
    waitingTasks,
    blockedTasks,
    doneTodayTasks,
    ideas,
  });

  return {
    mode,
    shouldSend:
      metrics.now + metrics.review + metrics.blocked + metrics.ideas > 0 ||
      (mode === "evening" && metrics.doneToday > 0),
    generatedAt: new Date().toISOString(),
    metrics,
    tasks: {
      now: nowTasks,
      review: reviewTasks,
      waiting: waitingTasks,
      blocked: blockedTasks,
      doneToday: doneTodayTasks,
    },
    ideas,
    payload,
  };
}

function buildTodayReminderPayload(input: {
  mode: ReminderMode;
  appUrl: string;
  metrics: TodayReminder["metrics"];
  nowTasks: ReminderTask[];
  reviewTasks: ReminderTask[];
  waitingTasks: ReminderTask[];
  blockedTasks: ReminderTask[];
  doneTodayTasks: ReminderTask[];
  ideas: ReminderIdea[];
}): ReminderPayload {
  const title = {
    morning: "早上检查一下今天要推进什么。",
    checkin: "我来催一下：这些事情还挂着。",
    evening: "今天收个尾，看看哪些做了，哪些还没收。",
  }[input.mode];
  const summary = `今日要做 ${input.metrics.now}，待确认 ${input.metrics.review}，卡住 ${input.metrics.blocked}，想法 ${input.metrics.ideas}，今天完成 ${input.metrics.doneToday}。`;
  const sections = [
    taskSection("现在先做", input.nowTasks),
    taskSection("待确认", input.reviewTasks),
    taskSection("卡住了", input.blockedTasks),
    ideaSection(input.ideas),
    input.mode === "evening"
      ? taskSection("今天已完成", input.doneTodayTasks)
      : null,
  ].filter(Boolean);
  const text = [title, summary, ...sections].join("\n\n");
  const cleanAppUrl = input.appUrl || "";
  const buttons = [
    ...input.nowTasks.slice(0, 1).map((task) => ({
      label: `打开任务：${task.title}`,
      url: `${cleanAppUrl}/tasks/${task.id}`,
    })),
    ...input.reviewTasks.slice(0, 1).map((task) => ({
      label: `确认任务：${task.title}`,
      url: `${cleanAppUrl}/tasks/${task.id}`,
    })),
    { label: "今日任务", url: `${cleanAppUrl}/` },
    { label: "想法池", url: `${cleanAppUrl}/ideas` },
  ].slice(0, 4);

  return { text, buttons };
}

function taskSection(title: string, tasks: ReminderTask[]) {
  if (tasks.length === 0) {
    return null;
  }
  return [
    `${title}：`,
    ...tasks.map((task, index) => {
      const project = task.project?.name ? ` / ${task.project.name}` : "";
      const nextAction = task.nextAction ? `\n   下一步：${task.nextAction}` : "";
      return `${index + 1}. [${formatTaskStatus(task.status)}] ${task.title}${project}${nextAction}`;
    }),
  ].join("\n");
}

function ideaSection(ideas: ReminderIdea[]) {
  if (ideas.length === 0) {
    return null;
  }
  return [
    "想法池待处理：",
    ...ideas.map((idea, index) => {
      const nextAction = idea.nextAction ? `\n   下一步：${idea.nextAction}` : "";
      return `${index + 1}. [${formatTaskStatus(idea.status)}] ${idea.title}${nextAction}`;
    }),
  ].join("\n");
}
