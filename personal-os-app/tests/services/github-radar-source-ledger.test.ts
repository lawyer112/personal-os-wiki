/**
 * GitHub Radar Source Ledger v1 — unit tests
 * Covers: registry schema, merge/dedup, task deduplication
 * Task: cmr8157y802pu0jp83edavhuo
 */
import { describe, expect, it } from "vitest";

// ── Inline the pure functions under test ────────────────────────────────────
// These are extracted from scripts/github-radar-intake.mjs for unit testing.
// If the script is later converted to a module with named exports, replace
// the inline copies with imports.

interface RegistryEntry {
  full_name: string;
  url: string;
  description: string;
  stars: number;
  first_seen: string;
  last_seen: string;
  times_seen: number;
  first_score: number;
  last_score: number;
  signals: string[];
  status: "new" | "evaluated" | "absorbed" | "skipped";
}

interface Registry {
  created_at: string;
  updated_at: string;
  entries: RegistryEntry[];
}

interface AnalyzedRepo {
  full_name: string;
  url: string;
  description: string;
  stars: number;
  score: number;
  signals: string[];
  pushed_at?: string;
}

interface Task {
  title: string;
  definitionOfDone: string;
  status: string;
  executionMode: string;
}

function mergeRegistry(registry: Registry, repos: AnalyzedRepo[]): Registry {
  const entryMap = new Map<string, RegistryEntry>(
    registry.entries.map((e) => [e.full_name, e]),
  );
  for (const repo of repos) {
    const existing = entryMap.get(repo.full_name);
    if (existing) {
      existing.times_seen = (existing.times_seen || 1) + 1;
      existing.last_seen = new Date().toISOString();
      existing.last_score = repo.score;
      existing.signals = [...new Set([...existing.signals, ...repo.signals])];
    } else {
      entryMap.set(repo.full_name, {
        full_name: repo.full_name,
        url: repo.url,
        description: repo.description,
        stars: repo.stars,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        times_seen: 1,
        first_score: repo.score,
        last_score: repo.score,
        signals: repo.signals,
        status: "new",
      });
    }
  }
  registry.entries = [...entryMap.values()];
  return registry;
}

function filterSeenRepos(
  repos: AnalyzedRepo[],
  registry: Registry,
  skipSeen: boolean,
): AnalyzedRepo[] {
  if (!skipSeen) return repos;
  const seen = new Set(
    registry.entries
      .filter((e) => e.times_seen > 1)
      .map((e) => e.full_name),
  );
  return repos.filter((repo) => !seen.has(repo.full_name));
}

function deduplicateTasks(
  tasks: Task[],
  existingTasks: Task[],
): Task[] {
  const existingTitles = new Set(existingTasks.map((t) => t.title));
  return tasks.filter((task) => !existingTitles.has(task.title));
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRepo(overrides: Partial<AnalyzedRepo> = {}): AnalyzedRepo {
  return {
    full_name: "owner/repo",
    url: "https://github.com/owner/repo",
    description: "test repo",
    stars: 100,
    score: 15.5,
    signals: ["source-registry"],
    ...overrides,
  };
}

function makeRegistry(entries: Partial<RegistryEntry>[] = []): Registry {
  return {
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    entries: entries.map((e) => ({
      full_name: "owner/repo",
      url: "https://github.com/owner/repo",
      description: "",
      stars: 0,
      first_seen: "2026-01-01T00:00:00Z",
      last_seen: "2026-01-01T00:00:00Z",
      times_seen: 1,
      first_score: 0,
      last_score: 0,
      signals: [],
      status: "new" as const,
      ...e,
    })),
  };
}

// ── Registry schema tests ────────────────────────────────────────────────────

describe("source ledger registry schema", () => {
  it("new repo produces a valid entry with required schema fields", () => {
    const registry = makeRegistry();
    const repo = makeRepo({ full_name: "acme/tool" });

    const merged = mergeRegistry(registry, [repo]);
    const entry = merged.entries.find((e) => e.full_name === "acme/tool");

    expect(entry).toBeDefined();
    expect(entry?.full_name).toBe("acme/tool");
    expect(entry?.url).toMatch(/^https:\/\/github.com\//);
    expect(typeof entry?.stars).toBe("number");
    expect(typeof entry?.first_seen).toBe("string");
    expect(typeof entry?.last_seen).toBe("string");
    expect(typeof entry?.times_seen).toBe("number");
    expect(entry?.times_seen).toBe(1);
    expect(Array.isArray(entry?.signals)).toBe(true);
    expect(entry?.status).toBe("new");
  });

  it("entry has first_score and last_score matching repo score on first insert", () => {
    const registry = makeRegistry();
    const repo = makeRepo({ full_name: "acme/scored", score: 42.5 });

    const merged = mergeRegistry(registry, [repo]);
    const entry = merged.entries.find((e) => e.full_name === "acme/scored");

    expect(entry?.first_score).toBe(42.5);
    expect(entry?.last_score).toBe(42.5);
  });

  it("entry captures all signals from the repo", () => {
    const registry = makeRegistry();
    const repo = makeRepo({
      full_name: "acme/multi",
      signals: ["source-registry", "graph-recall", "memory-tiering"],
    });

    const merged = mergeRegistry(registry, [repo]);
    const entry = merged.entries.find((e) => e.full_name === "acme/multi");

    expect(entry?.signals).toContain("source-registry");
    expect(entry?.signals).toContain("graph-recall");
    expect(entry?.signals).toContain("memory-tiering");
  });

  it("empty registry accepts first repos without error", () => {
    const registry = makeRegistry();
    const repos = [
      makeRepo({ full_name: "a/b", score: 10 }),
      makeRepo({ full_name: "c/d", score: 20 }),
    ];

    const merged = mergeRegistry(registry, repos);
    expect(merged.entries).toHaveLength(2);
  });
});

// ── Merge / dedup tests ──────────────────────────────────────────────────────

describe("source ledger merge and dedup", () => {
  it("increments times_seen when a known repo is seen again", () => {
    const registry = makeRegistry([
      { full_name: "owner/repo", times_seen: 3, signals: ["source-registry"] },
    ]);
    const repo = makeRepo({ signals: ["source-registry"] });

    const merged = mergeRegistry(registry, [repo]);
    const entry = merged.entries.find((e) => e.full_name === "owner/repo");

    expect(entry?.times_seen).toBe(4);
  });

  it("updates last_score but preserves first_score on re-encounter", () => {
    const registry = makeRegistry([
      {
        full_name: "owner/repo",
        times_seen: 2,
        first_score: 10.0,
        last_score: 10.0,
        signals: [],
      },
    ]);
    const repo = makeRepo({ score: 25.0 });

    const merged = mergeRegistry(registry, [repo]);
    const entry = merged.entries.find((e) => e.full_name === "owner/repo");

    expect(entry?.first_score).toBe(10.0);
    expect(entry?.last_score).toBe(25.0);
  });

  it("unions signals without duplicates on re-encounter", () => {
    const registry = makeRegistry([
      {
        full_name: "owner/repo",
        times_seen: 1,
        signals: ["source-registry", "graph-recall"],
      },
    ]);
    const repo = makeRepo({ signals: ["graph-recall", "agent-hooks"] });

    const merged = mergeRegistry(registry, [repo]);
    const entry = merged.entries.find((e) => e.full_name === "owner/repo");

    expect(entry?.signals).toContain("source-registry");
    expect(entry?.signals).toContain("graph-recall");
    expect(entry?.signals).toContain("agent-hooks");
    // no duplicates
    const graphRecallCount = entry?.signals.filter(
      (s) => s === "graph-recall",
    ).length;
    expect(graphRecallCount).toBe(1);
  });

  it("does not duplicate repos already in registry when same batch runs twice", () => {
    const registry = makeRegistry();
    const repos = [makeRepo({ full_name: "x/y" })];

    const first = mergeRegistry(registry, repos);
    expect(first.entries.filter((e) => e.full_name === "x/y")).toHaveLength(1);

    const second = mergeRegistry(first, repos);
    expect(second.entries.filter((e) => e.full_name === "x/y")).toHaveLength(1);
    expect(second.entries.find((e) => e.full_name === "x/y")?.times_seen).toBe(
      2,
    );
  });
});

// ── filterSeenRepos tests ────────────────────────────────────────────────────

describe("filterSeenRepos", () => {
  it("returns all repos when skipSeen=false regardless of times_seen", () => {
    const registry = makeRegistry([
      { full_name: "a/b", times_seen: 10 },
      { full_name: "c/d", times_seen: 1 },
    ]);
    const repos = [
      makeRepo({ full_name: "a/b" }),
      makeRepo({ full_name: "c/d" }),
      makeRepo({ full_name: "e/f" }),
    ];

    const result = filterSeenRepos(repos, registry, false);
    expect(result).toHaveLength(3);
  });

  it("filters out repos with times_seen > 1 when skipSeen=true", () => {
    const registry = makeRegistry([
      { full_name: "a/b", times_seen: 5 },
      { full_name: "c/d", times_seen: 1 },
    ]);
    const repos = [
      makeRepo({ full_name: "a/b" }),
      makeRepo({ full_name: "c/d" }),
      makeRepo({ full_name: "e/f" }),
    ];

    const result = filterSeenRepos(repos, registry, true);
    // a/b has times_seen=5 → filtered
    expect(result.map((r) => r.full_name)).not.toContain("a/b");
    // c/d times_seen=1 → not seen before → kept
    expect(result.map((r) => r.full_name)).toContain("c/d");
    // e/f not in registry → kept
    expect(result.map((r) => r.full_name)).toContain("e/f");
  });

  it("returns empty array when skipSeen=true and all repos have been seen before", () => {
    const registry = makeRegistry([
      { full_name: "a/b", times_seen: 3 },
      { full_name: "c/d", times_seen: 2 },
    ]);
    const repos = [
      makeRepo({ full_name: "a/b" }),
      makeRepo({ full_name: "c/d" }),
    ];

    const result = filterSeenRepos(repos, registry, true);
    expect(result).toHaveLength(0);
  });
});

// ── Task deduplication tests ─────────────────────────────────────────────────

describe("task deduplication against existing Personal OS tasks", () => {
  it("passes through new tasks that don't match any existing title", () => {
    const incoming: Task[] = [
      {
        title: "实现 GitHub 雷达 Source Registry 写回 v0",
        definitionOfDone: "...",
        status: "todo",
        executionMode: "agent_allowed",
      },
    ];
    const existing: Task[] = [];

    const result = deduplicateTasks(incoming, existing);
    expect(result).toHaveLength(1);
  });

  it("removes a task whose title exactly matches an existing task", () => {
    const title = "实现 GitHub 雷达 Source Registry 写回 v0";
    const incoming: Task[] = [
      { title, definitionOfDone: "...", status: "todo", executionMode: "agent_allowed" },
    ];
    const existing: Task[] = [
      { title, definitionOfDone: "already there", status: "review", executionMode: "agent_allowed" },
    ];

    const result = deduplicateTasks(incoming, existing);
    expect(result).toHaveLength(0);
  });

  it("passes through tasks whose titles don't match even if descriptions differ", () => {
    const incoming: Task[] = [
      {
        title: "GitHub 雷达 2026-07-06：评估 acme/tool 的吸收价值",
        definitionOfDone: "...",
        status: "todo",
        executionMode: "agent_allowed",
      },
    ];
    const existing: Task[] = [
      {
        title: "GitHub 雷达 2026-07-05：评估 acme/tool 的吸收价值",
        definitionOfDone: "same body",
        status: "review",
        executionMode: "agent_allowed",
      },
    ];

    // Titles differ by date → should NOT be deduplicated
    const result = deduplicateTasks(incoming, existing);
    expect(result).toHaveLength(1);
  });

  it("partial dedup: removes matched tasks and keeps unmatched ones", () => {
    const incoming: Task[] = [
      { title: "旧任务标题", definitionOfDone: "...", status: "todo", executionMode: "agent_allowed" },
      { title: "新任务标题", definitionOfDone: "...", status: "todo", executionMode: "agent_allowed" },
    ];
    const existing: Task[] = [
      { title: "旧任务标题", definitionOfDone: "already done", status: "done", executionMode: "agent_allowed" },
    ];

    const result = deduplicateTasks(incoming, existing);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("新任务标题");
  });

  it("does not require repos.json / intake-result.json to have duplicate task protection work", () => {
    // Regression: dedup must work on title match alone, no file I/O required
    const incoming: Task[] = Array.from({ length: 5 }, (_, i) => ({
      title: `任务 ${i}`,
      definitionOfDone: "...",
      status: "todo",
      executionMode: "agent_allowed",
    }));
    const existing: Task[] = [
      { title: "任务 2", definitionOfDone: "x", status: "review", executionMode: "agent_allowed" },
      { title: "任务 4", definitionOfDone: "x", status: "review", executionMode: "agent_allowed" },
    ];

    const result = deduplicateTasks(incoming, existing);
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.title)).not.toContain("任务 2");
    expect(result.map((t) => t.title)).not.toContain("任务 4");
  });
});
