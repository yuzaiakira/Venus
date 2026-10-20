import {
  configure,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from "@zip.js/zip.js/index-native.js";
import { defaultsDocument } from "../domain/plugins/blocks";
import {
  PluginFlowError,
  type PluginErrorCode,
} from "../domain/plugins/errors";
import { sniffRaster, type RasterMime } from "../domain/plugins/images";
import {
  manifestFromUnknown,
  parseUntrustedJson,
  type PluginManifest,
} from "../domain/plugins/manifest";
import {
  manifestBytes,
  maxCompressionRatio,
  packageImageBytes,
  zipEntryLimit,
  zipInputBytes,
  zipUncompressedBytes,
} from "../domain/plugins/quotas";
import type { PluginAssetRecord } from "../domain/plugins/records";

configure({ useWebWorkers: false, useCompressionStream: false });

const streamOptions = {
  useWebWorkers: false,
  useCompressionStream: false,
};

const writerOptions = {
  ...streamOptions,
  dataDescriptor: false,
};

const listOptions = {
  ...streamOptions,
  strictness: "strict" as const,
  filenameValidation: "strict" as const,
  checkSignature: true,
};

const dataOptions = {
  ...streamOptions,
  strictness: "strict" as const,
  checkCrc32: true,
  checkOverlappingEntry: true,
  checkSignature: true,
};

export interface ParsedPackage {
  manifest: PluginManifest;
  assets: PluginAssetRecord[];
  defaults: ReturnType<typeof defaultsDocument>;
}

export async function readPluginArchive(
  input: Uint8Array,
): Promise<ParsedPackage> {
  if (input.byteLength > zipInputBytes) throw new PluginFlowError("zip-input");
  let entries;
  const reader = new ZipReader(new Uint8ArrayReader(input), listOptions);
  try {
    try {
      entries = await reader.getEntries(listOptions);
    } catch (error) {
      throw archiveError(error);
    }
    if (entries.length > zipEntryLimit)
      throw new PluginFlowError("zip-entries");
    const seen = new Set<string>();
    let declared = 0;
    const files = new Map<string, Uint8Array>();
    for (const entry of entries) {
      const name = entry.filename;
      if (entry.directory || entry.symlink)
        throw new PluginFlowError("zip-symlink");
      if (entry.encrypted || entry.zipCrypto)
        throw new PluginFlowError("zip-encrypted");
      if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8)
        throw new PluginFlowError("zip-method");
      assertPath(name);
      const key = collisionKey(name);
      if (seen.has(key)) throw new PluginFlowError("zip-duplicate");
      seen.add(key);
      const uncompressed = entry.uncompressedSize;
      const compressed = entry.compressedSize;
      if (
        uncompressed === undefined ||
        compressed === undefined ||
        !Number.isFinite(uncompressed) ||
        !Number.isFinite(compressed)
      )
        throw new PluginFlowError("zip-overlap");
      if (compressed === 0 && uncompressed > 0)
        throw new PluginFlowError("zip-ratio");
      if (compressed > 0 && uncompressed / compressed > maxCompressionRatio)
        throw new PluginFlowError("zip-ratio");
      declared += uncompressed;
      if (declared > zipUncompressedBytes)
        throw new PluginFlowError("zip-uncompressed");
      if (name === "manifest.json" && uncompressed > manifestBytes)
        throw new PluginFlowError("zip-manifest");
      let bytes: Uint8Array;
      try {
        const data = await entry.getData(new Uint8ArrayWriter(), dataOptions);
        if (!ArrayBuffer.isView(data))
          throw new PluginFlowError("zip-structure");
        bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      } catch (error) {
        throw archiveError(error);
      }
      if (bytes.byteLength !== uncompressed)
        throw new PluginFlowError("zip-overlap");
      if (bytes.byteLength > zipUncompressedBytes - (declared - uncompressed))
        throw new PluginFlowError("zip-uncompressed");
      if (looksNested(bytes) && name !== "manifest.json")
        throw new PluginFlowError("zip-nested");
      if (name.endsWith(".wasm") || looksWasm(bytes))
        throw new PluginFlowError("wasm");
      files.set(name, bytes);
    }
    const manifestBytesValue = files.get("manifest.json");
    if (!manifestBytesValue) throw new PluginFlowError("schema");
    if (manifestBytesValue.byteLength > manifestBytes)
      throw new PluginFlowError("zip-manifest");
    const manifest = manifestFromUnknown(decodeUtf8(manifestBytesValue));
    const referenced = new Set<string>();
    const assets: PluginAssetRecord[] = [];
    let imageTotal = 0;
    for (const block of manifest.blocks) {
      if (block.kind === "text-image" && block.assetPath)
        referenced.add(block.assetPath);
    }
    for (const [name, bytes] of files) {
      if (name === "manifest.json" || name === "data/defaults.json") continue;
      if (!referenced.has(name)) throw new PluginFlowError("unknown-asset");
      imageTotal += bytes.byteLength;
      if (imageTotal > packageImageBytes)
        throw new PluginFlowError("quota-package-images");
      const image = sniffRaster(bytes);
      assets.push({ path: name, ...image, bytes });
    }
    for (const path of referenced) {
      if (!assets.some((asset) => asset.path === path))
        throw new PluginFlowError("image");
    }
    const defaultsRaw = files.get("data/defaults.json");
    const defaults = defaultsDocument(
      defaultsRaw ? parseUntrustedJson(decodeUtf8(defaultsRaw)) : undefined,
      manifest,
    );
    return { manifest, assets, defaults };
  } finally {
    await reader.close();
  }
}

export async function writePluginArchive(pkg: {
  manifest: PluginManifest;
  assets: { path: string; bytes: Uint8Array; mime: RasterMime }[];
  defaults: ParsedPackage["defaults"];
}) {
  const writer = new ZipWriter(new Uint8ArrayWriter(), writerOptions);
  await writer.add(
    "manifest.json",
    new Uint8ArrayReader(encodeUtf8(JSON.stringify(pkg.manifest))),
    writerOptions,
  );
  await writer.add(
    "data/defaults.json",
    new Uint8ArrayReader(encodeUtf8(JSON.stringify(pkg.defaults))),
    writerOptions,
  );
  for (const asset of pkg.assets) {
    await writer.add(
      asset.path,
      new Uint8ArrayReader(asset.bytes),
      writerOptions,
    );
  }
  const bytes = await writer.close();
  const output = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  await readPluginArchive(output);
  return output;
}

function assertPath(name: string) {
  if (
    name !== name.normalize("NFC") ||
    name.includes("\\") ||
    name.includes("\0") ||
    name.startsWith("/") ||
    name.startsWith("./") ||
    name.split("/").some((part) => part === ".." || part === "." || part === "")
  )
    throw new PluginFlowError(pathCode(name));
  const allowed =
    name === "manifest.json" ||
    name === "data/defaults.json" ||
    /^assets\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(name);
  if (!allowed) throw new PluginFlowError(pathCode(name));
}

function pathCode(name: string): PluginErrorCode {
  const lower = name.toLowerCase();
  if (/\.(js|mjs|cjs|html|css)$/.test(lower)) return "script";
  if (lower.endsWith(".wasm")) return "wasm";
  if (/\.(zip|zplugin)$/.test(lower)) return "zip-nested";
  return "zip-path";
}

function collisionKey(name: string) {
  return name.normalize("NFC").toLocaleLowerCase();
}

function looksNested(bytes: Uint8Array) {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  );
}

function looksWasm(bytes: Uint8Array) {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x73 &&
    bytes[3] === 0x6d
  );
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new PluginFlowError("schema");
  }
}

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function archiveError(error: unknown) {
  if (error instanceof PluginFlowError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/overlap|ambiguous|crc|signature/i.test(message))
    return new PluginFlowError("zip-overlap");
  if (/encrypt|password/i.test(message))
    return new PluginFlowError("zip-encrypted");
  if (/symlink|directory/i.test(message))
    return new PluginFlowError("zip-symlink");
  return new PluginFlowError("zip-structure");
}
