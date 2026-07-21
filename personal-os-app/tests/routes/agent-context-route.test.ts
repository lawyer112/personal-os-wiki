import { afterEach, describe, expect, it, vi } from "vitest";

const readRequest = (url: string, token = "os-read-token-00000") =>
  new Request(url, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

async function loadAgentContextRoute() {
  vi.resetModules();

  const mocks = {
    prisma: {},
    getAgentContext: vi.fn().mockResolvedValue({ mode: "task" }),
    getQueryAgentContext: vi.fn().mockResolvedValue({ mode: "query" }),
  };

  vi.doMock("@/lib/db", () => ({ prisma: mocks.prisma }));
  vi.doMock("@/lib/agent-context", () => ({
    getAgentContext: mocks.getAgentContext,
    getQueryAgentContext: mocks.getQueryAgentContext,
  }));

  const route = await import("@/app/api/agent/context/route");
  return { ...route, mocks };
}

describe("GET /api/agent/context", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("passes the budget query parameter to keyword context", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PERSONAL_OS_READ_TOKEN", "os-read-token-00000");

    const { GET, mocks } = await loadAgentContextRoute();
    const response = await GET(
      readRequest("http://os.local/api/agent/context?q=context&budget=4000"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, context: { mode: "query" } });
    expect(mocks.getQueryAgentContext).toHaveBeenCalledWith(
      "context",
      mocks.prisma,
      { budgetTokens: 4000 },
    );
  });
});
