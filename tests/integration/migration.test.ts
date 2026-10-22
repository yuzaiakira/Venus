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
    expect(db.verno).toBe(15);
    expect(await db.probes.get(probe.id)).toMatchObject({
      state: "pending",
      dueAt: 5,
    });
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      "assets",
      "bookmarkSnapshots",
      "commutePlans",
      "events",
      "financeAccounts",
      "financeBillPayments",
      "financeBills",
      "financeBudgets",
      "financeCategories",
      "financeTransactions",
      "focusDeferrals",
      "folders",
      "followUps",
      "goalRelations",
      "goals",
      "habits",
      "inboxItems",
      "interactions",
      "localBookmarks",
      "milestones",
      "noteDrafts",
      "notes",
      "notificationOccurrences",
      "people",
      "pluginInstanceData",
      "pluginPackages",
      "probes",
      "profiles",
      "quietHours",
      "reminderRules",
      "reviewHistory",
      "reviewSchedules",
      "sharedItems",
      "tasks",
      "timerSessions",
      "weatherForecasts",
      "weatherLocations",
      "weatherProfiles",
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
    expect(db.verno).toBe(15);
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
  expect(db.verno).toBe(15);
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
          [
            "goals",
            "milestones",
            "goalRelations",
            "weeklyReviews",
            "reviewSchedules",
            "reviewHistory",
            "people",
            "followUps",
            "interactions",
            "focusDeferrals",
            "inboxItems",
            "weatherProfiles",
            "weatherLocations",
            "weatherForecasts",
            "commutePlans",
            "financeAccounts",
            "financeCategories",
            "financeTransactions",
            "financeBudgets",
            "financeBills",
            "financeBillPayments",
          ].includes(String(name)) === false,
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
  expect(db.verno).toBe(15);
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

it("additively upgrades a realistic v8 workspace through v14 and persists Goals records", async () => {
  const { createGoals } = await import("../../src/application/goals");
  const { db, goalsDb } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const v8Stores = Object.fromEntries(
    db.tables
      .filter(
        (table) =>
          ![
            "goals",
            "milestones",
            "goalRelations",
            "weeklyReviews",
            "reviewSchedules",
            "reviewHistory",
            "people",
            "followUps",
            "interactions",
            "focusDeferrals",
            "inboxItems",
            "weatherProfiles",
            "weatherLocations",
            "weatherForecasts",
            "commutePlans",
            "financeAccounts",
            "financeCategories",
            "financeTransactions",
            "financeBudgets",
            "financeBills",
            "financeBillPayments",
          ].includes(table.name),
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
  expect(db.verno).toBe(15);
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

it("additively upgrades a realistic v9 workspace through v14 and preserves records while persisting review history", async () => {
  const { createReviews } = await import("../../src/application/reviews");
  const { db, reviewsDb } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const v9Stores = Object.fromEntries(
    db.tables
      .filter(
        (table) =>
          ![
            "reviewSchedules",
            "reviewHistory",
            "people",
            "followUps",
            "interactions",
            "focusDeferrals",
            "inboxItems",
            "weatherProfiles",
            "weatherLocations",
            "weatherForecasts",
            "commutePlans",
            "financeAccounts",
            "financeCategories",
            "financeTransactions",
            "financeBudgets",
            "financeBills",
            "financeBillPayments",
          ].includes(table.name),
      )
      .map((table) => {
        const indexes = table.schema.indexes.map((index) => index.src);
        return [
          table.name,
          [table.schema.primKey.src, ...indexes].filter(Boolean).join(", "),
        ];
      }),
  );
  const legacy = new Dexie("Venus-p00");
  legacy.version(9).stores(v9Stores);
  const profileId = "99999999-9999-4999-8999-999999999999";
  const noteId = "88888888-8888-4888-8888-888888888888";
  const goalId = "77777777-7777-4777-8777-777777777777";
  await legacy.table("profiles").put({
    id: profileId,
    title: "Kept v9 profile",
    revision: 3,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  await legacy.table("notes").put({
    id: noteId,
    title: "Kept v9 note",
    body: { type: "doc", content: [] },
    folderId: null,
    tags: [],
    pinned: false,
    archived: false,
    trashedAt: null,
    revision: 4,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  await legacy.table("goals").put({
    id: goalId,
    profileId,
    title: "Kept v9 goal",
    description: "",
    status: "active",
    startDate: "2026-10-20",
    targetDate: null,
    progress: { mode: "manual", target: 1, current: 0 },
    revision: 2,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  await legacy.table("tasks").put({
    id: "66666666-6666-4666-8666-666666666666",
    title: "Kept task",
    revision: 2,
    status: "open",
  });
  await legacy.table("habits").put({
    id: "55555555-5555-4555-8555-555555555555",
    title: "Kept habit",
    frequency: "daily",
    reminder: null,
    checkIns: ["2026-10-20"],
    revision: 2,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  legacy.close();

  await db.open();
  expect(db.verno).toBe(15);
  expect(
    db.reviewSchedules.schema.idxByName["[profileId+noteId]"],
  ).toBeDefined();
  expect((await db.notes.get(noteId))?.revision).toBe(4);
  expect((await db.goals.get(goalId))?.revision).toBe(2);
  expect(
    (await db.tasks.get("66666666-6666-4666-8666-666666666666"))?.title,
  ).toBe("Kept task");
  expect(
    (await db.habits.get("55555555-5555-4555-8555-555555555555"))?.checkIns,
  ).toEqual(["2026-10-20"]);
  const reviews = createReviews(reviewsDb);
  const schedule = await reviews.enroll(profileId, noteId, "2026-10-21");
  await reviews.submitRating(
    schedule.id,
    schedule.revision,
    "easy",
    "2026-10-21",
  );
  db.close();
  await db.open();
  const loaded = await reviews.load(profileId, "2026-10-22");
  expect(loaded.schedules[0]).toMatchObject({
    noteId,
    dueDate: "2026-10-24",
    intervalDays: 3,
  });
  expect(loaded.schedules[0]?.history).toHaveLength(1);
  db.close();
});

it("additively upgrades a realistic v10 workspace through v14 and preserves every existing record while persisting People data", async () => {
  const { createPeople } = await import("../../src/application/people");
  const { db, peopleDb } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const v10Stores = Object.fromEntries(
    db.tables
      .filter(
        (table) =>
          ![
            "people",
            "followUps",
            "interactions",
            "focusDeferrals",
            "inboxItems",
            "weatherProfiles",
            "weatherLocations",
            "weatherForecasts",
            "commutePlans",
            "financeAccounts",
            "financeCategories",
            "financeTransactions",
            "financeBudgets",
            "financeBills",
            "financeBillPayments",
          ].includes(table.name),
      )
      .map((table) => [
        table.name,
        [
          table.schema.primKey.src,
          ...table.schema.indexes.map((index) => index.src),
        ]
          .filter(Boolean)
          .join(", "),
      ]),
  );
  // v10 did not have the followUpId index.
  v10Stores.reminderRules = "id, eventId, taskId, habitId";
  const legacy = new Dexie("Venus-p00");
  legacy.version(10).stores(v10Stores);
  const profileId = "12121212-1212-4121-8121-121212121212";
  const noteId = "13131313-1313-4131-8131-131313131313";
  const goalId = "14141414-1414-4141-8141-141414141414";
  const habitId = "15151515-1515-4151-8151-151515151515";
  const ruleId = "16161616-1616-4161-8161-161616161616";
  await legacy.table("profiles").put({
    id: profileId,
    title: "Kept profile",
    revision: 7,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  await legacy.table("notes").put({
    id: noteId,
    title: "Kept note",
    body: { type: "doc", content: [] },
    folderId: null,
    tags: [],
    pinned: false,
    archived: false,
    trashedAt: null,
    revision: 4,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  await legacy.table("goals").put({
    id: goalId,
    profileId,
    title: "Kept goal",
    description: "",
    status: "active",
    startDate: "2026-10-20",
    targetDate: null,
    progress: { mode: "manual", target: 1, current: 0 },
    revision: 3,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  await legacy.table("habits").put({
    id: habitId,
    title: "Kept habit",
    frequency: "daily",
    reminder: null,
    checkIns: ["2026-10-20"],
    revision: 2,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  await legacy.table("reminderRules").put({
    id: ruleId,
    eventId: null,
    taskId: null,
    habitId,
    offsetMinutes: null,
    absoluteTime: null,
    severity: "normal",
    quietHoursOverride: false,
  });
  await legacy.table("reviewSchedules").put({
    id: "17171717-1717-4171-8171-171717171717",
    profileId,
    noteId,
    state: "active",
    dueDate: "2026-10-21",
    lastReviewedDate: null,
    intervalDays: 1,
    repetitions: 0,
    revision: 2,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  });
  legacy.close();

  await db.open();
  expect(db.verno).toBe(15);
  expect(db.people.schema.idxByName.profileId).toBeDefined();
  expect(db.followUps.schema.idxByName["[profileId+personId]"]).toBeDefined();
  expect(db.reminderRules.schema.idxByName.followUpId).toBeDefined();
  expect((await db.profiles.get(profileId))?.revision).toBe(7);
  expect((await db.notes.get(noteId))?.id).toBe(noteId);
  expect((await db.goals.get(goalId))?.id).toBe(goalId);
  expect((await db.habits.get(habitId))?.checkIns).toEqual(["2026-10-20"]);
  expect((await db.reminderRules.get(ruleId))?.habitId).toBe(habitId);
  expect(await db.reviewSchedules.toArray()).toHaveLength(1);
  const people = createPeople(peopleDb);
  const person = await people.createPerson(profileId, {
    displayName: "Migration person",
    organization: null,
    role: null,
    email: null,
    phone: null,
    tags: [],
    relationshipNotes: "",
  });
  const followUp = await people.createFollowUp(profileId, {
    personId: person.id,
    title: "Persist",
    dueDate: "2026-10-22",
    dueTime: "09:00",
    timeZone: "UTC",
    priority: "normal",
    contactMethod: "email",
    reminderEnabled: false,
  });
  await people.recordInteraction(profileId, {
    personId: person.id,
    followUpId: followUp.id,
    kind: "note",
    body: "Migrated safely",
    occurredAt: "2026-10-21T10:00:00.000Z",
  });
  db.close();
  await db.open();
  expect(await db.people.get(person.id)).toMatchObject({
    displayName: "Migration person",
    profileId,
  });
  expect(await db.followUps.get(followUp.id)).toMatchObject({
    title: "Persist",
    personId: person.id,
  });
  expect(
    (await db.interactions.toArray()).filter(
      (row) => row.personId === person.id,
    ),
  ).toHaveLength(1);
  db.close();
});

it("additively upgrades a realistic v11 workspace to v14 without changing records and persists Focus Coach choices", async () => {
  const { createFocus } = await import("../../src/application/focus");
  const { db, focusDb } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const v11Stores = Object.fromEntries(
    db.tables
      .filter(
        (table) =>
          ![
            "focusDeferrals",
            "inboxItems",
            "weatherProfiles",
            "weatherLocations",
            "weatherForecasts",
            "commutePlans",
            "financeAccounts",
            "financeCategories",
            "financeTransactions",
            "financeBudgets",
            "financeBills",
            "financeBillPayments",
          ].includes(table.name),
      )
      .map((table) => [
        table.name,
        [
          table.schema.primKey.src,
          ...table.schema.indexes.map((index) => index.src),
        ]
          .filter(Boolean)
          .join(", "),
      ]),
  );
  const legacy = new Dexie("Venus-p00");
  legacy.version(11).stores(v11Stores);
  const profileId = "18181818-1818-4181-8181-181818181818";
  const taskId = "19191919-1919-4191-8191-191919191919";
  const personId = "20202020-2020-4202-8202-202020202020";
  await legacy.table("profiles").put({
    id: profileId,
    title: "Kept v11 profile",
    preset: "minimal",
    themeMode: null,
    wallpaper: null,
    blurPx: null,
    glassAlpha: null,
    accent: null,
    revision: 5,
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
  });
  await legacy.table("tasks").put({
    id: taskId,
    title: "Keep focused work",
    details: "Keep every existing task field.",
    status: "open",
    column: "todo",
    sortIndex: 0,
    today: true,
    todayOrder: 0,
    labels: [],
    checklist: [],
    priority: 3,
    dueDate: "2026-10-22",
    eventId: null,
    focusRank: 1,
    completedAt: null,
    revision: 4,
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
  });
  await legacy.table("people").put({
    id: personId,
    profileId,
    displayName: "Kept person",
    organization: null,
    role: null,
    email: null,
    phone: null,
    tags: [],
    relationshipNotes: "",
    status: "active",
    revision: 2,
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
  });
  legacy.close();

  await db.open();
  expect(db.verno).toBe(15);
  expect(
    db.focusDeferrals.schema.idxByName["[profileId+taskId]"],
  ).toBeDefined();
  expect(await db.tasks.get(taskId)).toMatchObject({
    id: taskId,
    revision: 4,
    title: "Keep focused work",
  });
  expect(await db.people.get(personId)).toMatchObject({
    id: personId,
    profileId,
    displayName: "Kept person",
  });
  const focus = createFocus(focusDb);
  const plan = await focus.load(
    profileId,
    "America/New_York",
    Date.UTC(2026, 9, 21, 13),
  );
  expect(plan.suggestions[0]?.task.id).toBe(taskId);
  const state = await focus.snooze(
    profileId,
    taskId,
    null,
    60,
    Date.UTC(2026, 9, 21, 13),
  );
  db.close();
  await db.open();
  expect(await db.focusDeferrals.get(state.id)).toMatchObject({
    profileId,
    taskId,
    snoozedUntilUTC: Date.UTC(2026, 9, 21, 14),
  });
  db.close();
});

it("additively upgrades a realistic v12 workspace through v14, preserves records, and persists Inbox items", async () => {
  const { createInbox } = await import("../../src/application/inbox");
  const { createCalendar } = await import("../../src/application/calendar");
  const { createProductivity } = await import(
    "../../src/application/productivity"
  );
  const { db, inboxDb, calendarDb, productivityDb } = await import(
    "../../src/infrastructure/db"
  );
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const v12Stores = Object.fromEntries(
    db.tables
      .filter(
        (table) =>
          ![
            "inboxItems",
            "weatherProfiles",
            "weatherLocations",
            "weatherForecasts",
            "commutePlans",
            "financeAccounts",
            "financeCategories",
            "financeTransactions",
            "financeBudgets",
            "financeBills",
            "financeBillPayments",
          ].includes(table.name),
      )
      .map((table) => [
        table.name,
        [
          table.schema.primKey.src,
          ...table.schema.indexes.map((index) => index.src),
        ]
          .filter(Boolean)
          .join(", "),
      ]),
  );
  const legacy = new Dexie("Venus-p00");
  legacy.version(12).stores(v12Stores);
  const profileId = "30303030-3030-4030-8030-303030303030";
  const taskId = "31313131-3131-4131-8131-313131313131";
  const noteId = "32323232-3232-4232-8232-323232323232";
  const widgetId = "33333333-3333-4333-8333-333333333333";
  await legacy.table("profiles").put({
    id: profileId,
    title: "Preserved v12",
    preset: "minimal",
    themeMode: null,
    wallpaper: null,
    blurPx: null,
    glassAlpha: null,
    accent: null,
    revision: 7,
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
  });
  await legacy.table("tasks").put({
    id: taskId,
    title: "Keep task",
    details: "existing",
    status: "open",
    column: "todo",
    sortIndex: 0,
    today: false,
    todayOrder: 0,
    labels: [],
    checklist: [],
    priority: 2,
    dueDate: null,
    eventId: null,
    focusRank: null,
    completedAt: null,
    revision: 4,
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
  });
  await legacy.table("notes").put({
    id: noteId,
    title: "Keep note",
    body: { version: 1, content: [] },
    folderId: null,
    tags: [],
    sortIndex: 0,
    pinned: false,
    archived: false,
    trashedAt: null,
    revision: 3,
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
  });
  await legacy.table("widgets").put({
    id: widgetId,
    profileId,
    widgetType: "focus",
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    visible: true,
    settings: {},
    revision: 2,
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
  });
  legacy.close();
  await db.open();
  expect(db.verno).toBe(15);
  expect(db.inboxItems.schema.idxByName.profileId).toBeDefined();
  expect(await db.tasks.get(taskId)).toMatchObject({
    id: taskId,
    revision: 4,
    title: "Keep task",
  });
  expect(await db.notes.get(noteId)).toMatchObject({
    id: noteId,
    revision: 3,
    title: "Keep note",
  });
  expect(await db.widgets.get(widgetId)).toMatchObject({
    id: widgetId,
    profileId,
  });
  const productivity = createProductivity(productivityDb);
  const calendar = createCalendar({
    database: calendarDb,
    alarms: { schedule: async () => {}, clear: async () => {} },
    notifications: {
      permission: async () => "granted" as const,
      show: async () => "accepted" as const,
      clear: async () => {},
    },
  });
  const inbox = createInbox(inboxDb, () => {}, { productivity, calendar });
  const item = await inbox.create(profileId, "Buy milk", "UTC");
  const accepted = await inbox.accept(profileId, item.id, item.revision);
  db.close();
  await db.open();
  expect(await db.inboxItems.get(item.id)).toMatchObject({
    status: "accepted",
    destination: { id: accepted.destination?.id, kind: "task" },
  });
  expect(await db.tasks.get(accepted.destination?.id ?? "")).toMatchObject({
    title: "Buy milk",
  });
  db.close();
});
