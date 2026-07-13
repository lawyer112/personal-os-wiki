const taskStatusLabels: Record<string, string> = {
  active: "推进中",
  review: "待确认",
  todo: "今日要做",
  doing: "进行中",
  waiting: "等待中",
  blocked: "卡住了",
  paused: "暂停",
  done: "已完成",
  archived: "已忽略",
  captured: "刚捕获",
  shaping: "正在打磨",
  someday: "以后再看",
  promoted: "已转任务",
};

const priorityLabels: Record<string, string> = {
  P0: "最高优先",
  P1: "重要",
  P2: "普通",
  P3: "低优先",
};

export function formatTaskStatus(status: string) {
  return taskStatusLabels[status] ?? status;
}

export function formatPriority(priority: string) {
  return priorityLabels[priority] ?? priority;
}

export function formatIdeaStatus(status: string) {
  return taskStatusLabels[status] ?? status;
}
