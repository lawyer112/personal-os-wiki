import { describe, expect, it, vi } from "vitest";
import { createIdea, promoteIdea, updateIdea } from "@/lib/ideas";

describe("idea services", () => {
  it("creates an idea as a processable buffer item", async () => {
    const ideaCreate = vi.fn().mockResolvedValue({
      id: "idea_1",
      title: "做一个想法池",
      status: "captured",
    });
    const activityCreate = vi.fn().mockResolvedValue({ id: "activity_1" });
    const db = {
      idea: {
        create: ideaCreate,
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      task: { create: vi.fn() },
      activityLog: { create: activityCreate },
    };

    const idea = await createIdea(db, {
      title: "做一个想法池",
      body: "先捕获，再决定是否转成任务。",
      status: "captured",
      priority: "P1",
      tags: ["personal-os"],
    });

    expect(idea.id).toBe("idea_1");
    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "idea.created",
          targetType: "idea",
          targetId: "idea_1",
        }),
      }),
    );
  });

  it("updates idea status without creating a task", async () => {
    const ideaUpdate = vi.fn().mockResolvedValue({
      id: "idea_1",
      title: "做一个想法池",
      status: "someday",
    });
    const db = {
      idea: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: "idea_1", status: "captured" }),
        findMany: vi.fn(),
        update: ideaUpdate,
      },
      task: { create: vi.fn() },
      activityLog: { create: vi.fn().mockResolvedValue({ id: "activity_1" }) },
    };

    const idea = await updateIdea(db, "idea_1", { status: "someday" });

    expect(idea.status).toBe("someday");
    expect(ideaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "idea_1" },
        data: { status: "someday" },
      }),
    );
  });

  it("promotes an idea into a review task and links back to the task", async () => {
    const ideaUpdate = vi.fn().mockResolvedValue({ id: "idea_1" });
    const taskCreate = vi.fn().mockResolvedValue({
      id: "task_1",
      title: "做一个想法池",
      status: "review",
    });
    const db = {
      idea: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          id: "idea_1",
          title: "做一个想法池",
          body: "先捕获，再决定是否转成任务。",
          priority: "P1",
          nextAction: "整理成一个可执行动作。",
          projectId: "project_1",
        }),
        findMany: vi.fn(),
        update: ideaUpdate,
      },
      task: { create: taskCreate },
      activityLog: { create: vi.fn().mockResolvedValue({ id: "activity_1" }) },
    };

    const result = await promoteIdea(db, "idea_1", {});

    expect(result.task.id).toBe("task_1");
    expect(taskCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "做一个想法池",
          status: "review",
          projectId: "project_1",
        }),
      }),
    );
    expect(ideaUpdate).toHaveBeenCalledWith({
      where: { id: "idea_1" },
      data: { status: "promoted", promotedTaskId: "task_1" },
    });
  });
});
