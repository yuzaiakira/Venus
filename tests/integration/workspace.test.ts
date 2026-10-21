import { beforeEach, describe, expect, it } from "vitest";
import {
  appearanceOf,
  createWorkspace,
  memoryPreferences,
} from "../../src/application/workspace";
import { defaultBootstrap } from "../../src/domain/dashboard";
import { db, saveProbe } from "../../src/infrastructure/db";

const probe = {
  id: "f535d2b1-f815-41d9-9e61-2d2518ce30b8",
  dueAt: 1000,
  state: "pending" as const,
  native: "not_attempted" as const,
};

beforeEach(async () => {
  await db.probes.clear();
  await db.profiles.clear();
  await db.widgets.clear();
  await db.sharedItems.clear();
  await db.assets.clear();
  await db.notes.clear();
  await db.folders.clear();
  await db.tasks.clear();
  await db.localBookmarks.clear();
  await db.bookmarkSnapshots.clear();
});

describe("P01 workspace persistence", () => {
  it("keeps schema 1 probes while profiles isolate layouts and share fixtures", async () => {
    await saveProbe(probe);
    const workspace = createWorkspace(memoryPreferences());
    const first = await workspace.load();
    expect(await db.probes.get(probe.id)).toMatchObject({ state: "pending" });
    const second = await workspace.createProfile("personal", "Personal");
    const third = await workspace.createProfile("productivity", "Productivity");
    await workspace.addShared("note", "Shared note");
    await workspace.switchProfile(second.id);
    const switched = await workspace.load();
    expect(switched.bootstrap.selectedProfileId).toBe(second.id);
    expect(switched.shared.map((item) => item.title)).toEqual(["Shared note"]);
    expect(
      switched.widgets.filter(
        (item) => item.profileId === first.profiles[0]?.id,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      switched.widgets
        .filter((item) => item.profileId === third.id)
        .map((item) => item.widgetType),
    ).toContain("today");
    expect(
      switched.widgets
        .filter((item) => item.profileId === second.id)
        .map((item) => item.widgetType),
    ).not.toContain("today");
    const removed = await workspace.deleteProfile(second.id);
    const after = await workspace.load();
    expect(after.bootstrap.selectedProfileId).toBe(removed.id);
    expect(after.shared).toHaveLength(1);
    expect(await db.probes.count()).toBe(1);
  });
  it("keeps appearance on each profile and inherits null fields from bootstrap", async () => {
    const workspace = createWorkspace(memoryPreferences());
    const first = await workspace.load();
    const alpha = first.profiles[0];
    expect(alpha).toBeTruthy();
    if (!alpha) return;
    await workspace.patchProfileAppearance(
      alpha.id,
      {
        themeMode: "dark",
        wallpaper: { kind: "scene", sceneId: "nebula" },
        blurPx: 4,
        glassAlpha: 0.72,
      },
      "dark",
    );
    const beta = await workspace.createProfile("personal", "Beta");
    expect(beta.themeMode).toBeNull();
    expect(beta.wallpaper).toBeNull();
    const created = await workspace.load();
    const betaRow = created.profiles.find((item) => item.id === beta.id);
    expect(appearanceOf(created, betaRow).themeMode).toBe(
      created.bootstrap.themeMode,
    );
    expect(appearanceOf(created, betaRow).wallpaper).toEqual(
      created.bootstrap.wallpaper,
    );
    const copy = await workspace.duplicateProfile(alpha.id);
    expect(copy.themeMode).toBe("dark");
    expect(copy.wallpaper).toEqual({ kind: "scene", sceneId: "nebula" });
    await workspace.clearProfileAppearance(alpha.id);
    const cleared = await workspace.load();
    const alphaRow = cleared.profiles.find((item) => item.id === alpha.id);
    expect(alphaRow?.themeMode).toBeNull();
    expect(alphaRow?.blurPx).toBeNull();
    expect(appearanceOf(cleared, alphaRow).themeMode).toBe(
      cleared.bootstrap.themeMode,
    );
    const copyRow = cleared.profiles.find((item) => item.id === copy.id);
    expect(copyRow?.themeMode).toBe("dark");
    const selectedBefore = cleared.bootstrap.selectedProfileId;
    await workspace.deleteProfile(beta.id);
    const after = await workspace.load();
    expect(after.profiles.some((item) => item.id === beta.id)).toBe(false);
    expect(after.profiles.some((item) => item.id === copy.id)).toBe(true);
    expect(after.profiles.some((item) => item.id === selectedBefore)).toBe(
      true,
    );
    expect(after.bootstrap.selectedProfileId).toBe(selectedBefore);
    expect(await db.probes.count()).toBe(0);
  });
  it("rejects a stale profile revision and an overlapping placement", async () => {
    const workspace = createWorkspace(memoryPreferences());
    const snapshot = await workspace.load();
    const profile = snapshot.profiles[0];
    expect(profile).toBeTruthy();
    if (!profile) return;
    await workspace.updateProfile(profile.id, profile.revision, {
      title: "Renamed",
    });
    await expect(
      workspace.updateProfile(profile.id, profile.revision, { title: "Stale" }),
    ).rejects.toThrow("conflict");
    const widgets = snapshot.widgets.filter(
      (item) => item.profileId === profile.id,
    );
    const [a, b] = widgets;
    if (!a || !b) throw new Error("expected widgets");
    await expect(
      workspace.savePlacements(profile.id, [
        { id: a.id, x: 0, y: 0, w: 2, h: 2 },
        { id: b.id, x: 0, y: 0, w: 2, h: 1 },
      ]),
    ).rejects.toThrow("invalidInput");
  });
});

it("seeds one default profile across concurrent fresh workspace loads", async () => {
  const preferences = memoryPreferences();
  const first = createWorkspace(preferences),
    second = createWorkspace(preferences);
  const snapshots = await Promise.all([
    first.load(),
    second.load(),
    first.load(),
  ]);
  expect(await db.profiles.count()).toBe(1);
  expect(await db.widgets.count()).toBe(2);
  expect(
    new Set(snapshots.map((snapshot) => snapshot.bootstrap.selectedProfileId))
      .size,
  ).toBe(1);
  await expect(
    first.updatePreferences({ timeZone: "Not/A_Timezone" }),
  ).rejects.toThrow();
  expect((await first.load()).bootstrap.timeZone).not.toBe("Not/A_Timezone");
});

it("migrates v2 preferences and keeps assistant widgets singleton per profile", async () => {
  const current = defaultBootstrap("UTC");
  const legacy = {
    ...current,
    schemaVersion: 3,
    modules: Object.fromEntries(
      Object.entries(current.modules).filter(([key]) => key !== "briefing"),
    ),
  };
  const workspace = createWorkspace(
    memoryPreferences({ "venus.bootstrap": legacy }),
  );
  const first = await workspace.load();
  expect(first.bootstrap.schemaVersion).toBe(7);
  expect(first.bootstrap.modules.briefing).toBe(true);
  expect(first.bootstrap.modules.goals).toBe(true);
  expect(first.bootstrap.modules.reviews).toBe(true);
  const profile = first.profiles[0];
  if (!profile) throw new Error("missing profile");
  const one = await workspace.addWidget(profile.id, "briefing");
  const two = await workspace.addWidget(profile.id, "briefing");
  expect(two.id).toBe(one.id);
  expect(
    (await workspace.load()).widgets.filter(
      (widget) =>
        widget.profileId === profile.id && widget.widgetType === "briefing",
    ),
  ).toHaveLength(1);
});
