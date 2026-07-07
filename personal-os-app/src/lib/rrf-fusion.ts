/**
 * Weighted Reciprocal Rank Fusion (RRF) for multi-source retrieval.
 *
 * Ported from the algorithm layer of EverMind-AI/Raven's
 * `memory_engine/skill_forge/{router,fusion}.py` (SkillForgeRouter).
 * Raven itself is pre-alpha and not depended on directly — only the
 * fusion formula, over-fetch strategy, and failure isolation pattern
 * were adopted, then re-implemented natively in TypeScript for
 * Personal OS's `/api/agent/context` retrieval layer.
 *
 * Formula (unchanged from Raven):
 *   rrf_score(d) = Σ_i  w_i / (RRF_K + rank_i(d))
 * summed over every source i that returned d, where rank_i(d) is the
 * 1-based rank of d within source i's ranked result list.
 */

export const DEFAULT_RRF_K = 60;
export const DEFAULT_OVER_FETCH_FACTOR = 2;

export type RankedItem<T> = {
  /** Stable dedup key across sources, e.g. `${type}:${id}`. */
  key: string;
  /** Original per-source relevance score, used to pick the representative item on ties. */
  score: number;
  item: T;
};

export type RrfSourceInput<T> = {
  name: string;
  /** Source reliability weight. Higher weight = more trusted source. */
  weight: number;
  /** Already ranked (best first) list of items from this source. */
  items: RankedItem<T>[];
};

export type FusedRrfResult<T> = {
  key: string;
  /** Representative item: the one with the highest original per-source score. */
  item: T;
  rrfScore: number;
  contributingSources: string[];
  perSourceRank: Record<string, number>;
};

/**
 * Fuse multiple already-ranked, weighted result lists into a single
 * ranked list using weighted RRF. Sources that returned zero items
 * (e.g. because they failed and were isolated upstream) simply
 * contribute nothing — no special-casing needed here.
 */
export function weightedRrfFuse<T>(
  sources: RrfSourceInput<T>[],
  options: { rrfK?: number } = {},
): FusedRrfResult<T>[] {
  const rrfK = options.rrfK ?? DEFAULT_RRF_K;
  const byKey = new Map<string, FusedRrfResult<T> & { bestScore: number }>();

  for (const source of sources) {
    source.items.forEach((ranked, index) => {
      const rank = index + 1; // 1-based rank within this source
      const contribution = source.weight / (rrfK + rank);
      const existing = byKey.get(ranked.key);

      if (existing) {
        existing.rrfScore += contribution;
        existing.perSourceRank[source.name] = rank;
        if (!existing.contributingSources.includes(source.name)) {
          existing.contributingSources.push(source.name);
        }
        if (ranked.score > existing.bestScore) {
          existing.bestScore = ranked.score;
          existing.item = ranked.item;
        }
      } else {
        byKey.set(ranked.key, {
          key: ranked.key,
          item: ranked.item,
          rrfScore: contribution,
          contributingSources: [source.name],
          perSourceRank: { [source.name]: rank },
          bestScore: ranked.score,
        });
      }
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ bestScore: _bestScore, ...rest }) => rest);
}

/**
 * Over-fetch helper: ask each source for `k * factor` items so the RRF
 * fusion step has enough candidates per source to actually change the
 * final ranking (mirrors Raven's `over_fetch_factor`, default 2).
 */
export function overFetchLimit(
  finalLimit: number,
  factor: number = DEFAULT_OVER_FETCH_FACTOR,
): number {
  return Math.max(finalLimit, Math.round(finalLimit * factor));
}

/**
 * Failure isolation wrapper: run a source search and swallow any error,
 * returning an empty list instead. Mirrors Raven's `_safe_search`, which
 * ensures a single misbehaving source can never break the whole fusion.
 */
export async function safeSearch<T>(
  sourceName: string,
  fn: () => Promise<T[]>,
  onError?: (sourceName: string, error: unknown) => void,
): Promise<T[]> {
  try {
    return await fn();
  } catch (error) {
    onError?.(sourceName, error);
    return [];
  }
}
