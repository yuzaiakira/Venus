import { WorkspaceError } from "../domain/dashboard";
import {
  assertProductDate,
  convertDate,
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
import type { HabitRecord } from "../domain/productivity";

const sweepAlarm = "venus-sweep";

export interface CalendarDatabase {
  habits: { get(id: string): Promise<HabitRecord | undefined>; toArray(): Promise<HabitRecord[]> };
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
      const localDate =
        draft.localDate ?? todayInZone(draft.zoneId, now(), draft.basis);
      assertProductDate({ ...localDate, calendar: draft.basis });
      const recurrence = draft.recurrence ? assertRule(draft.recurrence) : null;
      const stamp = new Date(now()).toISOString();
      const row = eventSchema.parse({
        id: crypto.randomUUID(),
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
  async function deleteEvent(id: string) {
    const result = await input.database.transaction(async () => {
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
    const result = await input.database.transaction(async () => {
      const row = await must(key);
      const next = snoozeRow(row, now() + minutes * 60_000);
      await input.database.notificationOccurrences.put({
        ...row,
        internalStatus: "snoozed",
      });
      await input.database.notificationOccurrences.put(
        notificationSchema.parse(next),
      );
    });
    await armSweep();
    return result;
  }
  async function dismiss(key: string) {
    const row = await must(key);
    await input.database.notificationOccurrences.put({
      ...row,
      internalStatus: "dismissed",
      read: true,
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
