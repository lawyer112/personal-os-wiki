import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ingestAgentRun, ingestTask } from "@/lib/memory-ingestion";
import { upsertMemoryItem } from "@/lib/memory-vector-store";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/memory-vector-store", () => ({
  upsertMemoryItem: vi.fn(),
}));

const mockedUpsert = vi.mocked(upsertMemoryItem);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Flush setImmediate queue so fire-and-forget calls are drained.
 */
function flushImmediate(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// ── Setup ─────────────────────────────────────────────────────────────────────

describe("memory-ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Enable embedding so ingestion paths are active
    process.env.EMBEDDING_MODEL = "text-embedding-3-small";
  });

  afterEach(() => {
    delete process.env.EMBEDDING_MODEL;
  });

  // ── ingestAgentRun ──────────────────────────────────────────────────────────

  describe("ingestAgentRun", () => {
    it("calls upsertMemoryItem with agent_run sourceType after setImmediate", async () => {
      mockedUpsert.mockResolvedValue(undefined);

      ingestAgentRun({
        id: "run_abc",
        model: "claude-sonnet-5",
        reasoningSummary: "Analyzed context pack structure.",
        outputSummary: "Added hot/warm/cold tiers to response.",
      });

      // Not called synchronously — fire-and-forget
      expect(mockedUpsert).not.toHaveBeenCalled();

      await flushImmediate();

      expect(mockedUpsert).toHaveBeenCalledOnce();
      const call = mockedUpsert.mock.calls[0][0];
      expect(call.sourceType).toBe("agent_run");
      expect(call.sourceId).toBe("run_abc");
      expect(call.body).toContain("Analyzed context pack structure.");
      expect(call.body).toContain("Added hot/warm/cold tiers to response.");
      expect(call.title).toContain("run_abc");
      expect(call.title).toContain("claude-sonnet-5");
      expect(call.expiresAt).toBeInstanceOf(Date);
      expect(call.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it("skips upsert when both reasoningSummary and outputSummary are empty", async () => {
      ingestAgentRun({
        id: "run_empty",
        model: null,
        reasoningSummary: null,
        outputSummary: null,
      });

      await flushImmediate();

      expect(mockedUpsert).not.toHaveBeenCalled();
    });

    it("skips upsert when EMBEDDING_MODEL is not set", async () => {
      delete process.env.EMBEDDING_MODEL;

      mockedUpsert.mockResolvedValue(undefined);

      ingestAgentRun({
        id: "run_noenv",
        model: "claude-sonnet-5",
        reasoningSummary: "Some summary",
        outputSummary: "Some output",
      });

      await flushImmediate();

      expect(mockedUpsert).not.toHaveBeenCalled();
    });

    it("swallows upsert errors without throwing", async () => {
      mockedUpsert.mockRejectedValue(new Error("embedding service unavailable"));

      // Should not throw — fire-and-forget error handling
      expect(() =>
        ingestAgentRun({
          id: "run_err",
          model: "test-model",
          reasoningSummary: "Some reasoning",
          outputSummary: "Some output",
        }),
      ).not.toThrow();

      // Flush and confirm the error was swallowed (no unhandled rejection)
      await flushImmediate();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockedUpsert).toHaveBeenCalledOnce();
    });

    it("sets expiresAt ~30 days in the future", async () => {
      mockedUpsert.mockResolvedValue(undefined);
      const before = Date.now();

      ingestAgentRun({
        id: "run_ttl",
        model: "test-model",
        reasoningSummary: "reasoning",
        outputSummary: null,
      });

      await flushImmediate();

      const call = mockedUpsert.mock.calls[0][0];
      const ttlMs = call.expiresAt!.getTime() - before;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      // Allow ±5 s tolerance
      expect(ttlMs).toBeGreaterThan(thirtyDays - 5_000);
      expect(ttlMs).toBeLessThan(thirtyDays + 5_000);
    });
  });

  // ── ingestTask ──────────────────────────────────────────────────────────────

  describe("ingestTask", () => {
    it("calls upsertMemoryItem with task sourceType after setImmediate", async () => {
      mockedUpsert.mockResolvedValue(undefined);

      ingestTask({
        id: "task_xyz",
        title: "为 /api/agent/context 增加向量+episode 混合召回 PoC",
        description: "设计 memory_item schema 与索引/召回流程",
        nextAction: "优先复用 Personal OS 数据和现有 embedding-providers",
        definitionOfDone:
          "/api/agent/context?q=code x 记忆 向量 能召回本次评估记录和相关 P0/P1 任务",
        projectId: "proj_001",
      });

      expect(mockedUpsert).not.toHaveBeenCalled();

      await flushImmediate();

      expect(mockedUpsert).toHaveBeenCalledOnce();
      const call = mockedUpsert.mock.calls[0][0];
      expect(call.sourceType).toBe("task");
      expect(call.sourceId).toBe("task_xyz");
      expect(call.title).toBe(
        "为 /api/agent/context 增加向量+episode 混合召回 PoC",
      );
      expect(call.body).toContain("schema");
      expect(call.body).toContain("embedding-providers");
      expect(call.projectId).toBe("proj_001");
      expect(call.expiresAt).toBeInstanceOf(Date);
    });

    it("skips upsert when EMBEDDING_MODEL is not set", async () => {
      delete process.env.EMBEDDING_MODEL;

      ingestTask({
        id: "task_noenv",
        title: "Some task",
        description: null,
        nextAction: null,
        definitionOfDone: null,
        projectId: null,
      });

      await flushImmediate();

      expect(mockedUpsert).not.toHaveBeenCalled();
    });

    it("sets expiresAt ~90 days in the future", async () => {
      mockedUpsert.mockResolvedValue(undefined);
      const before = Date.now();

      ingestTask({
        id: "task_ttl",
        title: "task title",
        description: "description",
        nextAction: null,
        definitionOfDone: null,
        projectId: null,
      });

      await flushImmediate();

      const call = mockedUpsert.mock.calls[0][0];
      const ttlMs = call.expiresAt!.getTime() - before;
      const ninetyDays = 90 * 24 * 60 * 60 * 1000;
      expect(ttlMs).toBeGreaterThan(ninetyDays - 5_000);
      expect(ttlMs).toBeLessThan(ninetyDays + 5_000);
    });
  });
});
