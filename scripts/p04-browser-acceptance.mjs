/* eslint-disable no-undef */
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");
const evidenceDir = process.env.P00_EVIDENCE_DIR ?? "evidence/P04";
const executablePath =
  process.env.CHROME_BIN ??
  [
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].find(existsSync);
if (!executablePath)
  throw new Error("P04 browser acceptance: Chromium missing");
if (!existsSync(".output/chrome-mv3/manifest.json"))
  throw new Error("P04 browser acceptance: Chrome build missing");

const evidence = {
  profile: "disposable",
  productionFaultString: false,
  hostileRejected: false,
  safeModeKeepsData: false,
  persianDir: "",
  permissions: [],
  csp: "",
};
function treeHas(dir, needle) {
  if (!existsSync(dir)) return false;
  for (const entry of readdirSync(dir, { recursive: true })) {
    const path = join(dir, String(entry));
    if (!path.endsWith(".js")) continue;
    if (readFileSync(path, "utf8").includes(needle)) return true;
  }
  return false;
}
evidence.productionFaultString =
  treeHas(".output/chrome-mv3", "plugin fault") ||
  treeHas(".output/firefox-mv3", "plugin fault");

function makeBomb() {
  const data = Buffer.alloc(64);
  const local = Buffer.alloc(30);
  const name = Buffer.from("../manifest.json");
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const directory = Buffer.concat([central, name]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(30 + name.length + data.length, 16);
  return Buffer.concat([local, name, data, directory, end]);
}

const hostile = join(
  mkdtempSync(join(tmpdir(), "venus-p04-")),
  "hostile.zplugin",
);
writeFileSync(hostile, makeBomb());

async function openExtension(extension) {
  const profile = mkdtempSync(join(tmpdir(), "venus-p04-chrome-"));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath,
    chromiumSandbox: true,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  await context.setOffline(true);
  return context;
}

const context = await openExtension(resolve(".output/chrome-mv3"));
try {
  const page = await context.newPage();
  await page.goto("chrome://newtab/");
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.locator(".dialog-backdrop").waitFor({ state: "hidden" });
  const manifest = await page.evaluate(() => chrome.runtime.getManifest());
  evidence.permissions = manifest.permissions ?? [];
  evidence.csp = manifest.content_security_policy ?? "";
  await page.getByRole("button", { name: "Plugins" }).click();
  await page.getByRole("heading", { name: "Plugins" }).waitFor();
  await page.getByLabel("English name").fill("Counter pack");
  await page.getByRole("button", { name: "Save on this device" }).click();
  await page.getByText("Plugin saved on this device.").waitFor();
  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("heading", { name: "Counter" }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Plugins" }).click();
  await page.getByRole("button", { name: "Export package" }).click();
  const download = await downloadPromise;
  evidence.exportName = download.suggestedFilename();
  await page.getByRole("button", { name: "Disable" }).click();
  await page.getByLabel("Choose a package file").setInputFiles(hostile);
  await page.getByText("Nothing was changed.").waitFor();
  evidence.hostileRejected = true;
  await page.getByRole("button", { name: "Turn on Safe Mode" }).click();
  await page.getByText("Safe Mode is on.").waitFor();
  const rows = await page.evaluate(
    () =>
      new Promise((done, reject) => {
        const open = indexedDB.open("Venus-p00");
        open.onerror = () => reject(new Error("indexedDB"));
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("pluginInstanceData", "readonly");
          const found = [];
          tx.objectStore("pluginInstanceData").openCursor().onsuccess = (
            event,
          ) => {
            const cursor = event.target.result;
            if (!cursor) return;
            found.push(cursor.value);
            cursor.continue();
          };
          tx.oncomplete = () => done(found);
        };
      }),
  );
  evidence.instanceRows = rows.length;
  evidence.safeModeKeepsData = rows.length > 0;
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Language").selectOption("fa");
  await page.goto("chrome://newtab/");
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByRole("button", { name: "افزونه‌ها" }).click();
  evidence.persianDir = await page.evaluate(() => document.documentElement.dir);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, "p04-plugins-fa.png") });
  if (evidence.persianDir !== "rtl")
    throw new Error("Persian direction was " + evidence.persianDir);
  if (!evidence.safeModeKeepsData)
    throw new Error("Safe Mode removed plugin instance data");
  if (evidence.productionFaultString)
    throw new Error("Production bundle contains the plugin fault string");
} finally {
  await context.close();
}

if (existsSync(".output-p04-fault/chrome-mv3/manifest.json")) {
  const fault = await openExtension(resolve(".output-p04-fault/chrome-mv3"));
  try {
    const page = await fault.newPage();
    await page.goto("chrome://newtab/");
    await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
    await page.getByRole("button", { name: "Skip setup" }).click();
    await page.locator(".dialog-backdrop").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Plugins" }).click();
    await page.getByRole("button", { name: "Save on this device" }).click();
    await page.getByText("Plugin saved on this device.").waitFor();
    await page.evaluate(
      () =>
        new Promise((done, reject) => {
          const open = indexedDB.open("Venus-p00");
          open.onerror = () => reject(new Error("indexedDB"));
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("widgets", "readwrite");
            tx.objectStore("widgets").openCursor().onsuccess = (event) => {
              const cursor = event.target.result;
              if (!cursor) return;
              if (cursor.value.widgetType === "plugin") {
                cursor.value.settings.pluginFault = true;
                cursor.update(cursor.value);
              }
              cursor.continue();
            };
            tx.oncomplete = () => done(true);
          };
        }),
    );
    await page.reload();
    await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
    await page.getByText("This widget failed.").waitFor();
    evidence.faultBoundary = true;
    const kept = await page.evaluate(
      () =>
        new Promise((done, reject) => {
          const open = indexedDB.open("Venus-p00");
          open.onerror = () => reject(new Error("indexedDB"));
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("pluginInstanceData", "readonly");
            let count = 0;
            tx.objectStore("pluginInstanceData").openCursor().onsuccess = (
              event,
            ) => {
              const cursor = event.target.result;
              if (!cursor) return;
              count += 1;
              cursor.continue();
            };
            tx.oncomplete = () => done(count);
          };
        }),
    );
    evidence.faultInstanceRows = kept;
  } finally {
    await fault.close();
  }
}

await mkdir(evidenceDir, { recursive: true });
await writeFile(
  join(evidenceDir, "p04-browser.json"),
  JSON.stringify(evidence, null, 2),
);
if (evidence.permissions.join(",") !== "storage,alarms")
  throw new Error(
    "Permissions changed: " + JSON.stringify(evidence.permissions),
  );
console.log(JSON.stringify(evidence, null, 2));
