import Link from "next/link";
import { formatTaskStatus } from "@/lib/task-labels";
import type { ProjectRadarItem } from "@/lib/view-models";

export function ProjectRadar({ projects }: { projects: ProjectRadarItem[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">
            相关项目
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            今天被任务牵动的长期项目
          </p>
        </div>
        <Link href="/projects" className="text-xs font-semibold text-emerald-700">
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
              className="rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-semibold text-zinc-950">
                  {project.name}
                </div>
                <span className="shrink-0 rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600">
                  {project.status ? formatTaskStatus(project.status) : "未标记"}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-lg bg-zinc-100">
                <div
                  className="h-full rounded-lg bg-emerald-600"
                  style={{ width: `${Math.min(100, 28 + activeTasks * 18)}%` }}
                />
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-600">
                {project.currentFocus ?? project.goal ?? "等待下一步动作。"}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
