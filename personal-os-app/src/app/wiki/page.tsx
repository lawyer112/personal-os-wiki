import Link from "next/link";
import { wikiOpenUrl, wikiUrl } from "@/lib/app-config";

type WikiHealth = {
  status?: string;
  notes?: number;
};

type WikiNote = {
  title: string;
  path: string;
  excerpt?: string;
  tags?: string[];
};

export const dynamic = "force-dynamic";

function readableTitle(note: WikiNote) {
  const fallback = note.path
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.md$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  return note.title?.trim() || fallback || "未命名资料";
}

export default async function WikiPage() {
  const [health, recentNotes] = await Promise.all([
    getWikiHealth(),
    getRecentNotes(),
  ]);
  const isHealthy = health.status === "ok";

  return (
    <section className="grid gap-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="ui-eyebrow">记忆</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
            记忆
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
            这里只看可复用的资料和整理状态，不展示文件系统和后台配置。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <a
            href={wikiOpenUrl("/")}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[var(--brand-strong)] px-4 py-2 text-white"
          >
            打开完整资料库
          </a>
          <Link
            href="/notes"
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-[var(--ink-muted)] hover:border-[var(--border-strong)]"
          >
            项目记录
          </Link>
          <Link
            href="/capture"
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 text-[var(--ink-muted)] hover:border-[var(--border-strong)]"
          >
            收集新资料
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="grid gap-4">
          <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold text-[var(--ink)]">资料状态</h2>
            <div className="mt-3 rounded-2xl bg-[var(--surface-muted)] p-3">
              <div className="text-sm font-bold text-[var(--ink)]">
                {isHealthy ? "可以使用" : "暂时不可用"}
              </div>
              <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
                {isHealthy
                  ? `现在有 ${health.notes ?? 0} 条资料可检索。`
                  : "资料库服务没有响应，稍后再看。"}
              </p>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[var(--waiting)] bg-[var(--waiting-soft)] p-4">
            <h2 className="text-base font-bold text-[var(--waiting)]">整理口径</h2>
            <div className="mt-2 grid gap-2 text-sm leading-6 text-[var(--waiting)]">
              <p>能复用的背景、资料、方法，进入记忆。</p>
              <p>需要行动的内容，进入推进。</p>
              <p>还没想清楚的内容，先放收集箱。</p>
            </div>
          </section>
        </aside>

        <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">最近可用资料</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                看标题和摘要，不看文件名。
              </p>
            </div>
            <a
              href={wikiOpenUrl("/notes")}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-bold text-[var(--brand-strong)]"
            >
              全部资料
            </a>
          </div>
          <div className="mt-3 grid gap-3">
            {recentNotes.length > 0 ? (
              recentNotes.map((note) => (
                <a
                  key={note.path}
                  href={wikiOpenUrl(`/note?path=${encodeURIComponent(note.path)}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--app-bg-soft)] p-3 hover:bg-[var(--surface-muted)]"
                >
                  <div className="font-bold text-[var(--ink)]">{readableTitle(note)}</div>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--ink-muted)]">
                    {note.excerpt ?? "这条资料还没有整理出摘要。"}
                  </p>
                  {(note.tags ?? []).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1 text-xs text-[var(--ink-muted)]">
                      {(note.tags ?? []).slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </a>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-6 text-sm text-[var(--ink-muted)]">
                暂时没有拿到最近资料。
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

async function getWikiHealth(): Promise<WikiHealth> {
  try {
    const response = await fetch(wikiUrl("/api/health"), { cache: "no-store" });
    if (!response.ok) {
      return {};
    }
    return (await response.json()) as WikiHealth;
  } catch {
    return {};
  }
}

async function getRecentNotes(): Promise<WikiNote[]> {
  try {
    const token = process.env.WIKI_READ_TOKEN;
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(wikiUrl("/api/notes?page_size=5"), {
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }
    const body = (await response.json()) as { notes?: WikiNote[] };
    return body.notes ?? [];
  } catch {
    return [];
  }
}
