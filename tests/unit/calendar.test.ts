import { describe, expect, it } from "vitest";
import { isLeapJalaaliYear } from "jalaali-js";
import {
  addMonths,
  assertProductDate,
  formatCalendarDate,
  isLeapYear,
  monthLength,
  resolveWallTime,
  toGregorianDate,
  toJalaliDate,
} from "../../src/domain/time/calendar";
import { generateBatch } from "../../src/domain/time/recurrence";
import type { RecurrenceSpec } from "../../src/domain/time/recurrence";
import {
  applyDeliveryDecision,
  markAttemptStarted,
  pruneHistory,
  quietHoursActive,
  reconcileRow,
  type NotificationRow,
} from "../../src/domain/time/schedule";
import { VenusTemporal } from "../../src/domain/time/temporal";

const tehran = "Asia/Tehran";

function rule(patch: Partial<RecurrenceSpec>): RecurrenceSpec {
  return {
    basis: "jalali",
    freq: "YEARLY",
    interval: 1,
    startDate: { calendar: "jalali", year: 1403, month: 1, day: 1 },
    wall: { hour: 9, minute: 0, second: 0 },
    timeZone: tehran,
    invalidDayPolicy: "skip",
    exclusions: [],
    wkst: 6,
    ...patch,
  };
}

describe("calendar foundations", () => {
  it("keeps Jalali leap day and Esfand length on the Jalali calendar", () => {
    expect(isLeapYear("jalali", 1395)).toBe(isLeapJalaaliYear(1395));
    expect(monthLength({ calendar: "jalali", year: 1395, month: 12 })).toBe(30);
    expect(monthLength({ calendar: "jalali", year: 1394, month: 12 })).toBe(29);
    expect(isLeapYear("gregorian", 2000)).toBe(true);
    expect(monthLength({ calendar: "gregorian", year: 1900, month: 2 })).toBe(
      28,
    );
  });

  it("rejects dates outside Gregorian 1900-01-01 through 2100-12-31", () => {
    expect(() =>
      assertProductDate({
        calendar: "gregorian",
        year: 1899,
        month: 12,
        day: 31,
      }),
    ).toThrow();
    expect(() =>
      assertProductDate({
        calendar: "gregorian",
        year: 2101,
        month: 1,
        day: 1,
      }),
    ).toThrow();
    expect(
      assertProductDate({ calendar: "gregorian", year: 1900, month: 1, day: 1 })
        .day,
    ).toBe(1);
  });

  it("converts Farvardin 1 without changing a stored Jalali tuple", () => {
    const jalali = {
      calendar: "jalali" as const,
      year: 1404,
      month: 1,
      day: 1,
    };
    const gregorian = toGregorianDate(jalali);
    expect(jalali).toEqual({
      calendar: "jalali",
      year: 1404,
      month: 1,
      day: 1,
    });
    expect(toJalaliDate(gregorian)).toEqual(jalali);
  });

  it("moves a spring-forward gap forward and keeps the earlier fall-back offset", () => {
    const gap = resolveWallTime({
      date: { calendar: "gregorian", year: 2026, month: 3, day: 8 },
      wall: { hour: 2, minute: 30, second: 0 },
      timeZone: "America/New_York",
    });
    expect(gap.adjusted).toBe(true);
    expect(gap.instant.hour).toBe(3);
    const fold = resolveWallTime({
      date: { calendar: "gregorian", year: 2026, month: 11, day: 1 },
      wall: { hour: 1, minute: 30, second: 0 },
      timeZone: "America/New_York",
    });
    expect(fold.adjusted).toBe(true);
    const later = resolveWallTime({
      date: { calendar: "gregorian", year: 2026, month: 11, day: 1 },
      wall: { hour: 1, minute: 30, second: 0 },
      timeZone: "America/New_York",
      foldPolicy: "later",
    });
    expect(later.instant.epochMs).toBeGreaterThan(fold.instant.epochMs);
  });

  it("formats with the caller numeral system", () => {
    const label = formatCalendarDate(
      { calendar: "jalali", year: 1404, month: 1, day: 1 },
      "fa",
      (value) => String(value).replaceAll("1", "۱"),
    );
    expect(label).toContain("فروردین");
    expect(label).toContain("۱");
  });

  it("adds Jalali months without using a Gregorian month stepper", () => {
    expect(
      addMonths({ calendar: "jalali", year: 1403, month: 12, day: 1 }, 1),
    ).toEqual({ calendar: "jalali", year: 1404, month: 1, day: 1 });
  });
});

describe("recurrence", () => {
  const now = Date.UTC(2025, 2, 20);

  it("CAL-04 keeps a Farvardin series on the Jalali basis", () => {
    const spec = rule({ count: 2 });
    const batch = generateBatch(spec, Date.UTC(2024, 2, 1), null, 400);
    expect(batch.occurrences.map((item) => item.date)).toEqual([
      { calendar: "jalali", year: 1403, month: 1, day: 1 },
      { calendar: "jalali", year: 1404, month: 1, day: 1 },
    ]);
    expect(spec.basis).toBe("jalali");
    expect(batch.occurrences[0]?.key.startsWith("jalali:1403:")).toBe(true);
  });

  it("CAL-01 skips a missing Esfand 30 and can clamp to the last day", () => {
    const skipped = generateBatch(
      rule({
        freq: "YEARLY",
        startDate: { calendar: "jalali", year: 1393, month: 12, day: 1 },
        monthDay: 30,
        count: 3,
        invalidDayPolicy: "skip",
        wall: null,
      }),
      Date.UTC(2015, 0, 1),
      null,
    );
    expect(skipped.occurrences.map((item) => item.date.year)).not.toContain(
      1394,
    );
    const clamped = generateBatch(
      rule({
        freq: "YEARLY",
        startDate: { calendar: "jalali", year: 1394, month: 12, day: 29 },
        monthDay: 30,
        count: 1,
        invalidDayPolicy: "last_day",
        wall: null,
      }),
      Date.UTC(2016, 0, 1),
      null,
      120,
    );
    expect(clamped.occurrences[0]?.date.day).toBe(29);
  });

  it("CAL-02 and CAL-03 build last Thursday and a 14-day Saturday series", () => {
    const thursdays = generateBatch(
      rule({
        freq: "MONTHLY",
        startDate: { calendar: "jalali", year: 1404, month: 1, day: 1 },
        ordinalWeekday: { ordinal: -1, weekday: 4 },
        count: 2,
        wall: null,
      }),
      Date.UTC(2025, 2, 1),
      null,
      100,
    );
    expect(thursdays.occurrences).toHaveLength(2);
    expect(
      thursdays.occurrences.every((item) => item.date.calendar === "jalali"),
    ).toBe(true);
    const saturdays = generateBatch(
      rule({
        freq: "WEEKLY",
        interval: 2,
        byWeekdays: [6],
        startDate: { calendar: "jalali", year: 1404, month: 1, day: 2 },
        count: 3,
        wall: null,
      }),
      Date.UTC(2025, 2, 1),
      null,
    );
    expect(saturdays.occurrences).toHaveLength(3);
    const first = toGregorianDate(saturdays.occurrences[0]!.date);
    const second = toGregorianDate(saturdays.occurrences[1]!.date);
    const left = VenusTemporal.PlainDate.from({
      year: first.year,
      month: first.month,
      day: first.day,
    });
    const right = VenusTemporal.PlainDate.from({
      year: second.year,
      month: second.month,
      day: second.day,
    });
    expect(left.until(right, { largestUnit: "day" }).days).toBe(14);
  });

  it("does not drop the rest of a series when a batch fills", () => {
    const first = generateBatch(
      rule({
        basis: "gregorian",
        freq: "DAILY",
        startDate: { calendar: "gregorian", year: 2026, month: 1, day: 1 },
        wall: null,
        timeZone: "UTC",
      }),
      Date.UTC(2026, 0, 1),
      null,
      500,
      2,
    );
    expect(first.batchFull).toBe(true);
    expect(first.seriesExhausted).toBe(false);
    const second = generateBatch(
      rule({
        basis: "gregorian",
        freq: "DAILY",
        startDate: { calendar: "gregorian", year: 2026, month: 1, day: 1 },
        wall: null,
        timeZone: "UTC",
      }),
      Date.UTC(2026, 0, 1),
      first.cursor,
      500,
      2,
    );
    expect(second.occurrences[0]?.date.day).toBe(3);
  });

  it("rejects count together with until", () => {
    expect(() =>
      generateBatch(
        rule({
          count: 2,
          untilLocalDate: { calendar: "jalali", year: 1405, month: 1, day: 1 },
        }),
        now,
        null,
      ),
    ).toThrow();
  });
});

describe("notification claims", () => {
  const row: NotificationRow = {
    idempotencyKey: "a:b:c:1:1",
    ownerId: "a",
    ruleId: "b",
    occurrenceKey: "c",
    fireAtUTC: 1_000,
    internalStatus: "pending",
    read: false,
    seenMissed: false,
    nativeAttempt: "not_started",
    nativeApiStatus: null,
    osDisplay: "unobserved",
    attempt: 1,
    quietHoursOverride: false,
    sourceKind: "event",
    title: "Orbit",
  };

  it("marks a quit browser as missed and does not retry an uncertain attempt", () => {
    expect(reconcileRow(row, 2_000, true).internalStatus).toBe("missed");
    const started = markAttemptStarted({
      ...row,
      internalStatus: "due",
    });
    expect(started?.nativeAttempt).toBe("started");
    expect(
      reconcileRow(
        { ...row, internalStatus: "due", nativeAttempt: "started" },
        2_000,
        false,
      ).nativeApiStatus,
    ).toBe("uncertain");
    expect(
      markAttemptStarted({
        ...row,
        internalStatus: "due",
        nativeAttempt: "started",
        nativeApiStatus: "uncertain",
      }),
    ).toBeNull();
  });

  it("keeps API acceptance distinct from OS display", () => {
    const accepted = applyDeliveryDecision(
      { ...row, internalStatus: "due", nativeAttempt: "started" },
      { kind: "api", status: "accepted" },
    );
    expect(accepted.nativeApiStatus).toBe("accepted");
    expect(accepted.osDisplay).toBe("unobserved");
  });

  it("wraps quiet hours across midnight and keeps unseen missed rows", () => {
    const minutes = () => 23 * 60;
    expect(
      quietHoursActive(
        0,
        { enabled: true, start: "22:00", end: "07:00", timeZone: "UTC" },
        minutes,
      ),
    ).toBe(true);
    const missed = { ...row, internalStatus: "missed" as const, fireAtUTC: 0 };
    const pruned = pruneHistory([missed], 10 * 86_400_000, 1, 1);
    expect(pruned).toHaveLength(1);
  });
});
