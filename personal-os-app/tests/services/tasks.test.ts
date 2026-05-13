import { describe, expect, it, vi } from "vitest";
import { completeTask, createTask, updateTask } from "@/lib/tasks";

describe("task services", () => {
  it("creates a task and records an undoable activity entry", async () => {
    const taskCreate = vi
      .fn()
      .mockResolvedValue({ id: "task_1", title: "做工作台", status: "review" });
    const activityCreate = vi.fn().mockResolvedValue({ id: "activity_1" });
    const db = {
      task: {
        create: taskCreate,
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      activityLog: { create: activityCreate },
    };

    const task = await createTask(db, {
      title: "做工作台",
      status: "review",
      priority: "P0",
      nextAction: "把任务拆成今日要做和待确认",
      definitionOfDone: "今日任务页面能看清任务状态",
      createdBy: "hermes",
    });

    expect(task.id).toBe("task_1");
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "task.created",
          undoPayload: { action: "task.archive", id: "task_1" },
        }),
      }),
    );
  });

  it("persists explicit wiki links when creating a task", async () => {
    const taskCreate = vi
      .fn()
      .mockResolvedValue({ id: "task_2", title: "读资料后执行", status: "todo" });
    const db = {
      task: {
        create: taskCreate,
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      activityLog: { create: vi.fn().mockResolvedValue({ id: "activity_2" }) },
    };

    await createTask(db, {
      title: "读资料后执行",
      status: "todo",
      priority: "P1",
      nextAction: "打开关联 Wiki 笔记，确认执行步骤。",
      definitionOfDone: "任务详情能直达关联知识。",
      createdBy: "hermes",
      wikiLinks: [
        {
          noteTitle: "DeepTalk 输入链路",
          notePath: "vault/20_notes/deeptalk.md",
          noteUrl: "http://wiki.local/note?path=vault%2F20_notes%2Fdeeptalk.md",
        },
      ],
    });

    expect(taskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wikiLinks: {
            create: [
              expect.objectContaining({
                noteTitle: "DeepTalk 输入链路",
                notePath: "vault/20_notes/deeptalk.md",
              }),
            ],
          },
        }),
      }),
    );
  });

  it("completes a task with done status and completion timestamp", async () => {
    const before = { id: "task_1", status: "doing" };
    const taskUpdate = vi
      .fn()
      .mockResolvedValue({ id: "task_1", title: "做工作台", status: "done" });
    const db = {
      task: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(before),
        findMany: vi.fn(),
        update: taskUpdate,
      },
      activityLog: { create: vi.fn().mockResolvedValue({ id: "activity_1" }) },
    };

    const task = await completeTask(db, "task_1");

    expect(task.status).toBe("done");
    expect(taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task_1" },
        data: expect.objectContaining({ status: "done" }),
      }),
    );
  });

  it("reopens a done task by clearing completion timestamp", async () => {
    const before = {
      id: "task_1",
      status: "done",
      completedAt: new Date("2026-04-22T00:00:00Z"),
    };
    const taskUpdate = vi
      .fn()
      .mockResolvedValue({ id: "task_1", title: "做工作台", status: "todo" });
    const db = {
      task: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(before),
        findMany: vi.fn(),
        update: taskUpdate,
      },
      activityLog: { create: vi.fn().mockResolvedValue({ id: "activity_1" }) },
    };

    const task = await updateTask(db, "task_1", { status: "todo" });

    expect(task.status).toBe("todo");
    expect(taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task_1" },
        data: expect.objectContaining({
          status: "todo",
          completedAt: null,
        }),
      }),
    );
  });

  it("revokes an active agent lease when policy no longer allows agent work", async () => {
    const before = {
      id: "task_1",
      status: "doing",
      ownerAgent: "agent_1",
      leaseUntil: new Date("2026-04-22T01:00:00Z"),
    };
    const taskUpdate = vi
      .fn()
      .mockResolvedValue({ id: "task_1", title: "鍋氬伐浣滃彴", status: "doing" });
    const activityCreate = vi.fn().mockResolvedValue({ id: "activity_1" });
    const claimUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const runUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const actionCreate = vi.fn().mockResolvedValue({ id: "action_1" });
    const db = {
      task: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(before),
        findMany: vi.fn(),
        update: taskUpdate,
      },
      taskClaim: { updateMany: claimUpdateMany },
      taskRun: { updateMany: runUpdateMany },
      agentActionLog: { create: actionCreate },
      activityLog: { create: activityCreate },
    };

    await updateTask(db, "task_1", { executionMode: "approval_required" });

    expect(taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          executionMode: "approval_required",
          ownerAgent: null,
          leaseUntil: null,
          lastHeartbeatAt: null,
        }),
      }),
    );
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "task.lease.revoked_by_policy_change",
        }),
      }),
    );
    expect(claimUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          taskId: "task_1",
          agentId: "agent_1",
          releasedAt: null,
        },
        data: expect.objectContaining({ releaseReason: "policy_change" }),
      }),
    );
    expect(runUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          taskId: "task_1",
          agentId: "agent_1",
          status: "running",
        },
        data: expect.objectContaining({ status: "policy_revoked" }),
      }),
    );
    expect(actionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "task.lease.revoked_by_policy_change",
          agentId: "agent_1",
        }),
      }),
    );
  });
});
