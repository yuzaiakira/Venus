import {
  isLeapJalaaliYear,
  isValidJalaaliDate,
  jalaaliMonthLength,
  toGregorian,
  toJalaali,
} from "jalaali-js";
import { WorkspaceError } from "../dashboard";
import { maxGregorian, minGregorian } from "./limits";
import { VenusTemporal, readZoned, type PlainInstant } from "./temporal";

export type CalendarBasis = "gregorian" | "jalali";
export type CalendarDate = {
  calendar: CalendarBasis;
  year: number;
  month: number;
  day: number;
};
export type WallTime = { hour: number; minute: number; second: number };
export type FoldPolicy = "earlier" | "later";

const jalaliMonthEn = [
  "Farvardin",
  "Ordibehesht",
  "Khordad",
  "Tir",
  "Mordad",
  "Shahrivar",
  "Mehr",
  "Aban",
  "Azar",
  "Dey",
  "Bahman",
  "Esfand",
];
const jalaliMonthFa = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export function gregorianInProductRange(
  year: number,
  month: number,
  day: number,
) {
  const stamp = year * 10_000 + month * 100 + day;
  const min =
    minGregorian.year * 10_000 + minGregorian.month * 100 + minGregorian.day;
  const max =
    maxGregorian.year * 10_000 + maxGregorian.month * 100 + maxGregorian.day;
  return stamp >= min && stamp <= max;
}

export function assertProductDate(date: CalendarDate) {
  const gregorian =
    date.calendar === "gregorian" ? date : toGregorianDate(date);
  if (
    !gregorianInProductRange(gregorian.year, gregorian.month, gregorian.day) ||
    !isRealDate(date)
  )
    throw new WorkspaceError("invalidInput");
  return date;
}

export function isRealDate(date: CalendarDate) {
  if (date.calendar === "jalali")
    return isValidJalaaliDate(date.year, date.month, date.day);
  if (date.month < 1 || date.month > 12 || date.day < 1) return false;
  return date.day <= gregorianMonthLength(date.year, date.month);
}

export function monthLength(
  date: Pick<CalendarDate, "calendar" | "year" | "month">,
) {
  return date.calendar === "jalali"
    ? jalaaliMonthLength(date.year, date.month)
    : gregorianMonthLength(date.year, date.month);
}

export function isLeapYear(calendar: CalendarBasis, year: number) {
  return calendar === "jalali"
    ? isLeapJalaaliYear(year)
    : gregorianMonthLength(year, 2) === 29;
}

export function gregorianMonthLength(year: number, month: number) {
  const plain = VenusTemporal.PlainDate.from({ year, month, day: 1 });
  return plain.daysInMonth;
}

export function toGregorianDate(date: CalendarDate): CalendarDate {
  if (date.calendar === "gregorian") return date;
  const next = toGregorian(date.year, date.month, date.day);
  return {
    calendar: "gregorian",
    year: next.gy,
    month: next.gm,
    day: next.gd,
  };
}

export function toJalaliDate(date: CalendarDate): CalendarDate {
  if (date.calendar === "jalali") return date;
  const next = toJalaali(date.year, date.month, date.day);
  return { calendar: "jalali", year: next.jy, month: next.jm, day: next.jd };
}

export function convertDate(date: CalendarDate, calendar: CalendarBasis) {
  return calendar === "jalali" ? toJalaliDate(date) : toGregorianDate(date);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  if (date.calendar === "jalali") {
    const gregorian = toGregorianDate(date);
    const next = addDays({ ...gregorian, calendar: "gregorian" }, days);
    return toJalaliDate(next);
  }
  const plain = VenusTemporal.PlainDate.from({
    year: date.year,
    month: date.month,
    day: date.day,
  }).add({ days });
  return {
    calendar: "gregorian",
    year: plain.year,
    month: plain.month,
    day: plain.day,
  };
}

export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const index = date.year * 12 + (date.month - 1) + months;
  return {
    calendar: date.calendar,
    year: Math.floor(index / 12),
    month: (index % 12) + 1,
    day: date.day,
  };
}

export function compareDates(left: CalendarDate, right: CalendarDate) {
  const a = toGregorianDate(left);
  const b = toGregorianDate(right);
  return (
    a.year * 10_000 +
    a.month * 100 +
    a.day -
    (b.year * 10_000 + b.month * 100 + b.day)
  );
}

export function isoWeekday(date: CalendarDate) {
  const gregorian = toGregorianDate(date);
  return VenusTemporal.PlainDate.from({
    year: gregorian.year,
    month: gregorian.month,
    day: gregorian.day,
  }).dayOfWeek;
}

export function weekdayInMonth(
  calendar: CalendarBasis,
  year: number,
  month: number,
  ordinal: -1 | 1 | 2 | 3 | 4,
  weekday: number,
): CalendarDate | null {
  const length = monthLength({ calendar, year, month });
  const matches: CalendarDate[] = [];
  for (let day = 1; day <= length; day += 1) {
    const date = { calendar, year, month, day };
    if (isoWeekday(date) === weekday) matches.push(date);
  }
  if (ordinal === -1) return matches[matches.length - 1] ?? null;
  return matches[ordinal - 1] ?? null;
}

export function resolveWallTime(input: {
  date: CalendarDate;
  wall: WallTime;
  timeZone: string;
  foldPolicy?: FoldPolicy;
}): { instant: PlainInstant; adjusted: boolean } {
  assertProductDate(input.date);
  const gregorian = toGregorianDate(input.date);
  const fields = {
    year: gregorian.year,
    month: gregorian.month,
    day: gregorian.day,
    hour: input.wall.hour,
    minute: input.wall.minute,
    second: input.wall.second,
    timeZone: input.timeZone,
  };
  try {
    const exact = VenusTemporal.ZonedDateTime.from(fields, {
      disambiguation: "reject",
    });
    return { instant: readZoned(exact), adjusted: false };
  } catch (error) {
    if (!isTimeZoneError(error)) throw new WorkspaceError("invalidInput");
    let earlier;
    let later;
    try {
      earlier = VenusTemporal.ZonedDateTime.from(fields, {
        disambiguation: "earlier",
      });
      later = VenusTemporal.ZonedDateTime.from(fields, {
        disambiguation: "later",
      });
    } catch {
      throw new WorkspaceError("invalidInput");
    }
    const earlierMatches =
      earlier.hour === input.wall.hour && earlier.minute === input.wall.minute;
    const laterMatches =
      later.hour === input.wall.hour && later.minute === input.wall.minute;
    const chosen =
      earlierMatches && laterMatches
        ? input.foldPolicy === "later"
          ? later
          : earlier
        : later;
    return { instant: readZoned(chosen), adjusted: true };
  }
}

function isTimeZoneError(error: unknown) {
  return error instanceof RangeError || error instanceof TypeError;
}

export function formatCalendarDate(
  date: CalendarDate,
  locale: "en" | "fa",
  numerals: (value: number) => string,
) {
  const month =
    date.calendar === "jalali"
      ? (locale === "fa" ? jalaliMonthFa : jalaliMonthEn)[date.month - 1]
      : gregorianMonthName(date, locale);
  return `${numerals(date.day)} ${month} ${numerals(date.year)}`;
}

function gregorianMonthName(date: CalendarDate, locale: "en" | "fa") {
  const gregorian = toGregorianDate(date);
  return new Intl.DateTimeFormat(locale === "fa" ? "fa" : "en", {
    month: "long",
    timeZone: "UTC",
  }).format(
    new Date(Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day)),
  );
}

export function todayInZone(
  timeZone: string,
  epochMs: number,
  calendar: CalendarBasis,
) {
  const zoned =
    VenusTemporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(
      timeZone,
    );
  const gregorian: CalendarDate = {
    calendar: "gregorian",
    year: zoned.year,
    month: zoned.month,
    day: zoned.day,
  };
  return calendar === "jalali" ? toJalaliDate(gregorian) : gregorian;
}

export function occurrenceKey(input: {
  calendar: CalendarBasis;
  date: CalendarDate;
  wall: WallTime | null;
  timeZone: string;
}) {
  const wall = input.wall ?? { hour: 0, minute: 0, second: 0 };
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    input.calendar,
    input.date.year,
    pad(input.date.month),
    pad(input.date.day),
    pad(wall.hour),
    pad(wall.minute),
    pad(wall.second),
    input.timeZone,
  ].join(":");
}
