import { describe, expect, it, vi } from "vitest";
import {
  buildPlannerWikiQueries,
  configuredPlannerTimeZone,
  getDailyPlannerPack,
  saveDailyPlanSnapshot,
  todayInTimeZone,
} from "@/lib/daily-planner";
import { searchWikiContext } from "@/lib/agent-context";

vi.mock("@/lib/agent-context", () => ({
  searchWikiContext: vi.fn().mockResolvedValue({
    status: "empty",
    candidates: [],
    searchedQueries: [],
    successfulQueries: 1,
    failedQueries: [],
  }),
}));

const mockedSearchWikiContext = vi.mocked(searchWikiContext);

describe("daily planner pack", () => {
  it("builds wiki queries from tasks, ideas, and active projects", () => {
    const queries = buildPlannerWikiQueries(
      {
        mode: "morning",
        shouldSend: true,
        generatedAt: "2026-04-22T00:00:00Z",
        metrics: {
          now: 1,
          review: 1,
          waiting: 0,
          blocked: 0,
          doneToday: 0,
          ideas: 1,
        },
        tasks: {
          now: [
            {
              id: "task_1",
              title: "跑通 Personal OS 规划提醒",
              status: "todo",
              priority: "P1",
              nextAction: "让 Hermes 读取 Wiki 候选后给今日建议。",
              project: { id: "project_1", name: "Personal OS" },
            },
          ],
          review: [],
          waiting: [],
          blocked: [],
          doneToday: [],
        },
        ideas: [
          {
            id: "idea_1",
            title: "个人助理应该主动规划目标",
            status: "captured",
            priority: "P1",
            nextAction: "从 Wiki 和任务里整理今日主线。",
          },
        ],
        payload: { text: "", buttons: [] },
      },
      [
        {
          id: "project_1",
          name: "Personal OS",
          goal: "把任务、知识和 Hermes 助理整合起来。",
          status: "active",
          priority: "P0",
          currentFocus: "今日规划能力",
        },
      ],
    );

    expect(queries).toContain("跑通 Personal OS 规划提醒");
    expect(queries).toContain("个人助理应该主动规划目标");
    expect(queries).toContain("今日规划能力");
  });

  it("returns a planner instruction and wiki candidates for Hermes", async () => {
    const db = {
      task: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      idea: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      project: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "project_1",
            name: "Personal OS",
            status: "active",
            priority: "P0",
            currentFocus: "今日规划能力",
          },
        ]),
      },
      activityLog: { findMany: vi.fn().mockResolvedValue([]) },
    };

    const planner = await getDailyPlannerPack(db, { mode: "morning" });

    expect(planner.mode).toBe("morning");
    expect(planner.plannerInstruction).toContain("任务 PM");
    expect(planner.plannerInstruction).toContain("动词 + 对象 + 结果 + 验收标准");
    expect(mockedSearchWikiContext).toHaveBeenCalledWith(
      expect.arrayContaining(["Personal OS", "今日规划能力"]),
      10,
    );
  });

  it("persists a daily plan snapshot from the planner result", async () => {
    const db = {
      dailyPlan: {
        create: vi.fn().mockResolvedValue({
          id: "plan_1",
          date: "2026-05-02",
          timezone: "Asia/Shanghai",
          mode: "morning",
          mainLine: "Ship the agent execution guardrail.",
          firstAction: "Verify claim filtering tests.",
          blocked: [],
          needsDecision: [],
          deliveredTo: ["telegram"],
        }),
      },
    };

    const snapshot = await saveDailyPlanSnapshot(
      db,
      {
        date: "2026-05-02",
        timezone: "Asia/Shanghai",
        mode: "morning",
        mainLine: "Ship the agent execution guardrail.",
        firstAction: "Verify claim filtering tests.",
        blocked: [],
        needsDecision: [],
        deliveredTo: ["telegram"],
      },
      { mode: "morning", generatedAt: "2026-05-02T00:00:00Z" },
    );

    expect(snapshot.id).toBe("plan_1");
    expect(db.dailyPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          date: "2026-05-02",
          timezone: "Asia/Shanghai",
          mode: "morning",
          deliveredTo: ["telegram"],
        }),
      }),
    );
  });

  it("derives the planner date in the configured timezone", () => {
    const date = new Date("2026-05-01T16:30:00.000Z");

    expect(todayInTimeZone("UTC", date)).toBe("2026-05-01");
    expect(todayInTimeZone("Asia/Shanghai", date)).toBe("2026-05-02");
  });

  it("rejects invalid IANA timezones before persisting a snapshot", async () => {
    const db = {
      dailyPlan: {
        create: vi.fn(),
      },
    };

    await expect(
      saveDailyPlanSnapshot(
        db,
        {
          timezone: "Mars/Base",
          mode: "morning",
          mainLine: "Ship the agent execution guardrail.",
          firstAction: "Verify claim filtering tests.",
          blocked: [],
          needsDecision: [],
          deliveredTo: [],
        },
        { mode: "morning", generatedAt: "2026-05-02T00:00:00Z" },
      ),
    ).rejects.toThrow("Invalid timezone: Mars/Base");
    expect(db.dailyPlan.create).not.toHaveBeenCalled();
  });

  it("falls back when PERSONAL_OS_TIMEZONE is invalid", () => {
    const before = process.env.PERSONAL_OS_TIMEZONE;
    process.env.PERSONAL_OS_TIMEZONE = "Mars/Base";

    try {
      expect(configuredPlannerTimeZone()).not.toBe("Mars/Base");
      expect(() => todayInTimeZone("Mars/Base")).toThrow(
        "Invalid timezone: Mars/Base",
      );
    } finally {
      if (before === undefined) {
        delete process.env.PERSONAL_OS_TIMEZONE;
      } else {
        process.env.PERSONAL_OS_TIMEZONE = before;
      }
    }
  });
});
