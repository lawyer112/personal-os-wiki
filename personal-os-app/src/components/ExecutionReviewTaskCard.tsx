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
  const evidenceLinks = latestContribution?.evidenceLinks ?? [];
  const artifactUrls = Array.from(
    new Set([
      ...(latestContribution?.artifactUrls ?? []),
      ...(task.artifacts?.map((artifact) => artifact.url) ?? []),
    ]),
  );

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
    <article className="rounded-2xl border border-[var(--review)] bg-[var(--review-soft)] p-3.5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/tasks/${task.id}`}
            className="text-sm font-bold leading-5 text-[var(--ink)] hover:text-[var(--review)]"
          >
            {task.title}
          </Link>
          <p className="mt-1 text-xs font-semibold text-[var(--review)]">
            提交复核 / {formatPriority(task.priority)}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--review)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--review)]">
          待复核
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm leading-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--review)]">提交摘要</div>
          <p className="mt-1 text-[var(--ink-muted)]">
            {latestContribution?.summary ??
              latestRun?.resultSummary ??
              "这次提交还没有摘要。"}
          </p>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--review)]">
            验收标准
          </div>
          <p className="mt-1 text-[var(--ink-muted)]">{task.definitionOfDone}</p>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--review)]">
            证据与产物
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            {evidenceLinks.length || artifactUrls.length ? (
              <>
                {evidenceLinks.map((link) => (
                  <a
                    key={`evidence-${link}`}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--review)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--review)] hover:bg-white"
                  >
                    证据
                  </a>
                ))}
                {artifactUrls.map((url) => (
                  <a
                    key={`artifact-${url}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--review)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--review)] hover:bg-white"
                  >
                    产物
                  </a>
                ))}
              </>
            ) : (
              <span className="text-[var(--ink-muted)]">没有附带证据或产物链接。</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => review("approve")}
          className="rounded-full bg-[var(--review)] px-3 py-1.5 text-white disabled:opacity-50"
        >
          通过
        </button>
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => review("request_changes")}
          className="rounded-full border border-[var(--review)] bg-[var(--surface)] px-3 py-1.5 text-[var(--review)] disabled:opacity-50"
        >
          要求修改
        </button>
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => review("reject")}
          className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-[var(--ink-muted)] disabled:opacity-50"
        >
          驳回
        </button>
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => review("block")}
          className="rounded-full border border-[var(--blocked)] bg-[var(--surface)] px-3 py-1.5 text-[var(--blocked)] disabled:opacity-50"
        >
          阻塞
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-[var(--blocked)]">{error}</p> : null}
    </article>
  );
}
