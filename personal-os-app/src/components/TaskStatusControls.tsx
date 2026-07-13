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
  { status: "todo", label: "标回今日" },
  { status: "waiting", label: "等待" },
  { status: "blocked", label: "卡住" },
] as const;

export function TaskStatusControls({
  taskId,
  status,
  compact = false,
}: TaskStatusControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const isDone = status === "done";

  async function patchStatus(nextStatus: string) {
    setPending(nextStatus);
    setError(null);
    setConfirmArchive(false);
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
            "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50",
            isDone
              ? "border-zinc-200 bg-white text-zinc-600"
              : "border-emerald-700 bg-emerald-700 text-white",
          )}
        >
          <span
            className={clsx(
              "grid size-3 place-items-center rounded border text-[9px] leading-none",
              isDone
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-white",
            )}
          >
            {isDone ? "✓" : ""}
          </span>
          {isDone ? "标回今日" : "完成"}
        </button>
        {error ? <span className="text-xs text-rose-600">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-xs font-semibold text-zinc-500">人工改状态</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          type="button"
          disabled={pending !== null || isDone}
          onClick={() => patchStatus("done")}
          className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-white disabled:opacity-50"
        >
          勾选完成
        </button>
        {statusActions.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={pending !== null || status === action.status}
            onClick={() => patchStatus(action.status)}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-700 disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
        {confirmArchive ? (
          <>
            <span className="flex items-center text-zinc-500">确认归档？</span>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => patchStatus("archived")}
              className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-rose-700 disabled:opacity-50"
            >
              确认归档
            </button>
            <button
              type="button"
              onClick={() => setConfirmArchive(false)}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-500"
            >
              取消
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending !== null || status === "archived"}
            onClick={() => setConfirmArchive(true)}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-700 disabled:opacity-50"
          >
            忽略
          </button>
        )}
      </div>
      <div className="mt-2 text-xs text-zinc-500">
        当前：{formatTaskStatus(status)}
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
