import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCalendar } from "../../src/application/calendar";
import { createFocus } from "../../src/application/focus";
import { createProductivity } from "../../src/application/productivity";
import {
  createWorkspace,
  memoryPreferences,
} from "../../src/application/workspace";
import {
  calendarDb,
  db,
  focusDb,
  productivityDb,
} from "../../src/infrastructure/db";

const fixedNow = Date.UTC(2026, 2, 8, 13, 0, 0);
const alarms = {
  schedule: vi.fn(async () => {}),
  clear: vi.fn(async () => {}),
};
const notifications = {
  permission: vi.fn(async () => "granted" as const),
  show: vi.fn(async () => "accepted" as const),
  clear: vi.fn(async () => {}),
};

beforeEach(async () => {
  vi.clearAllMocks();
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.profiles.clear(),
    db.widgets.clear(),
    db.tasks.clear(),
    db.events.clear(),
    db.timerSessions.clear(),
    db.focusDeferrals.clear(),
  ]);
});

async function harness() {
  const workspace = createWorkspace(memoryPreferences());
  const snapshot = await workspace.load();
  const profile = snapshot.profiles[0];
  if (!profile) throw new Error("profile missing");
  return {
    workspace,
    profile,
    productivity: createProductivity(productivityDb),
    focus: createFocus(focusDb),
    calendar: createCalendar({
      database: calendarDb,
      alarms,
      notifications,
      now: () => fixedNow,
    }),
  };
}

describe("Focus Coach persistence", () => {
  it("builds a local schedule-aware recommendation, starts the existing timer, and persists snooze/defer choices", async () => {
    const { profile, productivity, focus, calendar } = await harness();
    const task = await productivity.createTask("Ship local focus coach");
    const ranked = await productivity.saveTask(task.id, task.revision, {
      dueDate: "2026-03-08",
      priority: 3,
      today: true,
      focusRank: 1,
    });
    await calendar.createEvent({
      title: "Calendar conflict",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 3, day: 8 },
      wall: { hour: 9, minute: 0, second: 0 },
      zoneId: "America/New_York",
      offsetMinutes: [],
    });
    const initial = await focus.load(profile.id, "America/New_York", fixedNow);
    expect(initial.suggestions[0]).toMatchObject({
      task: { id: ranked.id },
      reason: "dueToday",
    });
    expect(initial.conflicts.map((item) => item.title)).toContain(
      "Calendar conflict",
    );
    expect(initial.slots[0]?.startAtUTC).toBe(Date.UTC(2026, 2, 8, 14));

    const snoozed = await focus.snooze(
      profile.id,
      ranked.id,
      initial.suggestions[0]?.stateRevision ?? null,
      60,
      fixedNow,
    );
    expect(
      (await focus.load(profile.id, "America/New_York", fixedNow)).suggestions,
    ).toHaveLength(0);
    const restored = await focus.clear(profile.id, ranked.id, snoozed.revision);
    const deferred = await focus.defer(
      profile.id,
      ranked.id,
      restored.revision,
      "2026-03-08",
    );
    expect(deferred.deferredUntilDate).toBe("2026-03-09");
    expect(
      (await focus.load(profile.id, "America/New_York", fixedNow)).suggestions,
    ).toHaveLength(0);
    expect(
      (
        await focus.load(
          profile.id,
          "America/New_York",
          fixedNow + 24 * 60 * 60_000,
        )
      ).suggestions[0]?.task.id,
    ).toBe(ranked.id);

    await calendar.startTimer({
      mode: "pomodoro",
      label: ranked.title,
      durationMs: 25 * 60_000,
    });
    expect(
      (await focus.load(profile.id, "America/New_York", fixedNow)).activeTimer,
    ).toMatchObject({ label: ranked.title, status: "running" });

    db.close();
    await db.open();
    expect(await db.focusDeferrals.get(deferred.id)).toMatchObject({
      profileId: profile.id,
      taskId: ranked.id,
      deferredUntilDate: "2026-03-09",
    });
  });

  it("rejects stale concurrent choices, keeps states profile-isolated, and keeps Focus Coach opt-in", async () => {
    const { workspace, profile, productivity, focus } = await harness();
    const task = await productivity.createTask("Profile-safe task");
    const plan = await focus.load(profile.id, "UTC", fixedNow);
    const expected =
      plan.suggestions.find((item) => item.task.id === task.id)
        ?.stateRevision ?? null;
    const attempts = await Promise.allSettled([
      focus.snooze(profile.id, task.id, expected, 60, fixedNow),
      focus.defer(profile.id, task.id, expected, "2026-03-08"),
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(attempts.filter((item) => item.status === "rejected")).toHaveLength(
      1,
    );

    const other = await workspace.createProfile("minimal", "Other");
    expect(
      (await focus.load(other.id, "UTC", fixedNow)).suggestions,
    ).toHaveLength(1);
    const one = await workspace.addWidget(profile.id, "focus");
    const two = await workspace.addWidget(profile.id, "focus");
    expect(one.id).toBe(two.id);
    await workspace.removeWidget(one.id);
    expect(await db.focusDeferrals.count()).toBe(1);
    await workspace.deleteProfile(profile.id);
    expect(await db.focusDeferrals.count()).toBe(0);
  });
});
