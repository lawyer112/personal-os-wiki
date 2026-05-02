import { describe, expect, it, vi } from "vitest";
import { getToday } from "@/lib/today";

describe("getToday", () => {
  it("returns separated work sections and metrics", async () => {
    const db = {
      task: {
        count: vi
          .fn()
          .mockResolvedValueOnce(7)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ id: "now_1" }])
          .mockResolvedValueOnce([{ id: "review_1" }, { id: "review_2" }])
          .mockResolvedValueOnce([
            { id: "execution_review_1" },
            { id: "execution_review_2" },
            { id: "execution_review_3" },
          ])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: "blocked_1" }])
          .mockResolvedValueOnce([{ id: "done_1" }]),
      },
      project: { findMany: vi.fn().mockResolvedValue([{ id: "project_1" }]) },
      activityLog: { findMany: vi.fn().mockResolvedValue([{ id: "log_1" }]) },
    };

    const today = await getToday(db);

    expect(today.metrics).toEqual({
      now: 7,
      review: 5,
      intakeReview: 2,
      executionReview: 3,
      waiting: 0,
      blocked: 1,
      done: 1,
    });
    expect(today.reviewTasks).toEqual([{ id: "review_1" }, { id: "review_2" }]);
    expect(today.executionReviewTasks).toEqual([
      { id: "execution_review_1" },
      { id: "execution_review_2" },
      { id: "execution_review_3" },
    ]);
    expect(today.projects).toEqual([{ id: "project_1" }]);
    expect(today.activity).toEqual([{ id: "log_1" }]);
  });
});
