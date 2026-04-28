import { TaskCard } from "@/components/TaskCard";
import { prisma } from "@/lib/db";
import { formatPriority, formatTaskStatus } from "@/lib/task-labels";
import type { TaskView } from "@/lib/view-models";

export const dynamic = "force-dynamic";

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
        },
      },
      events: { orderBy: { createdAt: "desc" } },
      notes: { include: { note: true } },
    },
  });

  return (
    <section>
      <p className="text-sm font-semibold text-emerald-700">
        {formatTaskStatus(project.status)} / {formatPriority(project.priority)}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">
        {project.name}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
        {project.goal}
      </p>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3">
          {(project.tasks as TaskView[]).map((task) => (
            <TaskCard key={task.id} task={task} tone="review" />
          ))}
        </div>

        <aside className="grid gap-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold">项目进展</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-zinc-600">
              {project.events.length > 0 ? (
                project.events.map((event) => (
                  <div key={event.id} className="rounded-lg bg-zinc-50 p-3">
                    <div className="font-semibold text-zinc-900">{event.title}</div>
                    <p className="mt-1 line-clamp-3">{event.body}</p>
                  </div>
                ))
              ) : (
                <p>还没有项目进展。</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold">项目记录</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-zinc-600">
              {project.notes.length > 0 ? (
                project.notes.map((item) => (
                  <a
                    key={item.noteId}
                    href={`/notes/${item.noteId}`}
                    className="rounded-lg bg-zinc-50 p-3 font-medium text-zinc-900 hover:bg-zinc-100"
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
