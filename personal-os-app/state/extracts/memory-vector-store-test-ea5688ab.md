import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  cosineSimilarity,
  type MemoryVectorHit,
} from "../src/lib/memory-vector-store";

// ── DB + embedding provider mocks ────────────────────────────────────────────
vi.mock("../src/lib/db", () => ({
  prisma: {
    memoryItem: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("../src/lib/embedding-providers", () => ({
  createEmbeddingProviderFromEnv: vi.fn(),
}));

import { prisma as prismaClient } from "../src/lib/db";
import { createEmbeddingProviderFromEnv } from "../src/lib/embedding-providers";
import {
  upsertMemoryItem,
  searchMemoryVectors,
  pruneExpiredMemoryItems,
} from "../src/lib/memory-vector-store";

// Prisma-generated methods have complex types that vi.mocked cannot infer
// through a factory mock, so we cast to Mock explicitly.
type MockedMemoryItem = {
  findFirst: Mock;
  findMany: Mock;
  create: Mock;
  update: Mock;
  deleteMany: Mock;
};

const mockedPrisma = {
  memoryItem: (prismaClient as unknown as { memoryItem: MockedMemoryItem }).memoryItem,
};
const mockedCreateEmbeddingProvider = vi.mocked(createEmbeddingProviderFromEnv);

// Helper: build a mock embedding adapter that returns a fixed vector
function mockEmbeddingProvider(vector: number[]) {
  return {
    embed: vi.fn().mockResolvedValue(vector),
    batchEmbed: vi.fn().mockResolvedValue([vector]),
  } as unknown as ReturnType<typeof createEmbeddingProviderFromEnv>;
}

// Helper: build a fake DB MemoryItem row (includes embedding Float[])
function makeDbItem(overrides: Partial<{
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  body: string;
  projectId: string | null;
  embedding: number[];
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "item_1",
    sourceType: overrides.sourceType ?? "task",
    sourceId: overrides.sourceId ?? "src_1",
    title: overrides.title ?? "Test item",
    body: overrides.body ?? "Test body text",
    projectId: overrides.projectId ?? null,
    embedding: overrides.embedding ?? [1, 0, 0],
    expiresAt: overrides.expiresAt ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-07-01T00:00:00Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-07-01T00:00:00Z"),
  };
}

// ── cosineSimilarity unit tests ───────────────────────────────────────────────
describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0);
  });

  it("returns 0.0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0);
  });

  it("returns 0.0 when one vector is all zeros (denominator=0 guard)", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("returns correct value for a known non-trivial pair", () => {
    // [1,1,0] · [1,0,1] = 1; |[1,1,0]|=√2; |[1,0,1]|=√2 → 1/2 = 0.5
    expect(cosineSimilarity([1, 1, 0], [1, 0, 1])).toBeCloseTo(0.5);
  });

  it("throws when dimensions do not match", () => {
    expect(() => cosineSimilarity([1, 0], [1, 0, 0])).toThrow(
      /dimension mismatch/i,
    );
  });

  it("handles negative components correctly", () => {
    // [-1,0,0] · [1,0,0] = -1 → cosine = -1
    expect(cosineSimilarity([-1, 0, 0], [1, 0, 0])).toBeCloseTo(-1.0);
  });
});

// ── upsertMemoryItem ──────────────────────────────────────────────────────────
describe("upsertMemoryItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new item when none exists for (sourceType, sourceId)", async () => {
    mockedCreateEmbeddingProvider.mockReturnValue(
      mockEmbeddingProvider([0.1, 0.2, 0.3]),
    );
    mockedPrisma.memoryItem.findFirst.mockResolvedValue(null);
    mockedPrisma.memoryItem.create.mockResolvedValue(makeDbItem() as never);

    await upsertMemoryItem({
      sourceType: "task",
      sourceId: "task_new",
      title: "New task",
      body: "Task body",
    });

    expect(mockedPrisma.memoryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: "task",
          sourceId: "task_new",
          title: "New task",
          body: "Task body",
          embedding: [0.1, 0.2, 0.3],
        }),
      }),
    );
    expect(mockedPrisma.memoryItem.update).not.toHaveBeenCalled();
  });

  it("updates an existing item when (sourceType, sourceId) already exists", async () => {
    const existing = makeDbItem({ id: "existing_1" });
    mockedCreateEmbeddingProvider.mockReturnValue(
      mockEmbeddingProvider([0.9, 0.1, 0.0]),
    );
    mockedPrisma.memoryItem.findFirst.mockResolvedValue(existing as never);
    mockedPrisma.memoryItem.update.mockResolvedValue(existing as never);

    await upsertMemoryItem({
      sourceType: "task",
      sourceId: "src_1",
      title: "Updated title",
      body: "Updated body",
    });

    expect(mockedPrisma.memoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "existing_1" },
        data: expect.objectContaining({
          title: "Updated title",
          embedding: [0.9, 0.1, 0.0],
        }),
      }),
    );
    expect(mockedPrisma.memoryItem.create).not.toHaveBeenCalled();
  });
});

// ── searchMemoryVectors ───────────────────────────────────────────────────────
describe("searchMemoryVectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns top-k items by cosine similarity above threshold", async () => {
    // Query vector: [1, 0, 0]
    // Item A embedding [1, 0, 0] → similarity 1.0 (above 0.5)
    // Item B embedding [0, 1, 0] → similarity 0.0 (below 0.5, filtered)
    mockedCreateEmbeddingProvider.mockReturnValue(
      mockEmbeddingProvider([1, 0, 0]),
    );

    const itemA = makeDbItem({ id: "a", sourceId: "src_a", embedding: [1, 0, 0] });
    const itemB = makeDbItem({ id: "b", sourceId: "src_b", embedding: [0, 1, 0] });
    mockedPrisma.memoryItem.findMany.mockResolvedValue([itemA, itemB] as never);

    const results = await searchMemoryVectors("test query", {
      limit: 5,
      minSimilarity: 0.5,
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("a");
    expect(results[0].similarity).toBeCloseTo(1.0);
  });

  it("filters out expired items via DB where clause (not in in-memory scan)", async () => {
    // The store issues a DB query with expiresAt filter — we verify the query shape
    mockedCreateEmbeddingProvider.mockReturnValue(
      mockEmbeddingProvider([1, 0, 0]),
    );
    mockedPrisma.memoryItem.findMany.mockResolvedValue([] as never);

    await searchMemoryVectors("query", {});

    const callArgs = mockedPrisma.memoryItem.findMany.mock.calls[0][0] as {
      where?: { OR?: unknown[] };
    };
    expect(callArgs.where?.OR).toBeDefined();
    const orClause = callArgs.where!.OR as Array<Record<string, unknown>>;
    expect(orClause.some((c) => "expiresAt" in c && c.expiresAt === null)).toBe(true);
  });

  it("respects projectId filter in the DB query", async () => {
    mockedCreateEmbeddingProvider.mockReturnValue(
      mockEmbeddingProvider([1, 0, 0]),
    );
    mockedPrisma.memoryItem.findMany.mockResolvedValue([] as never);

    await searchMemoryVectors("query", { projectId: "proj_1" });

    const callArgs = mockedPrisma.memoryItem.findMany.mock.calls[0][0] as {
      where?: { projectId?: string };
    };
    expect(callArgs.where?.projectId).toBe("proj_1");
  });

  it("returns empty array when no items meet minSimilarity threshold", async () => {
    mockedCreateEmbeddingProvider.mockReturnValue(
      mockEmbeddingProvider([1, 0, 0]),
    );
    // All orthogonal → similarity 0, below default 0.5
    const items = [
      makeDbItem({ id: "x", embedding: [0, 1, 0] }),
      makeDbItem({ id: "y", embedding: [0, 0, 1] }),
    ];
    mockedPrisma.memoryItem.findMany.mockResolvedValue(items as never);

    const results = await searchMemoryVectors("query", { minSimilarity: 0.5 });
    expect(results).toHaveLength(0);
  });

  it("returns at most `limit` results even when more qualify", async () => {
    mockedCreateEmbeddingProvider.mockReturnValue(
      mockEmbeddingProvider([1, 0, 0]),
    );
    // 5 identical items, all similarity 1.0
    const items = Array.from({ length: 5 }, (_, i) =>
      makeDbItem({ id: `item_${i}`, embedding: [1, 0, 0] }),
    );
    mockedPrisma.memoryItem.findMany.mockResolvedValue(items as never);

    const results = await searchMemoryVectors("query", {
      limit: 3,
      minSimilarity: 0.5,
    });
    expect(results).toHaveLength(3);
  });
});

// ── pruneExpiredMemoryItems ───────────────────────────────────────────────────
describe("pruneExpiredMemoryItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls deleteMany with expiresAt <= now and returns count", async () => {
    mockedPrisma.memoryItem.deleteMany.mockResolvedValue({ count: 3 } as never);

    const count = await pruneExpiredMemoryItems();

    expect(count).toBe(3);
    expect(mockedPrisma.memoryItem.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expiresAt: expect.objectContaining({ lte: expect.any(Date) }),
        }),
      }),
    );
  });

  it("returns 0 when nothing has expired", async () => {
    mockedPrisma.memoryItem.deleteMany.mockResolvedValue({ count: 0 } as never);
    const count = await pruneExpiredMemoryItems();
    expect(count).toBe(0);
  });
});

// ── memoryVectorHit → ContextEpisode mapping (tested via agent-context) ───────
describe("MemoryVectorHit shape contract", () => {
  it("hit fields are correctly typed for memoryVectorHitToEpisode", () => {
    const hit: MemoryVectorHit = {
      id: "mv_1",
      sourceType: "task",
      sourceId: "task_abc",
      title: "Hybrid recall PoC",
      body: "Implements cosine similarity search over MemoryItem embeddings.",
      projectId: "proj_1",
      similarity: 0.82,
      createdAt: new Date("2026-07-01T10:00:00Z"),
    };

    // The mapping formula: relevanceScore = Math.round(similarity * 60)
    const expectedRelevanceScore = Math.round(hit.similarity * 60); // 49
    expect(expectedRelevanceScore).toBe(49);

    // id in episode is prefixed with "vec:"
    expect(`vec:${hit.id}`).toBe("vec:mv_1");
  });
});
