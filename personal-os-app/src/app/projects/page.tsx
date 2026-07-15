import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPriority, formatTaskStatus } from "@/lib/task-labels";

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

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    include: {
      tasks: {
        where: { status: { notIn: ["done", "archived"] } },
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
      },
      events: { orderBy: { createdAt: "desc" }, take: 1 },
      notes: { take: 3 },
    },
  });

  const activeProjects = projects.filter((project) => project.status === "active").length;
  const blockedProjects = projects.filter((project) => project.status === "blocked").length;
  const openTasks = projects.reduce((total, project) => total + project.tasks.length, 0);

  return (
    <section className="grid gap-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="ui-eyebrow">项目</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
            项目档案
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
            项目页只回答一件事：这个长期目标现在是否真的在动，以及它卡在哪里。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-center text-xs shadow-[var(--shadow-card)]">
          {[
            ["活跃", activeProjects],
            ["受阻", blockedProjects],
            ["任务", openTasks],
          ].map(([label, value]) => (
            <div key={label} className="min-w-20 rounded-2xl bg-[var(--surface-muted)] px-3 py-2">
              <div className="text-lg font-bold text-[var(--ink)]">{value}</div>
              <div className="mt-0.5 text-[var(--ink-muted)]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {projects.map((project) => {
          const blockedTasks = project.tasks.filter((task) => task.status === "blocked");
          const waitingTasks = project.tasks.filter((task) => task.status === "waiting");
          const latestEvent = project.events[0];

          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-bold text-[var(--ink)]">{project.name}</div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--ink-muted)]">
                    {project.currentFocus ?? project.goal ?? "还没有写当前焦点。"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)]">
                  {formatTaskStatus(project.status)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                <div className="rounded-2xl bg-[var(--surface-muted)] p-2">
                  <div className="text-[var(--ink-soft)]">优先级</div>
                  <div className="mt-1 font-bold text-[var(--ink)]">{formatPriority(project.priority)}</div>
                </div>
                <div className="rounded-2xl bg-[var(--surface-muted)] p-2">
                  <div className="text-[var(--ink-soft)]">未完成</div>
                  <div className="mt-1 font-bold text-[var(--ink)]">{project.tasks.length}</div>
                </div>
                <div className="rounded-2xl bg-[var(--blocked-soft)] p-2">
                  <div className="text-[var(--blocked)]">卡点</div>
                  <div className="mt-1 font-bold text-[var(--blocked)]">{blockedTasks.length}</div>
                </div>
                <div className="rounded-2xl bg-[var(--waiting-soft)] p-2">
                  <div className="text-[var(--waiting)]">等待</div>
                  <div className="mt-1 font-bold text-[var(--waiting)]">{waitingTasks.length}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--app-bg-soft)] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
                  最近推进
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--ink-muted)]">
                  {latestEvent
                    ? `${latestEvent.title} · ${formatDateTime(latestEvent.createdAt)}`
                    : "还没有项目事件。"}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
