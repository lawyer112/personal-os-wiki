import Link from "next/link";
import clsx from "clsx";
import { TaskStatusControls } from "@/components/TaskStatusControls";
import { AgentOwnerBadge } from "@/components/AgentOwnerBadge";
import { formatPriority, formatTaskStatus } from "@/lib/task-labels";
import type { TaskView } from "@/lib/view-models";

type TaskCardProps = {
  task: TaskView;
  tone?: "active" | "review" | "waiting" | "blocked" | "done";
};

const toneClass = {
  active: "border-emerald-300 bg-white shadow-[inset_4px_0_0_#059669]",
  review: "border-zinc-200 bg-white",
  waiting: "border-amber-300 bg-amber-50",
  blocked: "border-rose-300 bg-rose-50",
  done: "border-zinc-200 bg-zinc-50 opacity-80",
};

const sectionLabelClass = "text-[11px] font-semibold text-zinc-500";

export function TaskCard({ task, tone = "review" }: TaskCardProps) {
  const goalText =
    task.description ??
    task.sourceAgentRun?.outputSummary ??
    "还没有写清楚今天为什么要做它。";

  return (
    <article
      className={clsx(
        "rounded-lg border p-3 transition hover:border-zinc-400 hover:bg-white",
        toneClass[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/tasks/${task.id}`}
          className={clsx(
            "min-w-0 text-sm font-semibold leading-5 text-zinc-950 hover:underline",
            tone === "done" && "line-through",
          )}
        >
          {task.title}
        </Link>
        <span className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-600">
          {formatPriority(task.priority)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm leading-5">
        <div>
          <div className={sectionLabelClass}>今日目标</div>
          <p className="mt-0.5 text-zinc-700">{goalText}</p>
        </div>
        <div>
          <div className={sectionLabelClass}>下一步</div>
          <p className="mt-0.5 text-zinc-700">{task.nextAction}</p>
        </div>
        <div>
          <div className={sectionLabelClass}>完成标准</div>
          <p className="mt-0.5 text-zinc-600">{task.definitionOfDone}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {task.project?.name ? (
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
            {task.project.name}
          </span>
        ) : null}
        {task.estimateMinutes ? (
          <span className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-600">
            约 {task.estimateMinutes} 分钟
          </span>
        ) : null}
        <span className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-zinc-600">
          {formatTaskStatus(task.status)}
        </span>
        <AgentOwnerBadge
          ownerAgent={task.ownerAgent}
          leaseUntil={task.leaseUntil}
          lastHeartbeatAt={task.lastHeartbeatAt}
          executionMode={task.executionMode}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
        <TaskStatusControls taskId={task.id} status={task.status} compact />
        <Link
          href={`/tasks/${task.id}`}
          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
        >
          人工修改
        </Link>
      </div>
    </article>
  );
}
