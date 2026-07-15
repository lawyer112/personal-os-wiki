import { TaskCard } from "@/components/TaskCard";
import { ExecutionReviewTaskCard } from "@/components/ExecutionReviewTaskCard";
import { ReviewTaskCard } from "@/components/ReviewTaskCard";
import type { TaskView } from "@/lib/view-models";

type TaskColumnProps = {
  title: string;
  subtitle: string;
  tasks: TaskView[];
  tone: "active" | "review" | "waiting" | "blocked" | "done";
  reviewMode?: "intake" | "execution";
  emptyText: string;
  totalCount?: number;
};

export function TaskColumn({
  title,
  subtitle,
  tasks,
  tone,
  reviewMode = "intake",
  emptyText,
  totalCount,
}: TaskColumnProps) {
  const countLabel =
    totalCount && totalCount > tasks.length
      ? `${tasks.length}/${totalCount}`
      : `${tasks.length}`;

  return (
    <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--ink)]">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{subtitle}</p>
        </div>
        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--ink-muted)]">
          {countLabel}
        </span>
      </div>

      {tasks.length > 0 ? (
        <div className="grid gap-3">
          {tasks.map((task) => (
            tone === "review" && reviewMode === "execution" ? (
              <ExecutionReviewTaskCard key={task.id} task={task} />
            ) : tone === "review" ? (
              <ReviewTaskCard key={task.id} task={task} />
            ) : (
              <TaskCard key={task.id} task={task} tone={tone} />
            )
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-6 text-sm text-[var(--ink-muted)]">
          {emptyText}
        </div>
      )}
    </section>
  );
}
