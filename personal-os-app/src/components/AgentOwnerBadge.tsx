"use client";

/**
 * AgentOwnerBadge
 * 显示任务的 Agent 认领状态、租约是否过期。
 * - 无认领 → 不渲染
 * - 有认领 + 租约有效 → 蓝色 badge "Agent 认领中"
 * - 有认领 + 租约已过期 → 橙色 badge "租约过期"
 * - executionMode=agent_allowed 且无人认领 → 灰色 badge "可被 Agent 认领"
 */

type AgentOwnerBadgeProps = {
  ownerAgent?: string | null;
  leaseUntil?: Date | string | null;
  lastHeartbeatAt?: Date | string | null;
  executionMode?: string | null;
};

function isLeaseStale(leaseUntil?: Date | string | null): boolean {
  if (!leaseUntil) return false;
  return new Date(leaseUntil) < new Date();
}

export function AgentOwnerBadge({
  ownerAgent,
  leaseUntil,
  lastHeartbeatAt: _lastHeartbeatAt,
  executionMode,
}: AgentOwnerBadgeProps) {
  if (ownerAgent) {
    const stale = isLeaseStale(leaseUntil);
    const leaseLabel = leaseUntil
      ? stale
        ? "租约已过期"
        : `租约至 ${new Date(leaseUntil).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
      : "无租约时限";

    return (
      <span
        title={`认领人：${ownerAgent}　${leaseLabel}`}
        className={
          stale
            ? "rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700"
            : "rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700"
        }
      >
        {stale ? "⚠ 租约过期" : `🤖 ${ownerAgent}`}
      </span>
    );
  }

  if (executionMode === "agent_allowed" || executionMode === "agent_required") {
    return (
      <span className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-500">
        可被 Agent 认领
      </span>
    );
  }

  return null;
}
