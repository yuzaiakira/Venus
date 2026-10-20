import { PluginFlowError } from "./errors";
import { packageImageBytes } from "./quotas";

const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const maxEdge = 8192;
const maxPixels = 8_000_000;

export type RasterMime = "image/png" | "image/jpeg" | "image/webp";

export function sniffRaster(bytes: Uint8Array): {
  mime: RasterMime;
  width: number;
  height: number;
} {
  if (bytes.byteLength > packageImageBytes) throw new PluginFlowError("image");
  const pngSize = readPng(bytes);
  const jpegSize = pngSize ? null : readJpeg(bytes);
  const webpSize = pngSize || jpegSize ? null : readWebp(bytes);
  const size = pngSize ?? jpegSize ?? webpSize;
  if (!size) throw new PluginFlowError("image");
  if (
    size.width < 1 ||
    size.height < 1 ||
    size.width > maxEdge ||
    size.height > maxEdge ||
    size.width * size.height > maxPixels
  )
    throw new PluginFlowError("image");
  const mime: RasterMime = pngSize
    ? "image/png"
    : jpegSize
      ? "image/jpeg"
      : "image/webp";
  return { mime, width: size.width, height: size.height };
}

function readPng(bytes: Uint8Array) {
  if (bytes.length < 24 || !png.every((byte, index) => bytes[index] === byte))
    return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(12) !== 0x49484452) return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpeg(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    const startOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (startOfFrame) {
      if (length < 7) return null;
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function u24(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16)
  );
}

function readWebp(bytes: Uint8Array) {
  if (bytes.length < 16) return null;
  const tag = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (tag !== "RIFF" || webp !== "WEBP") return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      width: 1 + u24(bytes, 24),
      height: 1 + u24(bytes, 27),
    };
  }
  if (chunk === "VP8 " && bytes.length >= 30) {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a)
      return null;
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (chunk === "VP8L" && bytes.length >= 25) {
    if (bytes[20] !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}
