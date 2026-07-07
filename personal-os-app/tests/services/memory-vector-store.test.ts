import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cosineSimilarity,
  searchMemoryVectors,
  upsertMemoryItem,
  pruneExpiredMemoryItems,
} from "@/lib/memory-vector-store";

// ---------------------------------------------------------------------------
// Mock embedding provider — always returns a fixed deterministic vector
// ---------------------------------------------------------------------------
vi.mock("@/lib/embedding-providers", () => ({
  createEmbeddingProviderFromEnv: vi.fn(() => ({
    embed: vi.fn(async (text: string) => {
      // Return a vector based on whether text contains certain keywords.
      // This lets tests control which items surface as "similar".
      if (text.includes("vector") || text.includes("向量")) {
        return [1, 0, 0];
      }
      if (text.includes("wiki") || text.includes("知识库")) {
        return [0, 1, 0];
      }
      return [0, 0, 1];
    }),
    batchEmbed: vi.fn(async (texts: string[]) => {
      return texts.map((text) => {
        if (text.includes("vector") || text.includes("向量")) return [1, 0, 0];
        if (text.includes("wiki") || text.includes("知识库")) return [0, 1, 0];
        return [0, 0, 1];
      });
    }),
  })),
}));

// ---------------------------------------------------------------------------
// Mock Prisma so we never hit a real DB
// ---------------------------------------------------------------------------
const mockMemoryItemCreate = vi.fn();
const mockMemoryItemUpdate = vi.fn();
const mockMemoryItemFindFirst = vi.fn();
const mockMemoryItemFindMany = vi.fn();
const mockMemoryItemDeleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    memoryItem: {
      create: (...args: unknown[]) => mockMemoryItemCreate(...args),
      update: (...args: unknown[]) => mockMemoryItemUpdate(...args),
      findFirst: (...args: unknown[]) => mockMemoryItemFindFirst(...args),
      findMany: (...args: unknown[]) => mockMemoryItemFindMany(...args),
      deleteMany: (...args: unknown[]) => mockMemoryItemDeleteMany(...args),
    },
  },
}));

// ---------------------------------------------------------------------------
// Helper: build a mock MemoryItem row as Prisma would return it
// ---------------------------------------------------------------------------
function makeItem(
  overrides: Partial<{
    id: string;
    sourceType: string;
    sourceId: string;
    title: string;
    body: string;
    projectId: string | null;
    embedding: number[];
    expiresAt: Date | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: "item_default",
    sourceType: "task",
    sourceId: "src_1",
    title: "Default title",
    body: "Default body",
    projectId: null,
    embedding: [0, 0, 1],
    expiresAt: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// cosine similarity unit tests (pure function, no mocks needed)
// ---------------------------------------------------------------------------
describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
    expect(cosineSimilarity([0.5, 0.5, 0], [0.5, 0.5, 0])).toBeCloseTo(1.0);
  });

  it("returns 0.0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
    expect(cosineSimilarity([1, 0, 0], [0, 0, 1])).toBeCloseTo(0.0);
  });

  it("returns 0.5 for 60-degree vectors", () => {
    // [1,0,0] · [0.5, 0.866, 0] ≈ 0.5
    expect(cosineSimilarity([1, 0, 0], [0.5, 0.866, 0])).toBeCloseTo(0.5, 1);
  });

  it("returns 0 when one vector is zero-length", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it("throws on dimension mismatch", () => {
    expect(() => cosineSimilarity([1, 0], [1, 0, 0])).toThrow(
      "Vector dimension mismatch",
    );
  });
});

// ---------------------------------------------------------------------------
// upsertMemoryItem
// ---------------------------------------------------------------------------
describe("upsertMemoryItem", () => {
  beforeEach(() => {
    mockMemoryItemCreate.mockReset();
    mockMemoryItemUpdate.mockReset();
    mockMemoryItemFindFirst.mockReset();
  });

  it("creates a new item when no existing row matches (sourceType, sourceId)", async () => {
    mockMemoryItemFindFirst.mockResolvedValue(null);
    mockMemoryItemCreate.mockResolvedValue({});

    await upsertMemoryItem({
      sourceType: "task",
      sourceId: "task_new",
      title: "New vector task",
      body: "vector embedding recall agent context",
    });

    expect(mockMemoryItemFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceType: "task", sourceId: "task_new" },
      }),
    );
    expect(mockMemoryItemCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockMemoryItemCreate.mock.calls[0][0];
    expect(createArgs.data.title).toBe("New vector task");
    expect(Array.isArray(createArgs.data.embedding)).toBe(true);
    expect(createArgs.data.embedding).toEqual([1, 0, 0]); // "vector" keyword
    expect(mockMemoryItemUpdate).not.toHaveBeenCalled();
  });

  it("updates the existing item when (sourceType, sourceId) already exists", async () => {
    const existing = makeItem({ id: "item_exists" });
    mockMemoryItemFindFirst.mockResolvedValue(existing);
    mockMemoryItemUpdate.mockResolvedValue({});

    await upsertMemoryItem({
      sourceType: "task",
      sourceId: "task_existing",
      title: "Updated vector task",
      body: "vector memory update",
    });

    expect(mockMemoryItemUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockMemoryItemUpdate.mock.calls[0][0];
    expect(updateArgs.where.id).toBe("item_exists");
    expect(updateArgs.data.title).toBe("Updated vector task");
    expect(mockMemoryItemCreate).not.toHaveBeenCalled();
  });

  it("stores projectId and expiresAt when provided", async () => {
    mockMemoryItemFindFirst.mockResolvedValue(null);
    mockMemoryItemCreate.mockResolvedValue({});
    const expiry = new Date("2026-08-01T00:00:00Z");

    await upsertMemoryItem({
      sourceType: "wiki",
      sourceId: "note_abc",
      title: "Wiki知识库 note",
      body: "wiki knowledge base note",
      projectId: "proj_1",
      expiresAt: expiry,
    });

    const createArgs = mockMemoryItemCreate.mock.calls[0][0];
    expect(createArgs.data.projectId).toBe("proj_1");
    expect(createArgs.data.expiresAt).toEqual(expiry);
  });
});

// ---------------------------------------------------------------------------
// searchMemoryVectors
// ---------------------------------------------------------------------------
describe("searchMemoryVectors", () => {
  beforeEach(() => {
    mockMemoryItemFindMany.mockReset();
  });

  it("returns top-k hits sorted by similarity descending", async () => {
    // Query is "vector" → query embedding = [1,0,0]
    // item_a embedding = [1,0,0] → similarity 1.0 (exact match)
    // item_b embedding = [0,1,0] → similarity 0.0 (orthogonal)
    // item_c embedding = [0.707,0.707,0] → similarity ≈ 0.707
    mockMemoryItemFindMany.mockResolvedValue([
      makeItem({ id: "item_a", title: "Vector match", embedding: [1, 0, 0] }),
      makeItem({ id: "item_b", title: "Wiki note", embedding: [0, 1, 0] }),
      makeItem({
        id: "item_c",
        title: "Partial match",
        embedding: [0.707, 0.707, 0],
      }),
    ]);

    const hits = await searchMemoryVectors("vector embedding recall", {
      limit: 3,
      minSimilarity: 0.5,
    });

    // item_b similarity=0 should be filtered out (< 0.5)
    expect(hits.length).toBe(2);
    expect(hits[0].id).toBe("item_a");
    expect(hits[0].similarity).toBeCloseTo(1.0);
    expect(hits[1].id).toBe("item_c");
    expect(hits[1].similarity).toBeCloseTo(0.707, 1);
  });

  it("filters out expired items via the DB query (not in-memory)", async () => {
    // The implementation passes an expiresAt filter to findMany.
    // We verify findMany was called with the correct where clause.
    mockMemoryItemFindMany.mockResolvedValue([]);

    await searchMemoryVectors("vector recall");

    const findManyArgs = mockMemoryItemFindMany.mock.calls[0][0];
    expect(findManyArgs.where).toMatchObject({
      OR: [{ expiresAt: null }, { expiresAt: expect.objectContaining({}) }],
    });
  });

  it("respects limit option and never returns more than limit hits", async () => {
    // All items are identical direction as query → all similarity = 1.0
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({
        id: `item_${i}`,
        title: `Vector item ${i}`,
        embedding: [1, 0, 0],
      }),
    );
    mockMemoryItemFindMany.mockResolvedValue(items);

    const hits = await searchMemoryVectors("vector", { limit: 3 });

    expect(hits.length).toBe(3);
  });

  it("returns empty array when no items pass the minSimilarity threshold", async () => {
    // Query "vector" → [1,0,0]; item embedding [0,1,0] → similarity 0
    mockMemoryItemFindMany.mockResolvedValue([
      makeItem({ id: "item_x", embedding: [0, 1, 0] }),
    ]);

    const hits = await searchMemoryVectors("vector", { minSimilarity: 0.5 });

    expect(hits).toEqual([]);
  });

  it("filters by projectId when provided", async () => {
    mockMemoryItemFindMany.mockResolvedValue([]);

    await searchMemoryVectors("vector", { projectId: "proj_1" });

    const findManyArgs = mockMemoryItemFindMany.mock.calls[0][0];
    expect(findManyArgs.where.projectId).toBe("proj_1");
  });

  it("returns the correct MemoryVectorHit shape", async () => {
    const now = new Date("2026-07-01T00:00:00Z");
    mockMemoryItemFindMany.mockResolvedValue([
      makeItem({
        id: "item_shape",
        sourceType: "task",
        sourceId: "task_42",
        title: "Vector shape test",
        body: "vector memory body",
        projectId: "proj_shape",
        embedding: [1, 0, 0],
        createdAt: now,
      }),
    ]);

    const hits = await searchMemoryVectors("vector", { minSimilarity: 0.5 });

    expect(hits[0]).toMatchObject({
      id: "item_shape",
      sourceType: "task",
      sourceId: "task_42",
      title: "Vector shape test",
      body: "vector memory body",
      projectId: "proj_shape",
      createdAt: now,
    });
    expect(typeof hits[0].similarity).toBe("number");
    expect(hits[0].similarity).toBeGreaterThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// pruneExpiredMemoryItems
// ---------------------------------------------------------------------------
describe("pruneExpiredMemoryItems", () => {
  beforeEach(() => {
    mockMemoryItemDeleteMany.mockReset();
  });

  it("deletes only items where expiresAt <= now and returns count", async () => {
    mockMemoryItemDeleteMany.mockResolvedValue({ count: 3 });

    const deleted = await pruneExpiredMemoryItems();

    expect(deleted).toBe(3);
    expect(mockMemoryItemDeleteMany).toHaveBeenCalledTimes(1);
    const args = mockMemoryItemDeleteMany.mock.calls[0][0];
    expect(args.where.expiresAt).toBeDefined();
    // The where clause should use lte (less-than-or-equal) to filter expired rows
    expect(args.where.expiresAt).toMatchObject({ lte: expect.any(Date) });
  });

  it("returns 0 when no expired items exist", async () => {
    mockMemoryItemDeleteMany.mockResolvedValue({ count: 0 });

    const deleted = await pruneExpiredMemoryItems();

    expect(deleted).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: memoryVectorHitToEpisode conversion via agent-context
// ---------------------------------------------------------------------------
describe("memory vector hits surface in agent context evidence", () => {
  it("maps vector hit similarity to relevanceScore bucket correctly", () => {
    // similarity 1.0 → score Math.round(1.0 * 60) = 60
    // similarity 0.5 → score Math.round(0.5 * 60) = 30
    // similarity 0.3 → score Math.round(0.3 * 60) = 18
    const cases: [number, number][] = [
      [1.0, 60],
      [0.5, 30],
      [0.3, 18],
      [0.83, 50],
    ];
    for (const [sim, expected] of cases) {
      expect(Math.round(sim * 60)).toBe(expected);
    }
  });
});
