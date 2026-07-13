import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildContextSearchQueries,
  getAgentContext,
  getQueryAgentContext,
  searchWikiContext,
} from "@/lib/agent-context";
import { searchAgentMemoryEpisodes } from "@/lib/agentmemory-client";
import { searchWikiChunks, searchWikiNotes } from "@/lib/wiki-client";

vi.mock("@/lib/agentmemory-client", () => ({
  searchAgentMemoryEpisodes: vi.fn(),
}));

vi.mock("@/lib/wiki-client", () => ({
  searchWikiChunks: vi.fn(),
  searchWikiNotes: vi.fn(),
  wikiNoteUrl: (path: string) =>
    `http://wiki.local/note?path=${encodeURIComponent(path)}`,
}));

vi.mock("@/lib/memory-vector-store", () => ({
  searchMemoryVectors: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/swarmvault-mcp-client", () => ({
  searchSwarmVaultContext: vi.fn().mockResolvedValue([]),
}));

import { searchMemoryVectors } from "@/lib/memory-vector-store";
import { searchSwarmVaultContext } from "@/lib/swarmvault-mcp-client";

const mockedSearchMemoryVectors = vi.mocked(searchMemoryVectors);
const mockedSearchSwarmVaultContext = vi.mocked(searchSwarmVaultContext);
const mockedSearchAgentMemoryEpisodes = vi.mocked(searchAgentMemoryEpisodes);
const mockedSearchWikiChunks = vi.mocked(searchWikiChunks);
const mockedSearchWikiNotes = vi.mocked(searchWikiNotes);

function resetMocks() {
  mockedSearchAgentMemoryEpisodes.mockReset();
  mockedSearchAgentMemoryEpisodes.mockResolvedValue([]);
  mockedSearchMemoryVectors.mockReset();
  mockedSearchMemoryVectors.mockResolvedValue([]);
  mockedSearchSwarmVaultContext.mockReset();
  mockedSearchSwarmVaultContext.mockResolvedValue([]);
  mockedSearchWikiChunks.mockReset();
  mockedSearchWikiNotes.mockReset();
}

describe("agent context harness", () => {
  beforeEach(() => {
    resetMocks();
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
    mockedSearchWikiChunks.mockResolvedValue({ status: "ok", results: [] });

    const result = await searchWikiContext(["没有命中的关键词"], 8);

    expect(result.status).toBe("empty");
    expect(result.successfulQueries).toBe(1);
    expect(result.failedQueries).toEqual([]);
    expect(result.candidates).toEqual([]);
  });

  it("uses a single fast chunk search for wiki context and never falls back to notes scanning", async () => {
    mockedSearchWikiChunks.mockResolvedValue({
      status: "ok",
      results: [
        {
          title: "DeepTalk 输入链路",
          path: "voice/deeptalk.md",
          chunk_id: "voice/deeptalk.md#0001",
          snippet: "DeepTalk 转写先走导出文件或 Telegram 转发。",
        },
      ],
    });

    const result = await searchWikiContext(["DeepTalk", "Telegram"], 8);

    expect(mockedSearchWikiChunks).toHaveBeenCalledTimes(1);
    expect(mockedSearchWikiChunks.mock.calls[0][0]).toContain("DeepTalk");
    expect(mockedSearchWikiChunks.mock.calls[0][0]).toContain("Telegram");
    expect(mockedSearchWikiNotes).not.toHaveBeenCalled();
    expect(result.status).toBe("ok");
    expect(result.successfulQueries).toBe(1);
    expect(result.failedQueries).toEqual([]);
    expect(result.candidates[0]).toMatchObject({
      title: "DeepTalk 输入链路",
      path: "voice/deeptalk.md",
      excerpt: "DeepTalk 转写先走导出文件或 Telegram 转发。",
      metadata: {
        chunk_id: "voice/deeptalk.md#0001",
        retrieval: "wiki-chunks-fts",
      },
      url: "http://wiki.local/note?path=voice%2Fdeeptalk.md",
      matchedQueries: expect.arrayContaining(["DeepTalk", "Telegram"]),
    });
  });

  it("marks complete wiki failure as unavailable and preserves failure evidence", async () => {
    mockedSearchWikiChunks.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const result = await searchWikiContext(["DeepTalk"], 8);

    expect(result.status).toBe("unavailable");
    expect(result.successfulQueries).toBe(0);
    expect(result.failedQueries).toEqual([
      { query: "DeepTalk", message: "connect ECONNREFUSED" },
    ]);
  });

  it("keeps the fast path unavailable when the chunk index fails instead of using slow notes fallback", async () => {
    mockedSearchWikiChunks.mockRejectedValue(new Error("Personal Wiki fast search failed: 502"));
    mockedSearchWikiNotes.mockResolvedValue([
      {
        title: "DeepTalk 输入链路",
        path: "voice/deeptalk.md",
        tags: ["deeptalk", "input"],
        concepts: ["语音转文字"],
        excerpt: "DeepTalk 转写先走导出文件或 Telegram 转发。",
      },
    ]);

    const result = await searchWikiContext(["DeepTalk", "钉钉"], 8);

    expect(result.status).toBe("unavailable");
    expect(result.successfulQueries).toBe(0);
    expect(result.failedQueries).toHaveLength(1);
    expect(mockedSearchWikiNotes).not.toHaveBeenCalled();
    expect(result.candidates).toEqual([]);
  });

  it("marks a hung wiki search query as failed instead of blocking context", async () => {
    const previousTimeout = process.env.AGENT_CONTEXT_WIKI_QUERY_TIMEOUT_MS;
    process.env.AGENT_CONTEXT_WIKI_QUERY_TIMEOUT_MS = "10";
    mockedSearchWikiChunks.mockImplementation(async () => new Promise(() => undefined));

    try {
      const result = await Promise.race([
        searchWikiContext(["hung", "DeepTalk"], 8),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("context timed out")), 50);
        }),
      ]);

      expect(result.status).toBe("unavailable");
      expect(result.successfulQueries).toBe(0);
      expect(result.failedQueries).toEqual([
        {
          query: "hung DeepTalk",
          message: "Personal Wiki search timed out after 10ms",
        },
      ]);
      expect(mockedSearchWikiNotes).not.toHaveBeenCalled();
      expect(result.candidates).toEqual([]);
    } finally {
      if (previousTimeout === undefined) {
        delete process.env.AGENT_CONTEXT_WIKI_QUERY_TIMEOUT_MS;
      } else {
        process.env.AGENT_CONTEXT_WIKI_QUERY_TIMEOUT_MS = previousTimeout;
      }
    }
  });

  it("returns the same context envelope for keyword-only lookups", async () => {
    mockedSearchWikiChunks.mockResolvedValue({ status: "ok", results: [] });

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

  it("adds agentmemory hits to query evidence without changing wiki tiers", async () => {
    mockedSearchWikiChunks.mockResolvedValue({ status: "ok", results: [] });
    mockedSearchAgentMemoryEpisodes.mockResolvedValue([
      {
        id: "mem_vector",
        title: "Code X vector memory integration validation",
        summary: "agentmemory:decision session:memory",
        relevanceScore: 42,
        createdAt: "2026-07-01T15:51:11.945Z",
        sessionId: "memory",
        memoryType: "decision",
      },
    ]);

    const context = await getQueryAgentContext("Code X vector memory");

    expect(mockedSearchAgentMemoryEpisodes).toHaveBeenCalledWith(
      "Code X vector memory",
    );
    expect(context.evidence.episodes[0]).toMatchObject({
      type: "agentmemory",
      id: "mem_vector",
      title: "Code X vector memory integration validation",
      relevanceScore: 42,
      source: { type: "agentmemory", id: "mem_vector" },
      provenance: {
        sourceType: "agentmemory",
        sourceId: "mem_vector",
        createdAt: "2026-07-01T15:51:11.945Z",
      },
    });
    expect(context.tiers.hot).toEqual([]);
    expect(context.tiers.warm).toEqual([]);
  });

  it("adds P0/P1 agent executable tasks to hot tier for keyword lookups", async () => {
    mockedSearchWikiChunks.mockResolvedValue({
      status: "ok",
      results: [
        {
          title: "Personal OS context memory tiering",
          path: "projects/personal-os/context-tiering.md",
          snippet: "Historical Wiki evidence for hot/warm/cold context packs.",
        },
      ],
    });
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
    mockedSearchWikiChunks.mockResolvedValue({
      status: "ok",
      results: [
        {
          title: "Agent context tiering decision record",
          path: "projects/personal-os/context-tiering-decision.md",
          snippet: "Decision record for current task plus historical Wiki hit.",
        },
      ],
    });

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
    mockedSearchWikiChunks.mockResolvedValue({ status: "ok", results: [] });
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
      source: {
        type: "activity",
        id: "act_1",
      },
      provenance: {
        sourceType: "activity",
        sourceId: "act_1",
        createdAt: "2026-06-23T12:00:00.000Z",
      },
    });
  });

  it("adds provenance to wiki, agent run, and task contribution episodes", async () => {
    mockedSearchWikiChunks.mockResolvedValue({
      status: "ok",
      results: [
        {
          title: "Wiki write failure runbook",
          path: "runbooks/wiki-write-failure.md",
          snippet: "Steps to recover from wiki write failures.",
        },
      ],
    });

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
      sourceAgentRunId: "run_1",
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

    expect(context.evidence.episodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "wiki",
          id: "runbooks/wiki-write-failure.md",
          source: expect.objectContaining({
            type: "wiki",
            id: "runbooks/wiki-write-failure.md",
            path: "runbooks/wiki-write-failure.md",
          }),
          provenance: expect.objectContaining({
            sourceType: "wiki",
            sourceId: "runbooks/wiki-write-failure.md",
            sourcePath: "runbooks/wiki-write-failure.md",
          }),
        }),
        expect.objectContaining({
          type: "agent_run",
          id: "run_1",
          source: { type: "agent_run", id: "run_1" },
          provenance: { sourceType: "agent_run", sourceId: "run_1" },
        }),
        expect.objectContaining({
          type: "task",
          id: "task_current",
          source: { type: "task", id: "task_current" },
          provenance: expect.objectContaining({
            sourceType: "task",
            sourceId: "task_current",
          }),
        }),
      ]),
    );
  });

  it("recommends investigating failed agent runs when recent failures exist", async () => {
    mockedSearchWikiChunks.mockResolvedValue({ status: "ok", results: [] });
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
    mockedSearchWikiChunks.mockResolvedValue({
      status: "ok",
      results: [
        {
          title: "Wiki write failure runbook",
          path: "runbooks/wiki-write-failure.md",
          snippet: "Steps to recover from wiki write failures.",
        },
      ],
    });

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

  // ── vector recall integration tests ──────────────────────────────────────────

  it("includes vector hits in evidence.episodes for query lookups (happy path)", async () => {
    mockedSearchWikiChunks.mockResolvedValue({ status: "ok", results: [] });
    mockedSearchMemoryVectors.mockResolvedValue([
      {
        id: "mv_1",
        sourceType: "task",
        sourceId: "task_vec_1",
        title: "向量召回 PoC 设计",
        body: "实现基于 cosine similarity 的 MemoryItem 检索，与 episode 混合排序后注入 context。",
        projectId: "proj_vec",
        similarity: 0.85,
        createdAt: new Date("2026-07-01T10:00:00Z"),
      },
    ]);

    const context = await getQueryAgentContext("向量召回 memory context");

    expect(mockedSearchMemoryVectors).toHaveBeenCalledWith(
      expect.stringContaining("向量召回"),
      expect.objectContaining({ limit: 5, minSimilarity: 0.5 }),
    );

    const vecEpisode = context.evidence.episodes.find((e) => e.id === "vec:mv_1");
    expect(vecEpisode).toBeDefined();
    expect(vecEpisode).toMatchObject({
      type: "agentmemory",
      id: "vec:mv_1",
      title: "向量召回 PoC 设计",
      // similarity 0.85 → Math.round(0.85 * 60) = 51
      relevanceScore: 51,
      provenance: expect.objectContaining({
        sourceType: "task",
        sourceId: "task_vec_1",
      }),
    });
  });

  it("vector hit relevance score is computed correctly from similarity", async () => {
    mockedSearchWikiChunks.mockResolvedValue({ status: "ok", results: [] });
    const cases: Array<{ similarity: number; expectedScore: number }> = [
      { similarity: 1.0, expectedScore: 60 },
      { similarity: 0.5, expectedScore: 30 },
      { similarity: 0.0, expectedScore: 0 },
    ];

    for (const { similarity, expectedScore } of cases) {
      mockedSearchMemoryVectors.mockResolvedValue([
        {
          id: `mv_${similarity}`,
          sourceType: "wiki",
          sourceId: `wiki_${similarity}`,
          title: `Hit at ${similarity}`,
          body: "body",
          projectId: null,
          similarity,
          createdAt: new Date("2026-07-01T00:00:00Z"),
        },
      ]);

      const context = await getQueryAgentContext("test");
      const ep = context.evidence.episodes.find((e) => e.id === `vec:mv_${similarity}`);
      expect(ep?.relevanceScore).toBe(expectedScore);
    }
  });

  it("vector hits are merged with agentmemory hits and deduped by type:id key", async () => {
    mockedSearchWikiChunks.mockResolvedValue({ status: "ok", results: [] });
    // Both a vector hit and an agentmemory hit with the same "id" but different type prefix
    // They should be distinct episodes because vector uses "vec:<id>" prefix
    mockedSearchAgentMemoryEpisodes.mockResolvedValue([
      {
        id: "shared_1",
        title: "Agentmemory hit",
        summary: "From agentmemory store",
        relevanceScore: 30,
        createdAt: "2026-07-01T10:00:00Z",
        sessionId: "sess_1",
        memoryType: "fact",
      },
    ]);
    mockedSearchMemoryVectors.mockResolvedValue([
      {
        id: "vec_only",
        sourceType: "inbox",
        sourceId: "inbox_1",
        title: "Vector-only hit",
        body: "Local vector store result",
        projectId: null,
        similarity: 0.75,
        createdAt: new Date("2026-07-01T09:00:00Z"),
      },
    ]);

    const context = await getQueryAgentContext("mixed recall test");
    const ids = context.evidence.episodes.map((e) => e.id);

    expect(ids).toContain("shared_1");
    expect(ids).toContain("vec:vec_only");
  });

  it("gracefully degrades when searchMemoryVectors throws (evidence still populated from other sources)", async () => {
    mockedSearchWikiChunks.mockResolvedValue({
      status: "ok",
      results: [
        {
          title: "Fallback wiki note",
          path: "fallback/note.md",
          snippet: "Wiki fallback when vector store is down.",
        },
      ],
    });
    mockedSearchMemoryVectors.mockRejectedValue(new Error("vector store unavailable"));

    // Should not throw; vector errors are caught in agent-context.ts with .catch(() => [])
    const context = await getQueryAgentContext("degraded vector store");

    expect(context.evidence.episodes.some((e) => e.type === "wiki")).toBe(true);
    const hasVecEpisode = context.evidence.episodes.some((e) =>
      typeof e.id === "string" && e.id.startsWith("vec:"),
    );
    expect(hasVecEpisode).toBe(false);
  });

  it("includes vector hits in evidence for task-scoped getAgentContext", async () => {
    mockedSearchWikiChunks.mockResolvedValue({ status: "ok", results: [] });
    mockedSearchMemoryVectors.mockResolvedValue([
      {
        id: "mv_task_scope",
        sourceType: "agent_run",
        sourceId: "run_abc",
        title: "过期过滤验证 AgentRun",
        body: "AgentRun result: all expired items correctly excluded from recall.",
        projectId: "project_1",
        similarity: 0.72,
        createdAt: new Date("2026-07-02T08:00:00Z"),
      },
    ]);

    const task = {
      id: "task_scoped",
      title: "向量 + episode 混合召回验证",
      description: "验证 /api/agent/context 向量路径",
      status: "doing",
      priority: "P0",
      riskLevel: "low",
      executionMode: "agent_allowed",
      agentTags: [],
      ownerAgent: null,
      leaseUntil: null,
      nextAction: "跑离线评测",
      definitionOfDone: "向量命中正确注入 evidence.episodes；无 token 泄露",
      projectId: "project_1",
      sourceInboxItemId: null,
      sourceAgentRunId: null,
      project: { id: "project_1", name: "Personal OS / Wiki 知识库升级" },
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
      "task_scoped",
    );

    // Verify vector search was called with projectId scoping
    expect(mockedSearchMemoryVectors).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ projectId: "project_1" }),
    );

    const vecEp = context.evidence.episodes.find((e) => e.id === "vec:mv_task_scope");
    expect(vecEp).toBeDefined();
    expect(vecEp).toMatchObject({
      type: "agentmemory",
      // similarity 0.72 → Math.round(0.72 * 60) = 43
      relevanceScore: 43,
      provenance: expect.objectContaining({
        sourceType: "agent_run",
        sourceId: "run_abc",
      }),
    });
  });
});
