import Link from "next/link";
import { IdeaActionControls } from "@/components/IdeaActionControls";
import { prisma } from "@/lib/db";
import { formatIdeaStatus, formatPriority } from "@/lib/task-labels";
import type { IdeaView } from "@/lib/view-models";

export const dynamic = "force-dynamic";

const ideaGroups = [
  {
    status: "captured",
    title: "刚捕获",
    description: "还没变成任务，也不急着删。先判断它值不值得推进。",
  },
  {
    status: "shaping",
    title: "正在打磨",
    description: "方向有价值，但还需要补背景、拆动作或绑定项目。",
  },
  {
    status: "someday",
    title: "以后再看",
    description: "暂时不占今日注意力，等项目或时机成熟再翻出来。",
  },
  {
    status: "promoted",
    title: "已转任务",
    description: "已经进入任务系统，保留来源方便回看。",
  },
] as const;

export default async function IdeasPage() {
  const ideas = (await prisma.idea.findMany({
    where: { status: { not: "archived" } },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    include: {
      project: true,
      sourceInboxItem: true,
      sourceAgentRun: true,
      promotedTask: true,
    },
    take: 160,
  })) as IdeaView[];

  const metrics = ideaGroups.map((group) => ({
    ...group,
    count: ideas.filter((idea) => idea.status === group.status).length,
  }));

  return (
    <section>
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">想法池</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">
            把灵感先放住，再快速处理
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Hermes 从聊天、语音和链接里识别出的想法会先进入这里。
            你可以把它转成任务、继续打磨、放到以后，或者直接忽略。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link
            href="/inbox"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-700"
          >
            查看输入来源
          </Link>
          <Link href="/" className="rounded-lg bg-zinc-950 px-3 py-2 text-white">
            回到今日任务
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {metrics.map((item) => (
          <div
            key={item.status}
            className="rounded-lg border border-zinc-200 bg-white p-3"
          >
            <div className="text-2xl font-bold text-zinc-950">{item.count}</div>
            <div className="mt-1 text-sm font-semibold text-zinc-700">
              {item.title}
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5">
        {ideaGroups.map((group) => {
          const groupIdeas = ideas.filter((idea) => idea.status === group.status);
          return (
            <section key={group.status}>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-zinc-950">
                    {group.title}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {group.description}
                  </p>
                </div>
                <span className="text-xs font-semibold text-zinc-500">
                  {groupIdeas.length} 条
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {groupIdeas.length > 0 ? (
                  groupIdeas.map((idea) => <IdeaCard key={idea.id} idea={idea} />)
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-sm text-zinc-500">
                    暂时没有内容。
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function IdeaCard({ idea }: { idea: IdeaView }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-zinc-950">{idea.title}</h3>
            <span className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600">
              {formatIdeaStatus(idea.status)}
            </span>
            <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
              {formatPriority(idea.priority)}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
            {idea.body}
          </p>
        </div>
      </div>

      {idea.nextAction ? (
        <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
          下一步：{idea.nextAction}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
        {idea.project ? (
          <Link
            href={`/projects/${idea.project.id}`}
            className="rounded-lg border border-zinc-200 px-2 py-1 font-semibold text-zinc-700"
          >
            项目：{idea.project.name}
          </Link>
        ) : null}
        {idea.tags.map((tag) => (
          <span key={tag} className="rounded-lg bg-zinc-100 px-2 py-1">
            #{tag}
          </span>
        ))}
        {idea.sourceInboxItem ? (
          <span className="rounded-lg bg-zinc-100 px-2 py-1">
            来源：{idea.sourceInboxItem.sourcePlatform ?? "输入箱"}
          </span>
        ) : null}
        {idea.promotedTaskId ? (
          <Link
            href={`/tasks/${idea.promotedTaskId}`}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-700"
          >
            查看任务{idea.promotedTask ? `：${idea.promotedTask.title}` : ""}
          </Link>
        ) : null}
      </div>

      <div className="mt-4">
        <IdeaActionControls ideaId={idea.id} status={idea.status} compact />
      </div>
    </article>
  );
}
