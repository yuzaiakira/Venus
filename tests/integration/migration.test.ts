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
    expect(db.verno).toBe(5);
    expect(await db.probes.get(probe.id)).toMatchObject({
      state: "pending",
      dueAt: 5,
    });
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      "assets",
      "bookmarkSnapshots",
      "events",
      "folders",
      "localBookmarks",
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
    expect(db.verno).toBe(5);
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
