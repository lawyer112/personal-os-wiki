import { TaskCard } from "@/components/TaskCard";
import { prisma } from "@/lib/db";
import { formatPriority, formatTaskStatus } from "@/lib/task-labels";
import type { TaskView } from "@/lib/view-models";

export const dynamic = "force-dynamic";

function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function taskTone(status: string) {
  if (["todo", "doing", "active"].includes(status)) {
    return "active" as const;
  }
  if (["waiting", "paused"].includes(status)) {
    return "waiting" as const;
  }
  if (status === "blocked") {
    return "blocked" as const;
  }
  if (["done", "archived"].includes(status)) {
    return "done" as const;
  }
  return "review" as const;
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    include: {
      tasks: {
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
      },
      events: { orderBy: { createdAt: "desc" } },
      notes: { include: { note: true } },
    },
  });

  const tasks = project.tasks as TaskView[];
  const openTasks = tasks.filter((task) => !["done", "archived"].includes(task.status));
  const blockedTasks = openTasks.filter((task) => task.status === "blocked");
  const waitingTasks = openTasks.filter((task) => ["waiting", "paused"].includes(task.status));
  const latestEvent = project.events[0];

  return (
    <section className="grid gap-5">
      <div className="rounded-[2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <p className="ui-eyebrow">项目档案</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
              {project.name}
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--ink-muted)]">
              {project.goal ?? "这个项目还没有写长期目标。"}
            </p>
          </div>
          <div className="grid min-w-72 grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
              <div className="text-[var(--ink-soft)]">状态</div>
              <div className="mt-1 font-bold text-[var(--ink)]">
                {formatTaskStatus(project.status)}
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
              <div className="text-[var(--ink-soft)]">优先级</div>
              <div className="mt-1 font-bold text-[var(--ink)]">
                {formatPriority(project.priority)}
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--blocked-soft)] p-3">
              <div className="text-[var(--blocked)]">卡点</div>
              <div className="mt-1 font-bold text-[var(--blocked)]">
                {blockedTasks.length}
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--waiting-soft)] p-3">
              <div className="text-[var(--waiting)]">等待</div>
              <div className="mt-1 font-bold text-[var(--waiting)]">
                {waitingTasks.length}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-[var(--brand-soft)] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
              当前焦点
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink)]">
              {project.currentFocus ?? "还没有写当前焦点。"}
            </p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
              最近推进
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
              {latestEvent
                ? `${latestEvent.title} · ${formatDateTime(latestEvent.createdAt)}`
                : "还没有项目事件。"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4">
          <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">未完成任务</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                  项目是否在动，先看这些任务是否能继续推进。
                </p>
              </div>
              <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)]">
                {openTasks.length}
              </span>
            </div>

            {openTasks.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {openTasks.map((task) => (
                  <TaskCard key={task.id} task={task} tone={taskTone(task.status)} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-6 text-sm text-[var(--ink-muted)]">
                这个项目暂时没有未完成任务。
              </div>
            )}
          </section>
        </div>

        <aside className="grid gap-4">
          <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold text-[var(--ink)]">项目进展</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-[var(--ink-muted)]">
              {project.events.length > 0 ? (
                project.events.map((event) => (
                  <div key={event.id} className="rounded-2xl bg-[var(--surface-muted)] p-3">
                    <div className="font-bold text-[var(--ink)]">{event.title}</div>
                    <div className="mt-1 text-xs text-[var(--ink-soft)]">
                      {event.eventType} · {formatDateTime(event.createdAt)}
                    </div>
                    <p className="mt-2 line-clamp-4">{event.body}</p>
                  </div>
                ))
              ) : (
                <p>还没有项目进展。</p>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold text-[var(--ink)]">项目记录</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-[var(--ink-muted)]">
              {project.notes.length > 0 ? (
                project.notes.map((item) => (
                  <a
                    key={item.noteId}
                    href={`/notes/${item.noteId}`}
                    className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 font-medium text-[var(--ink)] hover:bg-[var(--app-bg-soft)]"
                  >
                    {item.note.title}
                  </a>
                ))
              ) : (
                <p>还没有项目记录。</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
