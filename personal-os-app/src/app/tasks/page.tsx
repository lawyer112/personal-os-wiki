import { TaskCard } from "@/components/TaskCard";
import { prisma } from "@/lib/db";
import type { TaskView } from "@/lib/view-models";

export const dynamic = "force-dynamic";

type TaskTone = "active" | "review" | "waiting" | "blocked" | "done";

type TaskGroup = {
  id: string;
  title: string;
  subtitle: string;
  statuses: string[];
  tone: TaskTone;
  emptyText: string;
};

const taskGroups: TaskGroup[] = [
  {
    id: "active",
    title: "进行中",
    subtitle: "可以直接推进，或已由助手接手执行的任务。",
    statuses: ["todo", "doing", "active"],
    tone: "active",
    emptyText: "没有正在推进的任务。",
  },
  {
    id: "review",
    title: "待确认 / 待复核",
    subtitle: "需要确认是否继续，或检查已提交的证据和产物。",
    statuses: ["review"],
    tone: "review",
    emptyText: "没有等待确认或复核的任务。",
  },
  {
    id: "waiting",
    title: "等待中",
    subtitle: "卡在外部输入、工具、导出、权限或异步结果上。",
    statuses: ["waiting", "paused"],
    tone: "waiting",
    emptyText: "没有等待项。",
  },
  {
    id: "blocked",
    title: "受阻",
    subtitle: "缺少继续条件，需要补充决策、能力或权限。",
    statuses: ["blocked"],
    tone: "blocked",
    emptyText: "暂无受阻任务。",
  },
  {
    id: "done",
    title: "已完成",
    subtitle: "已经完成的任务，用于复盘今天和项目真实推进。",
    statuses: ["done"],
    tone: "done",
    emptyText: "还没有完成任务。",
  },
  {
    id: "archived",
    title: "已忽略 / 归档",
    subtitle: "暂不推进，但保留来源和判断记录。",
    statuses: ["archived"],
    tone: "done",
    emptyText: "没有归档任务。",
  },
];

export default async function TasksPage() {
  const tasks = (await prisma.task.findMany({
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    include: {
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
    },
  })) as TaskView[];

  const groupedTasks = taskGroups.map((group) => ({
    ...group,
    tasks: tasks.filter((task) => group.statuses.includes(task.status)),
  }));
  const activeCount = groupedTasks.find((group) => group.id === "active")?.tasks.length ?? 0;
  const reviewCount = groupedTasks.find((group) => group.id === "review")?.tasks.length ?? 0;
  const blockedCount = groupedTasks.find((group) => group.id === "blocked")?.tasks.length ?? 0;

  return (
    <section className="grid gap-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="ui-eyebrow">任务</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
            任务推进池
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
            这里不按创建时间堆任务，而是按推进状态整理：进行中、待确认、等待、受阻和已完成。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-center text-xs shadow-[var(--shadow-card)]">
          {[
            ["推进", activeCount],
            ["待确认", reviewCount],
            ["受阻", blockedCount],
          ].map(([label, value]) => (
            <div key={label} className="min-w-20 rounded-2xl bg-[var(--surface-muted)] px-3 py-2">
              <div className="text-lg font-bold text-[var(--ink)]">{value}</div>
              <div className="mt-0.5 text-[var(--ink-muted)]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {groupedTasks.map((group) => (
          <section
            key={group.id}
            className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">{group.title}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                  {group.subtitle}
                </p>
              </div>
              <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)]">
                {group.tasks.length}
              </span>
            </div>

            {group.tasks.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {group.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} tone={group.tone} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-6 text-sm text-[var(--ink-muted)]">
                {group.emptyText}
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
