export const jsonInstanceBytes = 64 * 1024;
export const packageImageBytes = 1024 * 1024;
export const instancesPerProfile = 20;
export const installedPackages = 50;
export const globalImageBytes = 5 * 1024 * 1024;
export const zipInputBytes = 2 * 1024 * 1024;
export const zipUncompressedBytes = 2 * 1024 * 1024;
export const zipEntryLimit = 32;
export const manifestBytes = 64 * 1024;
export const maxBlocks = 10;
export const maxCompressionRatio = 100;
export const zdpsHostVersion = "1.0.0";
export const pluginDataSchemaVersion = 1 as const;
export const crashQuarantineThreshold = 3;

export function utf8Size(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}
