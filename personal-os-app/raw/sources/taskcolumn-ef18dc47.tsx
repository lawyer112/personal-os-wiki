import { TaskCard } from "@/components/TaskCard";
import { ReviewTaskCard } from "@/components/ReviewTaskCard";
import type { TaskView } from "@/lib/view-models";

type TaskColumnProps = {
  title: string;
  subtitle: string;
  tasks: TaskView[];
  tone: "active" | "review" | "waiting" | "blocked" | "done";
  emptyText: string;
  totalCount?: number;
};

export function TaskColumn({
  title,
  subtitle,
  tasks,
  tone,
  emptyText,
  totalCount,
}: TaskColumnProps) {
  const countLabel =
    totalCount && totalCount > tasks.length
      ? `${tasks.length}/${totalCount}`
      : `${tasks.length}`;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p>
        </div>
        <span className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600">
          {countLabel}
        </span>
      </div>

      {tasks.length > 0 ? (
        <div className="grid gap-3">
          {tasks.map((task) => (
            tone === "review" ? (
              <ReviewTaskCard key={task.id} task={task} />
            ) : (
              <TaskCard key={task.id} task={task} tone={tone} />
            )
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-sm text-zinc-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}
