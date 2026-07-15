"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPriority, formatTaskStatus } from "@/lib/task-labels";
import type { TaskView } from "@/lib/view-models";

export function ReviewTaskCard({ task }: { task: TaskView }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const goalText =
    task.description ??
    task.sourceAgentRun?.reasoningSummary ??
    "这条输入可能需要转为任务，请确认是否继续推进。";

  async function updateStatus(status: "todo" | "waiting" | "archived") {
    setPendingAction(status);
    setError(null);
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
    <article className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-3.5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/tasks/${task.id}`}
            className="text-sm font-bold leading-5 text-[var(--ink)] hover:text-[var(--brand-strong)]"
          >
            {task.title}
          </Link>
          <p className="mt-1 text-xs font-semibold text-[var(--ink-muted)]">
            {formatTaskStatus(task.status)} · {formatPriority(task.priority)}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--waiting)] bg-[var(--waiting-soft)] px-2.5 py-1 text-xs font-bold text-[var(--waiting)]">
          待决定
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm leading-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--waiting)]">
            建议动作
          </div>
          <p className="mt-1 text-[var(--ink-muted)]">{goalText}</p>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--waiting)]">
            建议下一步
          </div>
          <p className="mt-1 text-[var(--ink-muted)]">{task.nextAction}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => updateStatus("todo")}
          className="rounded-full bg-[var(--brand-strong)] px-3 py-1.5 text-white disabled:opacity-50"
        >
          收进今日
        </button>
        <Link
          href={`/tasks/${task.id}`}
          className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink-muted)] hover:bg-[var(--app-bg-soft)]"
        >
          修改任务
        </Link>
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => updateStatus("waiting")}
          className="rounded-full border border-[var(--waiting)] bg-[var(--surface)] px-3 py-1.5 text-[var(--waiting)] disabled:opacity-50"
        >
          转为等待
        </button>
        <button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => updateStatus("archived")}
          className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink-soft)] disabled:opacity-50"
        >
          忽略
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-[var(--blocked)]">{error}</p> : null}
    </article>
  );
}
