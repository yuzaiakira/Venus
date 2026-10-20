import {
  checkedInstance,
  emptyInstance,
  type CountdownRemaining,
} from "../domain/plugins/blocks";
import { countdownRemaining } from "../domain/plugins/blocks";
import { PluginFlowError } from "../domain/plugins/errors";
import { assertSafeUrl, compareSemver } from "../domain/plugins/manifest";
import type { PluginManifest } from "../domain/plugins/manifest";
import {
  crashQuarantineThreshold,
  globalImageBytes,
  installedPackages,
  packageImageBytes,
  pluginDataSchemaVersion,
} from "../domain/plugins/quotas";
import {
  instanceKey,
  preferredSpan,
  type PluginInstanceRecord,
  type PluginPackageRecord,
  type SafeModeState,
} from "../domain/plugins/records";
import type { db } from "../infrastructure/db";
import {
  readPluginArchive,
  writePluginArchive,
} from "../infrastructure/zip-archive";

type PluginPreferences = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
};

type PluginDb = Pick<
  typeof db,
  "pluginPackages" | "pluginInstanceData" | "widgets" | "transaction"
>;

const safeModeKey = "venus.plugins.safeMode";
const foreignStores = new Set([
  "notes",
  "folders",
  "tasks",
  "localBookmarks",
  "bookmarkSnapshots",
  "events",
  "reminderRules",
  "notificationOccurrences",
  "timerSessions",
  "probes",
  "profiles",
  "sharedItems",
  "assets",
  "quietHours",
]);

export function createPluginPlatform(
  database: PluginDb,
  preferences: PluginPreferences,
  openUrl: (url: string) => void,
  placeWidget: (
    profileId: string,
    record: PluginInstanceRecord,
    w: number,
    h: number,
  ) => Promise<void>,
) {
  async function requirePackage(id: string) {
    const row = await database.pluginPackages.get(id);
    if (!row) throw new PluginFlowError("not-found");
    if (row.schemaVersion !== pluginDataSchemaVersion)
      throw new PluginFlowError("version");
    return row;
  }

  async function safeMode(): Promise<SafeModeState> {
    const stored = await preferences.get(safeModeKey);
    if (!stored || typeof stored !== "object" || Array.isArray(stored))
      return { enabled: false, exceptions: [] };
    const record = stored as { enabled?: unknown; exceptions?: unknown };
    if (record.enabled !== true) return { enabled: false, exceptions: [] };
    const exceptions = Array.isArray(record.exceptions)
      ? record.exceptions.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
    return { enabled: true, exceptions };
  }

  async function writeSafeMode(state: SafeModeState) {
    await preferences.set(safeModeKey, state);
  }

  return {
    list: () => database.pluginPackages.toArray(),
    safeMode,
    rejectForeign(store: string): never {
      if (foreignStores.has(store) || store.startsWith("plugin:"))
        throw new PluginFlowError("foreign-store");
      throw new PluginFlowError("foreign-store");
    },
    async readSelf(pluginId: string, instanceId: string) {
      const pkg = await requirePackage(pluginId);
      if (!pkg.manifest.requestedCapabilities.includes("selfStorage.readWrite"))
        throw new PluginFlowError("capability");
      const row = await database.pluginInstanceData.get(
        instanceKey(pluginId, instanceId),
      );
      if (!row || row.pluginId !== pluginId)
        throw new PluginFlowError("foreign-store");
      if (row.schemaVersion !== pluginDataSchemaVersion)
        throw new PluginFlowError("version");
      return checkedInstance(pkg.manifest, row.data);
    },
    async writeSelf(pluginId: string, instanceId: string, data: unknown) {
      const pkg = await requirePackage(pluginId);
      if (!pkg.manifest.requestedCapabilities.includes("selfStorage.readWrite"))
        throw new PluginFlowError("capability");
      const checked = checkedInstance(pkg.manifest, data);
      const key = instanceKey(pluginId, instanceId);
      await database.transaction(
        "rw",
        database.pluginInstanceData,
        async () => {
          const current = await database.pluginInstanceData.get(key);
          if (!current || current.pluginId !== pluginId)
            throw new PluginFlowError("foreign-store");
          await database.pluginInstanceData.put({
            ...current,
            data: checked,
            schemaVersion: pluginDataSchemaVersion,
            revision: current.revision + 1,
            updatedAt: new Date().toISOString(),
          });
        },
      );
      return checked;
    },
    readClock(manifest: PluginManifest, now: Date): CountdownRemaining | null {
      const block = manifest.blocks.find((item) => item.kind === "countdown");
      if (!block || block.kind !== "countdown") return null;
      if (!manifest.requestedCapabilities.includes("clock.read"))
        throw new PluginFlowError("capability");
      return countdownRemaining(block.targetIso, now);
    },
    async openLink(pluginId: string, url: string, httpConfirmed: boolean) {
      const pkg = await requirePackage(pluginId);
      if (!pkg.enabled) throw new PluginFlowError("disabled");
      if (pkg.quarantined) throw new PluginFlowError("quarantine");
      if (!pkg.manifest.requestedCapabilities.includes("safeNavigation.open"))
        throw new PluginFlowError("capability");
      const parsed = assertSafeUrl(url);
      const allowed = pkg.manifest.blocks.some(
        (block) =>
          block.kind === "quick-links" &&
          block.links.some(
            (link) => link.url === parsed.toString() || link.url === url,
          ),
      );
      if (!allowed) throw new PluginFlowError("unsafe-url");
      if (parsed.protocol === "http:" && !httpConfirmed)
        throw new PluginFlowError("unsafe-url");
      openUrl(parsed.toString());
    },
    async preview(bytes: Uint8Array) {
      return readPluginArchive(bytes);
    },
    async install(bytes: Uint8Array, origin: "built" | "imported") {
      const parsed = await readPluginArchive(bytes);
      const hash = await sha256(bytes);
      const imageBytes = parsed.assets.reduce(
        (sum, asset) => sum + asset.bytes.byteLength,
        0,
      );
      if (imageBytes > packageImageBytes)
        throw new PluginFlowError("quota-package-images");
      await database.transaction("rw", database.pluginPackages, async () => {
        const existing = await database.pluginPackages.get(parsed.manifest.id);
        const others = (await database.pluginPackages.toArray()).filter(
          (row) => row.id !== parsed.manifest.id,
        );
        if (!existing && others.length >= installedPackages)
          throw new PluginFlowError("quota-packages");
        if (
          existing &&
          compareSemver(parsed.manifest.version, existing.version) <= 0
        )
          throw new PluginFlowError("version");
        const used = others.reduce(
          (sum, row) =>
            sum +
            row.assets.reduce(
              (inner, asset) => inner + asset.bytes.byteLength,
              0,
            ),
          0,
        );
        if (used + imageBytes > globalImageBytes)
          throw new PluginFlowError("quota-global-images");
        const row: PluginPackageRecord = {
          id: parsed.manifest.id,
          enabled: existing?.enabled ?? true,
          installedAt: existing?.installedAt ?? new Date().toISOString(),
          version: parsed.manifest.version,
          specVersion: "1.0",
          manifest: parsed.manifest,
          packageHash: hash,
          assets: parsed.assets,
          defaults: parsed.defaults,
          schemaVersion: pluginDataSchemaVersion,
          quarantined: false,
          crashCount: 0,
          origin,
        };
        await database.pluginPackages.put(row);
      });
    },
    async place(profileId: string, pluginId: string) {
      const pkg = await requirePackage(pluginId);
      if (pkg.quarantined) throw new PluginFlowError("quarantine");
      const mode = await safeMode();
      if (
        mode.enabled &&
        pkg.origin === "imported" &&
        !mode.exceptions.includes(pkg.id)
      )
        throw new PluginFlowError("quarantine");
      const instanceId = crypto.randomUUID();
      const data = emptyInstance(pkg.manifest);
      const span = preferredSpan(pkg.manifest.preferredSize);
      const record: PluginInstanceRecord = {
        id: instanceKey(pluginId, instanceId),
        pluginId,
        instanceId,
        profileId,
        schemaVersion: pluginDataSchemaVersion,
        data,
        revision: 1,
        updatedAt: new Date().toISOString(),
      };
      await placeWidget(profileId, record, span.w, span.h);
    },
    async setEnabled(id: string, enabled: boolean) {
      const pkg = await requirePackage(id);
      if (pkg.quarantined && enabled) throw new PluginFlowError("quarantine");
      await database.pluginPackages.update(id, { enabled });
    },
    async clearQuarantine(id: string) {
      await requirePackage(id);
      await database.pluginPackages.update(id, {
        quarantined: false,
        crashCount: 0,
        enabled: false,
      });
    },
    async uninstall(id: string, keepData: boolean) {
      await database.transaction(
        "rw",
        database.pluginPackages,
        database.pluginInstanceData,
        database.widgets,
        async () => {
          const widgets = await database.widgets.toArray();
          for (const widget of widgets) {
            if (
              widget.widgetType === "plugin" &&
              widget.settings.pluginId === id
            )
              await database.widgets.delete(widget.id);
          }
          if (!keepData) {
            const rows = await database.pluginInstanceData
              .where("pluginId")
              .equals(id)
              .toArray();
            for (const row of rows)
              await database.pluginInstanceData.delete(row.id);
          }
          await database.pluginPackages.delete(id);
        },
      );
    },
    async exportPackage(id: string) {
      const pkg = await requirePackage(id);
      const bytes = await writePluginArchive({
        manifest: pkg.manifest,
        assets: pkg.assets,
        defaults: pkg.defaults,
      });
      return { filename: `${pkg.id}.zplugin`, bytes };
    },
    async enterSafeMode() {
      await writeSafeMode({ enabled: true, exceptions: [] });
    },
    async reenable(id: string) {
      const pkg = await requirePackage(id);
      if (pkg.quarantined) throw new PluginFlowError("quarantine");
      const mode = await safeMode();
      if (!mode.enabled) {
        await database.pluginPackages.update(id, { enabled: true });
        return;
      }
      if (mode.exceptions.includes(id)) return;
      await writeSafeMode({
        enabled: true,
        exceptions: [...mode.exceptions, id],
      });
      await database.pluginPackages.update(id, { enabled: true });
    },
    async recordCrash(id: string) {
      const pkg = await requirePackage(id);
      const crashCount = pkg.crashCount + 1;
      const quarantined = crashCount >= crashQuarantineThreshold;
      await database.pluginPackages.update(id, {
        crashCount,
        quarantined,
        enabled: quarantined ? false : pkg.enabled,
      });
      return { crashCount, quarantined };
    },
    hidden(pkg: PluginPackageRecord, mode: SafeModeState) {
      if (pkg.quarantined || !pkg.enabled) return true;
      return (
        mode.enabled &&
        pkg.origin === "imported" &&
        !mode.exceptions.includes(pkg.id)
      );
    },
  };
}

export type PluginPlatform = ReturnType<typeof createPluginPlatform>;

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
