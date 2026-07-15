import Link from "next/link";
import { prisma } from "@/lib/db";

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

export default async function NotesPage() {
  const [notes, totalCount] = await Promise.all([
    prisma.note.findMany({
      orderBy: { updatedAt: "desc" },
      include: { projects: { include: { project: true } } },
      take: 8,
    }),
    prisma.note.count(),
  ]);

  const linkedProjectCount = notes.filter((note) => note.projects.length > 0).length;

  return (
    <section className="grid gap-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="ui-eyebrow">记忆</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
            项目记忆
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
            这里不是文件列表。只保留项目推进中留下来的判断、背景和复盘线索。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link
            href="/wiki"
            className="rounded-full bg-[var(--brand-strong)] px-4 py-2 text-white"
          >
            看长期记忆
          </Link>
          <Link
            href="/projects"
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-[var(--ink-muted)] hover:border-[var(--border-strong)]"
          >
            回到项目
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid gap-4 self-start">
          <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold text-[var(--ink)]">当前只看重点</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-[var(--surface-muted)] px-3 py-3">
                <div className="text-xl font-bold text-[var(--ink)]">{totalCount}</div>
                <div className="mt-0.5 text-[var(--ink-muted)]">全部记录</div>
              </div>
              <div className="rounded-2xl bg-[var(--surface-muted)] px-3 py-3">
                <div className="text-xl font-bold text-[var(--ink)]">{linkedProjectCount}</div>
                <div className="mt-0.5 text-[var(--ink-muted)]">最近关联</div>
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[var(--waiting)] bg-[var(--waiting-soft)] p-4 text-sm leading-6 text-[var(--waiting)]">
            <h2 className="text-base font-bold">放这里的内容</h2>
            <p className="mt-2">项目推进后的判断、复盘、背景线索。</p>
            <p className="mt-2">原始资料和长期知识，放到记忆库。</p>
          </section>
        </aside>

        <div className="grid gap-3">
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-[var(--ink)]">{note.title}</div>
                  <div className="mt-1 text-xs text-[var(--ink-soft)]">
                    最近整理 {formatDateTime(note.updatedAt)}
                  </div>
                </div>
                {note.projects.length > 0 ? (
                  <span className="shrink-0 rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-1 text-xs font-bold text-[var(--brand-strong)]">
                    项目相关
                  </span>
                ) : null}
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--ink-muted)]">
                {note.body}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {note.projects.slice(0, 2).map((item) => (
                  <span
                    key={item.projectId}
                    className="rounded-full border border-[var(--brand)] bg-[var(--brand-soft)] px-2.5 py-1 font-semibold text-[var(--brand-strong)]"
                  >
                    {item.project.name}
                  </span>
                ))}
                {note.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-[var(--ink-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
