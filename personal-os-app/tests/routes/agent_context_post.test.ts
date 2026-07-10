import { afterEach, describe, expect, it, vi } from "vitest";

const contextRequest = (body: unknown) =>
  new Request("http://os.local/api/agent/context", {
    method: "POST",
    headers: {
      authorization: "Bearer os-read-token-0000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("POST /api/agent/context", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("normalizes snake-case required refs into the structured retrieval contract", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "os-read-token-0000");
    const getQueryAgentContext = vi.fn().mockResolvedValue({ memoryItems: [] });
    vi.doMock("@/lib/db", () => ({ prisma: { marker: "db" } }));
    vi.doMock("@/lib/agent-context", () => ({
      getAgentContext: vi.fn(),
      getQueryAgentContext,
    }));
    const { POST } = await import("@/app/api/agent/context/route");

    const response = await POST(
      contextRequest({
        query: "召回评测",
        scope: { projectName: "Personal OS", sourceType: "agent-output" },
        required_refs: [
          {
            memory_id: "wiki:vault/memory-eval.md",
            version: 3,
            chunk_id: "结论",
          },
        ],
        top_k: 5,
        budget: { tokens: 900 },
      }),
    );

    expect(response.status).toBe(200);
    expect(getQueryAgentContext).toHaveBeenCalledWith(
      "召回评测",
      { marker: "db" },
      {
        scope: { projectName: "Personal OS", sourceType: "agent-output" },
        requiredRefs: [
          {
            memoryId: "wiki:vault/memory-eval.md",
            path: undefined,
            title: undefined,
            version: 3,
            chunkId: "结论",
            onMissing: "fail",
          },
        ],
        topK: 5,
        budgetTokens: 900,
      },
    );
  });
});
