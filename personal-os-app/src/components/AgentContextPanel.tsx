"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AgentContextPack } from "@/lib/agent-context";
import { formatIdeaStatus } from "@/lib/task-labels";

export function AgentContextPanel({
  context,
  taskId,
}: {
  context?: AgentContextPack | null;
  taskId?: string;
}) {
  const [asyncState, setAsyncState] = useState<{
    taskId?: string;
    context: AgentContextPack | null;
    loadState: "idle" | "loading" | "error";
  }>({
    taskId,
    context: null,
    loadState: taskId && !context ? "loading" : "idle",
  });

  useEffect(() => {
    if (context || !taskId) {
      return;
    }

    let isActive = true;

    fetch(`/api/agent/context?taskId=${encodeURIComponent(taskId)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json() as Promise<{
          ok: boolean;
          context: AgentContextPack;
        }>;
      })
      .then((body) => {
        if (isActive && body.ok) {
          setAsyncState({
            taskId,
            context: body.context,
            loadState: "idle",
          });
        }
      })
      .catch(() => {
        if (isActive) {
          setAsyncState({
            taskId,
            context: null,
            loadState: "error",
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [context, taskId]);

  const loadedContext =
    context ?? (asyncState.taskId === taskId ? asyncState.context : null);
  const loadState =
    context || loadedContext
      ? "idle"
      : asyncState.taskId === taskId
        ? asyncState.loadState
        : taskId
          ? "loading"
          : "idle";

  if (!loadedContext && !taskId) {
    return null;
  }

  const status = loadedContext?.wiki.status ?? "unavailable";
  const statusText = {
    ok: "已找到资料",
    empty: "暂无匹配",
    partial: "部分可用",
    unavailable: "资料暂不可用",
  }[status];
  const candidates = loadedContext?.wiki.candidates ?? [];
  const searchQueries = loadedContext?.searchQueries ?? [];
  const relatedIdeas = loadedContext?.relatedIdeas ?? [];
  const failedCount = loadedContext?.wiki.failedQueries.length ?? 0;

  return (
    <section className="mt-4 rounded-2xl border border-[var(--brand)] bg-[var(--brand-soft)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--brand-strong)]">
            相关资料
          </h3>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
            按当前任务找出的相关资料，可作为整理和复核依据。
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--brand)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--brand-strong)]">
          {loadState === "loading" ? "检索中" : `${statusText} · ${candidates.length} 条`}
        </span>
      </div>

      {searchQueries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {searchQueries.map((query) => (
            <span
              key={query}
              className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-[var(--brand-strong)]"
            >
              {query}
            </span>
          ))}
        </div>
      ) : null}

      {relatedIdeas.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
            相关想法
          </div>
          <div className="mt-2 grid gap-2">
            {relatedIdeas.slice(0, 3).map((idea) => (
              <Link
                key={idea.id}
                href="/ideas"
                className="rounded-2xl bg-[var(--surface-muted)] px-2 py-1.5 text-xs leading-5 text-[var(--ink-muted)]"
              >
                {idea.title} · {formatIdeaStatus(idea.status)}
                {idea.nextAction ? ` · 下一步：${idea.nextAction}` : ""}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2">
        {loadState === "loading" ? (
          <div className="rounded-2xl border border-dashed border-[var(--brand)] bg-[var(--surface)] px-3 py-4 text-sm text-[var(--brand-strong)]">
            正在查找相关资料，任务详情可以先看。
          </div>
        ) : loadState === "error" ? (
          <div className="rounded-2xl border border-dashed border-[var(--waiting)] bg-[var(--surface)] px-3 py-4 text-sm text-[var(--waiting)]">
            相关资料暂时取不到，不影响继续处理这个任务。
          </div>
        ) : candidates.length > 0 ? (
          candidates.slice(0, 5).map((note) => (
            <a
              key={note.path}
              href={note.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3 hover:bg-white"
            >
              <div className="text-sm font-semibold leading-5 text-[var(--ink)]">
                {note.title}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
                {note.excerpt ?? note.path}
              </p>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-[var(--ink-soft)]">
                <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5">
                  相关度 {note.score}
                </span>
                {note.source_type ? (
                  <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5">
                    {formatSourceType(note.source_type)}
                  </span>
                ) : null}
                {note.matchedQueries.slice(0, 3).map((query) => (
                  <span
                    key={query}
                    className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[var(--brand-strong)]"
                  >
                    命中：{query}
                  </span>
                ))}
                {(note.concepts ?? []).slice(0, 3).map((concept) => (
                  <span key={concept}>{concept}</span>
                ))}
              </div>
            </a>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--brand)] bg-[var(--surface)] px-3 py-4 text-sm text-[var(--brand-strong)]">
            {status === "empty"
              ? "资料检索正常，但暂时没有找到可用内容。可以换关键词再查。"
              : "相关资料暂时不可用。可以稍后重试，或先按任务信息继续处理。"}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-2xl bg-[var(--surface)] p-2 text-xs leading-5 text-[var(--ink-muted)]">
        规则：可以读取和建议更新知识；删除和自动归档必须确认。
        {failedCount > 0 ? ` 有 ${failedCount} 次查询失败，结果只能作为部分参考。` : ""}
      </div>
    </section>
  );
}

function formatSourceType(sourceType: string) {
  const labels: Record<string, string> = {
    telegram: "Telegram",
    link: "链接",
    file: "文件",
    "voice-transcript": "语音转写",
    manual: "手动整理",
    inbox: "输入",
  };
  return labels[sourceType] ?? sourceType;
}
