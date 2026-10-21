import { describe, expect, it } from "vitest";
import {
  addFocusDays,
  buildFocusWorkspace,
  focusConflicts,
  focusDeferralSchema,
  focusSlots,
  type FocusConflict,
} from "../../src/domain/focus";
import { taskSchema, type TaskRecord } from "../../src/domain/productivity";
import { eventSchema, type EventRecord } from "../../src/domain/time/records";

const taskStamp = {
  revision: 1,
  createdAt: "2026-03-08T00:00:00.000Z",
  updatedAt: "2026-03-08T00:00:00.000Z",
};

function task(
  id: string,
  title: string,
  patch: Partial<TaskRecord> = {},
): TaskRecord {
  return taskSchema.parse({
    id,
    title,
    details: "",
    status: "open",
    column: "todo",
    sortIndex: 0,
    today: false,
    todayOrder: 0,
    labels: [],
    checklist: [],
    priority: 1,
    dueDate: null,
    eventId: null,
    focusRank: null,
    completedAt: null,
    ...taskStamp,
    ...patch,
  });
}

describe("Focus Coach domain", () => {
  it("uses local calendar dates for deferral boundaries across DST and year ends", () => {
    expect(addFocusDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addFocusDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addFocusDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("finds a clear 25-minute window after a calendar conflict", () => {
    const now = Date.UTC(2026, 2, 8, 8, 55);
    const conflicts: FocusConflict[] = [
      {
        title: "Stand-up",
        startAtUTC: Date.UTC(2026, 2, 8, 9),
        endAtUTC: Date.UTC(2026, 2, 8, 10),
        allDay: false,
      },
    ];
    const slot = focusSlots(conflicts, now, "UTC", 1)[0];
    expect(slot).toMatchObject({
      startAtUTC: Date.UTC(2026, 2, 8, 10),
      endAtUTC: Date.UTC(2026, 2, 8, 10, 25),
      durationMinutes: 25,
    });
  });

  it("keeps daily and weekly recurring events visible even when their series began long ago", () => {
    const event = eventSchema.parse({
      id: "55555555-5555-4555-8555-555555555555",
      title: "Daily planning",
      description: "",
      calendarBasis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 3, day: 1 },
      wall: { hour: 9, minute: 0, second: 0 },
      zoneId: "America/New_York",
      foldPolicy: "earlier",
      recurrenceSpec: {
        basis: "gregorian",
        freq: "DAILY",
        interval: 1,
        startDate: { calendar: "gregorian", year: 2026, month: 3, day: 1 },
        wall: { hour: 9, minute: 0, second: 0 },
        timeZone: "America/New_York",
        invalidDayPolicy: "skip",
        exclusions: [],
        wkst: 1,
      },
      exclusions: [],
      overrides: {},
      generationCursor: null,
      ...taskStamp,
    }) as EventRecord;
    const conflicts = focusConflicts(
      [event],
      Date.UTC(2027, 2, 8, 13),
      "America/New_York",
    );
    expect(conflicts[0]).toMatchObject({
      title: "Daily planning",
      startAtUTC: Date.UTC(2027, 2, 8, 14),
    });
  });

  it("prioritizes overdue and due work while honoring a profile's persisted snooze", () => {
    const now = Date.UTC(2026, 2, 8, 13);
    const overdue = task("11111111-1111-4111-8111-111111111111", "Overdue", {
      dueDate: "2026-03-07",
      priority: 3,
    });
    const due = task("22222222-2222-4222-8222-222222222222", "Due", {
      dueDate: "2026-03-08",
    });
    const snoozed = focusDeferralSchema.parse({
      id: "33333333-3333-4333-8333-333333333333",
      profileId: "44444444-4444-4444-8444-444444444444",
      taskId: overdue.id,
      deferredUntilDate: null,
      snoozedUntilUTC: now + 60 * 60_000,
      ...taskStamp,
    });
    const plan = buildFocusWorkspace({
      tasks: [due, overdue],
      events: [],
      timers: [],
      states: [snoozed],
      timeZone: "America/New_York",
      now,
    });
    expect(plan.today).toBe("2026-03-08");
    expect(plan.suggestions.map((item) => item.task.id)).toEqual([due.id]);
    expect(plan.deferredCount).toBe(1);
  });
});
