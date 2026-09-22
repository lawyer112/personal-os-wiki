import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authenticateAgent, assertAgentRole, assertAgentScope, assertRunBinding } from "../../src/lib/agent-credentials";
const token = "test-worker-credential-only-for-unit-tests";
const principal = { agentId: "demo-worker", tokenHash: createHash("sha256").update(token).digest("hex"), role: "worker" as const, projectIds: ["project-demo"], maxConcurrent: 1 };
const configuration = JSON.stringify([principal]);
describe("独立智能体身份与执行批次", () => {
  it("凭证绑定身份，不接受请求自报的其他身份", () => expect(authenticateAgent(new Headers({ Authorization: `Bearer ${token}`, "X-Agent-Id": "admin" }), configuration).agentId).toBe("demo-worker"));
  it("没有配置时安全拒绝", () => expect(() => authenticateAgent(new Headers(), "")).toThrow("尚未配置"));
  it("拒绝 Cookie 代替独立凭证", () => expect(() => authenticateAgent(new Headers({ Cookie: `personal_os_read=${token}` }), configuration)).toThrow("缺少智能体凭证"));
  it("拒绝错误、重复与短凭证", () => {
    expect(() => authenticateAgent(new Headers({ Authorization: "Bearer wrong" }), configuration)).toThrow();
    expect(() => authenticateAgent(new Headers({ Authorization: `Bearer ${token}` }), JSON.stringify([principal, principal]))).toThrow("配置无效");
  });
  it("执行者不能自行复核", () => expect(() => assertAgentRole(principal, "reviewer")).toThrow("执行者不能审批"));
  it("限制项目与独立任务范围", () => {
    expect(() => assertAgentScope(principal, "project-demo")).not.toThrow();
    expect(() => assertAgentScope(principal, "other")).toThrow();
    expect(() => assertAgentScope(principal, null)).toThrow();
  });
  it("只接受当前执行者当前运行中的批次", () => {
    const run = { id: "run-2", taskId: "task-demo", agentId: principal.agentId, status: "running" };
    expect(() => assertRunBinding(principal, "task-demo", "run-2", run)).not.toThrow();
    for (const invalid of [null, { ...run, id: "old-run" }, { ...run, agentId: "other" }, { ...run, taskId: "other" }, { ...run, status: "submitted" }]) expect(() => assertRunBinding(principal, "task-demo", "run-2", invalid)).toThrow("批次已失效");
  });
});
