import { describe, expect, it } from "vitest";
import {
  DEFAULT_RRF_K,
  overFetchLimit,
  safeSearch,
  weightedRrfFuse,
  type RrfSourceInput,
} from "@/lib/rrf-fusion";

describe("weightedRrfFuse", () => {
  it("computes rrf_score(d) = sum(w_i / (k + rank_i(d))) across sources", () => {
    const sources: RrfSourceInput<{ id: string }>[] = [
      {
        name: "wiki",
        weight: 1.5,
        items: [
          { key: "a", score: 90, item: { id: "a" } },
          { key: "b", score: 50, item: { id: "b" } },
        ],
      },
      {
        name: "vector",
        weight: 1,
        items: [
          { key: "b", score: 0.8, item: { id: "b" } },
          { key: "a", score: 0.4, item: { id: "a" } },
        ],
      },
    ];

    const fused = weightedRrfFuse(sources);

    // a: rank1 in wiki (w=1.5) + rank2 in vector (w=1)
    const expectedA = 1.5 / (DEFAULT_RRF_K + 1) + 1 / (DEFAULT_RRF_K + 2);
    // b: rank2 in wiki (w=1.5) + rank1 in vector (w=1)
    const expectedB = 1.5 / (DEFAULT_RRF_K + 2) + 1 / (DEFAULT_RRF_K + 1);

    const a = fused.find((f) => f.key === "a");
    const b = fused.find((f) => f.key === "b");

    expect(a?.rrfScore).toBeCloseTo(expectedA, 6);
    expect(b?.rrfScore).toBeCloseTo(expectedB, 6);
    // b wins overall since vector rank1 (higher weight-normalized contribution) plus wiki rank2
    expect(fused[0].key).toBe(expectedA > expectedB ? "a" : "b");
  });

  it("dedups by key and accumulates contributing_sources across sources", () => {
    const sources: RrfSourceInput<{ id: string }>[] = [
      {
        name: "source_1",
        weight: 1,
        items: [{ key: "shared", score: 10, item: { id: "shared_from_1" } }],
      },
      {
        name: "source_2",
        weight: 1,
        items: [{ key: "shared", score: 99, item: { id: "shared_from_2" } }],
      },
    ];

    const fused = weightedRrfFuse(sources);

    expect(fused).toHaveLength(1);
    expect(fused[0].contributingSources).toEqual(["source_1", "source_2"]);
    // Representative item picked from the source with the higher original score
    expect(fused[0].item.id).toBe("shared_from_2");
    expect(fused[0].perSourceRank).toEqual({ source_1: 1, source_2: 1 });
  });

  it("isolates a failed source: it contributes nothing but does not break fusion", () => {
    const sources: RrfSourceInput<{ id: string }>[] = [
      {
        name: "healthy",
        weight: 1,
        items: [{ key: "x", score: 5, item: { id: "x" } }],
      },
      {
        // Represents a source whose safeSearch() failed upstream and returned [].
        name: "failed",
        weight: 2,
        items: [],
      },
    ];

    const fused = weightedRrfFuse(sources);

    expect(fused).toHaveLength(1);
    expect(fused[0].key).toBe("x");
    expect(fused[0].contributingSources).toEqual(["healthy"]);
  });

  it("returns an empty list when all sources are empty", () => {
    expect(weightedRrfFuse([])).toEqual([]);
    expect(
      weightedRrfFuse([{ name: "empty", weight: 1, items: [] }]),
    ).toEqual([]);
  });

  it("sorts fused results by descending rrf_score", () => {
    const sources: RrfSourceInput<{ id: string }>[] = [
      {
        name: "s1",
        weight: 1,
        items: [
          { key: "low", score: 1, item: { id: "low" } },
          { key: "high", score: 2, item: { id: "high" } },
        ],
      },
    ];
    // Reverse the ranking on purpose: "low" comes first (rank 1) but scores lower
    const fused = weightedRrfFuse(sources);
    expect(fused[0].key).toBe("low"); // rank 1 beats rank 2 regardless of raw score
    expect(fused[0].rrfScore).toBeGreaterThan(fused[1].rrfScore);
  });
});

describe("overFetchLimit", () => {
  it("multiplies the final limit by the over-fetch factor (default 2)", () => {
    expect(overFetchLimit(5)).toBe(10);
    expect(overFetchLimit(8)).toBe(16);
  });

  it("uses a custom factor when provided", () => {
    expect(overFetchLimit(5, 3)).toBe(15);
  });

  it("never returns less than the original limit", () => {
    expect(overFetchLimit(5, 0.1)).toBe(5);
  });
});

describe("safeSearch", () => {
  it("returns the resolved items on success", async () => {
    const result = await safeSearch("ok_source", async () => [1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  it("isolates a throwing source and returns an empty list instead of throwing", async () => {
    let capturedName: string | undefined;
    let capturedError: unknown;

    const result = await safeSearch(
      "flaky_source",
      async () => {
        throw new Error("boom");
      },
      (name, error) => {
        capturedName = name;
        capturedError = error;
      },
    );

    expect(result).toEqual([]);
    expect(capturedName).toBe("flaky_source");
    expect(capturedError).toBeInstanceOf(Error);
  });

  it("isolates a rejected promise the same way as a thrown error", async () => {
    const result = await safeSearch("rejecting_source", () =>
      Promise.reject(new Error("network down")),
    );
    expect(result).toEqual([]);
  });
});
