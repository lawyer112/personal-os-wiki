import { searchWikiContext, type WikiContextSearchResult } from "@/lib/agent-context";
import {
  getTodayReminder,
  normalizeReminderMode,
  type ReminderMode,
  type TodayReminder,
} from "@/lib/reminders";
import type { DailyPlanSnapshotInput } from "@/lib/validation";

type PlannerDb = {
  task: unknown;
  idea: unknown;
  project: unknown;
  activityLog: unknown;
  dailyPlan?: unknown;
};

type PlannerProject = {
  id: string;
  name: string;
  goal?: string | null;
  status: string;
  priority: string;
  currentFocus?: string | null;
};

type PlannerActivity = {
  id: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt?: Date | string;
};

export type DailyPlannerPack = {
  mode: ReminderMode;
  generatedAt: string;
  reminder: TodayReminder;
  projects: PlannerProject[];
  recentActivity: PlannerActivity[];
  wiki: WikiContextSearchResult;
  plannerInstruction: string;
};

export type DailyPlanSnapshot = {
  id: string;
  date: string;
  mode: string;
  mainLine: string;
  firstAction: string;
  blocked: string[];
  needsDecision: string[];
  deliveredTo: string[];
  createdAt?: Date | string;
};

export function normalizePlannerMode(value: string | null): ReminderMode {
  return normalizeReminderMode(value);
}

export async function getDailyPlannerPack<TDb extends PlannerDb>(
  db: TDb,
  options: { mode?: ReminderMode; appUrl?: string } = {},
): Promise<DailyPlannerPack> {
  const mode = options.mode ?? "morning";
  const project = db.project as {
    findMany(args: unknown): Promise<PlannerProject[]>;
  };
  const activityLog = db.activityLog as {
    findMany(args: unknown): Promise<PlannerActivity[]>;
  };

  const [reminder, projects, recentActivity] = await Promise.all([
    getTodayReminder(db, { mode, appUrl: options.appUrl }),
    project.findMany({
      where: { status: { in: ["active", "waiting", "blocked"] } },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  const wikiQueries = buildPlannerWikiQueries(reminder, projects);
  const wiki = await searchWikiContext(wikiQueries, 10);

  return {
    mode,
    generatedAt: new Date().toISOString(),
    reminder,
    projects,
    recentActivity,
    wiki,
    plannerInstruction: buildPlannerInstruction(mode),
  };
}

export async function saveDailyPlanSnapshot<TDb extends { dailyPlan?: unknown }>(
  db: TDb,
  input: DailyPlanSnapshotInput,
  sourcePlannerPacket: DailyPlannerPack | Record<string, unknown>,
): Promise<DailyPlanSnapshot> {
  const dailyPlan = db.dailyPlan as {
    create(args: unknown): Promise<DailyPlanSnapshot>;
  };
  const date = input.date ?? new Date().toISOString().slice(0, 10);

  return dailyPlan.create({
    data: {
      date,
      mode: input.mode,
      mainLine: input.mainLine,
      firstAction: input.firstAction,
      blocked: input.blocked,
      needsDecision: input.needsDecision,
      deliveredTo: input.deliveredTo,
      sourcePlannerPacket,
    },
  });
}

export function buildPlannerWikiQueries(
  reminder: TodayReminder,
  projects: PlannerProject[],
  limit = 10,
) {
  const queries = new Set<string>();
  const tasks = [
    ...reminder.tasks.now,
    ...reminder.tasks.review,
    ...reminder.tasks.blocked,
  ];

  for (const task of tasks) {
    addQuery(queries, task.title);
    addQuery(queries, task.nextAction ?? "");
    addQuery(queries, task.project?.name ?? "");
  }

  for (const idea of reminder.ideas) {
    addQuery(queries, idea.title);
    addQuery(queries, idea.nextAction ?? "");
    addQuery(queries, idea.project?.name ?? "");
  }

  for (const project of projects) {
    addQuery(queries, project.name);
    addQuery(queries, project.currentFocus ?? "");
    addQuery(queries, project.goal ?? "");
  }

  return Array.from(queries).slice(0, limit);
}

function addQuery(queries: Set<string>, value: string) {
  const query = value.trim().replace(/\s+/g, " ");
  if (query.length >= 2 && query.length <= 80) {
    queries.add(query);
  }
}

function buildPlannerInstruction(mode: ReminderMode) {
  const modeGoal = {
    morning: "决定今天最该推进的一个赚钱/落地项目，并把任务压缩成可验收动作。",
    checkin: "检查今天承诺的动作有没有推进；点名未完成、卡点、跑偏和下一步。",
    evening: "复盘今天留下了什么资产；把未完成原因和明天第一步写清楚。",
  }[mode];

  return [
    "你是 Personal OS 的任务 PM 和赚钱导向知识库管理员，不是闲聊助手，也不是单纯提醒机器人。",
    modeGoal,
    "先看 reminder.metrics、tasks、ideas、projects、recentActivity，再看 wiki.candidates；Wiki 候选只能作为证据，不能替代任务判断。",
    "输出必须短、硬、具体。默认只给 1 个今日主线、最多 3 个动作；每个动作必须包含对象、产物、验收标准。",
    "禁止空泛词单独出现：整理、优化、推进、收敛、研究、完善、持续、梳理。使用这些词时，必须接具体对象和可交付结果。",
    "不要写鸡汤，不要说方向清晰，不要说后续继续完善，不要解释系统实现。",
    "如果任务没完成，直接写“未完成”，并判断原因：阻塞、分心、任务定义错误、逃避高价值动作、外部事故。",
    "如果当前动作不推进收入或项目落地，直接标记“跑偏”，并给出回到主线的最小动作。",
    "任务必须满足：动词 + 对象 + 结果 + 验收标准。缺少验收标准时，把它放进“需要补定义”，不要伪装成正式任务。",
    "输出结构固定为：今日主线 / 现在卡点 / 建议先做 / 需要确认 / 今日不做 / 验收标准。",
    "建议先做必须是 60 到 120 分钟内能完成的动作；超过 2 小时就继续拆。",
    "不要擅自改任务状态；用户回复确认或完成后，再调用任务、想法或项目 API。",
  ].join("\n");
}
