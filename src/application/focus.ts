import { WorkspaceError } from "../domain/dashboard";
import {
  addFocusDays,
  buildFocusWorkspace,
  focusDeferralSchema,
  type FocusDeferralRecord,
} from "../domain/focus";
import type { TaskRecord } from "../domain/productivity";
import type { EventRecord, TimerRecord } from "../domain/time/records";
import type { ProfileRecord } from "../domain/dashboard";
import type { RowTable } from "./productivity";
import type { WorkspaceChange } from "./workspace";

export interface FocusDatabase {
  profiles: RowTable<ProfileRecord>;
  tasks: RowTable<TaskRecord>;
  events: RowTable<EventRecord>;
  timerSessions: RowTable<TimerRecord>;
  focusDeferrals: RowTable<FocusDeferralRecord>;
  transaction<T>(
    mode: "rw",
    tables: RowTable<unknown>[],
    work: () => Promise<T>,
  ): Promise<T>;
}

function stamp(revision = 1) {
  const now = new Date().toISOString();
  return { revision, createdAt: now, updatedAt: now };
}

function bump<T extends { revision: number; updatedAt: string }>(
  row: T,
  patch: Partial<T>,
): T {
  return {
    ...row,
    ...patch,
    revision: row.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function createFocus(
  database: FocusDatabase,
  notify: (change: WorkspaceChange) => void = () => {},
) {
  function changed(id: string, revision: number) {
    notify({ type: "workspace", id, revision });
  }

  async function requireProfile(profileId: string) {
    const profile = await database.profiles.get(profileId);
    if (!profile) throw new WorkspaceError("notFound");
    return profile;
  }

  async function load(profileId: string, timeZone: string, now = Date.now()) {
    await requireProfile(profileId);
    const [tasks, events, timerSessions, states] = await Promise.all([
      database.tasks.toArray(),
      database.events.toArray(),
      database.timerSessions.toArray(),
      database.focusDeferrals.toArray(),
    ]);
    return buildFocusWorkspace({
      tasks,
      events,
      timers: timerSessions,
      states: states.filter((state) => state.profileId === profileId),
      timeZone,
      now,
    });
  }

  async function updateState(
    profileId: string,
    taskId: string,
    expected: number | null,
    patch: Pick<FocusDeferralRecord, "deferredUntilDate" | "snoozedUntilUTC">,
  ) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.tasks, database.focusDeferrals],
      async () => {
        await requireProfile(profileId);
        const task = await database.tasks.get(taskId);
        if (!task || task.status !== "open")
          throw new WorkspaceError("notFound");
        const existing = (await database.focusDeferrals.toArray()).find(
          (state) => state.profileId === profileId && state.taskId === taskId,
        );
        if (existing && existing.revision !== expected)
          throw new WorkspaceError("conflict");
        if (!existing && expected !== null)
          throw new WorkspaceError("conflict");
        const next = focusDeferralSchema.parse(
          existing
            ? bump(existing, patch)
            : {
                id: crypto.randomUUID(),
                profileId,
                taskId,
                ...patch,
                ...stamp(),
              },
        );
        await database.focusDeferrals.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }

  return {
    load,
    snooze(
      profileId: string,
      taskId: string,
      expected: number | null,
      minutes: number,
      now = Date.now(),
    ) {
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60)
        throw new WorkspaceError("invalidInput");
      return updateState(profileId, taskId, expected, {
        deferredUntilDate: null,
        snoozedUntilUTC: now + minutes * 60_000,
      });
    },
    defer(
      profileId: string,
      taskId: string,
      expected: number | null,
      today: string,
    ) {
      return updateState(profileId, taskId, expected, {
        deferredUntilDate: addFocusDays(today, 1),
        snoozedUntilUTC: null,
      });
    },
    clear(profileId: string, taskId: string, expected: number) {
      return updateState(profileId, taskId, expected, {
        deferredUntilDate: null,
        snoozedUntilUTC: null,
      });
    },
  };
}

export type Focus = ReturnType<typeof createFocus>;
