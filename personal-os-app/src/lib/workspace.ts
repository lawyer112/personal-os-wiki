/** 工作台的展示契约。内部状态值保持兼容，中文只用于展示。 */
export const stages = [
  { id: "intake", name: "待确认", hint: "先明确要求，再安排执行" },
  { id: "todo", name: "可执行", hint: "要求已明确，等待认领" },
  { id: "doing", name: "执行中", hint: "查看下一步与最近进展" },
  { id: "waiting", name: "等待中", hint: "等待外部输入或依赖" },
  { id: "blocked", name: "已阻塞", hint: "需要处理权限、资源或决策" },
  { id: "submitted", name: "待验收", hint: "检查成果和证据后再通过" },
  { id: "done", name: "已完成", hint: "保留验收记录与知识引用" },
] as const;
export type Stage = (typeof stages)[number]["id"];
export type AgentSummary = {
  id: string; displayName: string; enabled: boolean; tags: string[];
  allowedRiskLevel: string; canWriteTasks: boolean; capabilities?: string[];
  canWriteWiki?: boolean; canTouchFiles?: boolean; canSendNotifications?: boolean;
};
export type WorkTask = {
  id: string; title: string; status: string; priority: string;
  description?: string | null; nextAction: string; definitionOfDone: string;
  riskLevel?: string; executionMode?: string; agentTags?: string[];
  ownerAgent?: string | null; leaseUntil?: string | Date | null;
  lastHeartbeatAt?: string | Date | null; submittedAt?: string | Date | null;
  updatedAt?: string | Date; dueDate?: string | Date | null;
  project?: { id: string; name: string } | null;
};
export function taskStage(task: Pick<WorkTask, "status" | "submittedAt">): string {
  return task.status === "review" ? (task.submittedAt ? "submitted" : "intake") : task.status;
}
export const labels: Record<string, string> = {
  review: "待确认", intake: "待确认", submitted: "待验收", todo: "可执行", doing: "执行中",
  waiting: "等待中", blocked: "已阻塞", done: "已完成", archived: "已归档",
  active: "推进中", paused: "已暂停", low: "低风险", medium: "中风险", high: "高风险",
  P0: "紧急", P1: "重要", P2: "普通", P3: "低优先级", manual: "人工执行",
  agent_suggested: "智能体建议", agent_allowed: "允许自动认领", approval_required: "执行前需审批",
  blocked_until_user: "等待人工决策", running: "运行中", completed: "已结束", failed: "失败",
  approved: "验收通过", approve: "通过", request_changes: "要求返工", rejected: "未通过",
  reject: "拒绝", block: "阻塞", archive: "归档", unverified: "尚未核验", verified: "已核验",
  inferred: "推断", speculative: "待证实", draft: "草稿", published: "已发布", deprecated: "已停用",
  "task.claimed": "认领任务", "task.heartbeat": "续约心跳", "task.submitted": "提交成果",
  "task.reviewed": "复核任务", "task.contributed": "记录进展", "task.created": "创建任务",
  "task.updated": "更新任务", user: "人工", system: "系统", link: "链接", file: "文件",
  artifact: "交付物", source: "原始资料", note: "知识页面", captured: "已收集", shaping: "整理中",
  someday: "暂缓处理", promoted: "已转任务", new: "待整理", processing: "处理中", processed: "已整理",
};
export function label(value?: string | null, fallback = "未设置") { return value ? labels[value] ?? value : fallback; }
export function displayTime(value?: string | Date | null) {
  if (!value) return "尚未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间无效" : date.toLocaleString("zh-CN", { hour12: false });
}
export function leaseState(task: WorkTask, now = Date.now()) {
  if (!task.ownerAgent) return "未认领";
  if (taskStage(task) === "submitted") return "成果待验收";
  if (task.status === "done" || task.status === "archived") return "执行已结束";
  if (!task.leaseUntil) return "未持有有效租约";
  return new Date(task.leaseUntil).getTime() > now ? "租约有效" : "租约已过期";
}
/** 与服务端认领策略一致；最终抢占仍由数据库条件更新裁决。 */
export function claimReasons(task: WorkTask, agent?: AgentSummary | null, now = Date.now()): string[] {
  const reasons: string[] = [];
  if (!["todo", "doing"].includes(task.status)) reasons.push("当前阶段不允许认领");
  if (task.executionMode !== "agent_allowed") reasons.push("尚未授权自动执行");
  if (task.riskLevel === "high") reasons.push("高风险任务需要人工审批");
  if (task.ownerAgent && (!task.leaseUntil || new Date(task.leaseUntil).getTime() > now)) reasons.push("已有执行者持有任务");
  if (!agent) reasons.push("请先选择执行者");
  else {
    if (!agent.enabled) reasons.push("执行者已停用");
    if (!agent.canWriteTasks) reasons.push("执行者没有任务写入权限");
    const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };
    if ((rank[task.riskLevel ?? "low"] ?? 3) > (rank[agent.allowedRiskLevel] ?? 1)) reasons.push("超出执行者的风险权限");
    if (task.agentTags?.length && !task.agentTags.some(tag => agent.tags.includes(tag))) reasons.push("执行者标签不匹配");
  }
  return reasons;
}
export function safeLink(value?: string | null): string | undefined {
  if (!value || /[\u0000-\u0020\\]/.test(value)) return undefined;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("wiki://")) return `/wiki?path=${encodeURIComponent(value.slice(7))}`;
  try { const url = new URL(value); return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
export function pageNumber(value: string | null, max = 100000) {
  const n = Number(value ?? "1");
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : 1;
}
export function readWorkspaceQuery(url: URL) {
  const p = url.searchParams;
  const allowed = new Set([...stages.map(s => s.id), "archived", "all"]);
  const stage = p.get("stage") ?? "all";
  return { q: (p.get("q") ?? "").trim().slice(0, 200), page: pageNumber(p.get("page")),
    pageSize: 30, stage: allowed.has(stage) ? stage : "all", project: (p.get("project") ?? "").slice(0, 100),
    owner: (p.get("owner") ?? "").slice(0, 100), agent: (p.get("agent") ?? "").slice(0, 100),
    claimable: p.get("claimable") === "1" };
}
