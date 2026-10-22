import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCalendar } from "../../src/application/calendar";
import { calendarDb, db } from "../../src/infrastructure/db";

const alarms = {
  schedule: vi.fn(async () => {}),
  clear: vi.fn(async () => {}),
};
const notifications = {
  permission: vi.fn(async () => "granted" as const),
  show: vi.fn(async () => "accepted" as const),
  clear: vi.fn(async () => {}),
};

describe("P03 scheduler", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    if (db.isOpen()) db.close();
    await Dexie.delete("Venus-p00");
    await db.open();
  });

  it("upgrades a version 3 note without deleting it", async () => {
    db.close();
    await Dexie.delete("Venus-p00");
    const legacy = new Dexie("Venus-p00");
    legacy.version(3).stores({
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
    });
    await legacy.table("notes").put({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Kept note",
      revision: 3,
    });
    legacy.close();
    await db.open();
    expect(db.verno).toBe(14);
    expect(
      await db.notes.get("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ).toMatchObject({
      title: "Kept note",
      revision: 3,
    });
  });

  it("marks a quit-browser reminder missed and does not call native notifications", async () => {
    const calendar = createCalendar({
      database: calendarDb,
      alarms,
      notifications,
      now: () => Date.UTC(2026, 0, 2),
    });
    await calendar.createEvent({
      title: "Orbit",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 1, day: 1 },
      wall: { hour: 9, minute: 0, second: 0 },
      zoneId: "UTC",
      offsetMinutes: [0],
    });
    notifications.show.mockClear();
    await calendar.reconcile(true);
    const rows = await db.notificationOccurrences.toArray();
    expect(rows.some((row) => row.internalStatus === "missed")).toBe(true);
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it("does not start a second native attempt after the first is uncertain", async () => {
    const calendar = createCalendar({
      database: calendarDb,
      alarms,
      notifications,
      now: () => Date.UTC(2026, 0, 1, 9, 0, 1),
    });
    await calendar.createEvent({
      title: "Fold",
      basis: "gregorian",
      allDay: false,
      localDate: { calendar: "gregorian", year: 2026, month: 1, day: 1 },
      wall: { hour: 9, minute: 0, second: 0 },
      zoneId: "UTC",
      offsetMinutes: [0],
    });
    const row = (await db.notificationOccurrences.toArray())[0];
    await db.notificationOccurrences.put({
      ...row!,
      internalStatus: "due",
      nativeAttempt: "started",
      nativeApiStatus: null,
    });
    await calendar.reconcile(false);
    await calendar.reconcile(false);
    expect(notifications.show).not.toHaveBeenCalled();
    expect(
      (await db.notificationOccurrences.toArray())[0]?.nativeApiStatus,
    ).toBe("uncertain");
    expect((await db.notificationOccurrences.toArray())[0]?.osDisplay).toBe(
      "unobserved",
    );
  });
});
