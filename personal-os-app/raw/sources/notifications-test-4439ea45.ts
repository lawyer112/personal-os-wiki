import { describe, expect, it, vi } from "vitest";
import {
  buildTelegramPayload,
  createTelegramNotification,
} from "@/lib/notifications";

describe("telegram notifications", () => {
  it("builds a result card payload with object deep links", () => {
    const payload = buildTelegramPayload({
      recipient: "user_1",
      projectName: "Personal OS",
      notes: [{ id: "note_1", title: "Bot 联动设计", url: "http://wiki.local/note?path=bot.md" }],
      tasks: [{ id: "task_1", title: "跑通 Hermes 推送闭环", status: "review" }],
      ideas: [],
      appUrl: "http://localhost:3000",
    });

    expect(payload.text).toContain("生成 1 篇笔记");
    expect(payload.text).toContain("生成 1 个任务");
    expect(payload.text).toContain("跑通 Hermes 推送闭环");
    expect(payload.text).toContain("[待确认]");
    expect(payload.buttons).toEqual([
      { label: "打开任务：跑通 Hermes 推送闭环", url: "http://localhost:3000/tasks/task_1" },
      { label: "打开笔记：Bot 联动设计", url: "http://wiki.local/note?path=bot.md" },
      { label: "打开今日任务", url: "http://localhost:3000/" },
      { label: "查看输入箱", url: "http://localhost:3000/inbox" },
    ]);
  });

  it("stores notification payload and writes activity", async () => {
    const db = {
      notification: {
        create: vi
          .fn()
          .mockResolvedValue({ id: "notice_1", payload: { text: "ok" } }),
      },
      activityLog: { create: vi.fn().mockResolvedValue({ id: "activity_1" }) },
    };

    const result = await createTelegramNotification(db, {
      recipient: "user_1",
      projectName: "Personal OS",
      notes: [],
      tasks: [{ id: "task_1", title: "跑通 Hermes 推送闭环", status: "review" }],
      ideas: [],
    });

    expect(result.notification.id).toBe("notice_1");
    expect(db.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: "telegram",
          recipient: "user_1",
        }),
      }),
    );
    expect(db.activityLog.create).toHaveBeenCalled();
  });
});
