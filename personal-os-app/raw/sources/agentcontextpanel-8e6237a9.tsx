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
    ok: "已检索",
    empty: "无命中",
    partial: "部分可用",
    unavailable: "Wiki 不可用",
  }[status];
  const candidates = loadedContext?.wiki.candidates ?? [];
  const searchQueries = loadedContext?.searchQueries ?? [];
  const relatedIdeas = loadedContext?.relatedIdeas ?? [];
  const failedCount = loadedContext?.wiki.failedQueries.length ?? 0;

  return (
    <section className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-emerald-950">
            相关资料
          </h3>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            系统按任务内容找出的可能相关资料，Hermes 执行前会再判断取舍。
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-700">
          {loadState === "loading" ? "检索中" : `${statusText} · ${candidates.length} 条`}
        </span>
      </div>

      {searchQueries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {searchQueries.map((query) => (
            <span
              key={query}
              className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-emerald-700"
            >
              {query}
            </span>
          ))}
        </div>
      ) : null}

      {relatedIdeas.length > 0 ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3">
          <div className="text-xs font-semibold text-emerald-900">
            相关想法
          </div>
          <div className="mt-2 grid gap-2">
            {relatedIdeas.slice(0, 3).map((idea) => (
              <Link
                key={idea.id}
                href="/ideas"
                className="rounded-lg bg-emerald-50 px-2 py-1.5 text-xs leading-5 text-emerald-900"
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
          <div className="rounded-lg border border-dashed border-emerald-300 bg-white px-3 py-4 text-sm text-emerald-800">
            正在检索 Wiki 候选，任务详情可以先看。
          </div>
        ) : loadState === "error" ? (
          <div className="rounded-lg border border-dashed border-amber-300 bg-white px-3 py-4 text-sm text-amber-800">
            上下文暂时取不到，不影响你人工处理这个任务。
          </div>
        ) : candidates.length > 0 ? (
          candidates.slice(0, 5).map((note) => (
            <a
              key={note.path}
              href={note.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-emerald-200 bg-white p-3 hover:bg-emerald-50"
            >
              <div className="text-sm font-semibold leading-5 text-zinc-950">
                {note.title}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600">
                {note.excerpt ?? note.path}
              </p>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-zinc-500">
                <span className="rounded-lg bg-zinc-100 px-1.5 py-0.5">
                  相关度 {note.score}
                </span>
                {note.source_type ? (
                  <span className="rounded-lg bg-zinc-100 px-1.5 py-0.5">
                    {formatSourceType(note.source_type)}
                  </span>
                ) : null}
                {note.matchedQueries.slice(0, 3).map((query) => (
                  <span
                    key={query}
                    className="rounded-lg bg-emerald-50 px-1.5 py-0.5 text-emerald-700"
                  >
                    命中：{query}
                  </span>
                ))}
                {(note.concepts ?? []).slice(0, 3).map((concept) => (
                  <span key={concept}>[[{concept}]]</span>
                ))}
              </div>
            </a>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-emerald-300 bg-white px-3 py-4 text-sm text-emerald-800">
            {status === "empty"
              ? "Wiki 正常，但没有命中相关候选。Hermes 可以换关键词再查。"
              : "Wiki 暂时不可用。Hermes 应稍后重试或先按任务字段处理。"}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-lg bg-white p-2 text-xs leading-5 text-emerald-800">
        规则：可以读取和建议更新知识；删除和自动归档必须确认。
        {failedCount > 0 ? ` 有 ${failedCount} 个查询失败，结果只能当部分上下文。` : ""}
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
