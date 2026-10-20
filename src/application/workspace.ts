import { db } from "../infrastructure/db";
import {
  BootstrapSchema,
  defaultBootstrap,
  layoutFor,
  storedFit,
  WallpaperSchema,
  validateAccent,
  validateAsset,
  type AssetRecord,
  type Bootstrap,
  type Placement,
  type Preset,
  type ProfileRecord,
  type SharedItem,
  type SharedKind,
  type Wallpaper,
  type WidgetRecord,
  type WidgetType,
  WorkspaceError,
} from "../domain/dashboard";
import { PluginFlowError } from "../domain/plugins/errors";
import { instancesPerProfile } from "../domain/plugins/quotas";
import {
  instanceKey,
  type PluginInstanceRecord,
} from "../domain/plugins/records";

export interface PreferenceStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  subscribe(listener: () => void): () => void;
}
export interface WorkspaceSnapshot {
  bootstrap: Bootstrap;
  profiles: ProfileRecord[];
  widgets: WidgetRecord[];
  shared: SharedItem[];
}
export interface WorkspaceChange {
  type: "workspace";
  id: string;
  revision: number;
}

const bootstrapKey = "venus.bootstrap";

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

export function createWorkspace(
  preferences: PreferenceStore,
  notify: (change: WorkspaceChange) => void = () => {},
) {
  async function readBootstrap(): Promise<Bootstrap> {
    const stored = await preferences.get(bootstrapKey);
    const parsed = BootstrapSchema.safeParse(stored);
    if (parsed.success) return parsed.data;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const created = defaultBootstrap(zone);
    await preferences.set(bootstrapKey, created);
    return created;
  }
  async function writeBootstrap(next: Bootstrap) {
    const parsed = BootstrapSchema.parse(next);
    new Intl.DateTimeFormat("en", { timeZone: parsed.timeZone }).format(0);
    await preferences.set(bootstrapKey, parsed);
    notify({
      type: "workspace",
      id: "bootstrap",
      revision: parsed.schemaVersion,
    });
    return parsed;
  }
  async function load(): Promise<WorkspaceSnapshot> {
    await ensureWorkspace();
    const bootstrap = await readBootstrap();
    const [profiles, widgets, shared] = await Promise.all([
      db.profiles.toArray(),
      db.widgets.toArray(),
      db.sharedItems.toArray(),
    ]);
    return { bootstrap, profiles, widgets, shared };
  }
  async function ensureWorkspace() {
    // Read and create in the same transaction: two fresh tabs must not seed
    // duplicate default profiles when startup subscriptions run together.
    const created = await db.transaction(
      "rw",
      db.profiles,
      db.widgets,
      async () => {
        if (await db.profiles.count()) return null;
        const profile: ProfileRecord = {
          id: crypto.randomUUID(),
          title: "Minimal",
          preset: "minimal",
          themeMode: null,
          wallpaper: null,
          blurPx: null,
          glassAlpha: null,
          accent: null,
          ...stamp(),
        };
        await db.profiles.add(profile);
        await db.widgets.bulkAdd(
          layoutFor("minimal").map((item) => widgetFrom(profile.id, item)),
        );
        return profile;
      },
    );
    const bootstrap = await readBootstrap();
    if (!(await db.profiles.get(bootstrap.selectedProfileId))) {
      const first = await db.profiles.orderBy("updatedAt").first();
      if (first)
        await writeBootstrap({ ...bootstrap, selectedProfileId: first.id });
    }
    if (created)
      notify({ type: "workspace", id: created.id, revision: created.revision });
  }
  async function createProfile(
    preset: Exclude<Preset, "custom">,
    title: string,
  ) {
    const profile: ProfileRecord = {
      id: crypto.randomUUID(),
      title,
      preset,
      themeMode: null,
      wallpaper: null,
      blurPx: null,
      glassAlpha: null,
      accent: null,
      ...stamp(),
    };
    const widgets = layoutFor(preset).map((item) =>
      widgetFrom(profile.id, item),
    );
    await db.transaction("rw", db.profiles, db.widgets, async () => {
      await db.profiles.add(profile);
      await db.widgets.bulkAdd(widgets);
    });
    notify({ type: "workspace", id: profile.id, revision: profile.revision });
    return profile;
  }
  function widgetFrom(
    profileId: string,
    item: { type: WidgetType; x: number; y: number; w: number; h: number },
  ): WidgetRecord {
    return {
      id: crypto.randomUUID(),
      profileId,
      widgetType: item.type,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      visible: true,
      settings: {},
      ...stamp(),
    };
  }
  async function updateProfile(
    id: string,
    expectedRevision: number,
    patch: Partial<ProfileRecord>,
  ) {
    const next = await db.transaction("rw", db.profiles, async () => {
      const current = await db.profiles.get(id);
      if (!current) throw new WorkspaceError("notFound");
      if (current.revision !== expectedRevision)
        throw new WorkspaceError("conflict");
      const row = bump(current, { ...patch, id: current.id });
      await db.profiles.put(row);
      return row;
    });
    notify({ type: "workspace", id, revision: next.revision });
    return next;
  }
  async function duplicateProfile(id: string) {
    const source = await db.profiles.get(id);
    if (!source) throw new WorkspaceError("notFound");
    const copy: ProfileRecord = {
      ...source,
      id: crypto.randomUUID(),
      title: `${source.title} 2`,
      ...stamp(),
    };
    const clones: WidgetRecord[] = [];
    const dataCopies: PluginInstanceRecord[] = [];
    for (const widget of await db.widgets
      .where("profileId")
      .equals(id)
      .toArray()) {
      const next: WidgetRecord = {
        ...widget,
        id: crypto.randomUUID(),
        profileId: copy.id,
        ...stamp(),
      };
      if (next.widgetType === "plugin") {
        const pluginId = String(next.settings.pluginId ?? "");
        const previous = String(next.settings.instanceId ?? "");
        const instanceId = crypto.randomUUID();
        const source = await db.pluginInstanceData.get(
          instanceKey(pluginId, previous),
        );
        next.settings = { ...next.settings, instanceId };
        if (source) {
          dataCopies.push({
            ...source,
            id: instanceKey(pluginId, instanceId),
            instanceId,
            profileId: copy.id,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      clones.push(next);
    }
    if (
      clones.filter((widget) => widget.widgetType === "plugin").length >
      instancesPerProfile
    )
      throw new PluginFlowError("quota-instances");
    await db.transaction(
      "rw",
      db.profiles,
      db.widgets,
      db.pluginInstanceData,
      async () => {
        await db.profiles.add(copy);
        await db.widgets.bulkAdd(clones);
        if (dataCopies.length > 0)
          await db.pluginInstanceData.bulkAdd(dataCopies);
      },
    );
    notify({ type: "workspace", id: copy.id, revision: copy.revision });
    return copy;
  }
  async function deleteProfile(id: string) {
    const remaining = (await db.profiles.toArray()).filter(
      (profile) => profile.id !== id,
    );
    let fallback = remaining[0];
    await db.transaction("rw", db.profiles, db.widgets, async () => {
      await db.widgets.where("profileId").equals(id).delete();
      await db.profiles.delete(id);
      if (!fallback) {
        fallback = {
          id: crypto.randomUUID(),
          title: "Minimal",
          preset: "minimal",
          themeMode: null,
          wallpaper: null,
          blurPx: null,
          glassAlpha: null,
          accent: null,
          ...stamp(),
        };
        await db.profiles.add(fallback);
        await db.widgets.bulkAdd(
          layoutFor("minimal").map((item) => widgetFrom(fallback!.id, item)),
        );
      }
    });
    if (!fallback) throw new WorkspaceError("storageError");
    const bootstrap = await readBootstrap();
    if (bootstrap.selectedProfileId === id) {
      await writeBootstrap({ ...bootstrap, selectedProfileId: fallback.id });
    }
    notify({ type: "workspace", id: fallback.id, revision: fallback.revision });
    return fallback;
  }
  async function switchProfile(id: string) {
    const profile = await db.profiles.get(id);
    if (!profile) throw new WorkspaceError("notFound");
    const bootstrap = await readBootstrap();
    return writeBootstrap({ ...bootstrap, selectedProfileId: id });
  }
  async function savePlacements(profileId: string, placements: Placement[]) {
    if (!storedFit(placements)) throw new WorkspaceError("invalidInput");
    const rows = await db.widgets
      .where("profileId")
      .equals(profileId)
      .toArray();
    const byId = new Map(placements.map((item) => [item.id, item]));
    await db.transaction("rw", db.widgets, async () => {
      for (const row of rows) {
        const next = byId.get(row.id);
        if (!next) continue;
        await db.widgets.put(
          bump(row, { x: next.x, y: next.y, w: next.w, h: next.h }),
        );
      }
    });
    notify({ type: "workspace", id: profileId, revision: Date.now() });
  }
  async function addWidget(profileId: string, type: WidgetType) {
    const row = widgetFrom(profileId, { type, x: 0, y: 40, w: 1, h: 1 });
    const existing = await db.widgets
      .where("profileId")
      .equals(profileId)
      .toArray();
    const spot = firstFree(existing, row.w, row.h);
    row.x = spot.x;
    row.y = spot.y;
    await db.widgets.add(row);
    notify({ type: "workspace", id: row.id, revision: row.revision });
    return row;
  }
  async function addPluginWidget(
    profileId: string,
    record: PluginInstanceRecord,
    w: number,
    h: number,
  ) {
    await db.transaction("rw", db.widgets, db.pluginInstanceData, async () => {
      const existing = await db.widgets
        .where("profileId")
        .equals(profileId)
        .toArray();
      if (
        existing.filter((widget) => widget.widgetType === "plugin").length >=
        instancesPerProfile
      )
        throw new PluginFlowError("quota-instances");
      const row = widgetFrom(profileId, {
        type: "clock",
        x: 0,
        y: 40,
        w,
        h,
      });
      row.widgetType = "plugin";
      row.settings = {
        pluginId: record.pluginId,
        instanceId: record.instanceId,
      };
      const spot = firstFree(existing, w, h);
      row.x = spot.x;
      row.y = spot.y;
      const placements = [
        ...existing.map((item) => ({
          id: item.id,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        })),
        { id: row.id, x: row.x, y: row.y, w: row.w, h: row.h },
      ];
      if (!storedFit(placements)) throw new WorkspaceError("invalidInput");
      await db.pluginInstanceData.add(record);
      await db.widgets.add(row);
    });
  }
  async function setWidget(
    id: string,
    expectedRevision: number,
    patch: Partial<WidgetRecord>,
  ) {
    const next = await db.transaction("rw", db.widgets, async () => {
      const current = await db.widgets.get(id);
      if (!current) throw new WorkspaceError("notFound");
      if (current.revision !== expectedRevision)
        throw new WorkspaceError("conflict");
      const row = bump(current, patch);
      await db.widgets.put(row);
      return row;
    });
    notify({ type: "workspace", id, revision: next.revision });
    return next;
  }
  async function removeWidget(id: string) {
    await db.widgets.delete(id);
    notify({ type: "workspace", id, revision: 0 });
  }
  async function resetLayout(
    profileId: string,
    preset: Exclude<Preset, "custom">,
  ) {
    await db.transaction("rw", db.profiles, db.widgets, async () => {
      const profile = await db.profiles.get(profileId);
      if (!profile) throw new WorkspaceError("notFound");
      await db.widgets.where("profileId").equals(profileId).delete();
      await db.widgets.bulkAdd(
        layoutFor(preset).map((item) => widgetFrom(profileId, item)),
      );
      await db.profiles.put(bump(profile, { preset }));
    });
    notify({ type: "workspace", id: profileId, revision: Date.now() });
  }
  async function addShared(kind: SharedKind, title: string) {
    const row: SharedItem = {
      id: crypto.randomUUID(),
      kind,
      title,
      revision: 1,
    };
    await db.sharedItems.add(row);
    notify({ type: "workspace", id: row.id, revision: row.revision });
    return row;
  }
  async function saveAsset(input: Omit<AssetRecord, "id" | "sha256">) {
    const checked = validateAsset(input);
    const digest = await crypto.subtle.digest("SHA-256", input.bytes);
    const sha256 = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const row: AssetRecord = {
      id: crypto.randomUUID(),
      sha256,
      ...checked,
      bytes: input.bytes,
    };
    await db.assets.add(row);
    notify({ type: "workspace", id: row.id, revision: 1 });
    return row;
  }
  async function readAsset(id: string) {
    return db.assets.get(id);
  }
  async function patchProfileAppearance(
    id: string,
    patch: Partial<
      Pick<
        ProfileRecord,
        "themeMode" | "wallpaper" | "blurPx" | "glassAlpha" | "accent"
      >
    >,
    theme: "light" | "dark",
  ) {
    const nextPatch = { ...patch };
    if (typeof nextPatch.accent === "string")
      nextPatch.accent = validateAccent(nextPatch.accent, theme);
    if (
      nextPatch.blurPx != null &&
      (!Number.isInteger(nextPatch.blurPx) ||
        nextPatch.blurPx < 0 ||
        nextPatch.blurPx > 16)
    )
      throw new WorkspaceError("invalidInput");
    if (
      nextPatch.glassAlpha != null &&
      (nextPatch.glassAlpha < 0.65 || nextPatch.glassAlpha > 0.95)
    )
      throw new WorkspaceError("invalidInput");
    if (nextPatch.wallpaper) WallpaperSchema.parse(nextPatch.wallpaper);
    const next = await db.transaction("rw", db.profiles, async () => {
      const current = await db.profiles.get(id);
      if (!current) throw new WorkspaceError("notFound");
      const row = bump(current, nextPatch);
      await db.profiles.put(row);
      return row;
    });
    notify({ type: "workspace", id, revision: next.revision });
    return next;
  }
  async function clearProfileAppearance(id: string) {
    return patchProfileAppearance(
      id,
      {
        themeMode: null,
        wallpaper: null,
        blurPx: null,
        glassAlpha: null,
        accent: null,
      },
      "light",
    );
  }
  async function updateAppearance(
    patch: Partial<
      Pick<
        Bootstrap,
        | "themeMode"
        | "blurPx"
        | "glassAlpha"
        | "accent"
        | "wallpaper"
        | "motion"
        | "density"
        | "fontScale"
      >
    >,
    theme: "light" | "dark",
  ) {
    const current = await readBootstrap();
    const next = { ...current, ...patch };
    if (patch.accent) next.accent = validateAccent(patch.accent, theme);
    return writeBootstrap(next);
  }
  let preferenceWrite: Promise<unknown> = Promise.resolve();
  async function updatePreferences(patch: Partial<Bootstrap>) {
    const run = async () => {
      const current = await readBootstrap();
      return writeBootstrap({ ...current, ...patch, schemaVersion: 2 });
    };
    const next = preferenceWrite.then(run, run);
    preferenceWrite = next;
    return next;
  }
  return {
    load,
    ensureWorkspace,
    readBootstrap,
    writeBootstrap,
    createProfile,
    updateProfile,
    duplicateProfile,
    deleteProfile,
    switchProfile,
    savePlacements,
    addWidget,
    addPluginWidget,
    setWidget,
    removeWidget,
    resetLayout,
    addShared,
    saveAsset,
    readAsset,
    updateAppearance,
    patchProfileAppearance,
    clearProfileAppearance,
    updatePreferences,
    subscribe: preferences.subscribe,
  };
}

function firstFree(existing: WidgetRecord[], w: number, h: number) {
  const occupied = new Set<string>();
  for (const item of existing) {
    for (let y = item.y; y < item.y + item.h; y += 1) {
      for (let x = item.x; x < item.x + item.w; x += 1)
        occupied.add(`${x}:${y}`);
    }
  }
  for (let y = 0; y < 40; y += 1) {
    for (let x = 0; x <= 4 - w; x += 1) {
      let free = true;
      for (let yy = y; yy < y + h && free; yy += 1) {
        for (let xx = x; xx < x + w; xx += 1) {
          if (occupied.has(`${xx}:${yy}`)) free = false;
        }
      }
      if (free) return { x, y };
    }
  }
  return { x: 0, y: existing.length + 4 };
}

export type Workspace = ReturnType<typeof createWorkspace>;

export function memoryPreferences(
  initial: Record<string, unknown> = {},
): PreferenceStore {
  const data = { ...initial };
  const listeners = new Set<() => void>();
  return {
    async get(key) {
      return data[key];
    },
    async set(key, value) {
      data[key] = value;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function appearanceOf(
  snapshot: WorkspaceSnapshot,
  profile: ProfileRecord | undefined,
) {
  const bootstrap = snapshot.bootstrap;
  return {
    themeMode: profile?.themeMode ?? bootstrap.themeMode,
    wallpaper: profile?.wallpaper ?? bootstrap.wallpaper,
    blurPx: profile?.blurPx ?? bootstrap.blurPx,
    glassAlpha: profile?.glassAlpha ?? bootstrap.glassAlpha,
    accent: profile?.accent ?? bootstrap.accent,
  };
}

export function moduleEnabled(
  bootstrap: Bootstrap,
  type: WidgetRecord["widgetType"],
) {
  if (type === "fault" || type === "plugin") return true;
  return bootstrap.modules[type];
}

export type { Wallpaper };
