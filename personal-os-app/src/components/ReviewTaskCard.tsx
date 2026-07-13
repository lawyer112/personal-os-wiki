"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AgentOwnerBadge } from "@/components/AgentOwnerBadge";
import { formatPriority, formatTaskStatus } from "@/lib/task-labels";
import type { TaskView } from "@/lib/view-models";

export function ReviewTaskCard({ task }: { task: TaskView }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const goalText =
    task.description ??
    task.sourceAgentRun?.reasoningSummary ??
    "Hermes 认为它像任务，但需要你确认是否真的要推进。";

  async function updateStatus(status: "todo" | "waiting" | "archived") {
    setPendingAction(status);
    setError(null);
    setConfirmArchive(false);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      router.refresh();
    } catch {
      setError("操作失败，稍后再试。");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-3 transition hover:border-zinc-400">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/tasks/${task.id}`}
            className="text-sm font-semibold leading-5 text-zinc-950 hover:underline"
          >
            {task.title}
          </Link>
          <p className="mt-1 text-xs text-zinc-500">
            {formatTaskStatus(task.status)} · {formatPriority(task.priority)}
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
          待决定
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <AgentOwnerBadge
          ownerAgent={task.ownerAgent}
          leaseUntil={task.leaseUntil}
          lastHeartbeatAt={task.lastHeartbeatAt}
          executionMode={task.executionMode}
        />
      </div>

      <div className="mt-3 grid gap-2 text-sm leading-5">
        <div>
          <div className="text-[11px] font-semibold text-zinc-500">
            建议动作
          </div>
          <p className="mt-0.5 text-zinc-700">{goalText}</p>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-zinc-500">
            建议下一步
          </div>
          <p className="mt-0.5 text-zinc-700">{task.nextAction}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => updateStatus("todo")}
          className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-white disabled:opacity-50"
        >
          收进今日
        </button>
        <Link
          href={`/tasks/${task.id}`}
          className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-zinc-700 hover:bg-zinc-50"
        >
          修改任务
        </Link>
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => updateStatus("waiting")}
          className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-zinc-700 disabled:opacity-50"
        >
          转为等待
        </button>
        {confirmArchive ? (
          <>
            <span className="flex items-center text-zinc-500">确定忽略此任务？</span>
            <button
              type="button"
              disabled={pendingAction !== null}
              onClick={() => updateStatus("archived")}
              className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-rose-700 disabled:opacity-50"
            >
              确认忽略
            </button>
            <button
              type="button"
              onClick={() => setConfirmArchive(false)}
              className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-zinc-500"
            >
              取消
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pendingAction !== null}
            onClick={() => setConfirmArchive(true)}
            className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-zinc-500 disabled:opacity-50"
          >
            忽略
          </button>
        )}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </article>
  );
}
