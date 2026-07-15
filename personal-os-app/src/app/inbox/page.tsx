import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatTaskStatus } from "@/lib/task-labels";

export const dynamic = "force-dynamic";

function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function InboxPage() {
  const items = await prisma.inboxItem.findMany({
    orderBy: { receivedAt: "desc" },
    include: {
      agentRuns: { orderBy: { startedAt: "desc" }, take: 1 },
      tasks: true,
      notes: true,
      ideas: true,
      projectEvents: true,
    },
    take: 100,
  });

  const pendingCount = items.filter((item) => ["new", "processing"].includes(item.status)).length;
  const processedCount = items.filter((item) => item.status === "processed").length;
  const failedCount = items.filter((item) => item.status === "failed").length;

  return (
    <section className="grid gap-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="ui-eyebrow">收集</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
            待整理来源
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
            链接、资料附件、语音转写和手动输入先进入这里。这里不承载任务推进，只保留原始来源和整理结果。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-center text-xs shadow-[var(--shadow-card)]">
          {[
            ["待整理", pendingCount],
            ["已处理", processedCount],
            ["失败", failedCount],
          ].map(([label, value]) => (
            <div key={label} className="min-w-20 rounded-2xl bg-[var(--surface-muted)] px-3 py-2">
              <div className="text-lg font-bold text-[var(--ink)]">{value}</div>
              <div className="mt-0.5 text-[var(--ink-muted)]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {items.map((item) => {
          const latestRun = item.agentRuns[0];
          const outputCount = item.tasks.length + item.ideas.length + item.notes.length + item.projectEvents.length;

          return (
            <article
              key={item.id}
              className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-[var(--ink)]">
                    {formatSource(item.sourcePlatform, item.sourceType)}
                  </div>
                  <div className="mt-1 text-xs text-[var(--ink-soft)]">
                    {formatInboxStatus(item.status)} · {formatDateTime(item.receivedAt)}
                  </div>
                </div>
                <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)]">
                  产出 {outputCount}
                </span>
              </div>

              <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-[var(--ink-muted)]">
                {item.rawText}
              </p>

              {latestRun?.reasoningSummary ? (
                <div className="mt-3 rounded-2xl bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--ink-muted)]">
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
                    整理结果
                  </div>
                  {latestRun.reasoningSummary}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {item.tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-1 text-[var(--brand-strong)]"
                  >
                    任务：{task.title} · {formatTaskStatus(task.status)}
                  </Link>
                ))}
                {item.ideas.map((idea) => (
                  <Link
                    key={idea.id}
                    href="/ideas"
                    className="rounded-full border border-[var(--waiting)] bg-[var(--waiting-soft)] px-2.5 py-1 text-[var(--waiting)]"
                  >
                    想法：{idea.title} · {formatTaskStatus(idea.status)}
                  </Link>
                ))}
                {item.notes.map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes/${note.id}`}
                    className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--ink-muted)]"
                  >
                    记录：{note.title}
                  </Link>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatSource(platform: string, sourceType: string) {
  const platformLabel: Record<string, string> = {
    telegram: "Telegram",
    dingtalk: "钉钉",
    deeptalk: "DeepTalk",
    manual: "手动输入",
  };
  const typeLabel: Record<string, string> = {
    text: "文本",
    link: "链接",
    file: "资料附件",
    "voice-transcript": "语音转写",
    telegram: "消息",
  };
  return `${platformLabel[platform] ?? platform} ${typeLabel[sourceType] ?? sourceType}`;
}

function formatInboxStatus(status: string) {
  const labels: Record<string, string> = {
    new: "未处理",
    processing: "整理中",
    processed: "已处理",
    failed: "处理失败",
    archived: "已忽略",
  };
  return labels[status] ?? status;
}
