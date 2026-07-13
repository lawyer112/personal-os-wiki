import { describe, expect, it, vi } from "vitest";
import { getTodayReminder } from "@/lib/reminders";

describe("today reminders", () => {
  it("builds a proactive payload from unfinished work and ideas", async () => {
    const db = {
      task: {
        count: vi
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "task_now",
              title: "跑通提醒闭环",
              status: "todo",
              priority: "P1",
              nextAction: "让 Hermes 定时拉取提醒 payload。",
              project: { id: "project_1", name: "Personal OS" },
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "task_review",
              title: "确认提醒文案",
              status: "review",
              priority: "P2",
            },
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: "task_blocked",
              title: "Telegram 发送工具待接",
              status: "blocked",
              priority: "P1",
            },
          ])
          .mockResolvedValueOnce([]),
      },
      idea: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "idea_1",
            title: "晚上做一次收尾提醒",
            status: "captured",
            priority: "P2",
          },
        ]),
      },
    };

    const reminder = await getTodayReminder(db, {
      mode: "checkin",
      appUrl: "http://localhost:3000",
    });

    expect(reminder.shouldSend).toBe(true);
    expect(reminder.metrics).toMatchObject({
      now: 1,
      review: 1,
      blocked: 1,
      ideas: 1,
    });
    expect(reminder.payload.text).toContain("我来催一下");
    expect(reminder.payload.text).toContain("跑通提醒闭环");
    expect(reminder.payload.text).toContain("想法池待处理");
    expect(reminder.payload.buttons).toEqual(
      expect.arrayContaining([
        { label: "今日任务", url: "http://localhost:3000/" },
        { label: "想法池", url: "http://localhost:3000/ideas" },
      ]),
    );
  });

  it("stays quiet when there is nothing to remind about during checkin", async () => {
    const db = {
      task: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      idea: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const reminder = await getTodayReminder(db, { mode: "checkin" });

    expect(reminder.shouldSend).toBe(false);
    expect(reminder.payload.text).toContain("今日要做 0");
  });
});
