import Link from "next/link";
import { formatTaskStatus } from "@/lib/task-labels";
import type { ProjectRadarItem } from "@/lib/view-models";

export function ProjectRadar({ projects }: { projects: ProjectRadarItem[] }) {
  return (
    <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)]">
            相关项目
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
            今天被任务牵动的长期项目
          </p>
        </div>
        <Link href="/projects" className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-bold text-[var(--brand-strong)] hover:border-[var(--border-strong)]">
          全部项目
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const activeTasks = project.tasks?.length ?? 0;
          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--app-bg-soft)] p-3 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-bold text-[var(--ink)]">
                  {project.name}
                </div>
                <span className="shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-muted)]">
                  {project.status ? formatTaskStatus(project.status) : "未标记"}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--brand)]"
                  style={{ width: `${Math.min(100, 28 + activeTasks * 18)}%` }}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
                {project.currentFocus ?? project.goal ?? "等待下一步动作。"}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
