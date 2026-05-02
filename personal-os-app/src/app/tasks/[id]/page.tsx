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
      claims: { orderBy: { claimedAt: "desc" }, take: 3 },
      contributions: { orderBy: { createdAt: "desc" }, take: 5 },
      artifacts: { orderBy: { createdAt: "desc" }, take: 5 },
      runs: { orderBy: { startedAt: "desc" }, take: 3 },
      agentActionLogs: { orderBy: { createdAt: "desc" }, take: 8 },
      reviews: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  })) as TaskView;

  return (
    <section className="mx-auto max-w-3xl">
      <TaskInspector task={task} />
    </section>
  );
}
