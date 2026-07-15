import { prisma } from "@/lib/db";
import { wikiUrl } from "@/lib/app-config";

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

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await prisma.note.findUniqueOrThrow({
    where: { id },
    include: { projects: { include: { project: true } } },
  });

  return (
    <article className="mx-auto grid max-w-4xl gap-5">
      <div>
        <p className="ui-eyebrow">项目记录</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
          {note.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">
          这是项目记录，用来承接任务处理摘要、背景线索和复盘内容。长期资料请继续沉淀到记忆库。
        </p>
      </div>

      <div className="rounded-[1.75rem] border border-[var(--waiting)] bg-[var(--waiting-soft)] p-4 text-sm leading-6 text-[var(--waiting)]">
        长期知识入口：{" "}
        <a
          href={wikiUrl("/notes")}
          target="_blank"
          rel="noreferrer"
          className="font-bold underline"
        >
          打开记忆库
        </a>
      </div>

      <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1">
            更新于 {formatDateTime(note.updatedAt)}
          </span>
          {note.projects.map((item) => (
            <span
              key={item.projectId}
              className="rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-1 font-semibold text-[var(--brand-strong)]"
            >
              项目：{item.project.name}
            </span>
          ))}
          {note.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1"
            >
              #{tag}
            </span>
          ))}
          {note.concepts.map((concept) => (
            <span
              key={concept}
              className="rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-1 text-[var(--brand-strong)]"
            >
              {concept}
            </span>
          ))}
        </div>

        <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-muted)]">
          {note.body}
        </div>

      </section>
    </article>
  );
}
