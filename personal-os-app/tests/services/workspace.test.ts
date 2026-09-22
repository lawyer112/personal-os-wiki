import { describe, expect, it } from "vitest";
import { claimReasons, leaseState, pageNumber, readWorkspaceQuery, safeLink, taskStage } from "../../src/lib/workspace";
const task = { id: "test", title: "测试任务", status: "todo", priority: "P2", riskLevel: "low", executionMode: "agent_allowed", agentTags: ["docs"], nextAction: "整理目录", definitionOfDone: "目录可检索" };
const agent = { id: "writer", displayName: "文档执行者", enabled: true, canWriteTasks: true, allowedRiskLevel: "low", tags: ["docs"] };
describe("中文工作台契约", () => {
  it("区分需求确认与交付验收", () => { expect(taskStage({ status: "review" })).toBe("intake"); expect(taskStage({ status: "review", submittedAt: "2026-01-01" })).toBe("submitted"); });
  it("授权并匹配的任务可以认领", () => expect(claimReasons(task, agent)).toEqual([]));
  it("未选执行者不伪称可认领", () => expect(claimReasons(task)).toContain("请先选择执行者"));
  it("禁止抢占有效租约，包括同身份重复认领", () => expect(claimReasons({ ...task, ownerAgent: agent.id, leaseUntil: new Date(2000) }, agent, 1000)).toContain("已有执行者持有任务"));
  it("过期租约可以重新竞争", () => expect(claimReasons({ ...task, status: "doing", ownerAgent: "old", leaseUntil: new Date(1000) }, agent, 2000)).toEqual([]));
  it("阻止高风险、未授权、禁用和不匹配执行者", () => {
    expect(claimReasons({ ...task, riskLevel: "high", executionMode: "manual" }, { ...agent, enabled: false, tags: [] })).toEqual(expect.arrayContaining(["高风险任务需要人工审批", "尚未授权自动执行", "执行者已停用", "执行者标签不匹配"]));
  });
  it("提交之后不把释放租约显示成掉线", () => expect(leaseState({ ...task, status: "review", ownerAgent: agent.id, submittedAt: "2026-01-01" })).toBe("成果待验收"));
  it("限制分页和未知筛选", () => { expect(pageNumber("-1")).toBe(1); expect(pageNumber("1.5")).toBe(1); expect(pageNumber("99999999")).toBe(100000); expect(readWorkspaceQuery(new URL("https://example.invalid/?stage=oops")).stage).toBe("all"); });
  it("拒绝脚本、协议相对地址、反斜线及控制字符", () => { for (const link of ["javascript:alert(1)", "data:text/html,test", "//example.invalid", "/\\evil", "https://examp\nle.invalid"]) expect(safeLink(link)).toBeUndefined(); });
  it("保留安全链接与站内知识引用", () => { expect(safeLink("/tasks/demo")).toBe("/tasks/demo"); expect(safeLink("wiki://vault/20_notes/demo.md")).toContain("/wiki?path="); });
});
