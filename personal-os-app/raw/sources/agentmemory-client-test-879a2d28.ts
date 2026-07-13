import { afterEach, describe, expect, it, vi } from "vitest";
import { searchAgentMemoryEpisodes } from "@/lib/agentmemory-client";

const previousEnabled = process.env.AGENT_CONTEXT_AGENTMEMORY_ENABLED;
const previousUrl = process.env.AGENT_CONTEXT_AGENTMEMORY_URL;
const previousLimit = process.env.AGENT_CONTEXT_AGENTMEMORY_LIMIT;
const previousTimeout = process.env.AGENT_CONTEXT_AGENTMEMORY_TIMEOUT_MS;

const restoreEnv = () => {
  if (previousEnabled === undefined) {
    delete process.env.AGENT_CONTEXT_AGENTMEMORY_ENABLED;
  } else {
    process.env.AGENT_CONTEXT_AGENTMEMORY_ENABLED = previousEnabled;
  }

  if (previousUrl === undefined) {
    delete process.env.AGENT_CONTEXT_AGENTMEMORY_URL;
  } else {
    process.env.AGENT_CONTEXT_AGENTMEMORY_URL = previousUrl;
  }

  if (previousLimit === undefined) {
    delete process.env.AGENT_CONTEXT_AGENTMEMORY_LIMIT;
  } else {
    process.env.AGENT_CONTEXT_AGENTMEMORY_LIMIT = previousLimit;
  }

  if (previousTimeout === undefined) {
    delete process.env.AGENT_CONTEXT_AGENTMEMORY_TIMEOUT_MS;
  } else {
    process.env.AGENT_CONTEXT_AGENTMEMORY_TIMEOUT_MS = previousTimeout;
  }
};

describe("agentmemory client", () => {
  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it("is disabled until the Personal OS agent context integration is explicitly enabled", async () => {
    delete process.env.AGENT_CONTEXT_AGENTMEMORY_ENABLED;
    delete process.env.AGENT_CONTEXT_AGENTMEMORY_URL;
    const fetchImpl = vi.fn();

    const hits = await searchAgentMemoryEpisodes("Code X vector memory", {
      fetchImpl,
    });

    expect(hits).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps compact smart-search results into bounded context hits", async () => {
    process.env.AGENT_CONTEXT_AGENTMEMORY_ENABLED = "true";
    process.env.AGENT_CONTEXT_AGENTMEMORY_URL = "http://agentmemory.local";
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              obsId: "mem_1",
              title: "Code X vector memory integration validation",
              type: "decision",
              sessionId: "memory",
              timestamp: "2026-07-01T15:51:11.945Z",
              score: 0.01639344262295082,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const hits = await searchAgentMemoryEpisodes("  Code X   vector memory  ", {
      fetchImpl,
      limit: 3,
      timeoutMs: 1_000,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://agentmemory.local/agentmemory/smart-search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ query: "Code X vector memory", limit: 3 }),
      }),
    );
    expect(hits).toEqual([
      {
        id: "mem_1",
        title: "Code X vector memory integration validation",
        summary: "agentmemory:decision session:memory",
        relevanceScore: 16,
        createdAt: "2026-07-01T15:51:11.945Z",
        sessionId: "memory",
        memoryType: "decision",
      },
    ]);
  });

  it("falls back to no hits when agentmemory is unavailable", async () => {
    process.env.AGENT_CONTEXT_AGENTMEMORY_ENABLED = "true";
    process.env.AGENT_CONTEXT_AGENTMEMORY_URL = "http://agentmemory.local";
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const hits = await searchAgentMemoryEpisodes("Code X vector memory", {
      fetchImpl,
      timeoutMs: 10,
    });

    expect(hits).toEqual([]);
  });
});
