import Link from "next/link";
import { personalOsUrl, personalWikiUrl, wikiOpenUrl } from "@/lib/app-config";
import { wikiClient } from "@/lib/wiki-client";

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

export default async function WikiPage() {
  const [health, recentNotes] = await Promise.all([
    getWikiHealth(),
    getRecentNotes(),
  ]);
  const isHealthy = health.status === "ok";

  return (
    <section>
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">知识库</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">
            给你和 Hermes 共用的资料库
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            链接、文件、语音转写和长期资料都沉淀到这里。任务执行前，
            Hermes 会从知识库取相关资料；你也可以直接打开笔记阅读和修正。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <a
            href={wikiOpenUrl("/")}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-700 px-3 py-2 text-white"
          >
            打开知识库
          </a>
          <a
            href={wikiOpenUrl("/notes")}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-700"
          >
            全部笔记
          </a>
          <Link
            href="/ideas"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-700"
          >
            想法池
          </Link>
          <Link
            href="/tasks"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-700"
          >
            全部任务
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="grid gap-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-base font-bold text-zinc-950">连接状态</h2>
            <div className="mt-3 rounded-lg bg-zinc-50 p-3">
              <div className="text-sm font-semibold text-zinc-950">
                {isHealthy ? "知识库正常" : "知识库暂时不可用"}
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {isHealthy
                  ? `当前可检索 ${health.notes ?? 0} 篇笔记。`
                  : "检查 Personal Wiki 服务、网络或 token 配置。"}
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <h2 className="text-base font-bold text-zinc-950">Hermes 当前用法</h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-zinc-600">
              <p>默认把资料、任务和项目进展交给一个入口处理。</p>
              <code className="block break-all rounded-lg bg-zinc-50 p-2 text-xs text-zinc-500">
                POST {personalOsUrl.replace(/\/$/, "")}/api/intake
              </code>
              <p>
                执行任务前读取任务上下文和相关知识。
              </p>
              <code className="block break-all rounded-lg bg-zinc-50 p-2 text-xs text-zinc-500">
                GET {personalOsUrl.replace(/\/$/, "")}/api/agent/context?taskId=...
              </code>
              <p>
                主动提醒由 Hermes 或 OpenClaw 定时拉取，再发到 Telegram。
              </p>
              <code className="block break-all rounded-lg bg-zinc-50 p-2 text-xs text-zinc-500">
                GET {personalOsUrl.replace(/\/$/, "")}/api/reminders/today?mode=checkin
              </code>
              <p>
                真正的每日规划读取任务、想法、项目和 Wiki 候选，再交给 Hermes 判断。
              </p>
              <code className="block break-all rounded-lg bg-zinc-50 p-2 text-xs text-zinc-500">
                GET {personalOsUrl.replace(/\/$/, "")}/api/planner/today?mode=morning
              </code>
            </div>
          </section>
        </aside>

        <div className="grid gap-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-zinc-950">最近入库</h2>
              <a
                href={wikiOpenUrl("/notes")}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-emerald-700"
              >
                查看全部
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
                    className="rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50"
                  >
                    <div className="font-semibold text-zinc-950">{note.title}</div>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600">
                      {note.excerpt ?? "这篇笔记还没有摘要。"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1 text-xs text-zinc-500">
                      {(note.tags ?? []).slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-lg bg-zinc-100 px-2 py-1">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-sm text-zinc-500">
                  还没有拿到最近笔记。确认知识库服务正常后再刷新。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-base font-bold text-amber-950">整理规则</h2>
            <div className="mt-2 grid gap-2 text-sm leading-6 text-amber-900">
              <p>资料和长期知识进入知识库；还没成形的灵感先进入想法池。</p>
              <p>行动、等待和阻塞进入今日任务；想法成熟后一键转成任务。</p>
              <p>一条输入同时包含资料和行动时，知识库保存背景，任务绑定相关笔记。</p>
              <p>项目里的“项目记录”只放处理摘要，不替代长期知识库。</p>
            </div>
          </section>
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        当前知识库地址：{personalWikiUrl}
      </p>
    </section>
  );
}

async function getWikiHealth(): Promise<WikiHealth> {
  try {
    const result = await wikiClient.read<WikiHealth>("/api/health");
    if (!result.ok) {
      return {};
    }
    return result.body ?? {};
  } catch {
    return {};
  }
}

async function getRecentNotes(): Promise<WikiNote[]> {
  try {
    const result = await wikiClient.read<{ notes?: WikiNote[] }>(
      "/api/notes?page_size=5",
    );
    if (!result.ok) {
      return [];
    }
    return result.body?.notes ?? [];
  } catch {
    return [];
  }
}
