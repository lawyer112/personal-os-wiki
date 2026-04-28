import Image from "next/image";
import { AgentContextPanel } from "@/components/AgentContextPanel";
import { TaskEditForm } from "@/components/TaskEditForm";
import { TaskStatusControls } from "@/components/TaskStatusControls";
import type { AgentContextPack } from "@/lib/agent-context";
import { formatPriority, formatTaskStatus } from "@/lib/task-labels";
import type { TaskView } from "@/lib/view-models";

export function TaskInspector({
  task,
  agentContext,
}: {
  task: TaskView | null;
  agentContext?: AgentContextPack | null;
}) {
  if (!task) {
    return (
      <aside className="rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-600">
        还没有选中的任务。等 Hermes 把输入整理成任务后，这里会优先显示
        今日目标、下一步和完成标准。
      </aside>
    );
  }

  const goalText =
    task.description ??
    task.sourceAgentRun?.outputSummary ??
    "这条任务还没有写清楚为什么今天要处理。";

  return (
    <aside className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-semibold text-emerald-700">任务详情</p>
      <h2 className="mt-2 text-lg font-bold leading-6 text-zinc-950">
        {task.title}
      </h2>

      <div className="mt-4">
        <TaskStatusControls taskId={task.id} status={task.status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-zinc-200 p-2">
          <div className="text-zinc-500">状态</div>
          <div className="mt-1 font-semibold">{formatTaskStatus(task.status)}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-2">
          <div className="text-zinc-500">优先级</div>
          <div className="mt-1 font-semibold">{formatPriority(task.priority)}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-2">
          <div className="text-zinc-500">项目</div>
          <div className="mt-1 truncate font-semibold">
            {task.project?.name ?? "未归属"}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-zinc-950">今日目标</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">{goalText}</p>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-zinc-950">下一步</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {task.nextAction}
        </p>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-zinc-950">完成标准</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {task.definitionOfDone}
        </p>
      </div>

      <AgentContextPanel taskId={task.id} context={agentContext} />

      {task.wikiLinks && task.wikiLinks.length > 0 ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <h3 className="text-sm font-semibold text-emerald-950">
            已绑定资料
          </h3>
          <div className="mt-2 grid gap-2 text-sm">
            {task.wikiLinks.map((link) =>
              link.noteUrl ? (
                <a
                  key={link.id}
                  href={link.noteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-white px-3 py-2 font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  {link.noteTitle}
                </a>
              ) : (
                <div key={link.id} className="rounded-lg bg-white px-3 py-2">
                  {link.noteTitle}
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex items-center gap-3">
          <Image src="/file.svg" alt="" width={32} height={32} />
          <div>
            <div className="text-sm font-semibold text-zinc-900">来源片段</div>
            <div className="text-xs text-zinc-500">
              {task.sourceInboxItem?.sourcePlatform ?? "telegram"} /{" "}
              {task.sourceInboxItem?.sourceType ?? "text"}
            </div>
          </div>
        </div>
        <p className="mt-3 line-clamp-6 text-sm leading-6 text-zinc-600">
          {task.sourceInboxItem?.rawText ?? "暂无来源文本"}
        </p>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-zinc-950">Hermes 判断</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {task.sourceAgentRun?.reasoningSummary ?? "暂无 Agent 说明。"}
        </p>
      </div>

      <TaskEditForm task={task} />
    </aside>
  );
}
