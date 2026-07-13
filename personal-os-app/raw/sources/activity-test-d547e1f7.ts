import { describe, expect, it, vi } from "vitest";
import { recordActivity } from "@/lib/activity";

describe("recordActivity", () => {
  it("writes an activity log with actor, target, and before/after payloads", async () => {
    const create = vi.fn().mockResolvedValue({ id: "activity_1" });
    const db = { activityLog: { create } };

    const result = await recordActivity(db, {
      actorType: "hermes",
      actorId: "agent_1",
      action: "task.created",
      targetType: "task",
      targetId: "task_1",
      before: undefined,
      after: { title: "确定数据模型" },
      undoPayload: { action: "task.archive", id: "task_1" },
    });

    expect(result).toEqual({ id: "activity_1" });
    expect(create).toHaveBeenCalledWith({
      data: {
        actorType: "hermes",
        actorId: "agent_1",
        action: "task.created",
        targetType: "task",
        targetId: "task_1",
        before: undefined,
        after: { title: "确定数据模型" },
        undoPayload: { action: "task.archive", id: "task_1" },
      },
    });
  });
});
