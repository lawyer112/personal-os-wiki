import Link from "next/link";
import clsx from "clsx";
import { TaskStatusControls } from "@/components/TaskStatusControls";
import { formatPriority, formatTaskStatus } from "@/lib/task-labels";
import type { TaskView } from "@/lib/view-models";

type TaskCardProps = {
  task: TaskView;
  tone?: "active" | "review" | "waiting" | "blocked" | "done";
};

const toneClass = {
  active: "border-[var(--brand)] bg-[var(--surface)] shadow-[inset_4px_0_0_var(--brand)]",
  review: "border-[var(--review)] bg-[var(--review-soft)]",
  waiting: "border-[var(--waiting)] bg-[var(--waiting-soft)]",
  blocked: "border-[var(--blocked)] bg-[var(--blocked-soft)]",
  done: "border-[var(--done-soft)] bg-[var(--done-soft)] opacity-80",
};

const sectionLabelClass = "text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]";

export function TaskCard({ task, tone = "review" }: TaskCardProps) {
  const goalText =
    task.description ??
    task.sourceAgentRun?.outputSummary ??
    "还没有写清楚今天为什么要做它。";

  return (
    <article
      className={clsx(
        "rounded-2xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]",
        toneClass[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/tasks/${task.id}`}
          className={clsx(
            "min-w-0 text-sm font-bold leading-5 text-[var(--ink)] hover:text-[var(--brand-strong)]",
            tone === "done" && "line-through",
          )}
        >
          {task.title}
        </Link>
        <span className="shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)]">
          {formatPriority(task.priority)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm leading-5">
        <div>
          <div className={sectionLabelClass}>今日目标</div>
          <p className="mt-1 text-[var(--ink-muted)]">{goalText}</p>
        </div>
        <div>
          <div className={sectionLabelClass}>下一步</div>
          <p className="mt-1 text-[var(--ink)]">{task.nextAction}</p>
        </div>
        <div>
          <div className={sectionLabelClass}>完成标准</div>
          <p className="mt-1 text-[var(--ink-muted)]">{task.definitionOfDone}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {task.project?.name ? (
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--brand-soft)] px-2.5 py-1 font-semibold text-[var(--brand-strong)]">
            {task.project.name}
          </span>
        ) : null}
        {task.estimateMinutes ? (
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-[var(--ink-muted)]">
            约 {task.estimateMinutes} 分钟
          </span>
        ) : null}
        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-2.5 py-1 text-[var(--ink-muted)]">
          {formatTaskStatus(task.status)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-3">
        <TaskStatusControls taskId={task.id} status={task.status} compact />
        <Link
          href={`/tasks/${task.id}`}
          className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-muted)] hover:border-[var(--border-strong)] hover:text-[var(--ink)]"
        >
          调整内容
        </Link>
      </div>
    </article>
  );
}
