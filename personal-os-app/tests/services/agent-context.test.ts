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
    expect(context.evidence.episodes).toEqual([]);
    expect(context.tiers.hot).toEqual([]);
    expect(context.tiers.warm).toEqual([]);
    expect(context.tiers.cold[0]).toMatchObject({ type: "policy" });
    expect(context.policy.canReadWiki).toBe(true);
    expect(context.wiki.status).toBe("empty");
    expect(context.nextAction).toBe("无高优先级可执行任务；运行 GitHub 雷达获取新任务");
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
    const activityLogFindMany = vi.fn().mockResolvedValue([]);

    const context = await getQueryAgentContext("personal os wiki", {
      task: { findMany: taskFindMany },
      activityLog: { findMany: activityLogFindMany },
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
    expect(context.evidence.episodes[0]).toMatchObject({
      type: "wiki",
      id: "projects/personal-os/context-tiering.md",
    });
    expect(context.nextAction).toBe("执行 P0 Agent 任务：把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0");
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
    expect(context.evidence.episodes[0]).toMatchObject({
      type: "wiki",
      id: "projects/personal-os/context-tiering-decision.md",
    });
    expect(context.nextAction).toBe("继续执行当前任务：把 /api/agent/context 输出升级为 hot/warm/cold 三层上下文 v0");
  });

  it("recalls related activity episodes for query keywords", async () => {
    mockedSearchWikiNotes.mockResolvedValue([]);
    const activityLogFindMany = vi.fn().mockResolvedValue([
      {
        id: "act_1",
        actorType: "system",
        action: "wiki.ingest.failed",
        targetType: "wiki",
        targetId: "wiki_1",
        createdAt: "2026-06-23T12:00:00.000Z",
      },
      {
        id: "act_2",
        actorType: "system",
        action: "task.submitted",
        targetType: "task",
        targetId: "task_1",
        createdAt: "2026-06-23T11:00:00.000Z",
      },
    ]);

    const context = await getQueryAgentContext("wiki write failed", {
      activityLog: { findMany: activityLogFindMany },
    });

    expect(context.evidence.episodes).toHaveLength(1);
    expect(context.evidence.episodes[0]).toMatchObject({
      type: "activity",
      id: "act_1",
      title: "wiki.ingest.failed on wiki",
      relevanceScore: 12,
    });
  });

  it("recommends investigating failed agent runs when recent failures exist", async () => {
    mockedSearchWikiNotes.mockResolvedValue([]);
    const taskFindMany = vi.fn().mockResolvedValue([]);
    const activityLogFindMany = vi.fn().mockResolvedValue([
      {
        id: "act_fail_1",
        actorType: "hermes",
        action: "agentRun.failed",
        targetType: "agentRun",
        targetId: "run_1",
        createdAt: "2026-06-23T22:08:27.000Z",
      },
      {
        id: "act_fail_2",
        actorType: "hermes",
        action: "agentRun.failed",
        targetType: "agentRun",
        targetId: "run_2",
        createdAt: "2026-06-23T22:08:02.000Z",
      },
    ]);

    const context = await getQueryAgentContext("agent executable tasks", {
      task: { findMany: taskFindMany },
      activityLog: { findMany: activityLogFindMany },
    });

    expect(context.nextAction).toBe("调查最近 2 个失败的 AgentRun");
  });

  it("recalls task contribution episodes when task has matching history", async () => {
    mockedSearchWikiNotes.mockResolvedValue([
      {
        title: "Wiki write failure runbook",
        path: "runbooks/wiki-write-failure.md",
        tags: ["runbook"],
        concepts: ["wiki"],
        excerpt: "Steps to recover from wiki write failures.",
      },
    ]);

    const task = {
      id: "task_current",
      title: "Fix wiki write pipeline",
      description: "Debug and fix wiki write failures.",
      status: "doing",
      priority: "P0",
      riskLevel: "low",
      executionMode: "agent_allowed",
      agentTags: ["personal-os", "wiki"],
      ownerAgent: "hermes",
      leaseUntil: new Date(Date.now() + 60_000).toISOString(),
      nextAction: "Apply the fix from previous runbook.",
      definitionOfDone: "Wiki writes succeed.",
      projectId: "project_1",
      sourceInboxItemId: null,
      sourceAgentRunId: null,
      project: { id: "project_1", name: "Personal OS" },
      sourceInboxItem: null,
      sourceAgentRun: {
        model: "hermes-agent",
        reasoningSummary: "Wiki write failed due to timeout.",
        outputSummary: "Applied retry logic and succeeded.",
      },
      wikiLinks: [],
      contributions: [
        {
          agentId: "obsidianmanager1",
          summary: "Fixed wiki write timeout by adding retry logic.",
          createdAt: "2026-06-23T10:00:00.000Z",
        },
      ],
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

    const episodes = context.evidence.episodes;
    expect(episodes.length).toBeGreaterThanOrEqual(3);
    expect(episodes.some((e) => e.type === "wiki")).toBe(true);
    expect(episodes.some((e) => e.type === "agent_run")).toBe(true);
    expect(episodes.some((e) => e.type === "task" && e.summary.includes("retry logic"))).toBe(true);
  });
});
