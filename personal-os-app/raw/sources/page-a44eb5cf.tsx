import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatTaskStatus } from "@/lib/task-labels";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    include: {
      tasks: {
        where: { status: { notIn: ["done", "archived"] } },
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        take: 5,
      },
    },
  });

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">项目</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        项目是长期骨架，任务和笔记都应该尽量归到项目上。
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-zinc-950">
                  {project.name}
                </div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  {project.currentFocus ?? project.goal ?? "暂无当前焦点"}
                </p>
              </div>
              <span className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600">
                {formatTaskStatus(project.status)}
              </span>
            </div>
            <div className="mt-3 text-xs text-zinc-500">
              未完成任务：{project.tasks.length}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
