import { TaskInspector } from "@/components/TaskInspector";
import { prisma } from "@/lib/db";
import type { TaskView } from "@/lib/view-models";

export const dynamic = "force-dynamic";

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = (await prisma.task.findUniqueOrThrow({
    where: { id },
    include: {
      project: true,
      sourceInboxItem: true,
      sourceAgentRun: true,
      wikiLinks: true,
    },
  })) as TaskView;

  return (
    <section className="mx-auto max-w-3xl">
      <TaskInspector task={task} />
    </section>
  );
}
