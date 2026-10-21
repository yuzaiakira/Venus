import { z } from "zod";
import type { TaskRecord } from "./productivity";
import type { EventRecord, TimerRecord } from "./time/records";
import {
  addDays,
  compareDates,
  isoWeekday,
  occurrenceKey,
  resolveWallTime,
  todayInZone,
  toGregorianDate,
  type CalendarDate,
} from "./time/calendar";
import { occurrencesInRange } from "./time/recurrence";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const stamp = {
  id: z.string().uuid(),
  revision: z.number().int().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
};

/** A local, profile-owned choice to temporarily hide a task recommendation. */
export const focusDeferralSchema = z
  .object({
    ...stamp,
    profileId: z.string().uuid(),
    taskId: z.string().uuid(),
    deferredUntilDate: dateString.nullable(),
    snoozedUntilUTC: z.number().int().nonnegative().nullable(),
  })
  .strict();

export type FocusDeferralRecord = z.infer<typeof focusDeferralSchema>;
export type FocusReason =
  | "overdue"
  | "dueToday"
  | "plannedToday"
  | "focusRank"
  | "highPriority"
  | "open";

export interface FocusSlot {
  startAtUTC: number;
  endAtUTC: number;
  durationMinutes: number;
}
export interface FocusConflict {
  title: string;
  startAtUTC: number;
  endAtUTC: number;
  allDay: boolean;
}
export interface FocusSuggestion {
  task: TaskRecord;
  reason: FocusReason;
  slot: FocusSlot | null;
  stateRevision: number | null;
}
export interface FocusWorkspace {
  today: string;
  suggestions: FocusSuggestion[];
  slots: FocusSlot[];
  conflicts: FocusConflict[];
  activeTimer: TimerRecord | null;
  deferredCount: number;
}

const focusDurationMinutes = 25;
const eventDurationMs = 60 * 60_000;

function dateKey(date: CalendarDate) {
  return `${date.year.toString().padStart(4, "0")}-${date.month
    .toString()
    .padStart(2, "0")}-${date.day.toString().padStart(2, "0")}`;
}

function localDate(timeZone: string, now: number) {
  return dateKey(todayInZone(timeZone, now, "gregorian"));
}

export function addFocusDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return dateKey(
    addDays(
      { calendar: "gregorian", year: year!, month: month!, day: day! },
      days,
    ),
  );
}

function timedInterval(
  date: CalendarDate,
  event: Pick<EventRecord, "wall" | "zoneId" | "foldPolicy" | "allDay">,
) {
  const start = resolveWallTime({
    date,
    wall: event.wall ?? { hour: 0, minute: 0, second: 0 },
    timeZone: event.zoneId,
    foldPolicy: event.foldPolicy,
  }).instant.epochMs;
  if (!event.allDay)
    return { startAtUTC: start, endAtUTC: start + eventDurationMs };
  const end = resolveWallTime({
    date: addDays(date, 1),
    wall: { hour: 0, minute: 0, second: 0 },
    timeZone: event.zoneId,
    foldPolicy: event.foldPolicy,
  }).instant.epochMs;
  return { startAtUTC: start, endAtUTC: end };
}

function dayDistance(left: CalendarDate, right: CalendarDate) {
  const a = toGregorianDate(left);
  const b = toGregorianDate(right);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) -
      Date.UTC(a.year, a.month - 1, a.day)) /
      86_400_000,
  );
}

function recurringDatesInFocusWindow(event: EventRecord, now: number) {
  const spec = event.recurrenceSpec;
  if (!spec) return [];
  // Daily and weekly records are the common planning patterns. Evaluate them
  // from the actual local date rather than scanning forward from a potentially
  // years-old start date, so a long-running series remains visible.
  if (
    (spec.freq === "DAILY" || spec.freq === "WEEKLY") &&
    spec.count === undefined
  ) {
    const dates: CalendarDate[] = [];
    const first = todayInZone(event.zoneId, now, event.calendarBasis);
    const weekdays = spec.byWeekdays?.length
      ? spec.byWeekdays
      : [isoWeekday(spec.startDate)];
    for (let offset = 0; offset <= 8; offset += 1) {
      const date = addDays(first, offset);
      if (compareDates(date, spec.startDate) < 0) continue;
      if (spec.untilLocalDate && compareDates(date, spec.untilLocalDate) > 0)
        continue;
      const delta = dayDistance(spec.startDate, date);
      const scheduled =
        spec.freq === "DAILY"
          ? delta % spec.interval === 0
          : Math.floor(delta / 7) % spec.interval === 0 &&
            weekdays.includes(isoWeekday(date));
      const key = occurrenceKey({
        calendar: event.calendarBasis,
        date,
        wall: spec.wall,
        timeZone: event.zoneId,
      });
      if (scheduled && !spec.exclusions.includes(key)) dates.push(date);
    }
    return dates;
  }
  const start = todayInZone(event.zoneId, now, event.calendarBasis);
  return occurrencesInRange(spec, start, addDays(start, 8)).map(
    (occurrence) => occurrence.date,
  );
}

/**
 * Calendar events do not carry an end time today. Timed events therefore
 * reserve one hour; all-day events reserve their local calendar day. This is
 * deliberately conservative and is explained in the Focus Coach UI.
 */
export function focusConflicts(
  events: EventRecord[],
  now: number,
  timeZone: string,
): FocusConflict[] {
  const startDate = todayInZone(timeZone, now, "gregorian");
  const horizon = resolveWallTime({
    date: addDays(startDate, 8),
    wall: { hour: 0, minute: 0, second: 0 },
    timeZone,
    foldPolicy: "earlier",
  }).instant.epochMs;
  const intervals: FocusConflict[] = [];
  for (const event of events) {
    const dates = event.recurrenceSpec
      ? recurringDatesInFocusWindow(event, now)
      : [event.localDate];
    for (const date of dates) {
      const interval = timedInterval(
        date,
        event.recurrenceSpec
          ? { ...event, wall: event.recurrenceSpec.wall }
          : event,
      );
      if (interval.endAtUTC <= now || interval.startAtUTC >= horizon) continue;
      intervals.push({
        title: event.title,
        ...interval,
        allDay: event.allDay,
      });
    }
  }
  return intervals.sort(
    (left, right) =>
      left.startAtUTC - right.startAtUTC ||
      left.title.localeCompare(right.title),
  );
}

function roundUpToFiveMinutes(value: number) {
  const step = 5 * 60_000;
  return Math.ceil(value / step) * step;
}

export function focusSlots(
  conflicts: FocusConflict[],
  now: number,
  timeZone: string,
  wanted = 4,
): FocusSlot[] {
  const result: FocusSlot[] = [];
  const today = todayInZone(timeZone, now, "gregorian");
  for (let day = 0; day < 8 && result.length < wanted; day += 1) {
    const date = addDays(today, day);
    const start = resolveWallTime({
      date,
      wall: { hour: 9, minute: 0, second: 0 },
      timeZone,
      foldPolicy: "earlier",
    }).instant.epochMs;
    const end = resolveWallTime({
      date,
      wall: { hour: 18, minute: 0, second: 0 },
      timeZone,
      foldPolicy: "earlier",
    }).instant.epochMs;
    let cursor = Math.max(start, roundUpToFiveMinutes(now));
    while (
      cursor + focusDurationMinutes * 60_000 <= end &&
      result.length < wanted
    ) {
      const finish = cursor + focusDurationMinutes * 60_000;
      const collision = conflicts.find(
        (item) => item.startAtUTC < finish && item.endAtUTC > cursor,
      );
      if (collision) {
        cursor = roundUpToFiveMinutes(
          Math.max(cursor + 5 * 60_000, collision.endAtUTC),
        );
        continue;
      }
      result.push({
        startAtUTC: cursor,
        endAtUTC: finish,
        durationMinutes: focusDurationMinutes,
      });
      cursor = finish;
    }
  }
  return result;
}

function reasonFor(task: TaskRecord, today: string): FocusReason {
  if (task.dueDate && task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "dueToday";
  if (task.today) return "plannedToday";
  if (task.focusRank !== null) return "focusRank";
  if (task.priority === 3) return "highPriority";
  return "open";
}

function taskOrder(left: TaskRecord, right: TaskRecord, today: string) {
  const rank = (task: TaskRecord) => {
    const reason = reasonFor(task, today);
    return [
      "overdue",
      "dueToday",
      "plannedToday",
      "focusRank",
      "highPriority",
      "open",
    ].indexOf(reason);
  };
  return (
    rank(left) - rank(right) ||
    (left.focusRank ?? 99) - (right.focusRank ?? 99) ||
    right.priority - left.priority ||
    (left.dueDate ?? "9999-12-31").localeCompare(
      right.dueDate ?? "9999-12-31",
    ) ||
    left.title.localeCompare(right.title)
  );
}

export function buildFocusWorkspace(input: {
  tasks: TaskRecord[];
  events: EventRecord[];
  states: FocusDeferralRecord[];
  timers: TimerRecord[];
  timeZone: string;
  now: number;
}): FocusWorkspace {
  // Validate IANA time zones before creating date boundaries or slots.
  new Intl.DateTimeFormat("en", { timeZone: input.timeZone }).format(input.now);
  const today = localDate(input.timeZone, input.now);
  const stateByTask = new Map(
    input.states.map((state) => [state.taskId, state]),
  );
  const hidden = (task: TaskRecord) => {
    const state = stateByTask.get(task.id);
    return Boolean(
      state &&
        ((state.snoozedUntilUTC !== null &&
          state.snoozedUntilUTC > input.now) ||
          (state.deferredUntilDate !== null &&
            state.deferredUntilDate > today)),
    );
  };
  const conflicts = focusConflicts(input.events, input.now, input.timeZone);
  const slots = focusSlots(conflicts, input.now, input.timeZone);
  const suggestions = input.tasks
    .filter((task) => task.status === "open" && !hidden(task))
    .sort((left, right) => taskOrder(left, right, today))
    .slice(0, 4)
    .map((task, index) => ({
      task,
      reason: reasonFor(task, today),
      slot: slots[index] ?? slots[0] ?? null,
      stateRevision: stateByTask.get(task.id)?.revision ?? null,
    }));
  return {
    today,
    suggestions,
    slots,
    conflicts,
    activeTimer:
      input.timers.find(
        (timer) => timer.status === "running" || timer.status === "paused",
      ) ?? null,
    deferredCount: input.tasks.filter(
      (task) => task.status === "open" && hidden(task),
    ).length,
  };
}
