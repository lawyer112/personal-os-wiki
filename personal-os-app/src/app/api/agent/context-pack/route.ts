/** 请求级上下文预算；不修改 process.env，多个执行者可并发调用。 */
import { prisma } from "@/lib/db";
import { getAgentContext, getQueryAgentContext } from "@/lib/agent-context";
import { applyContextBudget, getBudgetConfig, type ContextBudgetConfig } from "@/lib/agent-context-budget";
import { handleRouteError, HttpError, json, requireReadAccess } from "@/lib/http";
export const dynamic = "force-dynamic";
function budgetConfig(params: URLSearchParams): ContextBudgetConfig {
  const config = { ...getBudgetConfig() };
  for (const [parameter, field] of [["budgetHot", "hot"], ["budgetWarm", "warm"], ["budgetCold", "cold"], ["budgetTotal", "total"]] as const) {
    const raw = params.get(parameter);
    if (raw === null) continue;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > 100000) throw new HttpError(400, "预算应为 1 至 100000 的整数");
    config[field] = value;
  }
  return config;
}
export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const params = new URL(request.url).searchParams;
    const taskId = params.get("taskId"), query = params.get("q");
    if (!taskId && !query) throw new HttpError(400, "请提供任务编号或查询内容");
    const config = budgetConfig(params);
    const context = taskId ? await getAgentContext(prisma, taskId) : await getQueryAgentContext(query!, prisma);
    const limited = applyContextBudget(context.tiers, config);
    const result = params.get("compact") === "1"
      ? { generatedAt: context.generatedAt, tiers: limited.tiers, nextAction: context.nextAction, policy: context.policy, budget: limited.budget }
      : { ...context, tiers: limited.tiers, budget: limited.budget };
    return json({ ok: true, context: result, budgetScope: "tiers", note: "预算统计只覆盖分层条目，结构字段及完整模式附加内容不包含在内；令牌数为估算。" });
  } catch (error) { return handleRouteError(error); }
}
export async function OPTIONS() {
  return json({ ok: true, budgetDefaults: getBudgetConfig(), budgetScope: "tiers", params: { taskId: "任务编号", q: "检索内容", compact: "设为 1 时仅返回分层上下文", budgetHot: "核心层估算令牌上限", budgetWarm: "关联层估算令牌上限", budgetCold: "背景层估算令牌上限", budgetTotal: "分层内容估算令牌总上限" } });
}
