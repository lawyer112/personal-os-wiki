import { TaskCard } from "@/components/TaskCard";
import { prisma } from "@/lib/db";
import type { TaskView } from "@/lib/view-models";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const tasks = (await prisma.task.findMany({
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    include: {
      project: true,
      sourceInboxItem: true,
      sourceAgentRun: true,
      wikiLinks: true,
    },
  })) as TaskView[];

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">全部任务</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        这里是完整任务池。今日任务页只抽取今日要做、待确认、等待中、卡住了和今日已完成的部分。
      </p>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} tone="review" />
        ))}
      </div>
    </section>
  );
}
