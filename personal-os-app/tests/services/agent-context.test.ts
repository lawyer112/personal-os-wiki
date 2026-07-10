import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildContextSearchQueries,
  buildQuerySearchQueries,
  getAgentContext,
  getQueryAgentContext,
  searchWikiContext,
} from "@/lib/agent-context";
import { readWikiNote, searchWikiNotes } from "@/lib/wiki-client";

vi.mock("@/lib/wiki-client", () => ({
  readWikiNote: vi.fn(),
  searchWikiNotes: vi.fn(),
  wikiNoteUrl: (path: string) =>
    `http://wiki.local/note?path=${encodeURIComponent(path)}`,
}));

const mockedSearchWikiNotes = vi.mocked(searchWikiNotes);
const mockedReadWikiNote = vi.mocked(readWikiNote);

describe("agent context harness", () => {
  beforeEach(() => {
    mockedSearchWikiNotes.mockReset();
    mockedReadWikiNote.mockReset();
  });

  it("resolves required Wiki chunks exactly and keeps them ahead of fuzzy recall", async () => {
    mockedSearchWikiNotes.mockResolvedValue([]);
    mockedReadWikiNote.mockResolvedValue({
      title: "外置记忆召回评测",
      path: "vault/memory-eval.md",
      content: "# 外置记忆召回评测\n\n## 结论\n必须优先使用 required_refs。\n\n## 下一步\n继续做模糊检索。",
      frontmatter: {
        memory_id: "memory:recall-eval",
        version: 3,
        status: "active",
        source_type: "agent-output",
      },
    });

    const context = await getQueryAgentContext("知识库 记忆", undefined, {
      requiredRefs: [
        {
          memoryId: "wiki:vault/memory-eval.md",
          version: 3,
          chunkId: "结论",
        },
      ],
      budgetTokens: 200,
      topK: 3,
    });

    expect(mockedReadWikiNote).toHaveBeenCalledWith("vault/memory-eval.md");
    expect(context.requiredRefs).toEqual([
      expect.objectContaining({
        memoryId: "memory:recall-eval",
        version: 3,
        chunkId: "结论",
        status: "resolved",
      }),
    ]);
    expect(context.memoryItems[0]).toMatchObject({
      title: "外置记忆召回评测",
      summary: expect.stringContaining("必须优先使用 required_refs"),
      metadata: {
        required: true,
        memoryId: "memory:recall-eval",
        version: 3,
        chunkId: "结论",
      },
    });
    expect(context.memoryItems[0].summary).not.toContain("继续做模糊检索");
  });

  it("fails closed when a required memory is unavailable", async () => {
    mockedSearchWikiNotes.mockResolvedValue([]);
    mockedReadWikiNote.mockRejectedValue(new Error("not found"));

    await expect(
      getQueryAgentContext("精确引用", undefined, {
        requiredRefs: [{ path: "vault/missing.md" }],
      }),
    ).rejects.toMatchObject({ status: 422 });
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

  it("does not expand vector lookups to unimplemented provider runtime names", () => {
    const queries = buildQuerySearchQueries("火山方舟 向量 检索");

    expect(queries).toContain("火山方舟");
    expect(queries).toContain("向量");
    expect(queries).not.toContain("火山方舟 向量");
    expect(queries).not.toContain("VolcengineRetriever");
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
    expect(context.tiers.hot.items).toEqual([]);
    expect(context.tiers.warm.items).toEqual([]);
    expect(context.tiers.cold.items[0]).toMatchObject({ type: "policy" });
    expect(context.policy.canReadWiki).toBe(true);
    expect(context.wiki.status).toBe("empty");
    expect(context.nextAction).toBe("无高优先级可执行任务；运行 GitHub 雷达获取新任务");
  });

  it("adds SwarmVault MCP candidates to keyword context and the hot tier", async () => {
    mockedSearchWikiNotes.mockResolvedValue([]);
    const swarmVaultSearch = vi.fn().mockResolvedValue({
      status: "ok",
      candidates: [
        {
          id: "node:code-memory",
          title: "Code memory hybrid recall",
          source: "graph",
          score: 91,
          excerpt: "Graph evidence linking code context with long-term memory.",
          matchedQueries: ["code x memory"],
        },
      ],
      searchedQueries: ["code x memory"],
      failedQueries: [],
    });

    const context = await getQueryAgentContext("code x memory", {
      swarmVault: { search: swarmVaultSearch },
    });

    expect(swarmVaultSearch).toHaveBeenCalledWith("code x memory", 5);
    expect(context.swarmvault.candidates[0]).toMatchObject({
      id: "node:code-memory",
      title: "Code memory hybrid recall",
      source: "graph",
    });
    expect(context.tiers.hot.items[0]).toMatchObject({
      type: "swarmvault",
      id: "node:code-memory",
      title: "Code memory hybrid recall",
      source: "graph",
      reason: "matched SwarmVault graph context",
    });
    expect(context.debug.retrieval).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "swarmvault",
          status: "ok",
          candidateCount: 1,
        }),
      ]),
    );
  });

  it("plans long keyword lookups into shorter wiki queries and exposes retrieval debug", async () => {
    mockedSearchWikiNotes.mockImplementation(async (query) => {
      if (query === "context 召回") {
        return [
          {
            title: "Personal OS 记忆产品改造：外部项目吸收方案与提示词影响",
            path: "vault/20_notes/2026-07-03/personal-os-memory-product-plan.md",
            tags: ["personal-os", "agent-memory"],
            concepts: ["context-retrieval"],
            excerpt: "短关键词能召回，长 query 需要 query planner + hybrid recall。",
          },
        ];
      }

      return [];
    });

    const context = await getQueryAgentContext(
      "Personal OS context 召回 改造 SwarmVault OpenViking 火山方舟 向量 提示词",
    );

    expect(context.searchQueries).toContain("context 召回");
    expect(mockedSearchWikiNotes).toHaveBeenCalledWith("context 召回", 6);
    expect(context.wiki.status).toBe("ok");
    expect(context.wiki.candidates[0]).toMatchObject({
      title: "Personal OS 记忆产品改造：外部项目吸收方案与提示词影响",
    });
    expect(context.wiki.candidates[0].matchedQueries).toContain("context 召回");
    expect(context.evidence.episodes[0]).toMatchObject({
      type: "wiki",
      id: "vault/20_notes/2026-07-03/personal-os-memory-product-plan.md",
    });
    expect(context.debug.retrieval).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "wiki",
          query: "context 召回",
          status: "ok",
          candidateCount: 1,
        }),
      ]),
    );
  });

  it("recalls matching agent run episodes for keyword lookups when wiki is empty", async () => {
    mockedSearchWikiNotes.mockResolvedValue([]);
    const agentRunFindMany = vi.fn().mockResolvedValue([
      {
        id: "run_xinyao",
        model: "codex-gpt-5",
        status: "completed",
        reasoningSummary: "用户提醒星耀星图馆源代码在 6.28 服务器。",
        outputSummary: "通过 SSH config 找到 qihuo-628 / 192.168.6.28，并定位网站运营与收录排查入口。",
        startedAt: "2026-07-03T12:00:00.000Z",
        inboxItem: {
          rawText: "评估星耀星图馆博客访问、Google 收录和广告方案。",
          sourceUrl: null,
        },
      },
    ]);

    const context = await getQueryAgentContext("星耀星图馆 6.28 qihuo-628 Google 收录", {
      agentRun: { findMany: agentRunFindMany },
    });

    expect(agentRunFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { inboxItem: true },
        take: 40,
      }),
    );
    expect(context.wiki.status).toBe("empty");
    expect(context.evidence.episodes[0]).toMatchObject({
      type: "agent_run",
      id: "run_xinyao",
      title: "codex-gpt-5",
      summary: expect.stringContaining("qihuo-628"),
      relevanceScore: 20,
    });
    expect(context.debug.retrieval).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "agent_run",
          status: "ok",
          candidateCount: 1,
        }),
      ]),
    );
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
    expect(context.tiers.hot.items[0]).toMatchObject({
      type: "task",
      id: "task_hot",
      priority: "P0",
      status: "todo",
    });
    expect(context.tiers.warm.items[0]).toMatchObject({
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

    expect(context.tiers.hot.items[0]).toMatchObject({
      type: "task",
      id: "task_current",
      reason: "current task being executed",
    });
    expect(context.tiers.warm.items[0]).toMatchObject({
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

  it("recalls wiki write failure repair episodes and runbook for keyword lookups", async () => {
    mockedSearchWikiNotes.mockImplementation(async (query) => {
      if (query === "wiki 写入失败") {
        return [
          {
            title: "Wiki 写入失败修复记录",
            path: "vault/20_notes/2026-07-04/wiki-write-failure-fix.md",
            tags: ["personal-wiki", "agent-output"],
            concepts: ["WikiWriteJob"],
            excerpt: "修复记录：Wiki 写入失败时检查 WikiWriteJob、补偿重试并做读回验证。",
          },
        ];
      }

      if (query === "wiki write failure runbook") {
        return [
          {
            title: "Wiki write failure runbook",
            path: "runbooks/wiki-write-failure.md",
            tags: ["runbook", "personal-wiki"],
            concepts: ["wiki write failed"],
            excerpt: "Runbook: check /api/wiki-write-jobs, retry failed jobs, then verify Personal OS context readback.",
          },
        ];
      }

      return [];
    });
    const agentRunFindMany = vi.fn().mockResolvedValue([
      {
        id: "run_wiki_fix",
        model: "codex-autodrive",
        status: "completed",
        reasoningSummary: "wiki write failed: found failed WikiWriteJob and missing readback verification.",
        outputSummary: "Repair record: added retry path and verified Wiki write succeeded with Personal OS context.",
        startedAt: "2026-07-04T10:00:00.000Z",
        inboxItem: {
          rawText: "Fix wiki write failed in the Personal OS writeback loop.",
          sourceUrl: null,
        },
      },
    ]);

    const context = await getQueryAgentContext("wiki write failed", {
      agentRun: { findMany: agentRunFindMany },
    });

    expect(context.searchQueries).toEqual(
      expect.arrayContaining(["wiki 写入失败", "wiki write failure runbook"]),
    );
    expect(mockedSearchWikiNotes).toHaveBeenCalledWith("wiki 写入失败", 6);
    expect(mockedSearchWikiNotes).toHaveBeenCalledWith(
      "wiki write failure runbook",
      6,
    );
    expect(context.evidence.episodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "agent_run",
          id: "run_wiki_fix",
          summary: expect.stringContaining("Repair record"),
        }),
        expect.objectContaining({
          type: "wiki",
          id: "vault/20_notes/2026-07-04/wiki-write-failure-fix.md",
          title: "Wiki 写入失败修复记录",
        }),
        expect.objectContaining({
          type: "wiki",
          id: "runbooks/wiki-write-failure.md",
          title: "Wiki write failure runbook",
        }),
      ]),
    );
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

  it("fuses multi-source memory candidates with weighted RRF telemetry", async () => {
    mockedSearchWikiNotes.mockResolvedValue([
      {
        title: "Shared Retrieval Pattern",
        path: "vault/20_notes/shared-retrieval-pattern.md",
        status: "auto",
        source_type: "agent-output",
        tags: ["personal-os", "retrieval"],
        concepts: ["weighted rrf"],
        excerpt: "Wiki evidence for weighted RRF retrieval.",
      },
    ]);
    const taskFindMany = vi.fn().mockResolvedValue([
      {
        id: "task_shared",
        title: "Shared Retrieval Pattern",
        status: "todo",
        priority: "P1",
        riskLevel: "low",
        executionMode: "agent_allowed",
        ownerAgent: null,
        leaseUntil: null,
        nextAction: "Implement the fusion router.",
        definitionOfDone: "Memory context exposes contributing sources.",
        project: { id: "project_1", name: "Personal OS" },
      },
    ]);
    const projectEventFindMany = vi.fn().mockResolvedValue([
      {
        id: "event_shared",
        title: "Shared Retrieval Pattern",
        body: "ProjectEvent notes that the source registry and task ledger agree.",
        eventType: "decision",
        createdAt: "2026-07-07T12:00:00.000Z",
        project: { id: "project_1", name: "Personal OS" },
      },
    ]);
    const swarmVaultSearch = vi.fn().mockResolvedValue({
      status: "ok",
      candidates: [
        {
          id: "sv_shared",
          title: "Shared Retrieval Pattern",
          source: "graph",
          score: 92,
          excerpt: "Agentmemory graph confirms the retrieval pattern.",
          matchedQueries: ["Shared Retrieval Pattern"],
        },
      ],
      searchedQueries: ["Shared Retrieval Pattern"],
      failedQueries: [],
    });
    const sourceRegistrySearch = vi.fn().mockResolvedValue({
      status: "ok",
      candidates: [
        {
          id: "registry_shared",
          title: "Shared Retrieval Pattern",
          summary: "Source registry candidate for the same retrieval pattern.",
          score: 88,
          sourceUrl: "https://example.test/retrieval",
          metadata: { decision: "candidate" },
        },
      ],
      searchedQueries: ["Shared Retrieval Pattern"],
      failedQueries: [],
    });

    const context = await getQueryAgentContext("Shared Retrieval Pattern", {
      task: { findMany: taskFindMany },
      projectEvent: { findMany: projectEventFindMany },
      swarmVault: { search: swarmVaultSearch },
      sourceRegistry: { search: sourceRegistrySearch },
    });

    const fused = context.memoryItems.find(
      (item) => item.title === "Shared Retrieval Pattern",
    );

    expect(fused).toBeDefined();
    expect(
      context.memoryItems.filter((item) => item.title === "Shared Retrieval Pattern"),
    ).toHaveLength(1);
    expect(fused?.metadata).toMatchObject({
      contributing_sources: expect.arrayContaining([
        "wiki",
        "task",
        "project_event",
        "swarmvault",
        "source_registry",
      ]),
      sourceWeights: expect.objectContaining({
        wiki: expect.any(Number),
        task: expect.any(Number),
        project_event: expect.any(Number),
        swarmvault: expect.any(Number),
        source_registry: expect.any(Number),
      }),
      dedupReason: "merged_by_title",
      dedupKey: "title:shared retrieval pattern",
      rrfScore: expect.any(Number),
    });
  });

  it("isolates failing optional retrieval sources and still returns wiki memory", async () => {
    mockedSearchWikiNotes.mockResolvedValue([
      {
        title: "Wiki survives source failure",
        path: "vault/20_notes/wiki-survives-source-failure.md",
        status: "auto",
        source_type: "agent-output",
        tags: ["personal-os", "retrieval"],
        concepts: ["failure isolation"],
        excerpt: "Wiki context remains available when another source fails.",
      },
    ]);
    const taskFindMany = vi.fn().mockRejectedValue(new Error("task db down"));
    const projectEventFindMany = vi
      .fn()
      .mockRejectedValue(new Error("project event db down"));
    const sourceRegistrySearch = vi
      .fn()
      .mockRejectedValue(new Error("registry unavailable"));

    const context = await getQueryAgentContext("failure isolation", {
      task: { findMany: taskFindMany },
      projectEvent: { findMany: projectEventFindMany },
      sourceRegistry: { search: sourceRegistrySearch },
    });

    expect(context.wiki.status).toBe("ok");
    expect(context.memoryItems[0]).toMatchObject({
      id: "wiki:vault/20_notes/wiki-survives-source-failure.md",
      type: "wiki",
    });
    expect(context.debug.retrieval).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "task",
          status: "unavailable",
          candidateCount: 0,
        }),
        expect.objectContaining({
          source: "project_event",
          status: "unavailable",
          candidateCount: 0,
        }),
        expect.objectContaining({
          source: "source_registry",
          status: "unavailable",
          candidateCount: 0,
        }),
      ]),
    );
  });

  it("returns reranked memory items with token budget, evidence links, and stale/conflict flags", async () => {
    mockedSearchWikiNotes.mockResolvedValue([
      {
        title: "Personal OS context hybrid recall v0 实现记录",
        path: "vault/20_notes/2026-07-03/personal-os-context-hybrid-recall-v0.md",
        created: "2026-07-03 22:12 CST",
        status: "auto",
        source_type: "agent-output",
        tags: ["personal-os", "agent-memory", "context-retrieval"],
        concepts: ["vector recall", "episode"],
        excerpt: "记录 /api/agent/context 的向量 + episode 混合召回 PoC 和真实评估样例。",
      },
      {
        title: "Personal OS context 旧召回方案",
        path: "vault/20_notes/2024-01-01/personal-os-context-old-recall.md",
        created: "2024-01-01 00:00 CST",
        status: "superseded",
        source_type: "agent-output",
        tags: ["personal-os", "context-retrieval"],
        concepts: ["old recall"],
        excerpt: "旧版只做关键词召回，已经被 hybrid recall 取代。",
        metadata: {
          freshness_ttl_days: 30,
          superseded_by: "vault/20_notes/2026-07-03/personal-os-context-hybrid-recall-v0.md",
        },
      },
    ]);
    const taskFindMany = vi.fn().mockResolvedValue([
      {
        id: "task_vector",
        title: "决定并落地 Volcengine 向量检索",
        status: "todo",
        priority: "P1",
        riskLevel: "medium",
        executionMode: "agent_allowed",
        ownerAgent: null,
        leaseUntil: null,
        nextAction: "比较 keyword/context episode 与 optional embedding candidates。",
        definitionOfDone: "有 smoke、fallback、citation、cost note。",
        project: { id: "project_1", name: "Personal OS / Wiki 知识库升级" },
      },
      {
        id: "task_archived",
        title: "归档的向量检索任务",
        status: "archived",
        priority: "P1",
        riskLevel: "low",
        executionMode: "agent_allowed",
        ownerAgent: null,
        leaseUntil: null,
        nextAction: "不应进入 context pack。",
        definitionOfDone: "Archived tasks stay filtered.",
        project: { id: "project_1", name: "Personal OS / Wiki 知识库升级" },
      },
    ]);
    const activityLogFindMany = vi.fn().mockResolvedValue([
      {
        id: "act_eval",
        actorType: "hermes",
        action: "task.submitted",
        targetType: "task",
        targetId: "cmr28q5jt00ca0jnyxm8o03h0",
        createdAt: "2026-07-01T15:38:42.725Z",
      },
    ]);
    const agentRunFindMany = vi.fn().mockResolvedValue([
      {
        id: "run_vector_eval",
        model: "gpt-5-codex",
        status: "completed",
        reasoningSummary: "评估 Codex / Code X 长期记忆：向量库只是召回组件。",
        outputSummary: "建议先做 /api/agent/context 的向量 + episode 混合召回 PoC。",
        startedAt: "2026-07-01T15:38:42.699Z",
        inboxItem: {
          rawText: "是否给 Codex/Code X 建立向量记忆库。",
          sourceUrl: null,
        },
      },
    ]);

    const context = await getQueryAgentContext("code x 记忆 向量", {
      task: { findMany: taskFindMany },
      activityLog: { findMany: activityLogFindMany },
      agentRun: { findMany: agentRunFindMany },
    });

    expect(context.memoryItems).toEqual(expect.any(Array));
    expect(context.memoryItems[0]).toMatchObject({
      id: "wiki:vault/20_notes/2026-07-03/personal-os-context-hybrid-recall-v0.md",
      type: "wiki",
      title: "Personal OS context hybrid recall v0 实现记录",
      tier: "hot",
      evidenceId: "vault/20_notes/2026-07-03/personal-os-context-hybrid-recall-v0.md",
      metadata: expect.objectContaining({
        path: "vault/20_notes/2026-07-03/personal-os-context-hybrid-recall-v0.md",
        sourceType: "agent-output",
      }),
    });
    expect(context.memoryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "agent_run:run_vector_eval",
          type: "agent_run",
          evidenceId: "run_vector_eval",
          sourceUrl: undefined,
        }),
        expect.objectContaining({
          id: "task:task_vector",
          type: "task",
          tier: "hot",
          metadata: expect.objectContaining({ priority: "P1", status: "todo" }),
        }),
        expect.objectContaining({
          id: "wiki:vault/20_notes/2024-01-01/personal-os-context-old-recall.md",
          flags: expect.objectContaining({
            isStale: true,
            hasConflict: true,
          }),
        }),
      ]),
    );
    expect(context.memoryItems.map((item) => item.id)).not.toContain(
      "task:task_archived",
    );
    expect(context.tokenBudget).toMatchObject({
      maxTokens: 3000,
      itemCount: context.memoryItems.length,
    });
    expect(context.tokenBudget.estimatedTokens).toBeGreaterThan(0);
    expect(context.tokenBudget.remainingTokens).toBeGreaterThanOrEqual(0);
    expect(context.debug.retrieval).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "memory",
          status: "ok",
          candidateCount: context.memoryItems.length,
        }),
      ]),
    );
  });

  it("exposes explicit recall tracks and a read-only memory adapter contract", async () => {
    mockedSearchWikiNotes.mockResolvedValue([
      {
        title: "Raven MemoryBackend wiki note",
        path: "vault/20_notes/raven-memory-backend.md",
        created: "2026-07-07 21:24 CST",
        status: "auto",
        source_type: "agent-output",
        tags: ["raven", "memory"],
        concepts: ["MemoryBackend"],
        excerpt: "Wiki evidence explaining Raven MemoryBackend explicit tracks.",
        metadata: {
          native_id: "wiki-native-raven-memory",
          ledger: "github-radar",
        },
      },
    ]);
    const taskFindMany = vi.fn().mockResolvedValue([
      {
        id: "task_user_track",
        title: "Raven MemoryBackend user memory task",
        status: "todo",
        priority: "P2",
        riskLevel: "low",
        executionMode: "agent_allowed",
        ownerAgent: null,
        leaseUntil: null,
        nextAction: "Represent user memory without string prefixes.",
        definitionOfDone: "RecallSource carries user_id explicitly.",
        project: { id: "project_1", name: "Personal OS" },
      },
    ]);
    const agentRunFindMany = vi.fn().mockResolvedValue([
      {
        id: "run_agent_track",
        model: "codex-autodrive",
        status: "completed",
        reasoningSummary: "Raven MemoryBackend contract was evaluated.",
        outputSummary: "Agent experience says agent_id should be explicit.",
        startedAt: "2026-07-07T13:24:07.730Z",
        inboxItem: {
          rawText: "Evaluate Raven MemoryBackend.",
          sourceUrl: "https://github.com/EverMind-AI/Raven",
        },
      },
    ]);
    const sourceRegistrySearch = vi.fn().mockResolvedValue({
      status: "ok",
      candidates: [
        {
          id: "github:EverMind-AI/Raven",
          title: "EverMind-AI/Raven MemoryBackend source",
          summary: "External source registry evidence for Raven MemoryBackend.",
          score: 95,
          sourceUrl: "https://github.com/EverMind-AI/Raven",
          createdAt: "2026-07-07T12:55:40.000Z",
          metadata: {
            native_id: "source-native-raven",
            status: "selected",
          },
        },
      ],
      searchedQueries: ["Raven MemoryBackend explicit tracks"],
      failedQueries: [],
    });

    const context = await getQueryAgentContext(
      "Raven MemoryBackend explicit tracks",
      {
        task: { findMany: taskFindMany },
        agentRun: { findMany: agentRunFindMany },
        sourceRegistry: { search: sourceRegistrySearch },
      },
    );

    const userItem = context.memoryItems.find(
      (item) => item.id === "task:task_user_track",
    );
    const agentItem = context.memoryItems.find(
      (item) => item.id === "agent_run:run_agent_track",
    );
    const wikiItem = context.memoryItems.find(
      (item) => item.id === "wiki:vault/20_notes/raven-memory-backend.md",
    );
    const sourceItem = context.memoryItems.find(
      (item) => item.id === "source_registry:github:EverMind-AI/Raven",
    );

    expect(userItem).toMatchObject({
      recallSource: { track: "user", user_id: "personal-os" },
      provenance: {
        backend_id: "personal-os",
        retrieval_source: "task",
        evidence_id: "task_user_track",
      },
      backendMetadata: expect.objectContaining({
        source: "task",
      }),
    });
    expect(agentItem).toMatchObject({
      recallSource: { track: "agent", agent_id: "codex-autodrive" },
      provenance: {
        backend_id: "personal-os",
        retrieval_source: "agent_run",
        evidence_id: "run_agent_track",
      },
    });
    expect(wikiItem).toMatchObject({
      recallSource: {
        track: "wiki",
        wiki_path: "vault/20_notes/raven-memory-backend.md",
      },
      provenance: {
        backend_id: "personal-os",
        retrieval_source: "wiki",
        evidence_id: "vault/20_notes/raven-memory-backend.md",
      },
      backendMetadata: expect.objectContaining({
        native_id: "wiki-native-raven-memory",
      }),
    });
    expect(sourceItem).toMatchObject({
      recallSource: {
        track: "source",
        source_id: "github:EverMind-AI/Raven",
      },
      provenance: {
        backend_id: "personal-os",
        retrieval_source: "source_registry",
        evidence_id: "github:EverMind-AI/Raven",
      },
      backendMetadata: expect.objectContaining({
        native_id: "source-native-raven",
      }),
    });
    expect(context.cited).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "wiki:vault/20_notes/raven-memory-backend.md",
          recallSource: {
            track: "wiki",
            wiki_path: "vault/20_notes/raven-memory-backend.md",
          },
          provenance: expect.objectContaining({
            retrieval_source: "wiki",
          }),
          backendMetadata: expect.objectContaining({
            native_id: "wiki-native-raven-memory",
          }),
        }),
      ]),
    );

    const { createAgentContextReadOnlyMemoryAdapter } = await import(
      "@/lib/agent-context"
    );
    expect(createAgentContextReadOnlyMemoryAdapter).toEqual(expect.any(Function));

    const adapter = createAgentContextReadOnlyMemoryAdapter(context.memoryItems);
    await expect(
      adapter.recall({
        query: "Raven wiki evidence",
        source: {
          track: "wiki",
          wiki_path: "vault/20_notes/raven-memory-backend.md",
        },
        topK: 3,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "wiki:vault/20_notes/raven-memory-backend.md",
        recallSource: {
          track: "wiki",
          wiki_path: "vault/20_notes/raven-memory-backend.md",
        },
        backendMetadata: expect.objectContaining({
          native_id: "wiki-native-raven-memory",
        }),
      }),
    ]);
  });

  it("applies requested budget and exposes cited hot items plus omissions", async () => {
    mockedSearchWikiNotes.mockResolvedValue([
      {
        title: "Personal OS context budget source",
        path: "vault/20_notes/context-budget-source.md",
        created: "2026-07-05 18:00 CST",
        status: "auto",
        source_type: "agent-output",
        tags: ["personal-os", "context-pack"],
        concepts: ["budget", "citations"],
        excerpt: "Personal OS context budget evidence. ".repeat(80),
      },
      {
        title: "Personal OS context omitted source",
        path: "vault/20_notes/context-omitted-source.md",
        created: "2026-07-05 18:01 CST",
        status: "auto",
        source_type: "agent-output",
        tags: ["personal-os", "context-pack"],
        concepts: ["omissions"],
        excerpt: "Lower priority context that should be omitted when budget is tight. ".repeat(80),
      },
    ]);
    const taskFindMany = vi.fn().mockResolvedValue([
      {
        id: "task_hot_budget",
        title: "Ship cited context budget",
        status: "todo",
        priority: "P1",
        riskLevel: "low",
        executionMode: "agent_allowed",
        ownerAgent: null,
        leaseUntil: null,
        nextAction: "Return cited hot tier context.",
        definitionOfDone: "Context includes budget, cited, and omissions.",
        project: { id: "project_1", name: "Personal OS" },
      },
    ]);

    const context = await getQueryAgentContext(
      "Personal OS context budget cited omissions",
      {
        task: { findMany: taskFindMany },
      },
      { budgetTokens: 220 },
    );

    expect(context.budget).toMatchObject({
      maxTokens: 220,
      omittedCount: expect.any(Number),
    });
    expect(context.tokenBudget.maxTokens).toBe(220);
    expect(context.tiers.hot.items[0]).toMatchObject({
      type: "task",
      id: "task_hot_budget",
      cited: expect.arrayContaining([
        expect.objectContaining({
          id: "task:task_hot_budget",
          type: "task",
          title: "Ship cited context budget",
        }),
      ]),
    });
    expect(context.cited).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "task:task_hot_budget",
          type: "task",
          title: "Ship cited context budget",
        }),
      ]),
    );
    expect(context.omissions.length).toBeGreaterThan(0);
    expect(context.budget.omittedCount).toBe(context.omissions.length);
    expect(context.omissions[0]).toMatchObject({
      reason: "token_budget_exceeded",
      estimatedTokens: expect.any(Number),
    });
  });

  it("adds per-tier token budgets and archives traceable tier overflow", async () => {
    mockedSearchWikiNotes.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        title: `Raven Curator tier budget evidence ${index + 1}`,
        path: `vault/20_notes/raven-tier-budget-${index + 1}.md`,
        created: "2026-07-08 18:00 CST",
        status: "auto",
        source_type: "agent-output",
        tags: ["personal-os", "context-budget"],
        concepts: ["tier budget"],
        excerpt: "Raven Curator keeps overflow retrievable instead of dropping it. ".repeat(20),
      })),
    );
    const taskFindMany = vi.fn().mockResolvedValue([
      {
        id: "task_tier_budget",
        title: "Ship Raven Curator style tier budgets",
        status: "todo",
        priority: "P1",
        riskLevel: "low",
        executionMode: "agent_allowed",
        ownerAgent: null,
        leaseUntil: null,
        nextAction: "Expose per-tier budget metadata.",
        definitionOfDone: "Tier overflow is archived with retrievable references.",
        project: { id: "project_1", name: "Personal OS" },
      },
    ]);

    const context = await getQueryAgentContext(
      "Raven Curator context tier budget",
      {
        task: { findMany: taskFindMany },
      },
      { budgetTokens: 240 },
    );

    expect(context.tiers.hot).toMatchObject({
      tokenBudget: expect.any(Number),
      usedTokens: expect.any(Number),
      remainingTokens: expect.any(Number),
      items: [
        expect.objectContaining({
          type: "task",
          id: "task_tier_budget",
        }),
      ],
      archived: expect.any(Array),
    });
    expect(context.tiers.warm).toMatchObject({
      tokenBudget: expect.any(Number),
      usedTokens: expect.any(Number),
      remainingTokens: expect.any(Number),
      items: expect.any(Array),
      archived: expect.any(Array),
    });
    expect(context.tiers.cold).toMatchObject({
      tokenBudget: expect.any(Number),
      usedTokens: expect.any(Number),
      remainingTokens: expect.any(Number),
      items: expect.any(Array),
      archived: expect.any(Array),
    });
    expect(context.tiers.hot.usedTokens).toBeLessThanOrEqual(
      context.tiers.hot.tokenBudget,
    );
    expect(context.tiers.warm.usedTokens).toBeLessThanOrEqual(
      context.tiers.warm.tokenBudget,
    );
    expect(context.tiers.cold.usedTokens).toBeLessThanOrEqual(
      context.tiers.cold.tokenBudget,
    );
    expect(context.tiers.warm.archived.length).toBeGreaterThan(0);
    expect(context.tiers.warm.archived[0]).toMatchObject({
      id: expect.stringContaining("wiki:vault/20_notes/raven-tier-budget-"),
      type: "wiki",
      reason: "tier_token_budget_exceeded",
      estimatedTokens: expect.any(Number),
      retrieve: expect.objectContaining({
        path: expect.stringContaining("vault/20_notes/raven-tier-budget-"),
        sourceUrl: expect.stringContaining("http://wiki.local/note?path="),
      }),
    });
  });
});
