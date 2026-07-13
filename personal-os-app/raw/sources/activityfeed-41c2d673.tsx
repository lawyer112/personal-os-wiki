import type { ActivityItem } from "@/lib/view-models";

const actorLabels: Record<string, string> = {
  user: "我",
  hermes: "Hermes",
  codex: "Codex",
  system: "系统",
};

const actionLabels: Record<string, string> = {
  "inbox.created": "收到了新输入",
  "agentRun.started": "开始整理输入",
  "agentRun.completed": "完成了整理",
  "agentRun.failed": "整理失败",
  "task.created": "创建了任务",
  "task.updated": "更新了任务",
  "task.completed": "完成了任务",
  "idea.created": "记录了想法",
  "idea.updated": "更新了想法",
  "idea.promoted": "把想法转成任务",
  "note.created": "创建了项目记录",
  "project.created": "创建了项目",
  "project.event.created": "记录了项目进展",
  "notification.created": "生成了回执",
};

function formatActivity(item: ActivityItem) {
  const actor = actorLabels[item.actorType] ?? item.actorType;
  const action = actionLabels[item.action] ?? item.action;
  return `${actor} ${action}`;
}

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-base font-semibold text-zinc-950">最近操作</h2>
      <div className="mt-3 grid gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-lg border border-zinc-100 px-3 py-2 text-sm"
            >
              <span className="font-semibold text-zinc-500">
                {actorLabels[item.actorType] ?? item.actorType}
              </span>
              <span className="min-w-0 text-zinc-700">
                {formatActivity(item)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">暂时没有活动记录。</p>
        )}
      </div>
    </section>
  );
}
