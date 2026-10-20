import type { RasterMime } from "./images";
import type { PluginManifest } from "./manifest";
import { pluginDataSchemaVersion } from "./quotas";

export interface PluginAssetRecord {
  path: string;
  mime: RasterMime;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface PluginPackageRecord {
  id: string;
  enabled: boolean;
  installedAt: string;
  version: string;
  specVersion: "1.0";
  manifest: PluginManifest;
  packageHash: string;
  assets: PluginAssetRecord[];
  defaults: {
    schemaVersion: typeof pluginDataSchemaVersion;
    blocks: Record<string, unknown>;
  };
  schemaVersion: typeof pluginDataSchemaVersion;
  quarantined: boolean;
  crashCount: number;
  origin: "built" | "imported";
}

export interface PluginInstanceRecord {
  id: string;
  pluginId: string;
  instanceId: string;
  profileId: string;
  schemaVersion: typeof pluginDataSchemaVersion;
  data: PluginPackageRecord["defaults"];
  revision: number;
  updatedAt: string;
}

export interface SafeModeState {
  enabled: boolean;
  exceptions: string[];
}

export function instanceKey(pluginId: string, instanceId: string) {
  return `plugin:${pluginId}:${instanceId}`;
}

export function preferredSpan(size: PluginManifest["preferredSize"]) {
  if (size === "2x2") return { w: 2, h: 2 };
  if (size === "2x1") return { w: 2, h: 1 };
  return { w: 1, h: 1 };
}
