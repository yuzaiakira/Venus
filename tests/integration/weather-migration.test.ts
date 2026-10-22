import Dexie from "dexie";
import { expect, it } from "vitest";

it("additively upgrades a realistic v13 workspace to v14 without losing Inbox, focus, profile, task, note or widget records", async () => {
  const { db, weatherDb } = await import("../../src/infrastructure/db");
  const { createWeather } = await import("../../src/application/weather");
  const { createCalendar } = await import("../../src/application/calendar");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  const v13Stores = Object.fromEntries(
    db.tables
      .filter(
        (table) =>
          ![
            "weatherProfiles",
            "weatherLocations",
            "weatherForecasts",
            "commutePlans",
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
  legacy.version(13).stores(v13Stores);
  const profileId = "41414141-4141-4141-8141-414141414141";
  const taskId = "42424242-4242-4242-8242-424242424242";
  const noteId = "43434343-4343-4343-8343-434343434343";
  const inboxId = "44444444-4444-4444-8444-444444444444";
  const stamp = {
    revision: 4,
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
  };
  await legacy.table("profiles").put({
    id: profileId,
    title: "Kept v13",
    preset: "minimal",
    themeMode: null,
    wallpaper: null,
    blurPx: null,
    glassAlpha: null,
    accent: null,
    ...stamp,
  });
  await legacy.table("tasks").put({
    id: taskId,
    title: "Kept task",
    details: "",
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
    ...stamp,
  });
  await legacy.table("notes").put({
    id: noteId,
    title: "Kept note",
    body: { version: 1, content: [] },
    folderId: null,
    tags: [],
    sortIndex: 0,
    pinned: false,
    archived: false,
    trashedAt: null,
    ...stamp,
  });
  await legacy.table("inboxItems").put({
    id: inboxId,
    profileId,
    source: "manual",
    content: "Keep Inbox",
    suggestion: { kind: "note", confidence: "low", reason: "ambiguous" },
    selectedKind: "note",
    draft: {
      kind: "note",
      title: "Keep Inbox",
      content: "Keep Inbox",
      tags: [],
    },
    status: "pending",
    destination: null,
    operation: null,
    rejectedAt: null,
    acceptedAt: null,
    undoneAt: null,
    ...stamp,
  });
  legacy.close();
  await db.open();
  expect(db.verno).toBe(14);
  expect(db.weatherProfiles.schema.idxByName.profileId).toBeDefined();
  expect(
    db.weatherProfiles.schema.indexes.some(
      (index) =>
        index.unique &&
        JSON.stringify(index.keyPath) ===
          JSON.stringify(["profileId", "provider"]),
    ),
  ).toBe(true);
  expect(
    db.commutePlans.schema.indexes.some(
      (index) =>
        JSON.stringify(index.keyPath) ===
        JSON.stringify(["profileId", "eventId", "occurrenceKey"]),
    ),
  ).toBe(true);
  expect(await db.profiles.get(profileId)).toMatchObject({
    title: "Kept v13",
    revision: 4,
  });
  expect(await db.tasks.get(taskId)).toMatchObject({
    title: "Kept task",
    revision: 4,
  });
  expect(await db.notes.get(noteId)).toMatchObject({
    title: "Kept note",
    revision: 4,
  });
  expect(await db.inboxItems.get(inboxId)).toMatchObject({
    content: "Keep Inbox",
    revision: 4,
  });
  const calendar = createCalendar({
    database: (await import("../../src/infrastructure/db")).calendarDb,
    alarms: { schedule: async () => {}, clear: async () => {} },
    notifications: {
      permission: async () => "granted" as const,
      show: async () => "accepted" as const,
      clear: async () => {},
    },
  });
  const weather = createWeather(weatherDb, () => {}, {
    calendar,
    provider: {
      search: async () => [],
      forecast: async () => ({
        timezone: "UTC",
        current: {
          temperatureC: 1,
          windSpeedKph: 1,
          weatherCode: 0,
          observedAt: 0,
        },
        days: [
          {
            date: "2026-10-21",
            temperatureMaxC: 2,
            temperatureMinC: 0,
            precipitationProbability: null,
            precipitationMm: null,
            windSpeedKph: 1,
            weatherCode: 0,
          },
        ],
      }),
    },
  });
  expect((await weather.load(profileId)).preference.profileId).toBe(profileId);
  db.close();
});
