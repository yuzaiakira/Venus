import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  nextReview,
  reviewScheduleSchema,
  reviewState,
} from "../../src/domain/reviews";

const schedule = reviewScheduleSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  profileId: "22222222-2222-4222-8222-222222222222",
  noteId: "33333333-3333-4333-8333-333333333333",
  state: "active",
  dueDate: "2026-03-08",
  lastReviewedDate: null,
  intervalDays: 2,
  repetitions: 2,
  revision: 1,
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
});

describe("Knowledge Review scheduling", () => {
  it("uses documented, bounded recall transitions", () => {
    expect(nextReview(schedule, "again")).toEqual({
      intervalDays: 1,
      repetitions: 0,
    });
    expect(nextReview(schedule, "hard")).toEqual({
      intervalDays: 3,
      repetitions: 3,
    });
    expect(nextReview(schedule, "good")).toEqual({
      intervalDays: 4,
      repetitions: 3,
    });
    expect(nextReview(schedule, "easy")).toEqual({
      intervalDays: 6,
      repetitions: 3,
    });
    expect(nextReview({ intervalDays: 365, repetitions: 4 }, "easy")).toEqual({
      intervalDays: 365,
      repetitions: 5,
    });
  });

  it("uses calendar days across DST and year boundaries", () => {
    expect(addCalendarDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("classifies only active review dates as due, overdue or upcoming", () => {
    expect(reviewState(schedule, "2026-03-08")).toBe("due");
    expect(reviewState(schedule, "2026-03-09")).toBe("overdue");
    expect(
      reviewState({ ...schedule, dueDate: "2026-03-10" }, "2026-03-09"),
    ).toBe("upcoming");
    expect(reviewState({ ...schedule, state: "paused" }, "2026-03-09")).toBe(
      "paused",
    );
  });
});
