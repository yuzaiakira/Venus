import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import Dexie from "dexie";
import { createPluginPlatform } from "../../src/application/plugins";
import { createWorkspace } from "../../src/application/workspace";
import { PluginBlocks } from "../../src/app/plugin-blocks";
import { calculate, countdownRemaining } from "../../src/domain/plugins/blocks";
import { PluginFlowError } from "../../src/domain/plugins/errors";
import { sniffRaster } from "../../src/domain/plugins/images";
import {
  manifestFromUnknown,
  parseUntrustedJson,
} from "../../src/domain/plugins/manifest";
import {
  templateKinds,
  templateManifest,
} from "../../src/domain/plugins/templates";
import {
  readPluginArchive,
  writePluginArchive,
} from "../../src/infrastructure/zip-archive";

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function memoryPreferences() {
  const values = new Map<string, unknown>();
  return {
    async get(key: string) {
      return values.get(key);
    },
    async set(key: string, value: unknown) {
      values.set(key, value);
    },
    subscribe() {
      return () => undefined;
    },
  };
}

function makeZip(
  entries: {
    name: string;
    data: Buffer;
    method?: number;
    flag?: number;
    uncompressedSize?: number;
    compressed?: Buffer;
    externalAttributes?: number;
    versionMadeBy?: number;
    offset?: number;
  }[],
) {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let cursor = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const payload = entry.compressed ?? entry.data;
    const checksum = crc32(entry.data) >>> 0;
    const method = entry.method ?? 0;
    const flag = entry.flag ?? 0;
    const uncompressed = entry.uncompressedSize ?? entry.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flag, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(uncompressed, 22);
    local.writeUInt16LE(name.length, 26);
    const localOffset = entry.offset ?? cursor;
    locals.push(local, name, payload);
    cursor += local.length + name.length + payload.length;
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(entry.versionMadeBy ?? 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flag, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(uncompressed, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(entry.externalAttributes ?? 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centrals.push(central, name);
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(cursor, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

async function harness() {
  const preferences = memoryPreferences();
  const { db } = await import("../../src/infrastructure/db");
  if (db.isOpen()) db.close();
  await Dexie.delete("Venus-p00");
  await db.open();
  const workspace = createWorkspace(preferences, () => undefined);
  await workspace.ensureWorkspace();
  const snapshot = await workspace.load();
  const platform = createPluginPlatform(
    db,
    preferences,
    () => undefined,
    (profileId, record, w, h) =>
      workspace.addPluginWidget(profileId, record, w, h),
  );
  return {
    db,
    platform,
    profileId: snapshot.bootstrap.selectedProfileId,
  };
}

describe("P04 declarative plugins", () => {
  beforeEach(async () => {
    const { db } = await import("../../src/infrastructure/db");
    if (db.isOpen()) db.close();
    await Dexie.delete("Venus-p00");
  });

  it("validates the seven templates and rejects hostile manifests", () => {
    for (const kind of templateKinds) {
      expect(
        manifestFromUnknown(JSON.stringify(templateManifest(kind))).id,
      ).toContain("local.");
    }
    expect(() =>
      manifestFromUnknown(
        JSON.stringify({ ...templateManifest("counter"), extra: true }),
      ),
    ).toThrow(PluginFlowError);
    expect(() =>
      manifestFromUnknown(
        JSON.stringify({
          ...templateManifest("counter"),
          codecURI: "https://example.invalid/codec.js",
        }),
      ),
    ).toThrow(PluginFlowError);
    expect(() =>
      manifestFromUnknown(
        JSON.stringify({
          ...templateManifest("counter"),
          blocks: [
            {
              ...templateManifest("counter").blocks[0],
              codecURI: "./codec.js",
            },
          ],
        }),
      ),
    ).toThrow(PluginFlowError);
    expect(() => parseUntrustedJson('{"__proto__":{"polluted":true}}')).toThrow(
      PluginFlowError,
    );
    expect(() =>
      manifestFromUnknown(
        JSON.stringify({
          ...templateManifest("counter"),
          requestedCapabilities: ["notes.read"],
        }),
      ),
    ).toThrow(PluginFlowError);
    expect(() =>
      manifestFromUnknown(
        JSON.stringify({
          ...templateManifest("quick-links"),
          blocks: [
            {
              ...templateManifest("quick-links").blocks[0],
              links: [
                { label: { en: "Bad", fa: "بد" }, url: "javascript:alert(1)" },
              ],
            },
          ],
        }),
      ),
    ).toThrow(PluginFlowError);
    const duplicate = templateManifest("counter");
    duplicate.blocks = [
      duplicate.blocks[0]!,
      { ...duplicate.blocks[0]!, id: duplicate.blocks[0]!.id },
    ];
    expect(() => manifestFromUnknown(JSON.stringify(duplicate))).toThrow(
      PluginFlowError,
    );
    expect(sniffRaster(png).mime).toBe("image/png");
    expect(() => sniffRaster(Uint8Array.from([1, 2, 3, 4]))).toThrow(
      PluginFlowError,
    );
  });

  it("calculates two operands and reads only the injected clock", () => {
    expect(calculate(4, 0, "divide")).toEqual({ kind: "divide-by-zero" });
    expect(calculate(2, 3, "add").value).toBe(5);
    const start = new Date("2026-10-12T00:00:00.000Z");
    const first = countdownRemaining("2026-10-12T01:00:00.000Z", start);
    const later = countdownRemaining(
      "2026-10-12T01:00:00.000Z",
      new Date(start.getTime() + 10_000),
    );
    expect(later.totalSeconds).toBe(first.totalSeconds - 10);
  });

  it("renders plugin text without executing markup", () => {
    const manifest = templateManifest("text-image");
    const block = manifest.blocks[0];
    if (block?.kind !== "text-image") throw new Error("template");
    block.text = { en: '<img src=x onerror="alert(1)">', fa: "متن" };
    const html = renderToStaticMarkup(
      createElement(PluginBlocks, {
        manifest,
        data: { blocks: { text: {} } },
        assets: [],
        locale: "en",
        now: new Date(),
        disabled: true,
        onChange: () => undefined,
        onOpen: () => undefined,
      }),
    );
    expect(html).toContain("&lt;img");
    expect(html.includes("<img")).toBe(false);
  });

  it("round-trips a package without live instance data and rolls back a bad import", async () => {
    const { db, platform, profileId } = await harness();
    const manifest = templateManifest("counter", "local.counter");
    const bytes = await writePluginArchive({
      manifest,
      assets: [],
      defaults: {
        schemaVersion: 1,
        blocks: { count: { value: 0 } },
      },
    });
    await platform.install(bytes, "imported");
    await platform.place(profileId, manifest.id);
    const placed = await db.pluginInstanceData.toArray();
    const instanceId = placed[0]?.instanceId;
    if (!instanceId) throw new Error("missing instance");
    await platform.writeSelf(manifest.id, instanceId, {
      schemaVersion: 1,
      blocks: { count: { value: 7 } },
    });
    const exported = await platform.exportPackage(manifest.id);
    const parsed = await readPluginArchive(exported.bytes);
    expect(parsed.defaults.blocks.count).toEqual({ value: 0 });
    expect(JSON.stringify(parsed)).not.toContain('"value":7');
    const before = await db.pluginPackages.toArray();
    await expect(
      platform.install(
        makeZip([
          {
            name: "../manifest.json",
            data: Buffer.from("{"),
          },
        ]),
        "imported",
      ),
    ).rejects.toBeInstanceOf(PluginFlowError);
    expect(await db.pluginPackages.toArray()).toEqual(before);
    const bomb = deflateRawSync(Buffer.alloc(3 * 1024 * 1024));
    await expect(
      platform.install(
        makeZip([
          {
            name: "manifest.json",
            data: Buffer.alloc(3 * 1024 * 1024),
            compressed: bomb,
            method: 8,
            uncompressedSize: 3 * 1024 * 1024,
          },
        ]),
        "imported",
      ),
    ).rejects.toBeInstanceOf(PluginFlowError);
    expect(await db.pluginPackages.count()).toBe(1);
    await expect(
      platform.writeSelf(manifest.id, instanceId, {
        schemaVersion: 1,
        blocks: { count: { value: 1 }, blob: "x".repeat(70_000) },
      }),
    ).rejects.toMatchObject({ code: "quota-json" });
    expect(
      (await platform.readSelf(manifest.id, instanceId)).blocks.count,
    ).toEqual({ value: 7 });
  });

  it("rejects the hostile archive catalogue", async () => {
    const cases: Array<[string, Uint8Array]> = [
      [
        "traversal",
        makeZip([{ name: "../manifest.json", data: Buffer.from("{}") }]),
      ],
      [
        "absolute",
        makeZip([{ name: "/manifest.json", data: Buffer.from("{}") }]),
      ],
      [
        "duplicate",
        makeZip([
          { name: "manifest.json", data: Buffer.from("{}") },
          { name: "Manifest.json", data: Buffer.from("{}") },
        ]),
      ],
      [
        "entries",
        makeZip(
          Array.from({ length: 33 }, (_, index) => ({
            name: `file-${index}.txt`,
            data: Buffer.from("x"),
          })),
        ),
      ],
      [
        "encrypted",
        makeZip([{ name: "manifest.json", data: Buffer.from("{}"), flag: 1 }]),
      ],
      [
        "method",
        makeZip([
          { name: "manifest.json", data: Buffer.from("{}"), method: 99 },
        ]),
      ],
      [
        "symlink",
        makeZip([
          {
            name: "manifest.json",
            data: Buffer.from("target"),
            versionMadeBy: (3 << 8) | 20,
            externalAttributes: (0o120777 << 16) >>> 0,
          },
        ]),
      ],
      [
        "codec-uri",
        makeZip([{ name: "codec.js", data: Buffer.from("export default 1") }]),
      ],
      [
        "script",
        makeZip([{ name: "plugin.js", data: Buffer.from("alert(1)") }]),
      ],
      [
        "wasm",
        makeZip([
          {
            name: "plugin.wasm",
            data: Buffer.from([0x00, 0x61, 0x73, 0x6d]),
          },
        ]),
      ],
      [
        "overlap",
        makeZip([
          { name: "manifest.json", data: Buffer.from("{}") },
          { name: "data/defaults.json", data: Buffer.from("{}"), offset: 0 },
        ]),
      ],
      ["oversized", new Uint8Array(2 * 1024 * 1024 + 1)],
    ];
    for (const [name, bytes] of cases) {
      await expect(readPluginArchive(bytes), name).rejects.toBeInstanceOf(
        PluginFlowError,
      );
    }
  });

  it("keeps foreign stores closed and recovers through Safe Mode", async () => {
    const { db, platform, profileId } = await harness();
    let foreign = false;
    const guarded = new Proxy(db, {
      get(target, property, receiver) {
        if (property === "notes" || property === "events") {
          foreign = true;
          throw new Error("touched");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const isolated = createPluginPlatform(
      guarded,
      memoryPreferences(),
      () => undefined,
      async () => undefined,
    );
    expect(() => isolated.rejectForeign("notes")).toThrow(PluginFlowError);
    expect(() => isolated.rejectForeign("events")).toThrow(PluginFlowError);
    expect(foreign).toBe(false);
    const first = templateManifest("counter", "local.one");
    const second = templateManifest("counter", "local.two");
    await platform.install(
      await writePluginArchive({
        manifest: first,
        assets: [],
        defaults: { schemaVersion: 1, blocks: { count: { value: 0 } } },
      }),
      "imported",
    );
    await platform.install(
      await writePluginArchive({
        manifest: second,
        assets: [],
        defaults: { schemaVersion: 1, blocks: { count: { value: 0 } } },
      }),
      "imported",
    );
    await platform.place(profileId, first.id);
    const row = (await db.pluginInstanceData.toArray())[0];
    if (!row) throw new Error("missing");
    await expect(
      platform.writeSelf(second.id, row.instanceId, row.data),
    ).rejects.toBeInstanceOf(PluginFlowError);
    for (let crash = 0; crash < 3; crash += 1)
      await platform.recordCrash(first.id);
    expect((await db.pluginPackages.get(first.id))?.quarantined).toBe(true);
    expect(await db.pluginInstanceData.get(row.id)).toMatchObject({
      data: row.data,
    });
    await platform.enterSafeMode();
    const mode = await platform.safeMode();
    expect(
      platform.hidden((await db.pluginPackages.get(second.id))!, mode),
    ).toBe(true);
    await platform.clearQuarantine(first.id);
    await platform.reenable(second.id);
    const next = await platform.safeMode();
    expect(next.exceptions).toEqual([second.id]);
    expect(
      platform.hidden((await db.pluginPackages.get(first.id))!, next),
    ).toBe(true);
    expect((await db.notificationOccurrences.toArray()).length).toBe(0);
  });
});
