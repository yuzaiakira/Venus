import { describe, expect, it } from "vitest";
import {
  goalSchema,
  nextMilestone,
  progressSummary,
  type GoalRecord,
} from "../../src/domain/goals";

const stamp = {
  id: "11111111-1111-4111-8111-111111111111",
  profileId: "22222222-2222-4222-8222-222222222222",
  title: "Goal",
  description: "",
  status: "active" as const,
  startDate: "2026-12-30",
  targetDate: "2027-01-04",
  revision: 1,
  createdAt: "2026-12-30T00:00:00.000Z",
  updatedAt: "2026-12-30T00:00:00.000Z",
};

describe("Goals domain", () => {
  it("validates dates and explicit manual targets", () => {
    expect(() =>
      goalSchema.parse({
        ...stamp,
        targetDate: "2026-12-29",
        progress: { mode: "manual", target: 3, current: 1 },
      }),
    ).toThrow();
    expect(() =>
      goalSchema.parse({
        ...stamp,
        progress: { mode: "manual", target: 3, current: 4 },
      }),
    ).toThrow();
    expect(() =>
      goalSchema.parse({
        ...stamp,
        progress: {
          mode: "habitCheckIns",
          target: 3,
          periodStart: "2027-01-04",
          periodEnd: "2026-12-30",
        },
      }),
    ).toThrow();
  });

  it("calculates manual, task and habit progress without double counting", () => {
    const manual: GoalRecord = goalSchema.parse({
      ...stamp,
      progress: { mode: "manual", target: 4, current: 3 },
    });
    expect(
      progressSummary({ goal: manual, relations: [], tasks: [], habits: [] }),
    ).toMatchObject({
      current: 3,
      target: 4,
      percent: 75,
      remaining: 1,
    });

    const tasks: GoalRecord = goalSchema.parse({
      ...stamp,
      progress: { mode: "linkedTasks" },
    });
    expect(
      progressSummary({
        goal: tasks,
        relations: [
          {
            ...stamp,
            id: "33333333-3333-4333-8333-333333333333",
            goalId: stamp.id,
            targetKind: "task",
            targetId: "44444444-4444-4444-8444-444444444444",
          },
          {
            ...stamp,
            id: "55555555-5555-4555-8555-555555555555",
            goalId: stamp.id,
            targetKind: "task",
            targetId: "66666666-6666-4666-8666-666666666666",
          },
        ],
        tasks: [{ id: "44444444-4444-4444-8444-444444444444", status: "done" }],
        habits: [],
      }),
    ).toMatchObject({ current: 1, target: 1, percent: 100, unavailable: 1 });

    const habits: GoalRecord = goalSchema.parse({
      ...stamp,
      progress: {
        mode: "habitCheckIns",
        target: 3,
        periodStart: "2026-12-30",
        periodEnd: "2027-01-02",
      },
    });
    expect(
      progressSummary({
        goal: habits,
        relations: [
          {
            ...stamp,
            id: "77777777-7777-4777-8777-777777777777",
            goalId: stamp.id,
            targetKind: "habit",
            targetId: "88888888-8888-4888-8888-888888888888",
          },
        ],
        tasks: [],
        habits: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            checkIns: ["2026-12-30", "2026-12-30", "2027-01-01", "2027-01-03"],
          },
        ],
      }),
    ).toMatchObject({ current: 2, target: 3, percent: 67, remaining: 1 });
  });

  it("chooses the first incomplete dated milestone without relying on locale dates", () => {
    const result = nextMilestone([
      {
        ...stamp,
        id: "33333333-3333-4333-8333-333333333333",
        goalId: stamp.id,
        title: "Undated",
        targetDate: null,
        completed: false,
        sortIndex: 0,
      },
      {
        ...stamp,
        id: "44444444-4444-4444-8444-444444444444",
        goalId: stamp.id,
        title: "Earlier",
        targetDate: "2027-01-01",
        completed: false,
        sortIndex: 1,
      },
      {
        ...stamp,
        id: "55555555-5555-4555-8555-555555555555",
        goalId: stamp.id,
        title: "Done",
        targetDate: "2026-12-31",
        completed: true,
        sortIndex: 2,
      },
    ]);
    expect(result?.title).toBe("Earlier");
  });
});
