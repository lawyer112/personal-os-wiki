/**
 * /api/agent/context-pack
 *
 * Token-budget-aware context endpoint.
 * Supports per-call budget overrides via query params:
 *   ?q=<query>           – free-text query mode (no taskId)
 *   ?taskId=<id>         – task-scoped context
 *   ?budgetHot=<n>       – token cap for hot tier (default: env / 2000)
 *   ?budgetWarm=<n>      – token cap for warm tier (default: env / 1500)
 *   ?budgetCold=<n>      – token cap for cold tier (default: env / 1000)
 *   ?budgetTotal=<n>     – total token cap (default: env / 4500)
 *
 * Returns the full AgentContextPack with a `budget` field showing
 * how many tokens each tier actually consumed and whether truncation occurred.
 */

import { prisma } from "@/lib/db";
import { getAgentContext, getQueryAgentContext } from "@/lib/agent-context";
import { getBudgetConfig, type ContextBudgetConfig } from "@/lib/agent-context-budget";
import { handleRouteError, HttpError, json, requireReadAccess } from "@/lib/http";

export const dynamic = "force-dynamic";

function parseBudgetOverrides(
  searchParams: URLSearchParams,
): Partial<ContextBudgetConfig> {
  const overrides: Partial<ContextBudgetConfig> = {};

  const hot = parseInt(searchParams.get("budgetHot") ?? "", 10);
  const warm = parseInt(searchParams.get("budgetWarm") ?? "", 10);
  const cold = parseInt(searchParams.get("budgetCold") ?? "", 10);
  const total = parseInt(searchParams.get("budgetTotal") ?? "", 10);

  if (Number.isFinite(hot) && hot > 0) overrides.hot = hot;
  if (Number.isFinite(warm) && warm > 0) overrides.warm = warm;
  if (Number.isFinite(cold) && cold > 0) overrides.cold = cold;
  if (Number.isFinite(total) && total > 0) overrides.total = total;

  return overrides;
}

export async function GET(request: Request) {
  try {
    requireReadAccess(request);
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const query = searchParams.get("q");

    // Parse optional per-call budget overrides
    const budgetOverrides = parseBudgetOverrides(searchParams);
    const hasBudgetOverride = Object.keys(budgetOverrides).length > 0;

    if (hasBudgetOverride) {
      // Inject overrides into process.env temporarily via a scoped approach:
      // Since budget is read from env inside the lib, we pass via env override
      // pattern used elsewhere in the codebase.
      applyEnvBudgetOverrides(budgetOverrides);
    }

    try {
      if (taskId) {
        const context = await getAgentContext(prisma, taskId);
        return json({ ok: true, context });
      }

      if (query) {
        const context = await getQueryAgentContext(query, prisma);
        return json({ ok: true, context });
      }

      throw new HttpError(400, "taskId or q is required");
    } finally {
      if (hasBudgetOverride) {
        restoreEnvBudgetOverrides();
      }
    }
  } catch (error) {
    return handleRouteError(error);
  }
}

// ---------------------------------------------------------------------------
// Per-call budget override helpers
// These temporarily replace process.env budget vars for the duration of a
// single request, then restore them. Safe for single-threaded Node.js / Next.js
// serverless functions (one request per invocation). For multi-threaded or
// edge runtimes, callers should pass budgets via context directly.
// ---------------------------------------------------------------------------

const BUDGET_ENV_KEYS = {
  hot: "AGENT_CONTEXT_BUDGET_HOT",
  warm: "AGENT_CONTEXT_BUDGET_WARM",
  cold: "AGENT_CONTEXT_BUDGET_COLD",
  total: "AGENT_CONTEXT_BUDGET_TOTAL",
} as const;

type BudgetSavedEnv = Partial<Record<keyof typeof BUDGET_ENV_KEYS, string | undefined>>;

let savedEnv: BudgetSavedEnv | null = null;

function applyEnvBudgetOverrides(overrides: Partial<ContextBudgetConfig>) {
  savedEnv = {};
  for (const [key, envKey] of Object.entries(BUDGET_ENV_KEYS) as [keyof ContextBudgetConfig, string][]) {
    const value = overrides[key];
    if (value !== undefined) {
      savedEnv[key as keyof BudgetSavedEnv] = process.env[envKey];
      process.env[envKey] = String(value);
    }
  }
}

function restoreEnvBudgetOverrides() {
  if (!savedEnv) return;
  for (const [key, envKey] of Object.entries(BUDGET_ENV_KEYS) as [keyof ContextBudgetConfig, string][]) {
    if (key in savedEnv) {
      const saved = savedEnv[key as keyof BudgetSavedEnv];
      if (saved === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = saved;
      }
    }
  }
  savedEnv = null;
}

// Expose budget defaults for API consumers (informational)
export async function OPTIONS(_request: Request) {
  const defaults = getBudgetConfig();
  return json({
    ok: true,
    budgetDefaults: defaults,
    params: {
      taskId: "string – task-scoped context",
      q: "string – free-text query context",
      budgetHot: `number (default ${defaults.hot}) – max tokens for hot tier`,
      budgetWarm: `number (default ${defaults.warm}) – max tokens for warm tier`,
      budgetCold: `number (default ${defaults.cold}) – max tokens for cold tier`,
      budgetTotal: `number (default ${defaults.total}) – max total tokens`,
    },
  });
}
