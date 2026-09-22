import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http")>("@/lib/http");
  return { ...actual, requireReadAccess: vi.fn() };
});
vi.mock("@/lib/agent-context", () => ({
  getAgentContext: vi.fn(async () => ({ generatedAt: "2026-07-01", tiers: { hot: [{ type: "task", title: "演示任务" }], warm: [], cold: [] }, nextAction: "核对结果", policy: {} })),
  getQueryAgentContext: vi.fn(async () => ({ generatedAt: "2026-07-01", tiers: { hot: [], warm: [{ type: "wiki", title: "演示知识" }], cold: [] }, nextAction: "查看知识", policy: {} })),
}));
import { GET } from "../../src/app/api/agent/context-pack/route";
afterEach(() => vi.unstubAllEnvs());
describe("上下文预算请求隔离", () => {
  it("并发预算互不干扰，也不写入进程环境", async () => {
    vi.stubEnv("AGENT_CONTEXT_BUDGET_TOTAL", "4500");
    const [first, second] = await Promise.all([
      GET(new Request("https://example.invalid/api/agent/context-pack?taskId=test&budgetTotal=200")),
      GET(new Request("https://example.invalid/api/agent/context-pack?q=test&budgetTotal=800")),
    ]);
    expect((await first.json()).context.budget.total.max).toBe(200);
    expect((await second.json()).context.budget.total.max).toBe(800);
    expect(process.env.AGENT_CONTEXT_BUDGET_TOTAL).toBe("4500");
  });
  it("拒绝不完整或过大的预算", async () => {
    for (const value of ["3x", "0", "-2", "100001"]) expect((await GET(new Request(`https://example.invalid/api/agent/context-pack?q=test&budgetTotal=${value}`))).status).toBe(400);
  });
  it("说明统计范围，避免把局部估算说成整个响应大小", async () => {
    const body = await (await GET(new Request("https://example.invalid/api/agent/context-pack?q=test&compact=1"))).json();
    expect(body.budgetScope).toBe("tiers"); expect(body.context).not.toHaveProperty("wiki");
  });
});
