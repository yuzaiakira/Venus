import { WorkspaceError } from "../domain/dashboard";
import {
  addDays,
  assertProductDate,
  convertDate,
  isoWeekday,
  occurrenceKey,
  resolveWallTime,
  todayInZone,
  type CalendarDate,
} from "../domain/time/calendar";
import { materializationHorizonDays } from "../domain/time/limits";
import {
  eventSchema,
  notificationSchema,
  quietHoursSchema,
  reminderRuleSchema,
  timerSchema,
  type EventRecord,
  type NotificationRecord,
  type QuietHoursRecord,
  type ReminderRuleRecord,
  type TimerRecord,
} from "../domain/time/records";
import {
  assertRule,
  fillHorizon,
  occurrencesInRange,
  type GenerationCursor,
  type RecurrenceSpec,
} from "../domain/time/recurrence";
import {
  applyDeliveryDecision,
  idempotencyKey,
  markAttemptStarted,
  pruneHistory,
  quietHoursActive,
  reconcileRow,
  snoozeRow,
} from "../domain/time/schedule";
import { VenusTemporal } from "../domain/time/temporal";
import { habitSchema, type HabitRecord } from "../domain/productivity";
import { followUpSchema, type FollowUpRecord } from "../domain/people";

const sweepAlarm = "venus-sweep";

export interface CalendarDatabase {
  habits: {
    get(id: string): Promise<HabitRecord | undefined>;
    toArray(): Promise<HabitRecord[]>;
    put(row: HabitRecord): Promise<unknown>;
    delete(id: string): Promise<void>;
  };
  followUps: {
    get(id: string): Promise<FollowUpRecord | undefined>;
    toArray(): Promise<FollowUpRecord[]>;
    put(row: FollowUpRecord): Promise<unknown>;
    delete(id: string): Promise<void>;
  };
  events: {
    get(id: string): Promise<EventRecord | undefined>;
    toArray(): Promise<EventRecord[]>;
    put(row: EventRecord): Promise<unknown>;
    delete(id: string): Promise<void>;
  };
  reminderRules: {
    toArray(): Promise<ReminderRuleRecord[]>;
    put(row: ReminderRuleRecord): Promise<unknown>;
    delete(id: string): Promise<void>;
  };
  notificationOccurrences: {
    get(id: string): Promise<NotificationRecord | undefined>;
    toArray(): Promise<NotificationRecord[]>;
    put(row: NotificationRecord): Promise<unknown>;
    delete(id: string): Promise<void>;
  };
  timerSessions: {
    get(id: string): Promise<TimerRecord | undefined>;
    toArray(): Promise<TimerRecord[]>;
    put(row: TimerRecord): Promise<unknown>;
    delete(id: string): Promise<void>;
  };
  quietHours: {
    get(id: "quiet-hours"): Promise<QuietHoursRecord | undefined>;
    put(row: QuietHoursRecord): Promise<unknown>;
  };
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
export interface SweepAlarm {
  schedule(at: number): Promise<void>;
  clear(): Promise<void>;
}
export interface NativeNotification {
  permission(): Promise<"granted" | "denied" | "missing">;
  show(id: string, title: string): Promise<"accepted" | "rejected">;
  clear(id: string): Promise<void>;
}
type TaskCompleter = (id: string, revision?: number) => Promise<void>;

export function createCalendar(input: {
  database: CalendarDatabase;
  alarms: SweepAlarm;
  notifications: NativeNotification;
  completeTask?: TaskCompleter;
  now?: () => number;
}) {
  const now = input.now ?? Date.now;
  let claimQueue: Promise<unknown> = Promise.resolve();
  function claimOnce<T>(work: () => Promise<T>) {
    const run = claimQueue.then(work, work);
    claimQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
  return {
    list,
    occurrences,
    createEvent,
    saveEvent,
    replaceRules,
    configureHabitReminder,
    syncFollowUp,
    updateHabit,
    deleteHabit,
    notificationPermission: () => input.notifications.permission(),
    deleteEvent,
    saveQuietHours,
    quietHours,
    notifications: listNotifications,
    snooze,
    dismiss,
    complete,
    markRead,
    acknowledgeMissed,
    reconcile,
    timer,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
  };

  async function list() {
    return {
      events: await input.database.events.toArray(),
      rules: await input.database.reminderRules.toArray(),
      notifications: await input.database.notificationOccurrences.toArray(),
      timers: await input.database.timerSessions.toArray(),
      quietHours: await quietHours(),
    };
  }
  async function quietHours(): Promise<QuietHoursRecord> {
    return (
      (await input.database.quietHours.get("quiet-hours")) ?? {
        id: "quiet-hours",
        enabled: false,
        start: "22:00",
        end: "07:00",
        timeZone: "UTC",
      }
    );
  }
  async function createEvent(draft: {
    id?: string;
    title: string;
    description?: string;
    basis: "gregorian" | "jalali";
    allDay: boolean;
    localDate?: CalendarDate;
    wall?: { hour: number; minute: number; second: number } | null;
    zoneId: string;
    recurrence?: RecurrenceSpec | null;
    offsetMinutes?: number[];
    reminders?: Array<{
      offsetMinutes: number | null;
      absoluteTime: number | null;
      quietHoursOverride: boolean;
    }>;
    foldPolicy?: "earlier" | "later";
  }) {
    const result = await input.database.transaction(async () => {
      if (draft.id) {
        const existing = await input.database.events.get(draft.id);
        if (existing) return existing;
      }
      const localDate =
        draft.localDate ?? todayInZone(draft.zoneId, now(), draft.basis);
      assertProductDate({ ...localDate, calendar: draft.basis });
      const recurrence = draft.recurrence ? assertRule(draft.recurrence) : null;
      const stamp = new Date(now()).toISOString();
      const row = eventSchema.parse({
        id: draft.id ?? crypto.randomUUID(),
        title: draft.title.trim(),
        description: draft.description ?? "",
        calendarBasis: draft.basis,
        allDay: draft.allDay,
        localDate: { ...localDate, calendar: draft.basis },
        wall: draft.allDay
          ? null
          : (draft.wall ?? { hour: 9, minute: 0, second: 0 }),
        zoneId: draft.zoneId,
        foldPolicy: draft.foldPolicy ?? "earlier",
        recurrenceSpec: recurrence,
        exclusions: recurrence?.exclusions ?? [],
        overrides: {},
        generationCursor: null,
        revision: 1,
        createdAt: stamp,
        updatedAt: stamp,
      }) as EventRecord;
      await input.database.events.put(row);
      const reminders =
        draft.reminders ??
        (draft.offsetMinutes ?? [0]).map((offsetMinutes) => ({
          offsetMinutes,
          absoluteTime: null,
          quietHoursOverride: false,
        }));
      for (const reminder of reminders) {
        if (reminder.offsetMinutes !== null && reminder.absoluteTime !== null)
          throw new WorkspaceError("invalidInput");
        await input.database.reminderRules.put(
          reminderRuleSchema.parse({
            id: crypto.randomUUID(),
            eventId: row.id,
            taskId: null,
            offsetMinutes: reminder.offsetMinutes,
            absoluteTime: reminder.absoluteTime,
            severity: reminder.quietHoursOverride ? "important" : "normal",
            quietHoursOverride: reminder.quietHoursOverride,
          }),
        );
      }
      await materialize(row);
      return row;
    });
    await armSweep();
    return result;
  }
  async function saveEvent(
    id: string,
    expected: number,
    patch: Partial<
      Pick<
        EventRecord,
        | "title"
        | "description"
        | "exclusions"
        | "overrides"
        | "recurrenceSpec"
        | "localDate"
        | "wall"
        | "zoneId"
        | "allDay"
        | "foldPolicy"
      >
    >,
    scope: "THIS" | "ENTIRE_SERIES" = "ENTIRE_SERIES",
    occurrenceKeyValue?: string,
  ) {
    const result = await input.database.transaction(async () => {
      const current = await input.database.events.get(id);
      if (!current || current.revision !== expected)
        throw new WorkspaceError("conflict");
      if (
        patch.recurrenceSpec &&
        (patch.recurrenceSpec.basis !== current.calendarBasis ||
          patch.recurrenceSpec.timeZone !== (patch.zoneId ?? current.zoneId))
      )
        throw new WorkspaceError("invalidInput");
      const next = eventSchema.parse({
        ...current,
        localDate: patch.localDate ?? current.localDate,
        wall: patch.wall === undefined ? current.wall : patch.wall,
        zoneId: patch.zoneId ?? current.zoneId,
        allDay: patch.allDay ?? current.allDay,
        foldPolicy: patch.foldPolicy ?? current.foldPolicy,
        title:
          scope === "ENTIRE_SERIES"
            ? (patch.title ?? current.title)
            : current.title,
        description: patch.description ?? current.description,
        exclusions:
          scope === "THIS" && occurrenceKeyValue && patch.exclusions
            ? [...new Set([...current.exclusions, occurrenceKeyValue])]
            : (patch.exclusions ?? current.exclusions),
        overrides:
          scope === "THIS" && occurrenceKeyValue && patch.title
            ? {
                ...current.overrides,
                [occurrenceKeyValue]: {
                  title: patch.title,
                  cancelled: false,
                },
              }
            : (patch.overrides ?? current.overrides),
        recurrenceSpec:
          scope === "ENTIRE_SERIES"
            ? patch.recurrenceSpec === undefined
              ? current.recurrenceSpec
              : patch.recurrenceSpec
            : current.recurrenceSpec,
        generationCursor: null,
        revision: current.revision + 1,
        updatedAt: new Date(now()).toISOString(),
      }) as EventRecord;
      assertProductDate(next.localDate);
      if (next.localDate.calendar !== next.calendarBasis)
        throw new WorkspaceError("invalidInput");
      if (next.recurrenceSpec) assertRule(next.recurrenceSpec);
      singleOccurrence(next); // Validate time zone and wall time before committing.
      await input.database.events.put(next);
      if (scope === "THIS" && occurrenceKeyValue && patch.exclusions) {
        for (const row of await input.database.notificationOccurrences.toArray()) {
          if (
            row.ownerId === id &&
            row.occurrenceKey === occurrenceKeyValue &&
            ["pending", "due"].includes(row.internalStatus)
          )
            await input.database.notificationOccurrences.put({
              ...row,
              internalStatus: "cancelled",
            });
        }
      }
      if (scope === "ENTIRE_SERIES") await cancelFuture(id);
      await materialize(next);
      return next;
    });
    await armSweep();
    return result;
  }
  async function deleteEvent(id: string, expected?: number) {
    const result = await input.database.transaction(async () => {
      const current = await input.database.events.get(id);
      if (!current) throw new WorkspaceError("notFound");
      if (expected !== undefined && current.revision !== expected)
        throw new WorkspaceError("conflict");
      await cancelFuture(id);
      const rules = await input.database.reminderRules.toArray();
      for (const rule of rules) {
        if (rule.eventId === id)
          await input.database.reminderRules.delete(rule.id);
      }
      await input.database.events.delete(id);
    });
    await armSweep();
    return result;
  }
  async function configureHabitReminder(
    id: string,
    expected: number,
    reminder: NonNullable<HabitRecord["reminder"]>,
  ) {
    return updateHabit(id, expected, { reminder });
  }
  async function updateHabit(
    id: string,
    expected: number,
    patch: Partial<Pick<HabitRecord, "title" | "frequency" | "reminder">>,
  ) {
    const result = await input.database.transaction(async () => {
      const current = await input.database.habits.get(id);
      if (!current) throw new WorkspaceError("notFound");
      if (current.revision !== expected) throw new WorkspaceError("conflict");
      const reminder =
        patch.reminder === undefined
          ? current.reminder
          : habitSchema.shape.reminder.parse(patch.reminder);
      if (reminder?.enabled) {
        new Intl.DateTimeFormat("en", { timeZone: reminder.timeZone }).format(
          now(),
        );
        for (const day of reminder.weekdays)
          if (!Number.isInteger(day) || day < 1 || day > 7)
            throw new WorkspaceError("invalidInput");
      }
      // A schedule edit invalidates every unserved occurrence, including a
      // user-snoozed child attempt. Reconciliation itself must keep snoozes:
      // they carry attempt > 1 and are still a valid action for their parent
      // occurrence until an explicit schedule edit supersedes them.
      const scheduleChanged =
        patch.reminder !== undefined ||
        (patch.frequency !== undefined &&
          patch.frequency !== current.frequency);
      if (scheduleChanged) {
        await cancelHabitFuture(id);
        for (const rule of await input.database.reminderRules.toArray())
          if (rule.habitId === id)
            await input.database.reminderRules.delete(rule.id);
      }
      const next = habitSchema.parse({
        ...current,
        title: patch.title === undefined ? current.title : patch.title.trim(),
        frequency: patch.frequency ?? current.frequency,
        reminder,
        revision: current.revision + 1,
        updatedAt: new Date(now()).toISOString(),
      });
      await input.database.habits.put(next);
      if (scheduleChanged && reminder?.enabled)
        await input.database.reminderRules.put(
          reminderRuleSchema.parse({
            id: crypto.randomUUID(),
            eventId: null,
            taskId: null,
            habitId: id,
            offsetMinutes: null,
            absoluteTime: null,
            severity: "normal",
            quietHoursOverride: false,
          }),
        );
      if (next.title !== current.title) {
        for (const row of await input.database.notificationOccurrences.toArray())
          if (
            row.ownerId === id &&
            row.sourceKind === "habit" &&
            row.internalStatus === "pending"
          )
            await input.database.notificationOccurrences.put({
              ...row,
              title: next.title,
            });
      }
      await materializeHabit(next);
      return next;
    });
    await armSweep();
    return result;
  }
  async function deleteHabit(id: string, expected: number) {
    await input.database.transaction(async () => {
      const current = await input.database.habits.get(id);
      if (!current) throw new WorkspaceError("notFound");
      if (current.revision !== expected) throw new WorkspaceError("conflict");
      await cancelHabitFuture(id);
      for (const rule of await input.database.reminderRules.toArray())
        if (rule.habitId === id)
          await input.database.reminderRules.delete(rule.id);
      await input.database.habits.delete(id);
    });
    await armSweep();
  }
  async function cancelHabitFuture(id: string) {
    for (const row of await input.database.notificationOccurrences.toArray())
      if (
        row.ownerId === id &&
        row.sourceKind === "habit" &&
        ["pending", "due"].includes(row.internalStatus)
      )
        await input.database.notificationOccurrences.put({
          ...row,
          internalStatus: "cancelled",
        });
  }
  async function materializeHabit(habit: HabitRecord) {
    const rules = (await input.database.reminderRules.toArray())
      .filter((rule) => rule.habitId === habit.id)
      .sort((left, right) => left.id.localeCompare(right.id));
    const reminder = habit.reminder;
    if (!reminder?.enabled || !rules.length) {
      await cancelHabitFuture(habit.id);
      return;
    }
    const today = todayInZone(reminder.timeZone, now(), "gregorian");
    const [hour, minute] = reminder.time.split(":").map(Number);
    const desired = new Set<string>();
    for (let offset = 0; offset <= materializationHorizonDays; offset += 1) {
      const date = addDays(today, offset);
      if (
        habit.frequency === "weekly" &&
        !reminder.weekdays.includes(isoWeekday(date))
      )
        continue;
      const localDate = `${date.year.toString().padStart(4, "0")}-${date.month.toString().padStart(2, "0")}-${date.day.toString().padStart(2, "0")}`;
      if (habit.checkIns.includes(localDate)) continue;
      const resolved = resolveWallTime({
        date,
        wall: { hour: hour!, minute: minute!, second: 0 },
        timeZone: reminder.timeZone,
        foldPolicy: "earlier",
      });
      const fireAt = resolved.instant.epochMs;
      const occurrence = `habit:${habit.id}:${localDate}`;
      for (const rule of rules.slice(0, 1)) {
        const key = idempotencyKey({
          ownerId: habit.id,
          ruleId: rule.id,
          occurrenceKey: occurrence,
          scheduledInstant: fireAt,
          attempt: 1,
        });
        desired.add(key);
        if (await input.database.notificationOccurrences.get(key)) continue;
        await input.database.notificationOccurrences.put(
          notificationSchema.parse({
            idempotencyKey: key,
            ownerId: habit.id,
            ruleId: rule.id,
            occurrenceKey: occurrence,
            fireAtUTC: fireAt,
            internalStatus: "pending",
            read: false,
            seenMissed: false,
            nativeAttempt: "not_started",
            nativeApiStatus: null,
            osDisplay: "unobserved",
            attempt: 1,
            quietHoursOverride: rule.quietHoursOverride,
            sourceKind: "habit",
            title: habit.title,
          }),
        );
      }
    }
    for (const row of await input.database.notificationOccurrences.toArray())
      if (
        row.ownerId === habit.id &&
        row.sourceKind === "habit" &&
        ["pending", "due"].includes(row.internalStatus) &&
        row.attempt === 1 &&
        !desired.has(row.idempotencyKey)
      )
        await input.database.notificationOccurrences.put({
          ...row,
          internalStatus: "cancelled",
        });
  }
  /**
   * Follow-ups use the same durable occurrence table and alarm sweep as events
   * and habits. The record remains in the due queue even when native delivery
   * is denied; this only controls the optional notification occurrence.
   */
  async function syncFollowUp(id: string) {
    await input.database.transaction(async () => {
      const followUp = await input.database.followUps.get(id);
      const rules = (await input.database.reminderRules.toArray())
        .filter((rule) => rule.followUpId === id)
        .sort((left, right) => left.id.localeCompare(right.id));
      if (
        !followUp ||
        followUp.status === "completed" ||
        !followUp.reminderEnabled ||
        !followUp.dueTime
      ) {
        await cancelFollowUpFuture(id);
        for (const rule of rules)
          await input.database.reminderRules.delete(rule.id);
        return;
      }
      const primary =
        rules[0] ??
        reminderRuleSchema.parse({
          id: crypto.randomUUID(),
          eventId: null,
          taskId: null,
          habitId: null,
          followUpId: followUp.id,
          offsetMinutes: null,
          absoluteTime: null,
          severity: followUp.priority === "high" ? "important" : "normal",
          quietHoursOverride: false,
        });
      if (!rules.length) await input.database.reminderRules.put(primary);
      for (const extra of rules.slice(1)) {
        await input.database.reminderRules.delete(extra.id);
        for (const row of await input.database.notificationOccurrences.toArray())
          if (
            row.ruleId === extra.id &&
            ["pending", "due"].includes(row.internalStatus)
          )
            await input.database.notificationOccurrences.put({
              ...row,
              internalStatus: "cancelled",
            });
      }
      await materializeFollowUp(followUp, primary);
    });
    await armSweep();
  }
  async function cancelFollowUpFuture(id: string) {
    for (const row of await input.database.notificationOccurrences.toArray())
      if (
        row.ownerId === id &&
        row.sourceKind === "followup" &&
        ["pending", "due"].includes(row.internalStatus)
      )
        await input.database.notificationOccurrences.put({
          ...row,
          internalStatus: "cancelled",
        });
  }
  async function materializeFollowUp(
    followUp: FollowUpRecord,
    rule: ReminderRuleRecord,
  ) {
    if (
      followUp.status !== "open" ||
      !followUp.reminderEnabled ||
      !followUp.dueTime
    ) {
      await cancelFollowUpFuture(followUp.id);
      return;
    }
    const [hour, minute] = followUp.dueTime.split(":").map(Number);
    const [year, month, day] = followUp.dueDate.split("-").map(Number);
    const scheduled =
      followUp.snoozedUntilUTC && followUp.snoozedUntilUTC > now()
        ? followUp.snoozedUntilUTC
        : resolveWallTime({
            date: {
              calendar: "gregorian",
              year: year!,
              month: month!,
              day: day!,
            },
            wall: { hour: hour!, minute: minute!, second: 0 },
            timeZone: followUp.timeZone,
            foldPolicy: "earlier",
          }).instant.epochMs;
    // A revision is part of the occurrence key so an edited follow-up creates
    // a fresh future occurrence instead of reviving a previously cancelled one.
    const occurrence = `followup:${followUp.id}:${followUp.revision}:${followUp.dueDate}`;
    const key = idempotencyKey({
      ownerId: followUp.id,
      ruleId: rule.id,
      occurrenceKey: occurrence,
      scheduledInstant: scheduled,
      attempt: 1,
    });
    for (const row of await input.database.notificationOccurrences.toArray())
      if (
        row.ownerId === followUp.id &&
        row.sourceKind === "followup" &&
        ["pending", "due"].includes(row.internalStatus) &&
        row.idempotencyKey !== key
      )
        await input.database.notificationOccurrences.put({
          ...row,
          internalStatus: "cancelled",
        });
    if (await input.database.notificationOccurrences.get(key)) return;
    await input.database.notificationOccurrences.put(
      notificationSchema.parse({
        idempotencyKey: key,
        ownerId: followUp.id,
        ruleId: rule.id,
        occurrenceKey: occurrence,
        fireAtUTC: scheduled,
        internalStatus: "pending",
        read: false,
        seenMissed: false,
        nativeAttempt: "not_started",
        nativeApiStatus: null,
        osDisplay: "unobserved",
        attempt: 1,
        quietHoursOverride: rule.quietHoursOverride,
        sourceKind: "followup",
        title: followUp.title,
      }),
    );
  }
  async function cancelFuture(ownerId: string) {
    const rows = await input.database.notificationOccurrences.toArray();
    for (const row of rows) {
      if (
        row.ownerId === ownerId &&
        (row.internalStatus === "pending" || row.internalStatus === "due")
      ) {
        await input.database.notificationOccurrences.put({
          ...row,
          internalStatus: "cancelled",
        });
      }
    }
  }
  async function materialize(event: EventRecord) {
    const rules = (await input.database.reminderRules.toArray()).filter(
      (rule) => rule.eventId === event.id,
    );
    let cursor: GenerationCursor | null = event.generationCursor;
    const spec = event.recurrenceSpec;
    const filled = spec
      ? fillSpec(spec, cursor)
      : { occurrences: [singleOccurrence(event)], cursor };
    cursor = filled.cursor;
    for (const occurrence of filled.occurrences) {
      if (event.exclusions.includes(occurrence.key)) continue;
      if (event.overrides[occurrence.key]?.cancelled) continue;
      for (const rule of rules) {
        const fireAt =
          rule.absoluteTime ??
          occurrence.epochMs - (rule.offsetMinutes ?? 0) * 60_000;
        const key = idempotencyKey({
          ownerId: event.id,
          ruleId: rule.id,
          occurrenceKey: occurrence.key,
          scheduledInstant: fireAt,
          attempt: 1,
        });
        const existing = await input.database.notificationOccurrences.get(key);
        const title = event.overrides[occurrence.key]?.title ?? event.title;
        if (existing) {
          if (
            existing.internalStatus === "cancelled" &&
            existing.nativeAttempt === "not_started" &&
            existing.fireAtUTC > now()
          ) {
            await input.database.notificationOccurrences.put({
              ...existing,
              title,
              internalStatus: "pending",
            });
          }
          if (
            existing.internalStatus === "pending" &&
            existing.title !== title
          ) {
            await input.database.notificationOccurrences.put({
              ...existing,
              title,
            });
          }
          continue;
        }
        await input.database.notificationOccurrences.put(
          notificationSchema.parse({
            idempotencyKey: key,
            ownerId: event.id,
            ruleId: rule.id,
            occurrenceKey: occurrence.key,
            fireAtUTC: fireAt,
            internalStatus: "pending",
            read: false,
            seenMissed: false,
            nativeAttempt: "not_started",
            nativeApiStatus: null,
            osDisplay: "unobserved",
            attempt: 1,
            quietHoursOverride: rule.quietHoursOverride,
            sourceKind: "event",
            title,
          }),
        );
      }
    }
    if (spec)
      await input.database.events.put({ ...event, generationCursor: cursor });
  }
  function fillSpec(spec: RecurrenceSpec, cursor: GenerationCursor | null) {
    const filled = fillHorizon(spec, now(), cursor);
    return { occurrences: filled.occurrences, cursor: filled.cursor };
  }
  function singleOccurrence(event: EventRecord) {
    const date = { ...event.localDate, calendar: event.calendarBasis };
    const resolved = resolveWallTime({
      date,
      wall: event.wall ?? { hour: 0, minute: 0, second: 0 },
      timeZone: event.zoneId,
      foldPolicy: event.foldPolicy,
    });
    return {
      key: occurrenceKey({
        calendar: event.calendarBasis,
        date,
        wall: event.wall,
        timeZone: event.zoneId,
      }),
      date,
      wall: event.wall,
      epochMs: resolved.instant.epochMs,
      adjusted: resolved.adjusted,
      timeZone: event.zoneId,
    };
  }
  async function saveQuietHours(patch: Omit<QuietHoursRecord, "id">) {
    const row = quietHoursSchema.parse({ id: "quiet-hours", ...patch });
    for (const value of [row.start, row.end]) {
      const [hour, minute] = value.split(":").map(Number);
      if (hour! > 23 || minute! > 59) throw new WorkspaceError("invalidInput");
    }
    new Intl.DateTimeFormat("en", { timeZone: row.timeZone }).format(now());
    await input.database.quietHours.put(row);
    return row;
  }
  async function listNotifications() {
    const rows = await input.database.notificationOccurrences.toArray();
    return pruneHistory(rows, now());
  }
  async function snooze(key: string, minutes: number) {
    const followUpId = await input.database.transaction(async () => {
      const row = await must(key);
      if (!["pending", "due", "missed"].includes(row.internalStatus))
        throw new WorkspaceError("conflict");
      if (row.sourceKind === "followup") {
        const followUp = await input.database.followUps.get(row.ownerId);
        if (!followUp || followUp.status !== "open")
          throw new WorkspaceError("notFound");
        const until = now() + minutes * 60_000;
        await input.database.followUps.put(
          followUpSchema.parse({
            ...followUp,
            snoozedUntilUTC: until,
            revision: followUp.revision + 1,
            updatedAt: new Date(now()).toISOString(),
          }),
        );
        await input.database.notificationOccurrences.put({
          ...row,
          internalStatus: "snoozed",
          read: true,
        });
        return followUp.id;
      }
      const next = snoozeRow(row, now() + minutes * 60_000);
      await input.database.notificationOccurrences.put({
        ...row,
        internalStatus: "snoozed",
      });
      await input.database.notificationOccurrences.put(
        notificationSchema.parse(next),
      );
      return null;
    });
    if (followUpId) await syncFollowUp(followUpId);
    else await armSweep();
  }
  async function dismiss(key: string) {
    await input.database.transaction(async () => {
      const row = await must(key);
      if (!["pending", "due", "missed"].includes(row.internalStatus))
        throw new WorkspaceError("conflict");
      await input.database.notificationOccurrences.put({
        ...row,
        internalStatus: "dismissed",
        read: true,
      });
    });
  }
  async function markRead(key: string) {
    const row = await must(key);
    await input.database.notificationOccurrences.put({ ...row, read: true });
  }
  async function acknowledgeMissed(key: string) {
    const row = await must(key);
    await input.database.notificationOccurrences.put({
      ...row,
      read: true,
      seenMissed: true,
    });
  }
  async function complete(key: string, taskRevision?: number) {
    const row = await must(key);
    if (row.sourceKind === "task") {
      if (!input.completeTask) throw new WorkspaceError("invalidInput");
      await input.completeTask(row.ownerId, taskRevision);
    }
    if (row.sourceKind === "followup") {
      await input.database.transaction(async () => {
        const fresh = await input.database.notificationOccurrences.get(key);
        if (!fresh) throw new WorkspaceError("notFound");
        if (fresh.internalStatus === "completed") return;
        if (fresh.internalStatus === "cancelled")
          throw new WorkspaceError("conflict");
        const followUp = await input.database.followUps.get(fresh.ownerId);
        if (!followUp) throw new WorkspaceError("notFound");
        if (followUp.status !== "completed")
          await input.database.followUps.put(
            followUpSchema.parse({
              ...followUp,
              status: "completed",
              completedAt: new Date(now()).toISOString(),
              snoozedUntilUTC: null,
              revision: followUp.revision + 1,
              updatedAt: new Date(now()).toISOString(),
            }),
          );
        await input.database.notificationOccurrences.put({
          ...fresh,
          internalStatus: "completed",
          read: true,
        });
      });
      await syncFollowUp(row.ownerId);
      return;
    }
    if (row.sourceKind === "habit") {
      await input.database.transaction(async () => {
        const fresh = await input.database.notificationOccurrences.get(key);
        if (!fresh) throw new WorkspaceError("notFound");
        if (fresh.internalStatus === "completed") return;
        if (fresh.internalStatus === "cancelled")
          throw new WorkspaceError("conflict");
        const habit = await input.database.habits.get(fresh.ownerId);
        if (!habit) throw new WorkspaceError("notFound");
        const prefix = `habit:${habit.id}:`;
        const date = fresh.occurrenceKey.slice(prefix.length);
        const parsedDate = new Date(`${date}T00:00:00.000Z`);
        if (
          !fresh.occurrenceKey.startsWith(prefix) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== date
        )
          throw new WorkspaceError("invalidInput");
        const checkIns = habit.checkIns.includes(date)
          ? habit.checkIns
          : [...habit.checkIns, date].sort();
        if (checkIns !== habit.checkIns)
          await input.database.habits.put({
            ...habit,
            checkIns,
            revision: habit.revision + 1,
            updatedAt: new Date(now()).toISOString(),
          });
        await input.database.notificationOccurrences.put({
          ...fresh,
          internalStatus: "completed",
          read: true,
        });
      });
      await materializeHabit((await input.database.habits.get(row.ownerId))!);
      await armSweep();
      return;
    }
    await input.database.notificationOccurrences.put({
      ...row,
      internalStatus: "completed",
      read: true,
    });
  }
  async function must(key: string) {
    const row = await input.database.notificationOccurrences.get(key);
    if (!row) throw new WorkspaceError("notFound");
    return row;
  }
  async function occurrences(eventId: string) {
    const event = await input.database.events.get(eventId);
    if (!event) throw new WorkspaceError("notFound");
    if (!event.recurrenceSpec) return [singleOccurrence(event)];
    const end = {
      ...event.recurrenceSpec.startDate,
      year: event.recurrenceSpec.startDate.year + 1,
    };
    return occurrencesInRange(
      event.recurrenceSpec,
      event.recurrenceSpec.startDate,
      end,
    );
  }
  async function replaceRules(
    eventId: string,
    expected: number,
    reminders: Array<{
      offsetMinutes: number | null;
      absoluteTime: number | null;
      quietHoursOverride: boolean;
    }>,
  ) {
    const result = await input.database.transaction(async () => {
      const event = await input.database.events.get(eventId);
      if (!event || event.revision !== expected)
        throw new WorkspaceError("conflict");
      await cancelFuture(eventId);
      const existing = await input.database.reminderRules.toArray();
      for (const rule of existing) {
        if (rule.eventId === eventId)
          await input.database.reminderRules.delete(rule.id);
      }
      for (const reminder of reminders) {
        if (reminder.offsetMinutes !== null && reminder.absoluteTime !== null)
          throw new WorkspaceError("invalidInput");
        await input.database.reminderRules.put(
          reminderRuleSchema.parse({
            id: crypto.randomUUID(),
            eventId,
            taskId: null,
            offsetMinutes: reminder.offsetMinutes,
            absoluteTime: reminder.absoluteTime,
            severity: reminder.quietHoursOverride ? "important" : "normal",
            quietHoursOverride: reminder.quietHoursOverride,
          }),
        );
      }
      const next = {
        ...event,
        revision: event.revision + 1,
        generationCursor: null,
        updatedAt: new Date(now()).toISOString(),
      };
      await input.database.events.put(next);
      await materialize(next);
    });
    await armSweep();
    return result;
  }
  async function reconcile(browserQuit: boolean) {
    for (const event of await input.database.events.toArray()) {
      await input.database.transaction(async () => {
        const fresh = await input.database.events.get(event.id);
        if (fresh?.recurrenceSpec) await materialize(fresh);
      });
    }
    for (const followUp of await input.database.followUps.toArray())
      await syncFollowUp(followUp.id);
    await input.database.transaction(async () => {
      const existingFollowUpIds = new Set(
        (await input.database.followUps.toArray()).map((row) => row.id),
      );
      for (const rule of await input.database.reminderRules.toArray())
        if (rule.followUpId && !existingFollowUpIds.has(rule.followUpId))
          await input.database.reminderRules.delete(rule.id);
      for (const row of await input.database.notificationOccurrences.toArray())
        if (
          row.sourceKind === "followup" &&
          !existingFollowUpIds.has(row.ownerId) &&
          ["pending", "due"].includes(row.internalStatus)
        )
          await input.database.notificationOccurrences.put({
            ...row,
            internalStatus: "cancelled",
          });
    });
    await input.database.transaction(async () => {
      const habits = await input.database.habits.toArray();
      const activeHabitIds = new Set(
        habits
          .filter((habit) => habit.reminder?.enabled)
          .map((habit) => habit.id),
      );
      for (const rule of await input.database.reminderRules.toArray())
        if (rule.habitId && !activeHabitIds.has(rule.habitId))
          await input.database.reminderRules.delete(rule.id);
      for (const row of await input.database.notificationOccurrences.toArray())
        if (
          row.sourceKind === "habit" &&
          (!habits.some((habit) => habit.id === row.ownerId) ||
            !activeHabitIds.has(row.ownerId)) &&
          ["pending", "due"].includes(row.internalStatus)
        )
          await input.database.notificationOccurrences.put({
            ...row,
            internalStatus: "cancelled",
          });
      for (const habit of habits) {
        const current = await input.database.habits.get(habit.id);
        if (!current) continue;
        let rules = (await input.database.reminderRules.toArray()).filter(
          (rule) => rule.habitId === habit.id,
        );
        if (current.reminder?.enabled && rules.length === 0) {
          const rule = reminderRuleSchema.parse({
            id: crypto.randomUUID(),
            eventId: null,
            taskId: null,
            habitId: habit.id,
            offsetMinutes: null,
            absoluteTime: null,
            severity: "normal",
            quietHoursOverride: false,
          });
          await input.database.reminderRules.put(rule);
          rules = [rule];
        }
        rules.sort((left, right) => left.id.localeCompare(right.id));
        for (const extra of rules.slice(1)) {
          await input.database.reminderRules.delete(extra.id);
          for (const row of await input.database.notificationOccurrences.toArray())
            if (
              row.ruleId === extra.id &&
              row.sourceKind === "habit" &&
              ["pending", "due"].includes(row.internalStatus)
            )
              await input.database.notificationOccurrences.put({
                ...row,
                internalStatus: "cancelled",
              });
        }
        await materializeHabit(current);
      }
    });
    const quiet = await quietHours();
    const permission = await input.notifications.permission();
    const rows = await input.database.notificationOccurrences.toArray();
    const kept = pruneHistory(rows, now());
    const removed = new Set(kept.map((row) => row.idempotencyKey));
    for (const row of rows) {
      if (!removed.has(row.idempotencyKey))
        await input.database.notificationOccurrences.delete(row.idempotencyKey);
    }
    for (const original of kept) {
      const row = await input.database.transaction(async () => {
        const fresh = await input.database.notificationOccurrences.get(
          original.idempotencyKey,
        );
        if (!fresh) return null;
        const next = reconcileRow(fresh, now(), browserQuit);
        if (JSON.stringify(next) !== JSON.stringify(fresh))
          await input.database.notificationOccurrences.put(next);
        return next;
      });
      if (!row) continue;
      if (row.internalStatus !== "due" || row.nativeAttempt !== "not_started")
        continue;
      if (row.nativeApiStatus === "uncertain") continue;
      const inQuiet =
        quietHoursActive(now(), quiet, zonedMinutes) && !row.quietHoursOverride;
      if (inQuiet) {
        await input.database.transaction(async () => {
          const fresh = await input.database.notificationOccurrences.get(
            row.idempotencyKey,
          );
          if (
            fresh?.internalStatus === "due" &&
            fresh.nativeAttempt === "not_started"
          )
            await input.database.notificationOccurrences.put(
              applyDeliveryDecision(fresh, { kind: "quiet" }),
            );
        });
        continue;
      }
      if (permission !== "granted") {
        await input.database.transaction(async () => {
          const fresh = await input.database.notificationOccurrences.get(
            row.idempotencyKey,
          );
          if (
            fresh?.internalStatus === "due" &&
            fresh.nativeAttempt === "not_started"
          )
            await input.database.notificationOccurrences.put(
              applyDeliveryDecision(fresh, {
                kind: "permission",
                status: permission === "denied" ? "denied" : "unavailable",
              }),
            );
        });
        continue;
      }
      const started = markAttemptStarted(row);
      if (!started) continue;
      await claimOnce(async () => {
        const claimed = await input.database.transaction(async () => {
          const current = await input.database.notificationOccurrences.get(
            row.idempotencyKey,
          );
          if (
            !current ||
            current.internalStatus !== "due" ||
            current.nativeAttempt !== "not_started" ||
            current.nativeApiStatus
          )
            return false;
          const claimed = markAttemptStarted(current);
          if (!claimed) return false;
          await input.database.notificationOccurrences.put(claimed);
          return true;
        });
        if (!claimed) return;
        const fresh = await input.database.notificationOccurrences.get(
          row.idempotencyKey,
        );
        if (
          !fresh ||
          fresh.nativeAttempt !== "started" ||
          fresh.nativeApiStatus
        )
          return;
        let status: "accepted" | "rejected" = "rejected";
        try {
          status = await input.notifications.show(
            fresh.idempotencyKey,
            fresh.title,
          );
        } catch {
          status = "rejected";
        }
        await input.database.transaction(async () => {
          const latest = await input.database.notificationOccurrences.get(
            fresh.idempotencyKey,
          );
          if (latest?.nativeAttempt === "started" && !latest.nativeApiStatus)
            await input.database.notificationOccurrences.put(
              applyDeliveryDecision(latest, { kind: "api", status }),
            );
        });
      });
    }
    await refreshTimers();
    await armSweep();
  }
  async function armSweep() {
    const rows = await input.database.notificationOccurrences.toArray();
    const timers = await input.database.timerSessions.toArray();
    const next = [
      ...rows
        .filter((row) => row.internalStatus === "pending")
        .map((row) => row.fireAtUTC),
      ...timers
        .filter((item) => item.status === "running" && item.endsAtUTC !== null)
        .map((item) => item.endsAtUTC as number),
    ].sort((left, right) => left - right)[0];
    if (next === undefined) await input.alarms.clear();
    else await input.alarms.schedule(next);
  }
  async function timer() {
    const rows = await input.database.timerSessions.toArray();
    return (
      rows.find(
        (item) => item.status === "running" || item.status === "paused",
      ) ?? null
    );
  }
  async function startTimer(draft: {
    mode: "countdown" | "pomodoro";
    label?: string;
    durationMs?: number;
    autoNext?: boolean;
  }) {
    const result = await input.database.transaction(async () => {
      const existing = await timer();
      if (existing) throw new WorkspaceError("invalidInput");
      const duration = draft.durationMs ?? 25 * 60_000;
      const row = timerSchema.parse({
        id: crypto.randomUUID(),
        mode: draft.mode,
        label: draft.label ?? "",
        status: "running",
        durationMs: duration,
        startedAtUTC: now(),
        endsAtUTC: now() + duration,
        elapsedBeforePauseMs: 0,
        pauseAtUTC: null,
        cycleStep: "work",
        cycleIndex: 1,
        autoNext: draft.autoNext ?? false,
        workMs: draft.mode === "pomodoro" ? duration : duration,
        shortBreakMs: 5 * 60_000,
        longBreakMs: 15 * 60_000,
        clockWarning: false,
      });
      await input.database.timerSessions.put(row);
      return row;
    });
    await armSweep();
    return result;
  }
  async function pauseTimer(id: string) {
    const result = await input.database.transaction(async () => {
      const row = await input.database.timerSessions.get(id);
      if (!row || row.status !== "running" || row.endsAtUTC === null)
        throw new WorkspaceError("invalidInput");
      const elapsed =
        row.elapsedBeforePauseMs +
        Math.max(0, now() - (row.startedAtUTC ?? now()));
      const next = timerSchema.parse({
        ...row,
        status: "paused",
        elapsedBeforePauseMs: elapsed,
        pauseAtUTC: now(),
        endsAtUTC: null,
      });
      await input.database.timerSessions.put(next);
      return next;
    });
    await armSweep();
    return result;
  }
  async function resumeTimer(id: string) {
    const result = await input.database.transaction(async () => {
      const row = await input.database.timerSessions.get(id);
      if (!row || row.status !== "paused")
        throw new WorkspaceError("invalidInput");
      const remaining = Math.max(0, row.durationMs - row.elapsedBeforePauseMs);
      const next = timerSchema.parse({
        ...row,
        status: "running",
        startedAtUTC: now(),
        endsAtUTC: now() + remaining,
        pauseAtUTC: null,
      });
      await input.database.timerSessions.put(next);
      return next;
    });
    await armSweep();
    return result;
  }
  async function resetTimer(id: string) {
    const result = await input.database.transaction(async () => {
      const row = await input.database.timerSessions.get(id);
      if (!row) throw new WorkspaceError("notFound");
      await input.database.timerSessions.put(
        timerSchema.parse({
          ...row,
          status: "cancelled",
          endsAtUTC: null,
          pauseAtUTC: null,
        }),
      );
    });
    await armSweep();
    return result;
  }
  async function refreshTimers() {
    await input.database.transaction(async () => {
      const rows = await input.database.timerSessions.toArray();
      for (const row of rows) {
        if (row.status !== "running" || row.endsAtUTC === null) continue;
        const clockWarning = (row.startedAtUTC ?? now()) - now() > 60_000;
        const remaining = Math.max(0, row.endsAtUTC - now());
        if (remaining === 0) {
          const finished = timerSchema.parse({
            ...row,
            status: "finished",
            clockWarning: clockWarning || row.clockWarning,
          });
          await input.database.timerSessions.put(finished);
          if (row.mode === "pomodoro" && row.autoNext)
            await queueNext(finished);
        } else if (clockWarning && !row.clockWarning) {
          await input.database.timerSessions.put(
            timerSchema.parse({ ...row, clockWarning: true }),
          );
        }
      }
    });
  }
  async function queueNext(row: TimerRecord) {
    const step =
      row.cycleStep === "work"
        ? row.cycleIndex % 4 === 0
          ? "long"
          : "short"
        : "work";
    const duration =
      step === "work"
        ? row.workMs
        : step === "short"
          ? row.shortBreakMs
          : row.longBreakMs;
    await input.database.timerSessions.put(
      timerSchema.parse({
        ...row,
        id: crypto.randomUUID(),
        status: "running",
        cycleStep: step,
        cycleIndex: step === "work" ? row.cycleIndex + 1 : row.cycleIndex,
        durationMs: duration,
        startedAtUTC: now(),
        endsAtUTC: now() + duration,
        elapsedBeforePauseMs: 0,
        pauseAtUTC: null,
      }),
    );
  }
}

function zonedMinutes(epochMs: number, timeZone: string) {
  const zoned =
    VenusTemporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(
      timeZone,
    );
  return zoned.hour * 60 + zoned.minute;
}

export { sweepAlarm, convertDate, materializationHorizonDays };
