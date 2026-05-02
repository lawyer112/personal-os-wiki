"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPriority } from "@/lib/task-labels";
import type { TaskView } from "@/lib/view-models";

type ReviewDecision = "approve" | "request_changes" | "reject" | "block";

const decisionLabel: Record<ReviewDecision, string> = {
  approve: "通过",
  request_changes: "要求修改",
  reject: "驳回",
  block: "阻塞",
};

export function ExecutionReviewTaskCard({ task }: { task: TaskView }) {
  const router = useRouter();
  const [pendingDecision, setPendingDecision] = useState<ReviewDecision | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const latestRun = task.runs?.[0];
  const latestContribution = task.contributions?.[0];

  async function review(decision: ReviewDecision) {
    setPendingDecision(decision);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${task.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer: "user",
          decision,
          comment: decisionLabel[decision],
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      router.refresh();
    } catch {
      setError("复核失败，稍后再试。");
    } finally {
      setPendingDecision(null);
    }
  }

  return (
    <article className="rounded-lg border border-blue-200 bg-blue-50 p-3 transition hover:border-blue-400">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/tasks/${task.id}`}
            className="text-sm font-semibold leading-5 text-zinc-950 hover:underline"
          >
            {task.title}
          </Link>
          <p className="mt-1 text-xs text-blue-700">
            {latestRun?.agentId ?? task.ownerAgent ?? "agent"} 提交复核 /{" "}
            {formatPriority(task.priority)}
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-700">
          待复核
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm leading-5">
        <div>
          <div className="text-[11px] font-semibold text-blue-700">提交摘要</div>
          <p className="mt-0.5 text-zinc-700">
            {latestContribution?.summary ??
              latestRun?.resultSummary ??
              "这次提交还没有摘要。"}
          </p>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-blue-700">
            验收标准
          </div>
          <p className="mt-0.5 text-zinc-700">{task.definitionOfDone}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => review("approve")}
          className="rounded-lg bg-blue-700 px-2.5 py-1.5 text-white disabled:opacity-50"
        >
          通过
        </button>
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => review("request_changes")}
          className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-blue-700 disabled:opacity-50"
        >
          要求修改
        </button>
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => review("reject")}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-zinc-700 disabled:opacity-50"
        >
          驳回
        </button>
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => review("block")}
          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-rose-700 disabled:opacity-50"
        >
          阻塞
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </article>
  );
}
