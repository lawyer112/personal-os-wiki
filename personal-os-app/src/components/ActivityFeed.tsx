import type { ActivityItem } from "@/lib/view-models";

const actorLabels: Record<string, string> = {
  user: "手动",
  hermes: "助手",
  codex: "助手",
  system: "系统",
};

const actionLabels: Record<string, string> = {
  "inbox.created": "收到新输入",
  "agentRun.started": "开始整理输入",
  "agentRun.completed": "整理完成",
  "agentRun.failed": "整理失败",
  "task.created": "新增任务",
  "task.updated": "更新任务",
  "task.completed": "任务完成",
  "idea.created": "记录想法",
  "idea.updated": "更新想法",
  "idea.promoted": "想法转为任务",
  "note.created": "新增项目记录",
  "project.created": "新增项目",
  "project.event.created": "记录项目进展",
  "notification.created": "生成回执",
};

function formatActivity(item: ActivityItem) {
  return actionLabels[item.action] ?? item.action;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-bold text-[var(--ink)]">最近操作</h2>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--app-bg-soft)] px-3 py-2 text-sm"
            >
              <span className="font-bold text-[var(--brand-strong)]">
                {actorLabels[item.actorType] ?? item.actorType}
              </span>
              <span className="min-w-0 text-[var(--ink-muted)]">
                {formatActivity(item)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--ink-muted)]">暂时没有活动记录。</p>
        )}
      </div>
    </section>
  );
}
