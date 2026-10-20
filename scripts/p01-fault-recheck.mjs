/* global indexedDB */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");
const executablePath = "/usr/bin/chromium";
const extension = resolve(".output/chrome-mv3");
const evidenceDir = resolve("evidence/P01/acceptance");
const faultExt = join(evidenceDir, "fault-extension");

function filesWith(root, needle) {
  const files = execFileSync("find", [root, "-type", "f"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  return files.filter((file) =>
    readFileSync(file).includes(Buffer.from(needle)),
  );
}

execFileSync("npm", ["run", "build:chrome"], {
  env: { ...process.env, VITE_VENUS_WIDGET_FAULT: "1" },
  stdio: "inherit",
});
const faultFiles = filesWith(extension, "widget fault");
await rm(faultExt, { recursive: true, force: true });
await cp(extension, faultExt, { recursive: true });
execFileSync("npm", ["run", "build:chrome"], { stdio: "inherit" });
const productionFiles = filesWith(extension, "widget fault");

const context = await chromium.launchPersistentContext(
  await mkdtemp(join(tmpdir(), "venus-p01-fault3-")),
  {
    executablePath,
    chromiumSandbox: true,
    headless: true,
    args: [
      `--disable-extensions-except=${faultExt}`,
      `--load-extension=${faultExt}`,
    ],
  },
);
await context.setOffline(true);
const page = await context.newPage();
await page.goto("chrome://newtab/");
await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
await page.getByRole("button", { name: "Skip setup" }).click();
await page
  .getByRole("dialog", { name: "Welcome" })
  .waitFor({ state: "hidden" });
await page.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("Venus-p00");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  const profiles = await new Promise((resolve, reject) => {
    const request = db.transaction("profiles").objectStore("profiles").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const tx = db.transaction("widgets", "readwrite");
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
    const now = new Date().toISOString();
    tx.objectStore("widgets").put({
      id: "22222222-2222-4222-8222-222222222222",
      profileId: profiles[0]?.id,
      widgetType: "clock",
      revision: 1,
      createdAt: now,
      updatedAt: now,
      x: 0,
      y: 8,
      w: 1,
      h: 1,
      visible: true,
      settings: { fault: true },
    });
  });
});
await page.reload();
await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
const alert = page.getByRole("alert");
const before = await alert.innerText();
const heading = await page
  .getByRole("heading", { name: "Venus", exact: true })
  .isVisible();
const others = await page.locator("article.widget").count();
await alert.getByRole("button", { name: "Reset widget" }).click();
await page.waitForTimeout(500);
const stillFailed = await alert.isVisible().catch(() => false);
const clockBack = await page.locator("article .week").count();
await page.getByRole("button", { name: "Edit layout" }).click();
const clock = page
  .locator("article")
  .filter({ has: page.locator(".week") })
  .first();
const beforeTop = (await clock.boundingBox())?.y;
await clock.getByRole("button", { name: "Move ↓" }).click();
await page.waitForTimeout(400);
const afterTop = (await clock.boundingBox())?.y;
await page.screenshot({ path: join(evidenceDir, "fault-after-reset.png") });
const result = {
  faultFiles: faultFiles.length,
  productionFiles: productionFiles.length,
  heading,
  others,
  before,
  stillFailed,
  clockBack,
  movedWithoutReload:
    beforeTop !== undefined && afterTop !== undefined && afterTop > beforeTop,
  beforeTop,
  afterTop,
};
await writeFile(
  join(evidenceDir, "fault-recheck.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
await context.close();
await rm(faultExt, { recursive: true, force: true });
if (
  faultFiles.length === 0 ||
  productionFiles.length !== 0 ||
  !heading ||
  others < 2 ||
  stillFailed ||
  clockBack < 1 ||
  !result.movedWithoutReload
) {
  process.exit(1);
}
