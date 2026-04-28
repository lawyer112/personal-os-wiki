import { describe, expect, it, vi } from "vitest";
import { completeAgentRun, createInboxItem, startAgentRun } from "@/lib/inbox";

describe("inbox and agent run services", () => {
  it("creates an inbox item and records the raw input source", async () => {
    const db = {
      inboxItem: {
        create: vi.fn().mockResolvedValue({ id: "inbox_1", rawText: "hello" }),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      agentRun: { create: vi.fn(), update: vi.fn() },
      activityLog: { create: vi.fn().mockResolvedValue({ id: "activity_1" }) },
    };

    const item = await createInboxItem(db, {
      sourceType: "telegram",
      sourcePlatform: "telegram",
      rawText: "hello",
      attachments: [],
      createdBy: "user",
    });

    expect(item.id).toBe("inbox_1");
    expect(db.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "inbox.created",
          targetId: "inbox_1",
        }),
      }),
    );
  });

  it("moves an inbox item through processing and completed states", async () => {
    const db = {
      inboxItem: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "inbox_1" }),
      },
      agentRun: {
        create: vi.fn().mockResolvedValue({ id: "run_1" }),
        update: vi.fn().mockResolvedValue({ id: "run_1", inboxItemId: "inbox_1" }),
      },
      activityLog: { create: vi.fn().mockResolvedValue({ id: "activity_1" }) },
    };

    const run = await startAgentRun(db, {
      inboxItemId: "inbox_1",
      model: "example-agent-model",
      classification: { kind: "work" },
    });
    await completeAgentRun(db, run.id, { outputSummary: "created task" });

    expect(db.inboxItem.update).toHaveBeenCalledWith({
      where: { id: "inbox_1" },
      data: { status: "processing" },
    });
    expect(db.inboxItem.update).toHaveBeenCalledWith({
      where: { id: "inbox_1" },
      data: { status: "processed" },
    });
    expect(db.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({ status: "completed" }),
      }),
    );
  });
});
