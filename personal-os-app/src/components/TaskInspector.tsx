import Image from "next/image";
import { AgentContextPanel } from "@/components/AgentContextPanel";
import { TaskEditForm } from "@/components/TaskEditForm";
import { TaskStatusControls } from "@/components/TaskStatusControls";
import type { AgentContextPack } from "@/lib/agent-context";
import { formatPriority, formatTaskStatus } from "@/lib/task-labels";
import type { TaskView } from "@/lib/view-models";

function formatDateTime(value?: Date | string | null) {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString("zh-CN", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const runStatusLabels: Record<string, string> = {
  running: "执行中",
  submitted: "待复核",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  policy_revoked: "条件已变化",
};

const reviewDecisionLabels: Record<string, string> = {
  approve: "已通过",
  request_changes: "需调整",
  reject: "未通过",
  block: "受阻",
  archive: "已归档",
};

const actionLabels: Record<string, string> = {
  "task.claimed": "接手任务",
  "task.submitted": "提交复核",
  "task.completed": "标记完成",
  "task.updated": "更新任务",
  "wiki.write": "更新资料",
  "wiki-write-failed": "资料更新失败",
};

function formatRunStatus(status?: string | null) {
  return status ? (runStatusLabels[status] ?? status) : "未知状态";
}

function formatReviewDecision(decision?: string | null) {
  return decision ? (reviewDecisionLabels[decision] ?? decision) : "未记录结果";
}

function formatActorLabel(actor?: string | null) {
  if (!actor) {
    return "未认领";
  }

  const normalized = actor.toLowerCase();
  if (["hermes", "codex", "agent"].includes(normalized) || normalized.includes("agent")) {
    return "助手";
  }
  if (["user", "manual"].includes(normalized)) {
    return "手动";
  }
  return actor;
}

function formatActionLabel(action?: string | null) {
  return action ? (actionLabels[action] ?? "记录了一次操作") : "记录了一次操作";
}

export function TaskInspector({
  task,
  agentContext,
}: {
  task: TaskView | null;
  agentContext?: AgentContextPack | null;
}) {
  if (!task) {
    return (
      <aside className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--ink-muted)] shadow-[var(--shadow-card)]">
        还没有选中的任务。选择任务后，这里会显示今日目标、下一步和完成标准。
      </aside>
    );
  }

  const goalText =
    task.description ??
    task.sourceAgentRun?.outputSummary ??
    "这条任务还没有写清楚为什么需要推进。";
  const latestRun = task.runs?.[0];
  const latestClaim = task.claims?.[0];
  const latestContribution = task.contributions?.[0];
  const latestReview = task.reviews?.[0];
  const responsible = formatActorLabel(
    latestRun?.agentId ?? latestClaim?.agentId ?? task.ownerAgent,
  );
  const artifactUrls = Array.from(
    new Set([
      ...(latestContribution?.artifactUrls ?? []),
      ...(task.artifacts?.map((artifact) => artifact.url) ?? []),
    ]),
  );

  return (
    <aside className="rounded-[1.75rem] border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <p className="ui-eyebrow">任务详情</p>
      <h2 className="mt-2 text-lg font-bold leading-6 text-[var(--ink)]">
        {task.title}
      </h2>

      <div className="mt-4">
        <TaskStatusControls taskId={task.id} status={task.status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2">
          <div className="text-[var(--ink-soft)]">状态</div>
          <div className="mt-1 font-semibold">{formatTaskStatus(task.status)}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2">
          <div className="text-[var(--ink-soft)]">优先级</div>
          <div className="mt-1 font-semibold">{formatPriority(task.priority)}</div>
        </div>
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-2">
          <div className="text-[var(--ink-soft)]">项目</div>
          <div className="mt-1 truncate font-semibold">
            {task.project?.name ?? "未归属"}
          </div>
        </div>
      </div>

      <section className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
        <h3 className="text-sm font-bold text-[var(--ink)]">推进摘要</h3>
        <div className="mt-3 grid gap-3 text-sm leading-6 text-[var(--ink-muted)]">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl bg-[var(--surface)] p-2">
              <div className="text-[var(--ink-soft)]">当前责任方</div>
              <div className="mt-1 font-semibold text-[var(--ink)]">{responsible}</div>
            </div>
            <div className="rounded-2xl bg-[var(--surface)] p-2">
              <div className="text-[var(--ink-soft)]">最近执行</div>
              <div className="mt-1 font-semibold text-[var(--ink)]">
                {latestRun
                  ? `${formatRunStatus(latestRun.status)} · ${formatDateTime(latestRun.startedAt)}`
                  : "还没有执行记录"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--surface)] p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
              最近提交
            </div>
            <p className="mt-1 text-[var(--ink-muted)]">
              {latestContribution?.summary ?? "还没有提交摘要。"}
            </p>
            {latestContribution?.nextRecommendation ? (
              <p className="mt-1 text-[var(--ink-soft)]">
                建议下一步：{latestContribution.nextRecommendation}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl bg-[var(--surface)] p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
              证据与产物
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {latestContribution?.evidenceLinks?.length || artifactUrls.length ? (
                <>
                  {latestContribution?.evidenceLinks?.map((link) => (
                    <a
                      key={`summary-evidence-${link}`}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--review)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--review)] hover:bg-white"
                    >
                      证据
                    </a>
                  ))}
                  {artifactUrls.map((url) => (
                    <a
                      key={`summary-artifact-${url}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--review)] bg-[var(--surface)] px-2.5 py-1 font-semibold text-[var(--review)] hover:bg-white"
                    >
                      产物
                    </a>
                  ))}
                </>
              ) : (
                <span className="text-[var(--ink-soft)]">没有附带证据或产物链接。</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--surface)] p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
              最近复核
            </div>
            <p className="mt-1 text-[var(--ink-muted)]">
              {latestReview
                ? `${formatReviewDecision(latestReview.decision)} · ${formatActorLabel(
                    latestReview.reviewer,
                  )}${
                    latestReview.createdAt
                      ? ` · ${formatDateTime(latestReview.createdAt)}`
                      : ""
                  }`
                : "还没有复核记录。"}
            </p>
            {latestReview?.comment ? (
              <p className="mt-1 text-[var(--ink-soft)]">{latestReview.comment}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">今日目标</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{goalText}</p>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">下一步</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
          {task.nextAction}
        </p>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">完成标准</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
          {task.definitionOfDone}
        </p>
      </div>

      <AgentContextPanel taskId={task.id} context={agentContext} />

      {(task.claims?.length ||
        task.runs?.length ||
        task.agentActionLogs?.length ||
        task.contributions?.length ||
        task.artifacts?.length ||
        task.reviews?.length) ? (
        <details className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
          <summary className="cursor-pointer text-sm font-bold text-[var(--ink)]">
            执行记录
          </summary>
          <div className="mt-3 grid gap-3 text-sm leading-6 text-[var(--ink-muted)]">
            {task.runs?.length ? (
              <section className="rounded-2xl bg-[var(--surface)] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
                  运行记录
                </div>
                <div className="mt-2 grid gap-2">
                  {task.runs.map((run) => (
                    <div key={run.id} className="text-[var(--ink-muted)]">
                      <span className="font-semibold">
                        {formatActorLabel(run.agentId)}
                      </span>
                      {" · "}
                      <span>{formatRunStatus(run.status)}</span>
                      {run.startedAt
                        ? ` · 开始 ${formatDateTime(run.startedAt)}`
                        : ""}
                      {run.submittedAt
                        ? ` · 提交 ${formatDateTime(run.submittedAt)}`
                        : ""}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {task.agentActionLogs?.length ? (
              <section className="rounded-2xl bg-[var(--surface)] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
                  操作记录
                </div>
                <div className="mt-2 grid gap-2">
                  {task.agentActionLogs.map((action) => (
                    <div key={action.id} className="rounded-2xl bg-[var(--surface-muted)] p-2">
                      <div className="font-semibold text-[var(--ink)]">
                        {formatActionLabel(action.action)} · {formatActorLabel(action.agentId)}
                        {action.createdAt
                          ? ` / ${formatDateTime(action.createdAt)}`
                          : ""}
                      </div>
                      {action.summary ? (
                        <p className="mt-1 text-[var(--ink-muted)]">{action.summary}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {task.claims?.length ? (
              <section className="rounded-2xl bg-[var(--surface)] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
                  接手记录
                </div>
                <div className="mt-2 grid gap-2">
                  {task.claims.map((claim) => (
                    <div key={claim.id} className="text-[var(--ink-muted)]">
                      <span className="font-semibold">
                        {formatActorLabel(claim.agentId)}
                      </span>
                      {" 接手于 "}
                      {formatDateTime(claim.claimedAt)}
                      {claim.releasedAt
                        ? `，释放于 ${formatDateTime(claim.releasedAt)}`
                        : claim.leaseUntil
                          ? `，有效至 ${formatDateTime(claim.leaseUntil)}`
                          : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {task.contributions?.length ? (
              <section className="rounded-2xl bg-[var(--surface)] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
                  提交记录
                </div>
                <div className="mt-2 grid gap-3">
                  {task.contributions.map((contribution) => (
                    <div key={contribution.id}>
                      <div className="font-semibold text-[var(--ink)]">
                        {formatActorLabel(contribution.agentId)}
                        {contribution.createdAt
                          ? ` · ${formatDateTime(contribution.createdAt)}`
                          : ""}
                      </div>
                      <p className="mt-1">{contribution.summary}</p>
                      {contribution.nextRecommendation ? (
                        <p className="mt-1 text-[var(--ink-soft)]">
                          后续建议：{contribution.nextRecommendation}
                        </p>
                      ) : null}
                      {contribution.evidenceLinks?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {contribution.evidenceLinks.map((link) => (
                            <span
                              key={link}
                              className="rounded-full border border-[var(--review)] bg-[var(--surface)] px-2.5 py-1 text-[var(--review)]"
                            >
                              {link}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {task.artifacts?.length ? (
              <section className="rounded-2xl bg-[var(--surface)] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
                  产物记录
                </div>
                <div className="mt-2 grid gap-2">
                  {task.artifacts.map((artifact) => (
                    <a
                      key={artifact.id}
                      href={artifact.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 font-medium text-[var(--brand-strong)] hover:bg-[var(--app-bg-soft)]"
                    >
                      {artifact.title ?? artifact.url}
                      {artifact.verification
                        ? ` · ${artifact.verification}`
                        : ""}
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {task.reviews?.length ? (
              <section className="rounded-2xl bg-[var(--surface)] p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--brand-strong)]">
                  复核记录
                </div>
                <div className="mt-2 grid gap-2">
                  {task.reviews.map((review) => (
                    <div key={review.id} className="rounded-2xl bg-[var(--surface-muted)] p-2">
                      <div className="font-semibold text-[var(--ink)]">
                        {formatReviewDecision(review.decision)} · {formatActorLabel(
                          review.reviewer,
                        )}
                        {review.createdAt
                          ? ` · ${formatDateTime(review.createdAt)}`
                          : ""}
                      </div>
                      {review.comment ? (
                        <p className="mt-1 text-[var(--ink-muted)]">{review.comment}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </details>
      ) : null}

      {task.wikiLinks && task.wikiLinks.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-[var(--brand)] bg-[var(--brand-soft)] p-3">
          <h3 className="text-sm font-bold text-[var(--brand-strong)]">
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
                  className="rounded-2xl bg-[var(--surface)] px-3 py-2 font-medium text-[var(--brand-strong)] hover:bg-white"
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

      <div className="mt-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
        <div className="flex items-center gap-3">
          <Image src="/file.svg" alt="" width={32} height={32} />
          <div>
            <div className="text-sm font-semibold text-[var(--ink)]">来源片段</div>
            <div className="text-xs text-[var(--ink-soft)]">
              {task.sourceInboxItem?.sourcePlatform ?? "telegram"} /{" "}
              {task.sourceInboxItem?.sourceType ?? "text"}
            </div>
          </div>
        </div>
        <p className="mt-3 line-clamp-6 text-sm leading-6 text-[var(--ink-muted)]">
          {task.sourceInboxItem?.rawText ?? "暂无来源文本"}
        </p>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-[var(--ink)]">整理说明</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">
          {task.sourceAgentRun?.reasoningSummary ?? "暂无整理说明。"}
        </p>
      </div>

      <TaskEditForm task={task} />
    </aside>
  );
}
