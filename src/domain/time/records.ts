import { z } from "zod";
import type { RecurrenceSpec } from "./recurrence";

const date = z
  .object({
    calendar: z.enum(["gregorian", "jalali"]),
    year: z.number().int(),
    month: z.number().int(),
    day: z.number().int(),
  })
  .strict();
const wall = z
  .object({
    hour: z.number().int(),
    minute: z.number().int(),
    second: z.number().int(),
  })
  .strict();
export const recurrenceSchema = z
  .object({
    basis: z.enum(["gregorian", "jalali"]),
    freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    interval: z.number().int().min(1),
    byWeekdays: z.array(z.number().int().min(1).max(7)).optional(),
    ordinalWeekday: z
      .object({
        ordinal: z.union([
          z.literal(-1),
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
        ]),
        weekday: z.number().int().min(1).max(7),
      })
      .strict()
      .optional(),
    monthDay: z.number().int().min(1).max(31).optional(),
    startDate: date,
    wall: wall.nullable(),
    timeZone: z.string().min(1),
    foldPolicy: z.enum(["earlier", "later"]).optional(),
    count: z.number().int().min(1).optional(),
    untilLocalDate: date.optional(),
    invalidDayPolicy: z.enum(["skip", "last_day"]),
    exclusions: z.array(z.string()),
    wkst: z.number().int().min(1).max(7),
  })
  .strict();
export const eventSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(4000),
    calendarBasis: z.enum(["gregorian", "jalali"]),
    allDay: z.boolean(),
    localDate: date,
    wall: wall.nullable(),
    zoneId: z.string().min(1),
    foldPolicy: z.enum(["earlier", "later"]),
    recurrenceSpec: recurrenceSchema.nullable(),
    exclusions: z.array(z.string()),
    overrides: z.record(
      z.string(),
      z
        .object({
          title: z.string().max(200).optional(),
          cancelled: z.boolean().optional(),
        })
        .strict(),
    ),
    generationCursor: z
      .object({ afterMs: z.number(), emitted: z.number().int().nonnegative() })
      .nullable(),
    revision: z.number().int().min(1),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export const reminderRuleSchema = z
  .object({
    id: z.string().uuid(),
    eventId: z.string().uuid().nullable(),
    taskId: z.string().uuid().nullable(),
    habitId: z.string().uuid().nullable().default(null),
    offsetMinutes: z.number().int().nullable(),
    absoluteTime: z.number().nullable(),
    severity: z.enum(["normal", "important"]),
    quietHoursOverride: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const owners = [value.eventId, value.taskId, value.habitId].filter(Boolean);
    if (owners.length !== 1)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "exactly one reminder owner is required",
      });
  });
export const notificationSchema = z
  .object({
    idempotencyKey: z.string(),
    ownerId: z.string(),
    ruleId: z.string(),
    occurrenceKey: z.string(),
    fireAtUTC: z.number(),
    internalStatus: z.enum([
      "pending",
      "due",
      "missed",
      "snoozed",
      "dismissed",
      "completed",
      "cancelled",
    ]),
    read: z.boolean(),
    seenMissed: z.boolean(),
    nativeAttempt: z.enum(["not_started", "started", "not_attempted"]),
    nativeApiStatus: z
      .enum([
        "accepted",
        "rejected",
        "denied",
        "unavailable",
        "quiet_suppressed",
        "uncertain",
      ])
      .nullable(),
    osDisplay: z.literal("unobserved"),
    attempt: z.number().int().min(1),
    quietHoursOverride: z.boolean(),
    sourceKind: z.enum(["event", "task", "habit"]),
    title: z.string(),
  })
  .strict();
export const timerSchema = z
  .object({
    id: z.string().uuid(),
    mode: z.enum(["countdown", "pomodoro"]),
    label: z.string().max(120),
    status: z.enum(["idle", "running", "paused", "finished", "cancelled"]),
    durationMs: z.number().int().positive(),
    startedAtUTC: z.number().nullable(),
    endsAtUTC: z.number().nullable(),
    elapsedBeforePauseMs: z.number().int().nonnegative(),
    pauseAtUTC: z.number().nullable(),
    cycleStep: z.enum(["work", "short", "long"]),
    cycleIndex: z.number().int().nonnegative(),
    autoNext: z.boolean(),
    workMs: z.number().int().positive(),
    shortBreakMs: z.number().int().positive(),
    longBreakMs: z.number().int().positive(),
    clockWarning: z.boolean().default(false),
  })
  .strict();
export const quietHoursSchema = z
  .object({
    id: z.literal("quiet-hours"),
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    timeZone: z.string().min(1),
  })
  .strict();
export type EventRecord = z.infer<typeof eventSchema> & {
  recurrenceSpec: RecurrenceSpec | null;
};
export type ReminderRuleRecord = z.infer<typeof reminderRuleSchema>;
export type NotificationRecord = z.infer<typeof notificationSchema>;
export type TimerRecord = z.infer<typeof timerSchema>;
export type QuietHoursRecord = z.infer<typeof quietHoursSchema>;
