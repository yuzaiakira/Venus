import Dexie from "dexie";
import { beforeAll, describe, expect, it } from "vitest";

const probe = {
  id: "f535d2b1-f815-41d9-9e61-2d2518ce30b8",
  dueAt: 5,
  state: "pending",
  native: "not_attempted",
};

describe("Dexie version 3 migration", () => {
  beforeAll(async () => {
    const { db } = await import("../../src/infrastructure/db");
    if (db.isOpen()) db.close();
    await Dexie.delete("Venus-p00");
    const legacy = new Dexie("Venus-p00");
    legacy.version(1).stores({ probes: "id,state,dueAt" });
    await legacy.table("probes").put(probe);
    legacy.close();
  });
  it("opens version 3 without deleting version 1 probes", async () => {
    const { db } = await import("../../src/infrastructure/db");
    await db.open();
    expect(db.verno).toBe(9);
    expect(await db.probes.get(probe.id)).toMatchObject({
      state: "pending",
      dueAt: 5,
    });
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      "assets",
      "bookmarkSnapshots",
      "events",
      "folders",
      "goalRelations",
      "goals",
      "habits",
      "localBookmarks",
      "milestones",
      "noteDrafts",
      "notes",
      "notificationOccurrences",
      "pluginInstanceData",
      "pluginPackages",
      "probes",
      "profiles",
      "quietHours",
      "reminderRules",
      "sharedItems",
      "tasks",
      "timerSessions",
      "weeklyReviews",
      "widgets",
    ]);
    db.close();
    await Dexie.delete("Venus-p00");
    const version2 = new Dexie("Venus-p00");
    version2.version(2).stores({
      probes: "id,state,dueAt",
      profiles: "id,updatedAt",
      widgets: "id,profileId",
      sharedItems: "id,kind",
      assets: "id",
    });
    await version2.table("probes").put(probe);
    await version2.table("profiles").put({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Kept appearance",
      preset: "personal",
      themeMode: "dark",
      wallpaper: { kind: "scene", sceneId: "nebula" },
      blurPx: 4,
      glassAlpha: 0.72,
      accent: "#445566",
      revision: 2,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    await version2.table("widgets").put({
      id: "22222222-2222-4222-8222-222222222222",
      profileId: "11111111-1111-4111-8111-111111111111",
      widgetType: "clock",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      visible: true,
      settings: {},
      revision: 1,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    await version2.table("sharedItems").put({
      id: "33333333-3333-4333-8333-333333333333",
      kind: "note",
      title: "Shared survivor",
      revision: 1,
    });
    version2.close();
    await db.open();
    expect(
      await db.profiles.get("11111111-1111-4111-8111-111111111111"),
    ).toMatchObject({
      title: "Kept appearance",
      themeMode: "dark",
      blurPx: 4,
      wallpaper: { kind: "scene", sceneId: "nebula" },
    });
    expect(
      await db.widgets.get("22222222-2222-4222-8222-222222222222"),
    ).toMatchObject({ widgetType: "clock" });
    expect(
      await db.sharedItems.get("33333333-3333-4333-8333-333333333333"),
    ).toMatchObject({ title: "Shared survivor" });
    expect(await db.probes.get(probe.id)).toMatchObject({ state: "pending" });
    db.close();
  });

  it("opens version 5 without deleting version 4 events or timers", async () => {
    const { db } = await import("../../src/infrastructure/db");
    if (db.isOpen()) db.close();
    await Dexie.delete("Venus-p00");
    const version4 = new Dexie("Venus-p00");
    version4.version(4).stores({
      probes: "id,state,dueAt",
      profiles: "id,updatedAt",
      widgets: "id,profileId",
      sharedItems: "id,kind",
      assets: "id",
      notes: "id, folderId, pinned, trashedAt, updatedAt",
      folders: "id, scope, parentId",
      tasks: "id, status, dueDate, focusRank",
      localBookmarks: "id, folderId, quick",
      bookmarkSnapshots: "id, capturedAt",
      events: "id, zoneId, updatedAt",
      reminderRules: "id, eventId, taskId",
      notificationOccurrences:
        "idempotencyKey, fireAtUTC, internalStatus, ownerId",
      timerSessions: "id, status",
      quietHours: "id",
    });
    await version4.table("probes").put(probe);
    await version4.table("notes").put({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Kept note",
      revision: 4,
    });
    await version4.table("events").put({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "Kept event",
      zoneId: "UTC",
    });
    await version4.table("timerSessions").put({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      status: "idle",
    });
    version4.close();
    await db.open();
    expect(db.verno).toBe(9);
    expect(await db.probes.get(probe.id)).toMatchObject({ state: "pending" });
    expect(
      await db.notes.get("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ).toMatchObject({ title: "Kept note" });
    expect(
      await db.events.get("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    ).toMatchObject({ title: "Kept event" });
    expect(
      await db.timerSessions.get("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
    ).toMatchObject({ status: "idle" });
    expect(db.tables.some((table) => table.name === "pluginPackages")).toBe(
      true,
    );
    db.close();
  });
});

it("additively upgrades version 5 task and note records without changing IDs or losing content", async () => {
  const { db } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const legacy = new Dexie("Venus-p00");
  legacy.version(5).stores({
    notes: "id, folderId, pinned, trashedAt, updatedAt",
    tasks: "id, status, dueDate, focusRank",
  });
  const id = "11111111-1111-4111-8111-111111111111";
  const doneId = "22222222-2222-4222-8222-222222222222";
  await legacy.table("tasks").bulkPut([
    {
      id,
      title: "Old focused task",
      status: "open",
      focusRank: 2,
      details: "keep",
      revision: 7,
    },
    {
      id: doneId,
      title: "Done",
      status: "done",
      focusRank: null,
      updatedAt: "2026-01-01",
      revision: 3,
    },
  ]);
  await legacy.table("notes").put({
    id,
    title: "Old note",
    body: { type: "doc", content: [] },
    revision: 4,
  });
  legacy.close();
  await db.open();
  expect(await db.tasks.get(id)).toMatchObject({
    id,
    title: "Old focused task",
    column: "todo",
    today: true,
    todayOrder: 2,
    focusRank: 2,
    details: "keep",
    checklist: [],
    labels: [],
    revision: 7,
  });
  expect(await db.tasks.get(doneId)).toMatchObject({
    column: "done",
    completedAt: "2026-01-01",
    revision: 3,
  });
  expect(await db.notes.get(id)).toMatchObject({
    id,
    title: "Old note",
    body: { type: "doc", content: [] },
    revision: 4,
    sortIndex: 0,
  });
  db.close();
});

it("preserves a realistic version 6 workspace and persists habit check-ins after reopen", async () => {
  const { db } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const legacy = new Dexie("Venus-p00");
  legacy.version(6).stores({
    profiles: "id,updatedAt",
    widgets: "id,profileId",
    notes: "id, folderId, pinned, trashedAt, updatedAt, sortIndex",
    tasks: "id, status, dueDate, focusRank, column, sortIndex",
  });
  const profileId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const taskId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const noteId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await legacy.table("profiles").put({
    id: profileId,
    title: "Kept",
    revision: 4,
    updatedAt: "2026-01-01",
  });
  await legacy.table("widgets").put({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    profileId,
    widgetType: "today",
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    visible: true,
    revision: 2,
  });
  await legacy.table("tasks").put({
    id: taskId,
    title: "Kept task",
    details: "",
    status: "open",
    revision: 3,
    column: "todo",
    sortIndex: 0,
  });
  await legacy.table("notes").put({
    id: noteId,
    title: "Kept note",
    body: { type: "doc", content: [] },
    revision: 5,
    sortIndex: 0,
  });
  legacy.close();
  await db.open();
  expect(db.verno).toBe(9);
  expect(db.tables.some((table) => table.name === "habits")).toBe(true);
  expect((await db.profiles.get(profileId))?.id).toBe(profileId);
  expect((await db.widgets.toArray())[0]?.profileId).toBe(profileId);
  expect((await db.tasks.get(taskId))?.id).toBe(taskId);
  expect((await db.notes.get(noteId))?.id).toBe(noteId);
  const habitId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  await db.habits.put({
    id: habitId,
    title: "Walk",
    frequency: "daily",
    checkIns: ["2026-10-20"],
    revision: 1,
    createdAt: "2026-10-20",
    updatedAt: "2026-10-20",
  });
  db.close();
  await db.open();
  expect(await db.habits.get(habitId)).toMatchObject({
    id: habitId,
    checkIns: ["2026-10-20"],
  });
  db.close();
});

it("adds the habit reminder index from v7 while preserving event and task reminder history", async () => {
  const { db } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const v7Stores = Object.fromEntries(
    db.tables
      .map((table) => {
        const indexes = table.schema.indexes.map((index) => index.src);
        const fields = [table.schema.primKey.src, ...indexes].filter(Boolean);
        return [table.name, fields.join(", ")];
      })
      .filter(
        ([name]) =>
          !["goals", "milestones", "goalRelations", "weeklyReviews"].includes(
            String(name),
          ),
      ),
  );
  v7Stores.reminderRules = "id, eventId, taskId";
  const legacy = new Dexie("Venus-p00");
  legacy.version(7).stores(v7Stores);
  const eventRule = "11111111-1111-4111-8111-111111111111";
  const taskRule = "22222222-2222-4222-8222-222222222222";
  await legacy.table("reminderRules").bulkPut([
    {
      id: eventRule,
      eventId: "33333333-3333-4333-8333-333333333333",
      taskId: null,
      offsetMinutes: 5,
    },
    {
      id: taskRule,
      eventId: null,
      taskId: "44444444-4444-4444-8444-444444444444",
      offsetMinutes: 10,
    },
  ]);
  const oldNotification = {
    idempotencyKey: "legacy-event-occurrence",
    ownerId: "33333333-3333-4333-8333-333333333333",
    ruleId: eventRule,
    occurrenceKey: "legacy-date",
    fireAtUTC: 1_800_000_000_000,
    internalStatus: "pending",
    read: false,
    seenMissed: false,
    nativeAttempt: "not_started",
    nativeApiStatus: null,
    osDisplay: "unobserved",
    attempt: 1,
    quietHoursOverride: false,
    sourceKind: "event",
    title: "Legacy event",
  };
  await legacy.table("notificationOccurrences").put(oldNotification);
  legacy.close();
  await db.open();
  expect(db.verno).toBe(9);
  expect(await db.reminderRules.get(eventRule)).toMatchObject({
    eventId: "33333333-3333-4333-8333-333333333333",
    taskId: null,
  });
  expect(await db.reminderRules.get(taskRule)).toMatchObject({
    eventId: null,
    taskId: "44444444-4444-4444-8444-444444444444",
  });
  expect(
    await db.notificationOccurrences.get(oldNotification.idempotencyKey),
  ).toMatchObject(oldNotification);
  expect(db.reminderRules.schema.idxByName.habitId).toBeDefined();
  db.close();
});

it("additively upgrades a realistic v8 workspace to v9 and persists Goals records", async () => {
  const { createGoals } = await import("../../src/application/goals");
  const { db, goalsDb } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const v8Stores = Object.fromEntries(
    db.tables
      .filter(
        (table) =>
          !["goals", "milestones", "goalRelations", "weeklyReviews"].includes(
            table.name,
          ),
      )
      .map((table) => {
        const indexes = table.schema.indexes.map((index) => index.src);
        const fields = [table.schema.primKey.src, ...indexes].filter(Boolean);
        return [table.name, fields.join(", ")];
      }),
  );
  const legacy = new Dexie("Venus-p00");
  legacy.version(8).stores(v8Stores);
  const profileId = "11111111-1111-4111-8111-111111111111";
  const taskId = "22222222-2222-4222-8222-222222222222";
  const habitId = "33333333-3333-4333-8333-333333333333";
  const widgetId = "44444444-4444-4444-8444-444444444444";
  const ruleId = "55555555-5555-4555-8555-555555555555";
  const noteId = "66666666-6666-4666-8666-666666666666";
  await legacy.table("profiles").put({
    id: profileId,
    title: "Kept profile",
    preset: "personal",
    revision: 3,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  });
  await legacy.table("widgets").put({
    id: widgetId,
    profileId,
    widgetType: "habits",
    revision: 2,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  });
  await legacy.table("tasks").put({
    id: taskId,
    title: "Kept task",
    status: "open",
    revision: 5,
  });
  await legacy.table("notes").put({
    id: noteId,
    title: "Kept note",
    body: { type: "doc", content: [] },
    revision: 6,
  });
  await legacy.table("habits").put({
    id: habitId,
    title: "Kept habit",
    frequency: "daily",
    checkIns: ["2026-10-20"],
    revision: 4,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  await legacy.table("reminderRules").put({
    id: ruleId,
    eventId: null,
    taskId,
    habitId: null,
    offsetMinutes: 15,
  });
  await legacy.table("notificationOccurrences").put({
    idempotencyKey: "v8-task-notification",
    ownerId: taskId,
    ruleId,
    occurrenceKey: "v8-task",
    fireAtUTC: 1_800_000_000_000,
    internalStatus: "pending",
    sourceKind: "task",
  });
  legacy.close();

  await db.open();
  expect(db.verno).toBe(9);
  expect(db.tables.some((table) => table.name === "goals")).toBe(true);
  expect(db.goals.schema.idxByName.profileId).toBeDefined();
  expect(
    db.goalRelations.schema.idxByName["[goalId+targetKind+targetId]"],
  ).toBeDefined();
  expect((await db.profiles.get(profileId))?.revision).toBe(3);
  expect((await db.widgets.get(widgetId))?.profileId).toBe(profileId);
  expect((await db.tasks.get(taskId))?.revision).toBe(5);
  expect((await db.notes.get(noteId))?.revision).toBe(6);
  expect((await db.habits.get(habitId))?.checkIns).toEqual(["2026-10-20"]);
  expect((await db.reminderRules.get(ruleId))?.taskId).toBe(taskId);
  expect(
    await db.notificationOccurrences.get("v8-task-notification"),
  ).toBeTruthy();

  const goals = createGoals(goalsDb);
  const goal = await goals.createGoal(profileId, {
    title: "Ship safely",
    description: "",
    startDate: "2026-10-20",
    targetDate: "2026-10-31",
    progress: { mode: "manual", target: 2, current: 0 },
  });
  await goals.linkRecord(goal.id, goal.revision, "habit", habitId);
  db.close();
  await db.open();
  const loaded = await goals.load(profileId);
  expect(loaded.goals[0]).toMatchObject({ id: goal.id, title: "Ship safely" });
  expect(loaded.goals[0]?.relations[0]).toMatchObject({ targetId: habitId });
  db.close();
});
