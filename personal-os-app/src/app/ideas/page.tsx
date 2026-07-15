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
    description: "先放住，不急着变成任务，也不急着删。",
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
    <section className="grid gap-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="ui-eyebrow">想法</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
            待打磨想法
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
            想法不直接挤进今日任务。先判断它是要打磨、转任务、以后再看，还是只是保留一个来源。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link
            href="/inbox"
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-[var(--ink-muted)] hover:border-[var(--border-strong)]"
          >
            查看输入来源
          </Link>
          <Link href="/" className="rounded-full bg-[var(--brand-strong)] px-4 py-2 text-white">
            回到今日
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {metrics.map((item) => (
          <div
            key={item.status}
            className="rounded-[1.5rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
          >
            <div className="text-2xl font-bold text-[var(--ink)]">{item.count}</div>
            <div className="mt-1 text-sm font-bold text-[var(--ink)]">
              {item.title}
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5">
        {ideaGroups.map((group) => {
          const groupIdeas = ideas.filter((idea) => idea.status === group.status);
          return (
            <section
              key={group.status}
              className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--ink)]">
                    {group.title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                    {group.description}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)]">
                  {groupIdeas.length} 条
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {groupIdeas.length > 0 ? (
                  groupIdeas.map((idea) => <IdeaCard key={idea.id} idea={idea} />)
                ) : (
                  <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-8 text-sm text-[var(--ink-muted)]">
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
    <article className="rounded-2xl border border-[var(--border-soft)] bg-[var(--app-bg-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-[var(--ink)]">{idea.title}</h3>
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-muted)]">
              {formatIdeaStatus(idea.status)}
            </span>
            <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-muted)]">
              {formatPriority(idea.priority)}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ink-muted)]">
            {idea.body}
          </p>
        </div>
      </div>

      {idea.nextAction ? (
        <div className="mt-3 rounded-2xl bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--ink-muted)]">
          <span className="font-bold text-[var(--brand-strong)]">下一步：</span>
          {idea.nextAction}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
        {idea.project ? (
          <Link
            href={`/projects/${idea.project.id}`}
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--brand-strong)]"
          >
            项目：{idea.project.name}
          </Link>
        ) : null}
        {idea.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1">
            #{tag}
          </span>
        ))}
        {idea.sourceInboxItem ? (
          <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1">
            来源：{idea.sourceInboxItem.sourcePlatform ?? "输入箱"}
          </span>
        ) : null}
        {idea.promotedTaskId ? (
          <Link
            href={`/tasks/${idea.promotedTaskId}`}
            className="rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-1 font-semibold text-[var(--brand-strong)]"
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
