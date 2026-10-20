import { WorkspaceError } from "../dashboard";
import type { CalendarDate, FoldPolicy, WallTime } from "./calendar";
import { assertRule, type RecurrenceSpec } from "./recurrence";

export type RecurrenceForm = {
  enabled: boolean;
  basis: RecurrenceSpec["basis"];
  freq: RecurrenceSpec["freq"];
  interval: number;
  weekdays: number[];
  ordinal: "none" | "-1" | "1" | "2" | "3" | "4";
  ordinalWeekday: number;
  monthDay: number | null;
  count: number | null;
  until: CalendarDate | null;
  invalidDayPolicy: RecurrenceSpec["invalidDayPolicy"];
  startDate: CalendarDate;
  wall: WallTime | null;
  timeZone: string;
  foldPolicy: FoldPolicy;
  wkst: number;
};

export function recurrenceFromForm(
  form: RecurrenceForm,
): RecurrenceSpec | null {
  if (!form.enabled) return null;
  if (form.count !== null && form.until !== null)
    throw new WorkspaceError("invalidInput");
  if (form.interval < 1) throw new WorkspaceError("invalidInput");
  const ordinal =
    form.ordinal === "none"
      ? undefined
      : {
          ordinal: Number(form.ordinal) as -1 | 1 | 2 | 3 | 4,
          weekday: form.ordinalWeekday,
        };
  return assertRule({
    basis: form.basis,
    freq: form.freq,
    interval: form.interval,
    ...(form.weekdays.length > 0 ? { byWeekdays: form.weekdays } : {}),
    ...(ordinal ? { ordinalWeekday: ordinal } : {}),
    ...(form.monthDay ? { monthDay: form.monthDay } : {}),
    startDate: { ...form.startDate, calendar: form.basis },
    wall: form.wall,
    timeZone: form.timeZone,
    foldPolicy: form.foldPolicy,
    ...(form.count !== null ? { count: form.count } : {}),
    ...(form.until
      ? { untilLocalDate: { ...form.until, calendar: form.basis } }
      : {}),
    invalidDayPolicy: form.invalidDayPolicy,
    exclusions: [],
    wkst: form.wkst,
  });
}
