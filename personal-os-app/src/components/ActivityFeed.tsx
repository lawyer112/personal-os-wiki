import type { ActivityItem } from "@/lib/view-models";
const actorLabels: Record<string, string> = { user: "我", hermes: "Hermes", codex: "Codex", system: "系统" };
const actionLabels: Record<string, string> = {
  "task.claimed": "认领了任务", "task.heartbeat": "更新了执行心跳", "task.submitted": "提交了成果", "task.reviewed": "复核了成果", "task.contributed": "记录了执行进展", "task.blocked": "标记了任务阻塞",
  "inbox.created": "收到了新输入", "agentRun.started": "开始整理输入", "agentRun.completed": "完成了整理", "agentRun.failed": "整理失败", "task.created": "创建了任务", "task.updated": "更新了任务", "task.completed": "完成了任务", "idea.created": "记录了想法", "idea.updated": "更新了想法", "idea.promoted": "把想法转成任务", "note.created": "创建了项目记录", "project.created": "创建了项目", "project.event.created": "记录了项目进展", "notification.created": "生成了回执",
};
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return <section className="rounded-lg border border-zinc-200 bg-white p-4"><h2 className="text-base font-semibold text-zinc-950">最近操作</h2><div className="mt-3 grid gap-2">{items.length ? items.map(item => <div key={item.id} className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 rounded-lg border border-zinc-100 px-3 py-2 text-sm"><span className="font-semibold text-zinc-500">{actorLabels[item.actorType] ?? "执行者"}</span><span className="min-w-0 text-zinc-700">{actionLabels[item.action] ?? "记录了工作操作"}</span></div>) : <p className="text-sm text-zinc-500">暂时没有活动记录。</p>}</div></section>;
}
