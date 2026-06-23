import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildContextSearchQueries,
  getAgentContext,
  getQueryAgentContext,
  searchWikiContext,
} from "@/lib/agent-context";
import { searchWikiNotes } from "@/lib/wiki-client";

vi.mock("@/lib/wiki-client", () => ({
  searchWikiNotes: vi.fn(),
  wikiNoteUrl: (path: string) =>
    `http://wiki.local/note?path=${encodeURIComponent(path)}`,
}));

const mockedSearchWikiNotes = vi.mocked(searchWikiNotes);

describe("agent context harness", () => {
  beforeEach(() => {
    mockedSearchWikiNotes.mockReset();
  });

  it("builds bounded search queries from a task without requiring model intelligence", () => {
    const queries = buildContextSearchQueries({
      id: "task_1",
      title: "确认 DeepTalk 转写的可导出路径",
      description: "钉钉暂时没有明确自动 API，先把能稳定拿到文字的路径确认清楚。",
      status: "todo",
      priority: "P1",
      nextAction: "验证手动导出、文件上传和 Telegram 转发哪条最稳。",
      definitionOfDone: "形成 DeepTalk 输入链路的可行清单。",
      project: { id: "project_1", name: "Personal OS" },
    });

    expect(queries).toContain("确认 DeepTalk 转写的可导出路径");
    expect(queries).toContain("Personal OS");
    expect(queries).toContain("DeepTalk");
    expect(queries).toContain("Telegram");
    expect(queries).not.toContain("Personal");
    expect(queries.length).toBeLessThanOrEqual(8);
  });

  it("marks a reachable wiki with no candidates as empty instead of unavailable", async () => {
    mockedSearchWikiNotes.mockResolvedValue([]);

    const result = await searchWikiContext(["没有命中的关键词"], 8);

    expect(result.status).toBe("empty");
    expect(result.successfulQueries).toBe(1);
    expect(result.failedQueries).toEqual([]);
    expect(result.candidates).toEqual([]);
  });

  it("marks complete wiki failure as unavailable and preserves failure evidence", async () => {
    mockedSearchWikiNotes.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const result = await searchWikiContext(["DeepTalk"], 8);

    expect(result.status).toBe("unavailable");
    expect(result.successfulQueries).toBe(0);
    expect(result.failedQueries).toEqual([
      { query: "DeepTalk", message: "connect ECONNREFUSED" },
    ]);
  });

  it("marks mixed search results as partial and still returns usable candidates", async () => {
    mockedSearchWikiNotes.mockImplementation(async (query) => {
      if (query === "DeepTalk") {
        return [
          {
            title: "DeepTalk 输入链路",
            path: "voice/deeptalk.md",
            tags: ["deeptalk", "input"],
            concepts: ["语音转文字"],
            excerpt: "DeepTalk 转写先走导出文件或 Telegram 转发。",
          },
        ];
      }

      throw new Error("Personal Wiki search failed: 502");
    });

    const result = await searchWikiContext(["DeepTalk", "钉钉"], 8);

    expect(result.status).toBe("partial");
    expect(result.successfulQueries).toBe(1);
    expect(result.failedQueries).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      title: "DeepTalk 输入链路",
      url: "http://wiki.local/note?path=voice%2Fdeeptalk.md",
      matchedQueries: ["DeepTalk"],
    });
  });

  it("returns the same context envelope for keyword-only lookups", async () => {
    mockedSearchWikiNotes.mockResolvedValue([]);

    const context = await getQueryAgentContext("DeepTalk");

    expect(context.task).toBeNull();
    expect(context.searchQueries).toEqual(["DeepTalk"]);
    expect(context.recentTasks).toEqual([]);
    expect(context.relatedIdeas).toEqual([]);
    expect(context.activity).toEqual([]);
    expect(context.tiers.hot).toEqual([]);
    expect(context.tiers.warm).toEqual([]);
    expect(context.tiers.cold[0]).toMatchObject({ type: "policy" });
    expect(context.policy.canReadWiki).toBe(true);
    expect(context.wiki.status).toBe("empty");
  });

  it("adds P0/P1 agent executable tasks to hot tier for keyword lookups", async () => {
    mockedSearchWikiNotes.mockResolvedValue([
      {
        title: "Personal OS context memory tiering",
        path: "projects/personal-os/context-tiering.md",
        tags: ["personal-os", "context"],
        concepts: ["hot warm cold"],
        excerpt: "Historical Wiki evidence for hot/warm/cold context packs.",
      },
    ]);
    const taskFindMany = vi.fn().mockResolvedValue([
      {
        id: "task_hot",
        title: "把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0",
        status: "todo",
        priority: "P0",
        riskLevel: "low",
        executionMode: "agent_allowed",
        ownerAgent: null,
        leaseUntil: null,
        nextAction: "Add tiers to the context response.",
        definitionOfDone: "Query context returns tiers.hot/warm/cold.",
        project: { id: "project_1", name: "Personal OS" },
      },
    ]);

    const context = await getQueryAgentContext("personal os wiki", {
      task: { findMany: taskFindMany },
    });

    expect(taskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        include: { project: true },
      }),
    );
    expect(context.tiers.hot[0]).toMatchObject({
      type: "task",
      id: "task_hot",
      priority: "P0",
      status: "todo",
    });
    expect(context.tiers.warm[0]).toMatchObject({
      type: "wiki",
      path: "projects/personal-os/context-tiering.md",
    });
  });

  it("puts the current task in hot tier and historical wiki hits in warm tier", async () => {
    mockedSearchWikiNotes.mockResolvedValue([
      {
        title: "Agent context tiering decision record",
        path: "projects/personal-os/context-tiering-decision.md",
        tags: ["personal-os", "wiki"],
        concepts: ["Agent Context"],
        excerpt: "Decision record for current task plus historical Wiki hit.",
      },
    ]);

    const task = {
      id: "task_current",
      title: "把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0",
      description: "Add context tiers.",
      status: "doing",
      priority: "P0",
      riskLevel: "low",
      executionMode: "agent_allowed",
      agentTags: ["personal-os", "context"],
      ownerAgent: "hermes",
      leaseUntil: new Date(Date.now() + 60_000).toISOString(),
      nextAction: "Implement tiers.",
      definitionOfDone: "Context response keeps old fields and adds tiers.",
      projectId: "project_1",
      sourceInboxItemId: null,
      sourceAgentRunId: null,
      project: { id: "project_1", name: "Personal OS" },
      sourceInboxItem: null,
      sourceAgentRun: null,
      wikiLinks: [],
      contributions: [],
      artifacts: [],
      reviews: [],
    };

    const context = await getAgentContext(
      {
        task: {
          findUnique: vi.fn().mockResolvedValue(task),
          findMany: vi.fn().mockResolvedValue([]),
        },
        idea: { findMany: vi.fn().mockResolvedValue([]) },
        activityLog: { findMany: vi.fn().mockResolvedValue([]) },
      },
      "task_current",
    );

    expect(context.tiers.hot[0]).toMatchObject({
      type: "task",
      id: "task_current",
      reason: "current task being executed",
    });
    expect(context.tiers.warm[0]).toMatchObject({
      type: "wiki",
      path: "projects/personal-os/context-tiering-decision.md",
    });
  });
});
