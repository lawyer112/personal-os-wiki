import Link from "next/link";
import { TaskColumn } from "@/components/TaskColumn";
import type { TodayView } from "@/lib/view-models";

function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TodayWorkspace({ today }: { today: TodayView }) {
  const latestPlan = today.latestPlan;
  const pendingCount = today.metrics.executionReview + today.metrics.intakeReview;
  const blockedCount = today.metrics.blocked + today.metrics.waiting;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="ui-eyebrow">今日</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--ink)]">
            今日重点
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ink-muted)]">
            首页只保留当天需要判断的内容：当前重点、待处理事项和受阻事项。
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)] p-2 text-center text-xs shadow-[var(--shadow-card)]">
          {[
            ["进行中", today.metrics.now],
            ["待处理", pendingCount],
            ["受阻/等待", blockedCount],
          ].map(([label, value]) => (
            <div key={label} className="min-w-20 rounded-2xl bg-[var(--surface-muted)] px-3 py-2">
              <div className="text-lg font-bold text-[var(--ink)]">{value}</div>
              <div className="mt-0.5 text-[var(--ink-muted)]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <section className="rounded-[2rem] border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <p className="ui-eyebrow">今日重点</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)]">
              {latestPlan?.mainLine ?? "尚未生成今日重点"}
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-[var(--ink-muted)]">
              {latestPlan?.firstAction ??
                "先明确今天最重要的一步，再处理任务细节。"}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-[var(--brand-soft)] px-4 py-3 text-xs leading-5 text-[var(--brand-strong)]">
            {latestPlan ? (
              <>
                <div>{latestPlan.date}</div>
                <div>{formatDateTime(latestPlan.createdAt)}</div>
              </>
            ) : (
              <div>等待今日计划</div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
            <div className="text-xs font-semibold text-[var(--ink-muted)]">受阻原因</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
              {latestPlan?.blocked.length ? (
                latestPlan.blocked.slice(0, 4).map((item) => (
                  <span key={item} className="rounded-full bg-[var(--surface)] px-3 py-1">
                    {item}
                  </span>
                ))
              ) : (
                <span>暂无明显阻塞。</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
            <div className="text-xs font-semibold text-[var(--ink-muted)]">待确认事项</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
              {latestPlan?.needsDecision.length ? (
                latestPlan.needsDecision.slice(0, 4).map((item) => (
                  <span key={item} className="rounded-full bg-[var(--surface)] px-3 py-1">
                    {item}
                  </span>
                ))
              ) : (
                <span>暂无待确认事项。</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 2xl:grid-cols-3">
        <TaskColumn
          title="正在推进"
          subtitle="当天需要实际推进的事项。"
          tasks={today.nowTasks}
          tone="active"
          emptyText="今天还没有安排正式任务。"
          totalCount={today.metrics.now}
        />
        <TaskColumn
          title="待复核"
          subtitle="已有提交结果，需要确认是否通过。"
          tasks={today.executionReviewTasks}
          tone="review"
          reviewMode="execution"
          emptyText="暂无待复核提交。"
          totalCount={today.metrics.executionReview}
        />
        <TaskColumn
          title="受阻事项"
          subtitle="缺少继续条件，需要先补齐信息、权限或决策。"
          tasks={today.blockedTasks}
          tone="blocked"
          emptyText="暂无受阻事项。"
          totalCount={today.metrics.blocked}
        />
      </div>

      <section className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-base font-bold text-[var(--ink)]">次要内容</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
              项目、输入、想法和完成记录仍然保留，但不放在今日首屏。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <Link href="/tasks" className="rounded-full bg-[var(--brand-strong)] px-3 py-2 text-white">
              全部任务
            </Link>
            <Link href="/projects" className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-[var(--ink-muted)]">
              项目档案
            </Link>
            <Link href="/capture" className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-3 py-2 text-[var(--ink-muted)]">
              新增输入
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
