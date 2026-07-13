"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState } from "react";

type IdeaActionControlsProps = {
  ideaId: string;
  status: string;
  compact?: boolean;
};

const statusActions = [
  { status: "shaping", label: "打磨一下" },
  { status: "someday", label: "以后再看" },
  { status: "archived", label: "忽略" },
] as const;

export function IdeaActionControls({
  ideaId,
  status,
  compact = false,
}: IdeaActionControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchStatus(nextStatus: string) {
    setPending(nextStatus);
    setError(null);
    try {
      const response = await fetch(`/api/ideas/${ideaId}`, {
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

  async function promote() {
    setPending("promote");
    setError(null);
    try {
      const response = await fetch(`/api/ideas/${ideaId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      router.refresh();
    } catch {
      setError("转任务失败，稍后再试。");
    } finally {
      setPending(null);
    }
  }

  if (status === "promoted") {
    return (
      <div className="text-xs font-semibold text-emerald-700">
        已经转成任务
      </div>
    );
  }

  return (
    <div className={clsx("flex flex-wrap items-center gap-2", compact && "text-xs")}>
      <button
        type="button"
        disabled={pending !== null}
        onClick={promote}
        className="rounded-lg bg-zinc-950 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        转成任务
      </button>
      {statusActions.map((action) => (
        <button
          key={action.status}
          type="button"
          disabled={pending !== null || status === action.status}
          onClick={() => patchStatus(action.status)}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-50"
        >
          {action.label}
        </button>
      ))}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  );
}
