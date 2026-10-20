import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCalendar } from "../../src/application/calendar";
import { fillHorizon } from "../../src/domain/time/recurrence";
import { recurrenceFromForm } from "../../src/domain/time/form";
import { calendarDb, db } from "../../src/infrastructure/db";
import { WorkspaceError } from "../../src/domain/dashboard";

const alarms = {
  schedule: vi.fn(async () => {}),
  clear: vi.fn(async () => {}),
};
const notifications = {
  permission: vi.fn(
    async (): Promise<"granted" | "denied" | "missing"> => "granted",
  ),
  show: vi.fn(async () => "accepted" as const),
  clear: vi.fn(async () => {}),
};

function service(now = Date.UTC(2026, 5, 1, 12)) {
  return createCalendar({
    database: calendarDb,
    alarms,
    notifications,
    now: () => now,
  });
}

describe("P03 acceptance remediation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    notifications.permission.mockResolvedValue("granted");
    notifications.show.mockResolvedValue("accepted");
    if (db.isOpen()) db.close();
    await Dexie.delete("Venus-p00");
    await db.open();
  });

  it("CAL-07 edits one generated occurrence and keeps its key", async () => {
    const calendar = service();
    const event = await calendar.createEvent({
      title: "Series",
      basis: "gregorian",
      allDay: true,
      localDate: { calendar: "gregorian", year: 2026, month: 6, day: 1 },
      zoneId: "UTC",
      recurrence: {
        basis: "gregorian",
        freq: "DAILY",
        interval: 1,
        startDate: { calendar: "gregorian", year: 2026, month: 6, day: 1 },
        wall: null,
        timeZone: "UTC",
        count: 3,
        invalidDayPolicy: "skip",
        exclusions: [],
        wkst: 1,
      },
    });
    const before = await calendar.occurrences(event.id);
    const chosen = before[0];
    expect(chosen).toBeTruthy();
    await calendar.saveEvent(
      event.id,
      event.revision,
      { title: "Only this" },
      "THIS",
      chosen?.key,
    );
    const after = await calendar.occurrences(event.id);
    expect(after.map((item) => item.key)).toEqual(
      before.map((item) => item.key),
    );
    const rows = (await calendar.list()).notifications;
    const changed = rows.filter((row) => row.occurrenceKey === chosen?.key);
    const others = rows.filter((row) => row.occurrenceKey !== chosen?.key);
    expect(changed.every((row) => row.title === "Only this")).toBe(true);
    expect(others.every((row) => row.title === "Series")).toBe(true);
    db.close();
    await db.open();
    const reloaded = service();
    await reloaded.reconcile(false);
    expect(
      (await reloaded.occurrences(event.id)).map((item) => item.key),
    ).toEqual(before.map((item) => item.key));
  });

  it("CAL-08 cancels the series without restoring it or dropping history", async () => {
    const calendar = service();
    const event = await calendar.createEvent({
      title: "Gone",
      basis: "gregorian",
      allDay: true,
      localDate: { calendar: "gregorian", year: 2026, month: 6, day: 1 },
      zoneId: "UTC",
      recurrence: {
        basis: "gregorian",
        freq: "DAILY",
        interval: 1,
        startDate: { calendar: "gregorian", year: 2026, month: 6, day: 1 },
        wall: null,
        timeZone: "UTC",
        count: 2,
        invalidDayPolicy: "skip",
        exclusions: [],
        wkst: 1,
      },
    });
    const rows = (await calendar.list()).notifications;
    await calendar.complete(rows[0]?.idempotencyKey ?? "");
    await calendar.deleteEvent(event.id);
    const after = await calendar.list();
    expect(after.events).toHaveLength(0);
    expect(after.rules).toHaveLength(0);
    expect(
      after.notifications.some((row) => row.internalStatus === "completed"),
    ).toBe(true);
    expect(
      after.notifications
        .filter((row) => row.internalStatus !== "completed")
        .every((row) => row.internalStatus === "cancelled"),
    ).toBe(true);
    await calendar.reconcile(false);
    expect((await calendar.list()).events).toHaveLength(0);
    expect(
      (await calendar.list()).notifications.some(
        (row) =>
          row.internalStatus === "pending" || row.internalStatus === "due",
      ),
    ).toBe(false);
  });

  it("NOT-01 lets only one concurrent reconcile claim the native call", async () => {
    const calendar = service(Date.UTC(2026, 5, 2, 12));
    await calendar.createEvent({
      title: "Due",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 6, day: 1 },
      wall: { hour: 9, minute: 0, second: 0 },
      zoneId: "UTC",
      offsetMinutes: [0],
    });
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    notifications.show.mockImplementation(async () => {
      await gate;
      return "accepted";
    });
    const both = Promise.all([
      calendar.reconcile(false),
      calendar.reconcile(false),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    release();
    await both;
    expect(notifications.show).toHaveBeenCalledTimes(1);
    const row = (await calendar.list()).notifications[0];
    expect(row?.nativeAttempt).toBe("started");
    expect(row?.nativeApiStatus).toBe("accepted");
    expect(row?.osDisplay).toBe("unobserved");
  });

  it("NOT-03 suppresses overnight quiet hours and keeps an important override", async () => {
    const calendar = service(Date.UTC(2026, 5, 2, 23));
    await calendar.saveQuietHours({
      enabled: true,
      start: "22:00",
      end: "07:00",
      timeZone: "UTC",
    });
    await calendar.createEvent({
      title: "Quiet",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 6, day: 2 },
      wall: { hour: 23, minute: 0, second: 0 },
      zoneId: "UTC",
      offsetMinutes: [0],
    });
    await calendar.reconcile(false);
    const quiet = (await calendar.list()).notifications[0];
    expect(quiet?.internalStatus).toBe("due");
    expect(quiet?.nativeApiStatus).toBe("quiet_suppressed");
    expect(notifications.show).not.toHaveBeenCalled();
    await calendar.createEvent({
      title: "Important",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 6, day: 2 },
      wall: { hour: 22, minute: 0, second: 0 },
      zoneId: "UTC",
      reminders: [
        { offsetMinutes: 0, absoluteTime: null, quietHoursOverride: true },
      ],
    });
    await calendar.reconcile(false);
    expect(notifications.show).toHaveBeenCalledTimes(1);
  });

  it("NOT-04 keeps the internal row when permission is denied or missing", async () => {
    const calendar = service(Date.UTC(2026, 5, 2, 12));
    await calendar.createEvent({
      title: "Denied",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 6, day: 1 },
      wall: { hour: 8, minute: 0, second: 0 },
      zoneId: "UTC",
      offsetMinutes: [0],
    });
    notifications.permission.mockResolvedValueOnce("denied");
    await calendar.reconcile(false);
    expect((await calendar.list()).notifications[0]?.nativeApiStatus).toBe(
      "denied",
    );
    expect(notifications.show).not.toHaveBeenCalled();
    notifications.permission.mockResolvedValue("missing");
    await calendar.createEvent({
      title: "Missing",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 6, day: 1 },
      wall: { hour: 8, minute: 5, second: 0 },
      zoneId: "UTC",
      offsetMinutes: [0],
    });
    await calendar.reconcile(false);
    const missing = (await calendar.list()).notifications.find(
      (row) => row.title === "Missing",
    );
    expect(missing?.nativeApiStatus).toBe("unavailable");
    expect(missing?.internalStatus).toBe("due");
  });

  it("TIM-01 through TIM-04 follow absolute timestamps", async () => {
    let now = Date.UTC(2026, 5, 1, 12);
    const calendar = createCalendar({
      database: calendarDb,
      alarms,
      notifications,
      now: () => now,
    });
    const running = await calendar.startTimer({
      mode: "countdown",
      durationMs: 25 * 60_000,
    });
    await expect(
      calendar.startTimer({ mode: "countdown" }),
    ).rejects.toBeInstanceOf(WorkspaceError);
    now += 5 * 60_000;
    const paused = await calendar.pauseTimer(running.id);
    expect(paused.elapsedBeforePauseMs).toBe(5 * 60_000);
    expect(paused.endsAtUTC).toBeNull();
    now += 60_000;
    const resumed = await calendar.resumeTimer(running.id);
    expect(resumed.endsAtUTC).toBe(now + 20 * 60_000);
    now = resumed.endsAtUTC ?? now;
    await calendar.reconcile(true);
    expect((await calendar.list()).timers[0]?.status).toBe("finished");
    const focus = await calendar.startTimer({
      mode: "pomodoro",
      durationMs: 1_000,
      autoNext: false,
    });
    now += 1_000;
    await calendar.reconcile(false);
    expect(
      (await calendar.list()).timers.filter((row) => row.status === "running"),
    ).toHaveLength(0);
    await calendar.resetTimer(focus.id);
    await calendar.startTimer({
      mode: "pomodoro",
      durationMs: 1_000,
      autoNext: true,
    });
    now += 1_000;
    await calendar.reconcile(false);
    const next = (await calendar.list()).timers.find(
      (row) => row.status === "running",
    );
    expect(next?.cycleStep).toBe("short");
    now = (next?.startedAtUTC ?? now) - 120_000;
    await calendar.reconcile(false);
    expect(
      (await calendar.list()).timers.find((row) => row.id === next?.id)
        ?.clockWarning,
    ).toBe(true);
  });

  it("continues a batch-limited series instead of truncating it", () => {
    const spec = {
      basis: "gregorian" as const,
      freq: "DAILY" as const,
      interval: 1,
      startDate: {
        calendar: "gregorian" as const,
        year: 2026,
        month: 1,
        day: 1,
      },
      wall: null,
      timeZone: "UTC",
      count: 6,
      invalidDayPolicy: "skip" as const,
      exclusions: [],
      wkst: 1,
    };
    const first = fillHorizon(spec, Date.UTC(2026, 0, 1), null, 2, 2);
    expect(first.paused).toBe(true);
    expect(first.occurrences).toHaveLength(4);
    const second = fillHorizon(spec, Date.UTC(2026, 0, 1), first.cursor, 2, 2);
    expect(second.seriesExhausted).toBe(true);
    expect(second.occurrences).toHaveLength(2);
  });

  it("rejects a recurrence form that sets both count and until", () => {
    expect(() =>
      recurrenceFromForm({
        enabled: true,
        basis: "jalali",
        freq: "YEARLY",
        interval: 1,
        weekdays: [],
        ordinal: "none",
        ordinalWeekday: 1,
        monthDay: 1,
        count: 2,
        until: { calendar: "jalali", year: 1405, month: 1, day: 1 },
        invalidDayPolicy: "skip",
        startDate: { calendar: "jalali", year: 1403, month: 1, day: 1 },
        wall: null,
        timeZone: "Asia/Tehran",
        foldPolicy: "earlier",
        wkst: 6,
      }),
    ).toThrow(WorkspaceError);
  });
});
