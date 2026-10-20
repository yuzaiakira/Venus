import { RRuleTemporal } from "rrule-temporal";
import { WorkspaceError } from "../dashboard";
import {
  addDays,
  addMonths,
  assertProductDate,
  compareDates,
  gregorianInProductRange,
  isoWeekday,
  monthLength,
  occurrenceKey,
  resolveWallTime,
  toGregorianDate,
  weekdayInMonth,
  type CalendarDate,
  type FoldPolicy,
  type WallTime,
} from "./calendar";
import { materializationHorizonDays, recurrenceBatchSize } from "./limits";
import { VenusTemporal } from "./temporal";

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type InvalidDayPolicy = "skip" | "last_day";
export type RecurrenceSpec = {
  basis: CalendarDate["calendar"];
  freq: Frequency;
  interval: number;
  byWeekdays?: number[];
  ordinalWeekday?: { ordinal: -1 | 1 | 2 | 3 | 4; weekday: number };
  monthDay?: number;
  startDate: CalendarDate;
  wall: WallTime | null;
  timeZone: string;
  foldPolicy?: FoldPolicy;
  count?: number;
  untilLocalDate?: CalendarDate;
  invalidDayPolicy: InvalidDayPolicy;
  exclusions: string[];
  wkst: number;
};
export type Occurrence = {
  key: string;
  date: CalendarDate;
  wall: WallTime | null;
  epochMs: number;
  adjusted: boolean;
  timeZone: string;
};
export type GenerationCursor = { afterMs: number; emitted: number };
export type GenerationBatch = {
  occurrences: Occurrence[];
  cursor: GenerationCursor;
  seriesExhausted: boolean;
  horizonFilled: boolean;
  batchFull: boolean;
};

const weekdayCode = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export function assertRule(spec: RecurrenceSpec) {
  if (spec.interval < 1 || !Number.isInteger(spec.interval))
    throw new WorkspaceError("invalidInput");
  if (spec.count !== undefined && spec.untilLocalDate !== undefined)
    throw new WorkspaceError("invalidInput");
  if (spec.count !== undefined && spec.count < 1)
    throw new WorkspaceError("invalidInput");
  if (spec.startDate.calendar !== spec.basis)
    throw new WorkspaceError("invalidInput");
  assertProductDate(spec.startDate);
  if (spec.untilLocalDate) {
    if (spec.untilLocalDate.calendar !== spec.basis)
      throw new WorkspaceError("invalidInput");
    assertProductDate(spec.untilLocalDate);
  }
  return spec;
}

export function generateBatch(
  spec: RecurrenceSpec,
  nowMs: number,
  cursor: GenerationCursor | null,
  horizonDays = materializationHorizonDays,
  batchSize = recurrenceBatchSize,
): GenerationBatch {
  assertRule(spec);
  const afterMs = cursor?.afterMs ?? Number.NEGATIVE_INFINITY;
  let emitted = cursor?.emitted ?? 0;
  const horizonEnd = nowMs + horizonDays * 86_400_000;
  const occurrences: Occurrence[] = [];
  let scanned = 0;
  let seriesExhausted = false;
  let horizonFilled = false;
  for (let index = emitted; scanned < batchSize; index += 1) {
    if (spec.count !== undefined && emitted >= spec.count) {
      seriesExhausted = true;
      break;
    }
    const step = candidateDate(spec, index);
    if (step === "end") {
      seriesExhausted = true;
      break;
    }
    scanned += 1;
    if (step === "skip") continue;
    if (spec.untilLocalDate && compareDates(step, spec.untilLocalDate) > 0) {
      seriesExhausted = true;
      break;
    }
    const occurrence = toOccurrence(spec, step);
    if (!occurrence) continue;
    emitted += 1;
    if (occurrence.epochMs <= afterMs) continue;
    if (occurrence.epochMs > horizonEnd) {
      horizonFilled = true;
      emitted -= 1;
      break;
    }
    if (!spec.exclusions.includes(occurrence.key)) occurrences.push(occurrence);
  }
  const last = occurrences[occurrences.length - 1];
  return {
    occurrences,
    cursor: { afterMs: last ? last.epochMs : afterMs, emitted },
    seriesExhausted,
    horizonFilled,
    batchFull: scanned >= batchSize && !seriesExhausted && !horizonFilled,
  };
}

export const reconcileGenerationPasses = 50;

export function fillHorizon(
  spec: RecurrenceSpec,
  nowMs: number,
  cursor: GenerationCursor | null,
  passes = reconcileGenerationPasses,
  batchSize = recurrenceBatchSize,
) {
  const occurrences: Occurrence[] = [];
  let current = cursor;
  let seriesExhausted = false;
  let horizonFilled = false;
  let passesUsed = 0;
  while (passesUsed < passes && !seriesExhausted && !horizonFilled) {
    const batch = generateBatch(spec, nowMs, current, undefined, batchSize);
    occurrences.push(...batch.occurrences);
    current = batch.cursor;
    seriesExhausted = batch.seriesExhausted;
    horizonFilled = batch.horizonFilled;
    passesUsed += 1;
    if (!batch.batchFull) break;
  }
  return {
    occurrences,
    cursor: current,
    seriesExhausted,
    horizonFilled,
    paused: !seriesExhausted && !horizonFilled && passesUsed >= passes,
  };
}

export function occurrencesInRange(
  spec: RecurrenceSpec,
  start: CalendarDate,
  end: CalendarDate,
) {
  const found: Occurrence[] = [];
  const batch = generateBatch(
    spec,
    resolveWallTime({
      date: start,
      wall: { hour: 0, minute: 0, second: 0 },
      timeZone: spec.timeZone,
    }).instant.epochMs,
    null,
    400,
    recurrenceBatchSize,
  );
  for (const occurrence of batch.occurrences) {
    if (compareDates(occurrence.date, start) < 0) continue;
    if (compareDates(occurrence.date, end) > 0) continue;
    found.push(occurrence);
  }
  return found;
}

function candidateDate(
  spec: RecurrenceSpec,
  index: number,
): CalendarDate | "skip" | "end" {
  if (spec.basis === "gregorian" && usesRrule(spec))
    return gregorianRruleDate(spec, index);
  if (spec.freq === "DAILY")
    return addDays(spec.startDate, index * spec.interval);
  if (spec.freq === "WEEKLY") return weeklyDate(spec, index);
  const step =
    spec.freq === "YEARLY" ? index * spec.interval * 12 : index * spec.interval;
  const shifted = addMonths(spec.startDate, step);
  return resolveMonthDate(spec, shifted.year, shifted.month);
}

function usesRrule(spec: RecurrenceSpec) {
  return (
    spec.freq === "DAILY" ||
    spec.freq === "WEEKLY" ||
    spec.ordinalWeekday !== undefined ||
    (spec.invalidDayPolicy === "skip" &&
      (spec.freq === "MONTHLY" || spec.freq === "YEARLY"))
  );
}

function weeklyDate(spec: RecurrenceSpec, index: number): CalendarDate | "end" {
  const days = weekdaysOf(spec);
  let cursor = spec.startDate;
  let seen = 0;
  for (let guard = 0; guard < 8000; guard += 1) {
    const gregorian = toGregorianDate(cursor);
    if (
      !gregorianInProductRange(gregorian.year, gregorian.month, gregorian.day)
    )
      return "end";
    const delta = dayDistance(spec.startDate, cursor);
    if (
      delta >= 0 &&
      Math.floor(delta / 7) % spec.interval === 0 &&
      days.includes(isoWeekday(cursor))
    ) {
      if (seen === index) return cursor;
      seen += 1;
    }
    cursor = addDays(cursor, 1);
  }
  return "end";
}

function weekdaysOf(spec: RecurrenceSpec) {
  return spec.byWeekdays && spec.byWeekdays.length > 0
    ? [...new Set(spec.byWeekdays)].sort((left, right) => left - right)
    : [isoWeekday(spec.startDate)];
}

function dayDistance(start: CalendarDate, next: CalendarDate) {
  const left = VenusTemporal.PlainDate.from(toPlain(start));
  const right = VenusTemporal.PlainDate.from(toPlain(next));
  return left.until(right, { largestUnit: "day" }).days;
}

function toPlain(date: CalendarDate) {
  const gregorian = toGregorianDate(date);
  return { year: gregorian.year, month: gregorian.month, day: gregorian.day };
}

function resolveMonthDate(
  spec: RecurrenceSpec,
  year: number,
  month: number,
): CalendarDate | "skip" | "end" {
  if (spec.ordinalWeekday) {
    return (
      weekdayInMonth(
        spec.basis,
        year,
        month,
        spec.ordinalWeekday.ordinal,
        spec.ordinalWeekday.weekday,
      ) ?? "skip"
    );
  }
  const requested = spec.monthDay ?? spec.startDate.day;
  const length = monthLength({ calendar: spec.basis, year, month });
  if (requested > length) {
    if (spec.invalidDayPolicy === "skip") return "skip";
    return { calendar: spec.basis, year, month, day: length };
  }
  const date = { calendar: spec.basis, year, month, day: requested };
  const gregorian = toGregorianDate(date);
  if (!gregorianInProductRange(gregorian.year, gregorian.month, gregorian.day))
    return "end";
  return date;
}

function gregorianRruleDate(
  spec: RecurrenceSpec,
  index: number,
): CalendarDate | "end" {
  const start = resolveWallTime({
    date: spec.startDate,
    wall: spec.wall ?? { hour: 0, minute: 0, second: 0 },
    timeZone: spec.timeZone,
    ...(spec.foldPolicy ? { foldPolicy: spec.foldPolicy } : {}),
  });
  const dtstart = VenusTemporal.ZonedDateTime.from(
    zonedStamp(start.instant, spec.timeZone),
  );
  const until = spec.untilLocalDate
    ? VenusTemporal.ZonedDateTime.from(
        `${toGregorianDate(spec.untilLocalDate).year}-${pad(toGregorianDate(spec.untilLocalDate).month)}-${pad(toGregorianDate(spec.untilLocalDate).day)}T23:59:59[${spec.timeZone}]`,
      )
    : undefined;
  const byDay = gregorianByDay(spec);
  const byMonthDay = gregorianMonthDay(spec);
  const rule = new RRuleTemporal({
    freq: spec.freq,
    interval: spec.interval,
    dtstart,
    ...(spec.count === undefined ? {} : { count: spec.count }),
    ...(until ? { until } : {}),
    ...(byDay ? { byDay } : {}),
    ...(byMonthDay ? { byMonthDay } : {}),
    wkst: weekdayCode[spec.wkst] ?? "MO",
    temporal: VenusTemporal,
    maxIterations: Math.max(recurrenceBatchSize, index + 2),
  });
  const matches = rule.all((_value, position) => position <= index);
  const match = matches[index];
  if (!match) return "end";
  return {
    calendar: "gregorian",
    year: match.year,
    month: match.month,
    day: match.day,
  };
}

function gregorianByDay(spec: RecurrenceSpec) {
  if (spec.ordinalWeekday) {
    const code = weekdayCode[spec.ordinalWeekday.weekday];
    return code ? [`${spec.ordinalWeekday.ordinal}${code}`] : undefined;
  }
  if (spec.freq !== "WEEKLY") return undefined;
  return weekdaysOf(spec).map((day) => weekdayCode[day] ?? "MO");
}

function gregorianMonthDay(spec: RecurrenceSpec) {
  if (spec.ordinalWeekday || spec.freq === "WEEKLY" || spec.freq === "DAILY")
    return undefined;
  return [spec.monthDay ?? spec.startDate.day];
}

function toOccurrence(
  spec: RecurrenceSpec,
  date: CalendarDate,
): Occurrence | null {
  try {
    assertProductDate(date);
  } catch {
    return null;
  }
  const wall = spec.wall;
  const resolved = resolveWallTime({
    date,
    wall: wall ?? { hour: 0, minute: 0, second: 0 },
    timeZone: spec.timeZone,
    ...(spec.foldPolicy ? { foldPolicy: spec.foldPolicy } : {}),
  });
  return {
    key: occurrenceKey({
      calendar: spec.basis,
      date,
      wall,
      timeZone: spec.timeZone,
    }),
    date,
    wall,
    epochMs: resolved.instant.epochMs,
    adjusted: wall ? resolved.adjusted : false,
    timeZone: spec.timeZone,
  };
}

function zonedStamp(
  instant: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string,
) {
  return `${instant.year}-${pad(instant.month)}-${pad(instant.day)}T${pad(instant.hour)}:${pad(instant.minute)}:${pad(instant.second)}[${timeZone}]`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
