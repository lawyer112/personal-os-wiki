/**
 * Token budget management for agent context tiers.
 * Implements fail-safe truncation to prevent context overflow.
 */

export type TierBudget = {
  /** Maximum tokens for this tier */
  max: number;
  /** Actual tokens used */
  used: number;
  /** Number of items truncated */
  truncated: number;
};

export type ContextBudgetConfig = {
  hot: number;
  warm: number;
  cold: number;
  /** Total budget across all tiers */
  total: number;
};

export type BudgetReport = {
  hot: TierBudget;
  warm: TierBudget;
  cold: TierBudget;
  total: {
    max: number;
    used: number;
    truncated: number;
  };
  wasLimited: boolean;
};

/**
 * Default token budgets per tier.
 * These are conservative estimates based on typical JSON serialization overhead.
 */
const DEFAULT_CONTEXT_BUDGET: ContextBudgetConfig = {
  hot: 2000,   // Critical: P0/P1 tasks, blockers
  warm: 1500,  // Important: recent tasks, top wiki matches
  cold: 1000,  // Background: policy, low-priority items
  total: 4500, // Overall cap
};

export { DEFAULT_CONTEXT_BUDGET };

/**
 * Rough token estimation for JSON-serialized items.
 * Uses character count / 3.5 as a heuristic (conservative for Chinese/mixed content).
 */
function estimateTokens(item: unknown): number {
  try {
    const json = JSON.stringify(item);
    return Math.ceil(json.length / 3.5);
  } catch {
    return 100; // Fallback estimate for non-serializable items
  }
}

/**
 * Truncate a tier's items to fit within budget, keeping highest priority items.
 * Returns truncated items and budget usage stats.
 */
export function applyTierBudget<T>(
  items: T[],
  maxTokens: number,
): { items: T[]; budget: TierBudget } {
  const result: T[] = [];
  let used = 0;
  let truncated = 0;

  for (const item of items) {
    const itemTokens = estimateTokens(item);
    if (used + itemTokens <= maxTokens) {
      result.push(item);
      used += itemTokens;
    } else {
      truncated++;
    }
  }

  return {
    items: result,
    budget: {
      max: maxTokens,
      used,
      truncated,
    },
  };
}

/**
 * Apply tiered budget limits to context tiers.
 * If total budget would be exceeded, proportionally reduce each tier.
 */
export function applyContextBudget<T>(
  tiers: { hot: T[]; warm: T[]; cold: T[] },
  config: ContextBudgetConfig = DEFAULT_CONTEXT_BUDGET,
): {
  tiers: { hot: T[]; warm: T[]; cold: T[] };
  budget: BudgetReport;
} {
  // First pass: apply per-tier budgets
  const hot = applyTierBudget(tiers.hot, config.hot);
  const warm = applyTierBudget(tiers.warm, config.warm);
  const cold = applyTierBudget(tiers.cold, config.cold);

  const totalUsed = hot.budget.used + warm.budget.used + cold.budget.used;
  const totalTruncated = hot.budget.truncated + warm.budget.truncated + cold.budget.truncated;

  // If within total budget, return as-is
  if (totalUsed <= config.total) {
    return {
      tiers: {
        hot: hot.items,
        warm: warm.items,
        cold: cold.items,
      },
      budget: {
        hot: hot.budget,
        warm: warm.budget,
        cold: cold.budget,
        total: {
          max: config.total,
          used: totalUsed,
          truncated: totalTruncated,
        },
        wasLimited: totalTruncated > 0,
      },
    };
  }

  // Second pass: reduce cold tier first, then warm, preserve hot
  const excess = totalUsed - config.total;
  let remaining = excess;

  // Try removing from cold
  const coldReduced = applyTierBudget(
    cold.items,
    Math.max(0, config.cold - remaining),
  );
  remaining -= cold.budget.used - coldReduced.budget.used;

  if (remaining <= 0) {
    return {
      tiers: {
        hot: hot.items,
        warm: warm.items,
        cold: coldReduced.items,
      },
      budget: {
        hot: hot.budget,
        warm: warm.budget,
        cold: {
          max: coldReduced.budget.max,
          used: coldReduced.budget.used,
          truncated: cold.budget.truncated + (tiers.cold.length - coldReduced.items.length),
        },
        total: {
          max: config.total,
          used: hot.budget.used + warm.budget.used + coldReduced.budget.used,
          truncated: hot.budget.truncated + warm.budget.truncated + cold.budget.truncated + (tiers.cold.length - coldReduced.items.length),
        },
        wasLimited: true,
      },
    };
  }

  // Try removing from warm
  const warmReduced = applyTierBudget(
    warm.items,
    Math.max(0, config.warm - remaining),
  );
  remaining -= warm.budget.used - warmReduced.budget.used;

  if (remaining <= 0) {
    return {
      tiers: {
        hot: hot.items,
        warm: warmReduced.items,
        cold: coldReduced.items,
      },
      budget: {
        hot: hot.budget,
        warm: {
          max: warmReduced.budget.max,
          used: warmReduced.budget.used,
          truncated: warm.budget.truncated + (tiers.warm.length - warmReduced.items.length),
        },
        cold: {
          max: coldReduced.budget.max,
          used: coldReduced.budget.used,
          truncated: cold.budget.truncated + (tiers.cold.length - coldReduced.items.length),
        },
        total: {
          max: config.total,
          used: hot.budget.used + warmReduced.budget.used + coldReduced.budget.used,
          truncated: hot.budget.truncated + warm.budget.truncated + (tiers.warm.length - warmReduced.items.length) + cold.budget.truncated + (tiers.cold.length - coldReduced.items.length),
        },
        wasLimited: true,
      },
    };
  }

  // Last resort: reduce hot (this should rarely happen)
  const hotReduced = applyTierBudget(
    hot.items,
    Math.max(0, config.hot - remaining),
  );

  return {
    tiers: {
      hot: hotReduced.items,
      warm: warmReduced.items,
      cold: coldReduced.items,
    },
    budget: {
      hot: {
        max: hotReduced.budget.max,
        used: hotReduced.budget.used,
        truncated: hot.budget.truncated + (tiers.hot.length - hotReduced.items.length),
      },
      warm: {
        max: warmReduced.budget.max,
        used: warmReduced.budget.used,
        truncated: warm.budget.truncated + (tiers.warm.length - warmReduced.items.length),
      },
      cold: {
        max: coldReduced.budget.max,
        used: coldReduced.budget.used,
        truncated: cold.budget.truncated + (tiers.cold.length - coldReduced.items.length),
      },
      total: {
        max: config.total,
        used: hotReduced.budget.used + warmReduced.budget.used + coldReduced.budget.used,
        truncated: hot.budget.truncated + (tiers.hot.length - hotReduced.items.length) + warm.budget.truncated + (tiers.warm.length - warmReduced.items.length) + cold.budget.truncated + (tiers.cold.length - coldReduced.items.length),
      },
      wasLimited: true,
    },
  };
}

/**
 * Read budget config from environment or use defaults.
 */
export function getBudgetConfig(): ContextBudgetConfig {
  const hot = parseInt(process.env.AGENT_CONTEXT_BUDGET_HOT ?? "", 10);
  const warm = parseInt(process.env.AGENT_CONTEXT_BUDGET_WARM ?? "", 10);
  const cold = parseInt(process.env.AGENT_CONTEXT_BUDGET_COLD ?? "", 10);
  const total = parseInt(process.env.AGENT_CONTEXT_BUDGET_TOTAL ?? "", 10);

  return {
    hot: Number.isFinite(hot) && hot > 0 ? hot : DEFAULT_CONTEXT_BUDGET.hot,
    warm: Number.isFinite(warm) && warm > 0 ? warm : DEFAULT_CONTEXT_BUDGET.warm,
    cold: Number.isFinite(cold) && cold > 0 ? cold : DEFAULT_CONTEXT_BUDGET.cold,
    total: Number.isFinite(total) && total > 0 ? total : DEFAULT_CONTEXT_BUDGET.total,
  };
}
