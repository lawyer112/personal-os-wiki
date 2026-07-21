import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getQueryAgentContext, searchWikiContext } from "@/lib/agent-context";
import { createReadOnlyMemoryAdapter } from "@/lib/memory_backend_contract";

const wikiMocks = vi.hoisted(() => ({
  expandWikiChunk: vi.fn(),
  searchWikiNotes: vi.fn(),
}));

vi.mock("@/lib/wiki-client", () => ({
  expandWikiChunk: wikiMocks.expandWikiChunk,
  searchWikiNotes: wikiMocks.searchWikiNotes,
  searchWikiChunks: async (query: string, limit: number) => {
    const notes = await wikiMocks.searchWikiNotes(query, limit);
    return {
      status: "ok",
      results: notes.map((note: Record<string, unknown>) => ({
        ...note,
        snippet: note.excerpt,
      })),
    };
  },
  wikiNoteUrl: (notePath: string) =>
    `http://wiki.local/note?path=${encodeURIComponent(notePath)}`,
}));

const mockedSearchWikiNotes = wikiMocks.searchWikiNotes;
const fixtureDirectory = fileURLToPath(
  new URL("../fixtures/memory_relevance_eval", import.meta.url),
);

type FixtureNote = {
  title: string;
  path: string;
  status: string;
  source_type: string;
  created?: string;
  tags: string[];
  concepts: string[];
  excerpt: string;
  metadata: Record<string, string>;
};

const parseFixture = (content: string): FixtureNote => {
  const [, frontmatter = "", body = ""] = content.split("---");
  const values = Object.fromEntries(
    frontmatter
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf(":");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );

  return {
    title: values.title,
    path: values.path,
    status: values.status,
    source_type: values.source_type,
    created: values.created,
    tags: values.tags.split(",").map((value) => value.trim()),
    concepts: values.concepts.split(",").map((value) => value.trim()),
    excerpt: body.trim(),
    metadata: {
      ...(values.supersedes ? { supersedes: values.supersedes } : {}),
      ...(values.superseded_by
        ? { superseded_by: values.superseded_by }
        : {}),
    },
  };
};

const rankOf = (paths: string[], expectedPath: string) => {
  const index = paths.indexOf(expectedPath);
  return index === -1 ? null : index + 1;
};

describe("memory relevance evaluation", () => {
  let notes: FixtureNote[] = [];

  beforeAll(async () => {
    const files = (await readdir(fixtureDirectory))
      .filter((file) => file.endsWith(".md"))
      .sort();
    notes = await Promise.all(
      files.map(async (file) =>
        parseFixture(await readFile(path.join(fixtureDirectory, file), "utf8")),
      ),
    );
    expect(notes).toHaveLength(10);
  });

  beforeEach(() => {
    mockedSearchWikiNotes.mockReset();
    mockedSearchWikiNotes.mockImplementation(async () => notes);
  });

  it("meets the 10-document ranking gate and prefers corrections over superseded facts", async () => {
    const cases = [
      ["Context Pack 跨会话 writeback", "eval/context_pack.md"],
      ["Personal OS 通用介绍", "eval/generic_overview.md"],
      ["GitHub 雷达 source registry 长期记忆", "eval/github_radar.md"],
      ["期货策略 仓位上限 最大回撤 熔断", "eval/futures_risk.md"],
      ["Personal OS 生产地址 6.37 6.42", "eval/endpoint_current.md"],
      ["错误记忆 supersedes superseded_by 审计", "eval/correction_policy.md"],
      ["retrieval relevance score Recall MRR nDCG", "eval/scoring_rubric.md"],
      ["Content Workbench 3220 只读挂载", "eval/workbench_boundary.md"],
      ["demo token fallback 生产部署", "eval/secrets_policy.md"],
      ["192.168.6.42 真相源还能继续用吗", "eval/endpoint_current.md"],
    ] as const;
    const ranks: number[] = [];

    for (const [query, expectedPath] of cases) {
      const context = await getQueryAgentContext(query);
      const rank = rankOf(
        context.memoryItems.map((item) => item.evidenceId ?? ""),
        expectedPath,
      );
      expect(rank, query).not.toBeNull();
      ranks.push(rank ?? Number.POSITIVE_INFINITY);
    }

    const recallAt1 = ranks.filter((rank) => rank <= 1).length / ranks.length;
    const recallAt3 = ranks.filter((rank) => rank <= 3).length / ranks.length;
    const mrr = ranks.reduce((sum, rank) => sum + 1 / rank, 0) / ranks.length;
    const ndcgAt3 =
      ranks.reduce(
        (sum, rank) => sum + (rank <= 3 ? 1 / Math.log2(rank + 1) : 0),
        0,
      ) / ranks.length;

    expect(recallAt1).toBeGreaterThanOrEqual(0.8);
    expect(recallAt3).toBe(1);
    expect(mrr).toBeGreaterThanOrEqual(0.85);
    expect(ndcgAt3).toBeGreaterThanOrEqual(0.85);

    const correctionContext = await getQueryAgentContext(
      "192.168.6.42 真相源还能继续用吗",
    );
    const currentRank = correctionContext.memoryItems.findIndex(
      (item) => item.evidenceId === "eval/endpoint_current.md",
    );
    const oldMemory = correctionContext.memoryItems.find(
      (item) => item.evidenceId === "eval/endpoint_old.md",
    );

    expect(currentRank).toBeGreaterThanOrEqual(0);
    expect(oldMemory).toMatchObject({
      tier: "cold",
      flags: { isStale: true, hasConflict: true },
    });
    expect(currentRank).toBeLessThan(
      correctionContext.memoryItems.findIndex(
        (item) => item.evidenceId === "eval/endpoint_old.md",
      ),
    );
    expect(
      correctionContext.tiers.warm.items.some(
        (item) => item.path === "eval/endpoint_old.md",
      ),
    ).toBe(false);
  });

  it("keeps repeated generic source rows below the relevant evidence", async () => {
    const inboxItemFindMany = vi.fn().mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `generic_inbox_${index}`,
        sourceType: "agent-output",
        sourcePlatform: "internal",
        rawText: "Personal OS retrieval generic status update without relevance metrics.",
        receivedAt: `2026-07-09T0${index}:00:00.000Z`,
      })),
    );
    const taskFindMany = vi.fn().mockResolvedValue([
      {
        id: "unrelated_hot_task",
        title: "集成 EverOS OpenClaw 插件",
        status: "todo",
        priority: "P1",
        executionMode: "agent_allowed",
        project: { name: "Personal OS" },
      },
    ]);

    const context = await getQueryAgentContext(
      "retrieval relevance score Recall MRR nDCG",
      {
        inboxItem: { findMany: inboxItemFindMany },
        task: { findMany: taskFindMany },
      },
    );

    expect(context.memoryItems[0]).toMatchObject({
      evidenceId: "eval/scoring_rubric.md",
      type: "wiki",
    });
    expect(
      context.memoryItems.filter((item) => item.title === "agent-output"),
    ).toHaveLength(1);
    expect(
      context.tiers.hot.items.some((item) => item.id === "unrelated_hot_task"),
    ).toBe(false);
    expect(context.nextAction).toContain("集成 EverOS OpenClaw 插件");
  });

  it("bounds Wiki query fan-out to four concurrent reads", async () => {
    let active = 0;
    let maxActive = 0;
    mockedSearchWikiNotes.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return [];
    });

    await searchWikiContext(
      Array.from({ length: 12 }, (_, index) => `query-${index}`),
    );

    expect(maxActive).toBeLessThanOrEqual(4);
  });

  it("does not return a high-base-score memory when the query has no match", async () => {
    const source = { track: "wiki", wiki_path: "eval/shared.md" } as const;
    const adapter = createReadOnlyMemoryAdapter([
      {
        id: "irrelevant",
        text: "unrelated operational status",
        score: 999,
        recallSource: source,
        provenance: { backend_id: "test", retrieval_source: "wiki" },
      },
      {
        id: "relevant",
        text: "retrieval relevance scoring rubric",
        score: 10,
        recallSource: source,
        provenance: { backend_id: "test", retrieval_source: "wiki" },
      },
    ]);

    await expect(
      adapter.recall({ query: "retrieval scoring", source, topK: 5 }),
    ).resolves.toEqual([expect.objectContaining({ id: "relevant" })]);
  });
});
