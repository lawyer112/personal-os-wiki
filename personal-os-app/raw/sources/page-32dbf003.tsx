import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatTaskStatus } from "@/lib/task-labels";

export const dynamic = "force-dynamic";

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

  return (
    <section>
      <h1 className="text-3xl font-bold tracking-tight">输入箱</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
        所有 Telegram、文件、链接、语音转文字和 DeepTalk 导出先进入这里。
        Hermes 处理后会生成任务、笔记或项目事件。
      </p>

      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-950">
                {formatSource(item.sourcePlatform, item.sourceType)} /{" "}
                {formatInboxStatus(item.status)}
              </div>
              <div className="text-xs text-zinc-500">
                任务 {item.tasks.length} · 想法 {item.ideas.length} · 记录 {item.notes.length} · 进展{" "}
                {item.projectEvents.length}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
              {item.rawText}
            </p>
            {item.agentRuns[0]?.reasoningSummary ? (
              <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
                {item.agentRuns[0].reasoningSummary}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              {item.tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700"
                >
                  任务：{task.title} · {formatTaskStatus(task.status)}
                </Link>
              ))}
              {item.ideas.map((idea) => (
                <Link
                  key={idea.id}
                  href="/ideas"
                  className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700"
                >
                  想法：{idea.title} · {formatTaskStatus(idea.status)}
                </Link>
              ))}
              {item.notes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-700"
                >
                  记录：{note.title}
                </Link>
              ))}
            </div>
          </article>
        ))}
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
    file: "文件",
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
