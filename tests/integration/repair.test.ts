import { createCalendar } from "../../src/application/calendar";
import { calendarDb } from "../../src/infrastructure/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createProductivity } from "../../src/application/productivity";
import {
  emptyDocument,
  previewTodayTasks,
  sortedTasks,
  taskColumn,
  type TaskRecord,
} from "../../src/domain/productivity";
import { db, productivityDb } from "../../src/infrastructure/db";

beforeEach(async () => {
  await Promise.all([
    db.notes.clear(),
    db.noteDrafts.clear(),
    db.tasks.clear(),
    db.folders.clear(),
    db.localBookmarks.clear(),
    db.events.clear(),
    db.reminderRules.clear(),
    db.notificationOccurrences.clear(),
    db.timerSessions.clear(),
  ]);
});

describe("repair: persistent authoritative records", () => {
  it("rejects one of two competing note writes atomically", async () => {
    const first = createProductivity(productivityDb),
      second = createProductivity(productivityDb);
    const note = await first.createNote({
      title: "Original",
      body: emptyDocument("private"),
      folderId: null,
    });
    const results = await Promise.allSettled([
      first.saveNote(note.id, note.revision, { title: "First" }),
      second.saveNote(note.id, note.revision, { title: "Second" }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason.code).toBe(
      "conflict",
    );
    expect((await db.notes.get(note.id))?.revision).toBe(2);
  });
  it("persists task CRUD, board movement, checklist and unlimited today without duplicate records", async () => {
    const api = createProductivity(productivityDb);
    const tasks: TaskRecord[] = [];
    for (let index = 0; index < 5; index++) {
      const row = await api.createTask(`Task ${index}`, "details");
      tasks.push(
        await api.saveTask(row.id, row.revision, {
          today: true,
          todayOrder: index,
          labels: ["Work"],
          checklist: [{ id: crypto.randomUUID(), text: "Verify", done: true }],
        }),
      );
    }
    expect(previewTodayTasks((await api.load()).tasks)).toHaveLength(5);
    await api.moveTask(tasks[0]!.id, tasks[0]!.revision, "doing", 0);
    let task = (await api.load()).tasks.find(
      (task) => task.id === tasks[0]!.id,
    )!;
    expect(taskColumn(task)).toBe("doing");
    task = await api.saveTask(task.id, task.revision, { status: "done" });
    expect(taskColumn(task)).toBe("done");
    expect(task.completedAt).toBeTruthy();
    expect(
      previewTodayTasks((await api.load()).tasks).filter(
        (row) => row.status === "done",
      ),
    ).toHaveLength(1);
    task = await api.saveTask(task.id, task.revision, { status: "open" });
    expect(taskColumn(task)).toBe("todo");
    expect(task.completedAt).toBeNull();
    db.close();
    await db.open();
    const reloaded = createProductivity(productivityDb);
    const library = await reloaded.load();
    expect(library.tasks).toHaveLength(5);
    expect(library.tasks.find((row) => row.id === task.id)).toMatchObject({
      details: "details",
      labels: ["Work"],
      checklist: [{ text: "Verify", done: true }],
    });
    await reloaded.deleteTask(task.id, task.revision);
    expect((await reloaded.load()).tasks).toHaveLength(4);
  });
  it("persists intra-column and today's order and rejects stale reorder atomically", async () => {
    const api = createProductivity(productivityDb);
    await api.createTask("A");
    const b = await api.createTask("B");
    await api.moveTask(b.id, b.revision, "todo", 0);
    let tasks = (await api.load()).tasks;
    expect(sortedTasks(tasks).map((task) => task.title)).toEqual(["B", "A"]);
    const selected = [];
    for (const task of tasks)
      selected.push(
        await api.saveTask(task.id, task.revision, { today: true }),
      );
    await api.reorderToday([...selected].reverse());
    tasks = (await api.load()).tasks;
    expect(previewTodayTasks(tasks).map((task) => task.id)).toEqual(
      [...selected].reverse().map((task) => task.id),
    );
    const before = await db.tasks.toArray();
    await expect(api.reorderToday(selected)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(await db.tasks.toArray()).toEqual(before);
  });
  it("keeps Top Three focus distinct and prevents concurrent duplicate ranks", async () => {
    const api = createProductivity(productivityDb);
    const a = await api.createTask("A"),
      b = await api.createTask("B");
    const results = await Promise.allSettled([
      api.saveTask(a.id, a.revision, { focusRank: 1 }),
      api.saveTask(b.id, b.revision, { focusRank: 1 }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (await api.load()).tasks.filter((task) => task.focusRank === 1),
    ).toHaveLength(1);
  });
  it("persists note reorder, archive, restore, pin and folder moves", async () => {
    const api = createProductivity(productivityDb);
    const a = await api.createNote({
      title: "A",
      body: emptyDocument("secret searchable body"),
      folderId: null,
    });
    const b = await api.createNote({
      title: "B",
      body: emptyDocument(),
      folderId: null,
    });
    await api.reorderNotes([b, a]);
    let notes = (await api.load()).notes.sort(
      (a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0),
    );
    expect(notes.map((note) => note.title)).toEqual(["B", "A"]);
    const folder = await api.createFolder("notes", "Folder", null);
    let note = notes[0]!;
    note = await api.saveNote(note.id, note.revision, {
      folderId: folder.id,
      pinned: true,
      archived: true,
    });
    note = await api.saveNote(note.id, note.revision, {
      archived: false,
      trashedAt: new Date().toISOString(),
    });
    note = await api.saveNote(note.id, note.revision, { trashedAt: null });
    expect(await db.notes.get(note.id)).toMatchObject({
      folderId: folder.id,
      pinned: true,
      archived: false,
      trashedAt: null,
    });
    notes = (await api.load()).notes;
    const before = await db.notes.toArray();
    await expect(
      api.reorderNotes([notes.find((row) => row.id === b.id)!, a]),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await db.notes.toArray()).toEqual(before);
  });
  it("does not publish rolled back note writes", async () => {
    const changes: unknown[] = [];
    const api = createProductivity(productivityDb, (change) =>
      changes.push(change),
    );
    const note = await api.createNote({
      title: "A",
      body: emptyDocument(),
      folderId: null,
    });
    changes.length = 0;
    await expect(
      api.saveNote(note.id, note.revision, { folderId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    expect(changes).toEqual([]);
    expect((await db.notes.get(note.id))?.revision).toBe(1);
  });
});

it("retains a conflicting draft across reopening and purges only explicitly trashed notes", async () => {
  const api = createProductivity(productivityDb);
  const note = await api.createNote({
    title: "Original",
    body: emptyDocument("original"),
    folderId: null,
  });
  const draft = {
    id: crypto.randomUUID(),
    noteId: note.id,
    expectedRevision: note.revision,
    title: "Local unsaved",
    body: emptyDocument("recover me"),
    tags: ["draft"],
    updatedAt: new Date().toISOString(),
  };
  await api.saveNoteDraft(draft);
  await api.saveNote(note.id, note.revision, { title: "Other tab" });
  await expect(
    api.saveNote(note.id, note.revision, { title: draft.title }),
  ).rejects.toMatchObject({ code: "conflict" });
  db.close();
  await db.open();
  expect(await api.noteDrafts(note.id)).toEqual([draft]);
  expect((await db.notes.get(note.id))?.title).toBe("Other tab");
  await expect(api.purgeNote(note.id)).rejects.toMatchObject({
    code: "invalidInput",
  });
  const current = (await db.notes.get(note.id))!;
  await api.saveNote(note.id, current.revision, {
    trashedAt: new Date().toISOString(),
  });
  await api.purgeNote(note.id);
  expect(await api.noteDrafts(note.id)).toEqual([]);
});

it("persists bookmark ordering and rejects stale bookmark writes", async () => {
  const api = createProductivity(productivityDb);
  const a = await api.createBookmark({
    title: "A",
    url: "https://example.com/a",
    folderId: null,
    quick: true,
  });
  const b = await api.createBookmark({
    title: "B",
    url: "https://example.com/b",
    folderId: null,
    quick: true,
  });
  await api.reorderBookmarks([b, a]);
  expect(
    (await api.load()).bookmarks
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => row.title),
  ).toEqual(["B", "A"]);
  await expect(
    api.saveBookmark(a.id, a.revision, { title: "Stale" }),
  ).rejects.toMatchObject({ code: "conflict" });
  await expect(api.deleteBookmark(a.id, a.revision)).rejects.toMatchObject({
    code: "conflict",
  });
  expect((await api.load()).bookmarks).toHaveLength(2);
});

function calendarService() {
  return createCalendar({
    database: calendarDb,
    alarms: { schedule: async () => {}, clear: async () => {} },
    notifications: {
      permission: async () => "missing",
      show: async () => "rejected",
      clear: async () => {},
    },
    now: () => Date.UTC(2026, 5, 1, 12),
  });
}
const eventDraft = {
  title: "Future",
  basis: "gregorian" as const,
  allDay: true,
  localDate: { calendar: "gregorian" as const, year: 2026, month: 6, day: 3 },
  zoneId: "UTC",
  offsetMinutes: [0],
};

it("does not leave an orphan event or partial rules after invalid reminder input", async () => {
  const api = calendarService();
  await expect(
    api.createEvent({
      ...eventDraft,
      reminders: [
        { offsetMinutes: 1, absoluteTime: null, quietHoursOverride: false },
        { offsetMinutes: 1, absoluteTime: 1, quietHoursOverride: false },
      ],
    }),
  ).rejects.toMatchObject({ code: "invalidInput" });
  expect((await api.list()).events).toHaveLength(0);
  expect((await api.list()).rules).toHaveLength(0);
});

it("retains future reminders when editing a series and permits disabling recurrence", async () => {
  const api = calendarService();
  let event = await api.createEvent({
    ...eventDraft,
    recurrence: {
      basis: "gregorian",
      freq: "DAILY",
      interval: 1,
      startDate: eventDraft.localDate,
      wall: null,
      timeZone: "UTC",
      count: 3,
      invalidDayPolicy: "skip",
      exclusions: [],
      wkst: 1,
    },
  });
  expect(
    (await api.list()).notifications.filter(
      (row) => row.internalStatus === "pending",
    ),
  ).toHaveLength(3);
  event = await api.saveEvent(event.id, event.revision, { title: "Renamed" });
  expect(
    (await api.list()).notifications.filter(
      (row) => row.internalStatus === "pending",
    ),
  ).toHaveLength(3);
  expect(
    (await api.list()).notifications.every((row) => row.title === "Renamed"),
  ).toBe(true);
  event = await api.saveEvent(event.id, event.revision, {
    recurrenceSpec: null,
  });
  expect(event.recurrenceSpec).toBeNull();
  expect(await api.occurrences(event.id)).toHaveLength(1);
  expect(
    (await api.list()).notifications.filter(
      (row) => row.internalStatus === "pending",
    ),
  ).toHaveLength(1);
});

it("cancels only the skipped occurrence and rejects simultaneous stale event updates", async () => {
  const api = calendarService();
  let event = await api.createEvent({
    ...eventDraft,
    recurrence: {
      basis: "gregorian",
      freq: "DAILY",
      interval: 1,
      startDate: eventDraft.localDate,
      wall: null,
      timeZone: "UTC",
      count: 3,
      invalidDayPolicy: "skip",
      exclusions: [],
      wkst: 1,
    },
  });
  const occurrence = (await api.occurrences(event.id))[1]!;
  event = await api.saveEvent(
    event.id,
    event.revision,
    { exclusions: [occurrence.key] },
    "THIS",
    occurrence.key,
  );
  const schedule = await api.list();
  expect(
    schedule.notifications.filter((row) => row.internalStatus === "cancelled"),
  ).toHaveLength(1);
  expect(
    schedule.notifications.filter((row) => row.internalStatus === "pending"),
  ).toHaveLength(2);
  const results = await Promise.allSettled([
    api.saveEvent(event.id, event.revision, { title: "A" }),
    api.saveEvent(event.id, event.revision, { title: "B" }),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
});

it("allows only one active timer across concurrent services and recovers pause/resume after reopening", async () => {
  const a = calendarService(),
    b = calendarService();
  const results = await Promise.allSettled([
    a.startTimer({ mode: "countdown", durationMs: 60_000 }),
    b.startTimer({ mode: "pomodoro" }),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  const timer = (await a.timer())!;
  await a.pauseTimer(timer.id);
  db.close();
  await db.open();
  expect((await b.timer())?.status).toBe("paused");
  await b.resumeTimer(timer.id);
  expect((await a.timer())?.status).toBe("running");
  await b.resetTimer(timer.id);
  expect(await a.timer()).toBeNull();
});

it("does not revive a notification dismissed while the native API call was in flight", async () => {
  const api = createCalendar({
    database: calendarDb,
    alarms: { schedule: async () => {}, clear: async () => {} },
    notifications: {
      permission: async () => "granted",
      show: async (id) => {
        await db.notificationOccurrences.update(id, {
          internalStatus: "dismissed",
          read: true,
        });
        return "accepted";
      },
      clear: async () => {},
    },
    now: () => Date.UTC(2026, 5, 3, 12),
  });
  await api.createEvent(eventDraft);
  await api.reconcile(false);
  const rows = (await api.list()).notifications;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    internalStatus: "dismissed",
    read: true,
    nativeApiStatus: "accepted",
  });
});

it("searches persisted note bodies through the command palette without enabling offline web search", async () => {
  const { searchPalette } = await import("../../src/domain/commands");
  const api = createProductivity(productivityDb);
  const note = await api.createNote({
    title: "Private title",
    body: emptyDocument("پژوهش كيهان"),
    folderId: null,
  });
  const library = await api.load();
  const results = searchPalette(
    [
      {
        id: "web",
        label: "Search web",
        group: "web",
        available: false,
        profileId: "",
      },
    ],
    library,
    "کیهان",
  );
  expect(results.find((row) => row.id === `open-note:${note.id}`)?.label).toBe(
    "Private title",
  );
  expect(results.find((row) => row.id === "web")).toMatchObject({
    available: false,
  });
});
