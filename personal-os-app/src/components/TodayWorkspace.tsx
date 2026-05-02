import { ActivityFeed } from "@/components/ActivityFeed";
import { ProjectRadar } from "@/components/ProjectRadar";
import { TaskColumn } from "@/components/TaskColumn";
import { TaskInspector } from "@/components/TaskInspector";
import type { TodayView } from "@/lib/view-models";

export function TodayWorkspace({ today }: { today: TodayView }) {
  const selectedTask =
    today.nowTasks[0] ??
    today.executionReviewTasks[0] ??
    today.reviewTasks[0] ??
    today.waitingTasks[0] ??
    today.blockedTasks[0] ??
    null;

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-700">今日任务</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-950">
            今天要推进什么
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            这里不放普通摘录，只放今天能产生结果的动作、等别人或工具的事项、
            已经卡住的事项，以及 Hermes 提取出来但还需要你确认的任务。
          </p>
        </div>

        <div className="grid grid-cols-6 gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-center text-xs">
          {[
            ["今日", today.metrics.now],
            ["待复核", today.metrics.executionReview],
            ["待确认", today.metrics.intakeReview],
            ["等待", today.metrics.waiting],
            ["卡住", today.metrics.blocked],
            ["完成", today.metrics.done],
          ].map(([label, value]) => (
            <div key={label} className="min-w-16 rounded-lg bg-zinc-50 px-3 py-2">
              <div className="font-bold text-zinc-950">{value}</div>
              <div className="mt-1 text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <div className="grid gap-4 2xl:grid-cols-3">
            <TaskColumn
              title="今日要做"
              subtitle="今天真正要推进的事。每张卡都必须有目标、下一步和完成标准。"
              tasks={today.nowTasks}
              tone="active"
              emptyText="今天还没有安排正式任务。"
              totalCount={today.metrics.now}
            />
            <TaskColumn
              title="待复核提交"
              subtitle="Agent 已经提交产物，必须由人或 reviewer agent 判断是否通过。"
              tasks={today.executionReviewTasks}
              tone="review"
              reviewMode="execution"
              emptyText="没有待复核提交。"
              totalCount={today.metrics.executionReview}
            />
            <TaskColumn
              title="待确认"
              subtitle="Hermes 判断像任务，但还没有进入你的今日安排。"
              tasks={today.reviewTasks}
              tone="review"
              reviewMode="intake"
              emptyText="没有待确认任务。"
              totalCount={today.metrics.intakeReview}
            />
          </div>

          <div className="grid gap-4 2xl:grid-cols-3">
            <TaskColumn
              title="等待中"
              subtitle="等工具、API、外部输入或设备导出。"
              tasks={today.waitingTasks}
              tone="waiting"
              emptyText="没有等待项。"
              totalCount={today.metrics.waiting}
            />
            <TaskColumn
              title="卡住了"
              subtitle="缺决策、缺权限、缺能力，继续做会空转。"
              tasks={today.blockedTasks}
              tone="blocked"
              emptyText="没有卡住的事项。"
              totalCount={today.metrics.blocked}
            />
            <TaskColumn
              title="今日已完成"
              subtitle="完成感要能看见，晚上复盘也靠它。"
              tasks={today.doneTasks}
              tone="done"
              emptyText="今天还没有完成项。"
              totalCount={today.metrics.done}
            />
          </div>

          <ProjectRadar projects={today.projects} />
          <ActivityFeed items={today.activity} />
        </div>

        <TaskInspector task={selectedTask} />
      </div>
    </div>
  );
}
