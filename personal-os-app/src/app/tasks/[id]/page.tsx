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
    <section className="mx-auto grid max-w-4xl gap-5">
      <div>
        <p className="ui-eyebrow">任务档案</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
          任务档案
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">
          先判断目标、下一步、责任方、证据和复核状态。执行轨迹保留在下方，需要时再展开。
        </p>
      </div>
      <TaskInspector task={task} />
    </section>
  );
}
