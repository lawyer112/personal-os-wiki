"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatTaskStatus } from "@/lib/task-labels";

type TaskStatusControlsProps = {
  taskId: string;
  status: string;
  compact?: boolean;
};

const statusActions = [
  { status: "todo", label: "移回今日" },
  { status: "waiting", label: "等待" },
  { status: "blocked", label: "受阻" },
  { status: "archived", label: "归档" },
] as const;

export function TaskStatusControls({
  taskId,
  status,
  compact = false,
}: TaskStatusControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDone = status === "done";

  async function patchStatus(nextStatus: string) {
    setPending(nextStatus);
    setError(null);
    try {
      const response =
        nextStatus === "done"
          ? await fetch(`/api/tasks/${taskId}/complete`, { method: "POST" })
          : await fetch(`/api/tasks/${taskId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: nextStatus }),
            });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      router.refresh();
    } catch {
      setError("操作失败，稍后再试。");
    } finally {
      setPending(null);
    }
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => patchStatus(isDone ? "todo" : "done")}
          className={clsx(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50",
            isDone
              ? "border-[var(--border-soft)] bg-[var(--surface)] text-[var(--ink-muted)]"
              : "border-[var(--brand-strong)] bg-[var(--brand-strong)] text-white",
          )}
        >
          <span
            className={clsx(
              "grid size-3 place-items-center rounded border text-[9px] leading-none",
              isDone
                ? "border-[var(--brand-strong)] bg-[var(--brand-strong)] text-white"
                : "border-white",
            )}
          >
            {isDone ? "✓" : ""}
          </span>
          {isDone ? "移回今日" : "完成"}
        </button>
        {error ? <span className="text-xs text-[var(--blocked)]">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--ink-soft)]">调整状态</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          type="button"
          disabled={pending !== null || isDone}
          onClick={() => patchStatus("done")}
          className="rounded-full bg-[var(--brand-strong)] px-3 py-1.5 text-white disabled:opacity-50"
        >
          勾选完成
        </button>
        {statusActions.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={pending !== null || status === action.status}
            onClick={() => patchStatus(action.status)}
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink-muted)] disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="mt-2 text-xs text-[var(--ink-muted)]">
        当前：{formatTaskStatus(status)}
      </div>
      {error ? <p className="mt-2 text-xs text-[var(--blocked)]">{error}</p> : null}
    </div>
  );
}
