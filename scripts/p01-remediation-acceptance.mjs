/* global chrome, indexedDB, document, getComputedStyle, performance */
// Historical P01 remediation runner. Its palette check expects "New note" to show
// "Nothing was saved." P02 opens capture and saves the note. Current acceptance is
// scripts/p02-acceptance.mjs. A run rewrites evidence/P01/remediation.
if (process.env.VENUS_RUN_HISTORICAL_P01 !== "1") {
  console.error(
    "Historical P01 remediation runner. It still expects New note to remain unsaved. Current runner: scripts/p02-acceptance.mjs. Set VENUS_RUN_HISTORICAL_P01=1 to re-run and overwrite evidence/P01/remediation.",
  );
  process.exit(3);
}
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");
const executablePath = "/usr/bin/chromium";
const extension = resolve(".output/chrome-mv3");
const evidenceDir = resolve("evidence/P01/remediation");
await mkdir(evidenceDir, { recursive: true });
const checks = [];
const record = (id, status, detail) => {
  checks.push({ id, status, detail });
  console.log(`${status} ${id}`);
};

function filesWith(root, needle) {
  return execFileSync("find", [root, "-type", "f"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((file) => readFileSync(file).includes(Buffer.from(needle)));
}
function p90(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(0.9 * sorted.length) - 1];
}
async function launch(profile, extensionDir) {
  const context = await chromium.launchPersistentContext(profile, {
    executablePath,
    chromiumSandbox: true,
    headless: true,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });
  await context.setOffline(true);
  return context;
}
async function openNewTab(context) {
  const page = await context.newPage();
  await page.goto("chrome://newtab/");
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  return page;
}
async function skip(page) {
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.waitForFunction(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    return stored["venus.bootstrap"]?.onboardingComplete === true;
  });
  await page
    .getByRole("dialog", { name: "Welcome" })
    .waitFor({ state: "hidden" });
}
async function switchTo(page, label) {
  await page.getByLabel("Switch profile").selectOption({ label });
  await page.waitForFunction(async (title) => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    const bootstrap = stored["venus.bootstrap"];
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("Venus-p00");
      request.onsuccess = () => resolve(request.result);
    });
    const rows = await new Promise((resolve) => {
      const request = db
        .transaction("profiles")
        .objectStore("profiles")
        .getAll();
      request.onsuccess = () => resolve(request.result);
    });
    return (
      rows.find((row) => row.id === bootstrap.selectedProfileId)?.title ===
      title
    );
  }, label);
}
async function look(page) {
  await page.getByLabel("Switch profile").waitFor();
  await page.locator("article .week").first().waitFor();
  return page.evaluate(() => ({
    theme: document.documentElement.dataset.theme ?? "",
    scene: document.body.dataset.scene ?? "",
    motion: document.documentElement.dataset.motion ?? "",
    blur: getComputedStyle(document.documentElement)
      .getPropertyValue("--blur")
      .trim(),
    canvas: getComputedStyle(document.documentElement)
      .getPropertyValue("--canvas")
      .trim()
      .toLowerCase(),
    background: document.body.style.background,
    backgroundImage: document.body.style.backgroundImage,
    remote: performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.startsWith("http")),
  }));
}
async function profiles(page) {
  return page.evaluate(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const rows = await new Promise((resolve, reject) => {
      const request = db
        .transaction("profiles")
        .objectStore("profiles")
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return {
      version: db.version,
      stores: [...db.objectStoreNames],
      bootstrap: stored["venus.bootstrap"],
      profiles: rows,
    };
  });
}

execFileSync("npm", ["run", "build:chrome"], { stdio: "inherit" });
const browserVersion = execFileSync(executablePath, ["--version"], {
  encoding: "utf8",
}).trim();
const profile = await mkdtemp(join(tmpdir(), "venus-p01-remediate-"));
let context = await launch(profile, extension);
try {
  let page = await openNewTab(context);
  const first = await look(page);
  record(
    "offline-first-load",
    first.remote.length === 0 ? "PASS" : "FAIL",
    `remote=${first.remote.length}`,
  );
  await skip(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Theme").selectOption("dark");
  await page.getByRole("button", { name: "Nebula" }).click();
  await page.getByLabel("Blur").fill("2");
  await page.getByLabel("Glass opacity").fill("0.7");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByLabel("Create profile").fill("Beta");
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await page.getByRole("link", { name: "Venus" }).click();
  await switchTo(page, "Beta");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Theme").selectOption("light");
  await page.locator("#gradient-from").fill("#112233");
  await page.locator("#gradient-to").fill("#ABCDEF");
  await page.getByRole("button", { name: "Gradient", exact: true }).click();
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const betaLook = await look(page);
  await switchTo(page, "Minimal");
  const alphaLook = await look(page);
  await switchTo(page, "Beta");
  const betaAgain = await look(page);
  await switchTo(page, "Minimal");
  const alphaAgain = await look(page);
  const isolated =
    alphaLook.theme === "dark" &&
    alphaLook.scene === "nebula" &&
    alphaLook.blur === "2px" &&
    alphaLook.canvas === "#111827" &&
    betaLook.theme === "light" &&
    betaLook.scene === "" &&
    betaLook.canvas === "#f6f6fb" &&
    betaLook.background.includes("linear-gradient") &&
    betaLook.background.includes("rgb(17, 34, 51)") &&
    alphaAgain.scene === "nebula" &&
    betaAgain.background.includes("linear-gradient");
  record(
    "profile-appearance-switch",
    isolated ? "PASS" : "FAIL",
    JSON.stringify({ alphaLook, betaLook, alphaAgain, betaAgain }),
  );

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Blur").fill("6");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  await switchTo(page, "Beta");
  const betaUntouched = await look(page);
  const stored = await profiles(page);
  const alphaRow = stored.profiles.find((item) => item.title === "Minimal");
  const betaRow = stored.profiles.find((item) => item.title === "Beta");
  record(
    "active-profile-only",
    alphaRow?.blurPx === 6 &&
      betaRow?.blurPx == null &&
      betaUntouched.blur === "8px" &&
      stored.bootstrap.themeMode === "system" &&
      stored.bootstrap.wallpaper.sceneId === "orbit"
      ? "PASS"
      : "FAIL",
    JSON.stringify({
      alphaBlur: alphaRow?.blurPx,
      betaBlur: betaRow?.blurPx,
      betaComputed: betaUntouched.blur,
      bootstrapTheme: stored.bootstrap.themeMode,
      bootstrapScene: stored.bootstrap.wallpaper,
    }),
  );

  await context.close();
  context = await launch(profile, extension);
  page = await openNewTab(context);
  await switchTo(page, "Minimal");
  const alphaRestart = await look(page);
  await switchTo(page, "Beta");
  const betaRestart = await look(page);
  record(
    "profile-appearance-restart",
    alphaRestart.theme === "dark" &&
      alphaRestart.scene === "nebula" &&
      alphaRestart.blur === "6px" &&
      betaRestart.theme === "light" &&
      betaRestart.background.includes("linear-gradient")
      ? "PASS"
      : "FAIL",
    JSON.stringify({ alphaRestart, betaRestart }),
  );

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Create profile").fill("Gamma");
  await page.getByRole("button", { name: "Minimal", exact: true }).click();
  await page.getByRole("link", { name: "Venus" }).click();
  await switchTo(page, "Gamma");
  const gamma = await look(page);
  const gammaRow = (await profiles(page)).profiles.find(
    (item) => item.title === "Gamma",
  );
  record(
    "new-profile-inherits",
    gamma.theme === "system" &&
      gamma.scene === "orbit" &&
      gamma.blur === "8px" &&
      gammaRow?.themeMode == null &&
      gammaRow?.wallpaper == null
      ? "PASS"
      : "FAIL",
    JSON.stringify({ gamma, gammaRow }),
  );

  await switchTo(page, "Minimal");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page.getByRole("link", { name: "Venus" }).click();
  await switchTo(page, "Minimal 2");
  const copyLook = await look(page);
  await switchTo(page, "Minimal");
  await page.getByRole("link", { name: "Settings" }).click();
  await page
    .locator("section", {
      has: page.getByRole("heading", { name: "Appearance" }),
    })
    .getByRole("button", { name: "Reset this section" })
    .click();
  await page.getByRole("button", { name: "Confirm reset" }).click();
  await page.getByRole("link", { name: "Venus" }).click();
  const resetLook = await look(page);
  await switchTo(page, "Minimal 2");
  const copyAfterReset = await look(page);
  record(
    "duplicate-and-reset",
    copyLook.theme === "dark" &&
      copyLook.scene === "nebula" &&
      resetLook.theme === "system" &&
      resetLook.scene === "orbit" &&
      copyAfterReset.theme === "dark" &&
      copyAfterReset.scene === "nebula"
      ? "PASS"
      : "FAIL",
    JSON.stringify({ copyLook, resetLook, copyAfterReset }),
  );

  const png = join(evidenceDir, "pixel.png");
  writeFileSync(
    png,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  const textFile = join(evidenceDir, "note.txt");
  writeFileSync(textFile, "not an image");
  const huge = join(evidenceDir, "huge.png");
  writeFileSync(huge, Buffer.alloc(5 * 1024 * 1024 + 1, 1));
  await page.getByRole("link", { name: "Settings" }).click();
  await page.locator("input[type=file]").setInputFiles(textFile);
  await page.getByText("That change was not saved.").waitFor();
  await page.locator("input[type=file]").setInputFiles(huge);
  await page.getByText("That change was not saved.").waitFor();
  await page.locator("input[type=file]").setInputFiles(png);
  await page
    .getByText("Saved", { exact: true })
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  await page.getByRole("link", { name: "Venus" }).click();
  const uploaded = await look(page);
  await switchTo(page, "Gamma");
  const gammaAfterUpload = await look(page);
  record(
    "wallpaper-upload",
    uploaded.backgroundImage.startsWith("url(") &&
      gammaAfterUpload.scene === "orbit" &&
      gammaAfterUpload.backgroundImage === ""
      ? "PASS"
      : "FAIL",
    JSON.stringify({ uploaded, gammaAfterUpload }),
  );

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Motion").selectOption("off");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const motionOff = await look(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Motion").selectOption("system");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const motionSystemReduce = await look(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  const motionSystemOn = await look(page);
  record(
    "reduced-motion",
    motionOff.motion === "off" &&
      motionSystemReduce.motion === "off" &&
      motionSystemOn.motion === "system"
      ? "PASS"
      : "FAIL",
    JSON.stringify({ motionOff, motionSystemReduce, motionSystemOn }),
  );

  await page.locator("#dashboard-search").focus();
  await page.keyboard.press("Control+k");
  const blocked = await page
    .getByRole("dialog", { name: "Commands" })
    .isVisible();
  await page.locator("h1").click();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Filter commands").waitFor();
  await page.getByPlaceholder("Filter commands").fill("New note");
  await page.getByRole("button", { name: /New note/ }).click();
  const noteNotice = await page.getByRole("status").innerText();
  await page.keyboard.press("Escape");
  await page.locator("h1").click();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Filter commands").fill("Start timer");
  await page.getByRole("button", { name: /Start timer/ }).click();
  const timerNotice = await page.getByRole("status").innerText();
  record(
    "command-palette",
    blocked === false &&
      noteNotice.includes("Nothing was saved.") &&
      timerNotice.includes("Nothing was saved.") &&
      !/created|success/i.test(noteNotice)
      ? "PASS"
      : "FAIL",
    JSON.stringify({ blocked, noteNotice, timerNotice }),
  );

  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Run setup again" }).click();
  await page.getByRole("link", { name: "Venus" }).click();
  await page.getByRole("dialog", { name: "Welcome" }).waitFor();
  for (let step = 0; step < 4; step += 1)
    await page.getByRole("button", { name: "Next" }).click();
  await page
    .getByRole("button", { name: "Request permission bookmarks" })
    .click();
  const denial = page.getByText(
    "Permission was not granted. Setup can continue.",
  );
  const sawDenial = await denial.isVisible().catch(() => false);
  await page.waitForTimeout(3000);
  const sawDenialLater = await denial.isVisible().catch(() => false);
  const contains = await page.evaluate(async () => {
    try {
      return await chrome.permissions.contains({ permissions: ["bookmarks"] });
    } catch (error) {
      return String(error);
    }
  });
  const finishEnabled = await page
    .getByRole("button", { name: "Finish" })
    .isEnabled();
  record(
    "native-permission-prompt",
    "NOT_VERIFIED",
    JSON.stringify({
      sawDenialImmediately: sawDenial,
      sawDenialAfter3s: sawDenialLater,
      bookmarksContains: contains,
      finishEnabled,
      interpretation:
        "Headless Chromium did not return a permission result during the wait. An empty note is not recorded as a denial. Native grant, deny, and revoke remain unverified.",
    }),
  );
  await page.getByRole("button", { name: "Finish" }).click();
  await context.close();
} catch (error) {
  record(
    "browser-session",
    "FAIL",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  await context.close().catch(() => {});
}

const cold = [];
for (let index = 0; index < 5; index += 1) {
  const coldProfile = await mkdtemp(join(tmpdir(), "venus-p01-cold-"));
  const coldContext = await launch(coldProfile, extension);
  const coldPage = await coldContext.newPage();
  const started = Date.now();
  await coldPage.goto("chrome://newtab/");
  await coldPage.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  cold.push(Date.now() - started);
  if (index === 0) {
    for (let reload = 0; reload < 5; reload += 1) {
      const warmStarted = Date.now();
      await coldPage.reload();
      await coldPage
        .getByRole("heading", { name: "Venus", exact: true })
        .waitFor();
      cold.warm ??= [];
      cold.warm.push(Date.now() - warmStarted);
    }
  }
  await coldContext.close();
  await rm(coldProfile, { recursive: true, force: true });
}
const warm = cold.warm ?? [];
record(
  "heading-timing",
  "INFO",
  JSON.stringify({
    method:
      "Timer starts at page.goto or reload after the browser process is already running, and stops when the Venus heading is visible. It excludes process startup. p90 uses nearest rank ceil(0.9*n).",
    coldMs: cold,
    warmMs: warm,
    coldP90: p90(cold),
    warmP90: p90(warm),
    browser: browserVersion,
  }),
);

const adapterExt = join(evidenceDir, "permission-adapter");
execFileSync("npm", ["run", "build:chrome"], {
  env: { ...process.env, VITE_VENUS_PERMISSION_ADAPTER: "denied" },
  stdio: "inherit",
});
const adapterFiles = filesWith(extension, "controlled-denial");
await rm(adapterExt, { recursive: true, force: true });
await cp(extension, adapterExt, { recursive: true });
execFileSync("npm", ["run", "build:chrome"], { stdio: "inherit" });
const productionAdapter = filesWith(extension, "controlled-denial");
const adapterProfile = await mkdtemp(join(tmpdir(), "venus-p01-adapter-"));
const adapterContext = await launch(adapterProfile, adapterExt);
try {
  const adapterPage = await openNewTab(adapterContext);
  await adapterPage.getByRole("button", { name: "Next" }).click();
  await adapterPage.getByRole("button", { name: "Next" }).click();
  await adapterPage.getByRole("button", { name: "Next" }).click();
  await adapterPage.getByRole("button", { name: "Next" }).click();
  await adapterPage
    .getByRole("button", { name: "Request permission bookmarks" })
    .click();
  const text = await adapterPage
    .getByText("Permission was not granted. Setup can continue.")
    .innerText();
  const finish = await adapterPage
    .getByRole("button", { name: "Finish" })
    .isEnabled();
  await adapterPage.getByRole("button", { name: "Finish" }).click();
  await adapterPage
    .getByRole("dialog", { name: "Welcome" })
    .waitFor({ state: "hidden" });
  const hidden = true;
  record(
    "controlled-permission-denial",
    text.includes("Permission was not granted") &&
      finish &&
      hidden &&
      adapterFiles.length > 0 &&
      productionAdapter.length === 0
      ? "PASS"
      : "FAIL",
    JSON.stringify({
      text,
      finish,
      hidden,
      adapterBuildContainsMarker: adapterFiles.length,
      productionContainsMarker: productionAdapter.length,
      nativeLifecycle: "NOT VERIFIED",
    }),
  );
} catch (error) {
  record(
    "controlled-permission-denial",
    "FAIL",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
}
await adapterContext.close();

const faultExt = join(evidenceDir, "fault-extension");
execFileSync("npm", ["run", "build:chrome"], {
  env: { ...process.env, VITE_VENUS_WIDGET_FAULT: "1" },
  stdio: "inherit",
});
const faultFiles = filesWith(extension, "widget fault");
await rm(faultExt, { recursive: true, force: true });
await cp(extension, faultExt, { recursive: true });
execFileSync("npm", ["run", "build:chrome"], { stdio: "inherit" });
const productionFault = filesWith(extension, "widget fault");
const faultProfile = await mkdtemp(join(tmpdir(), "venus-p01-fault-"));
const faultContext = await launch(faultProfile, faultExt);
try {
  const faultPage = await openNewTab(faultContext);
  await skip(faultPage);
  await faultPage.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const rows = await new Promise((resolve, reject) => {
      const request = db
        .transaction("profiles")
        .objectStore("profiles")
        .getAll();
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
        profileId: rows[0]?.id,
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
  await faultPage.reload();
  await faultPage
    .getByRole("heading", { name: "Venus", exact: true })
    .waitFor();
  const alert = faultPage.getByRole("alert");
  const alertText = await alert.innerText();
  const widgetsBefore = await faultPage.locator("article.widget").count();
  const searchBefore = await faultPage.locator("#dashboard-search").count();
  await alert.getByRole("button", { name: "Reset widget" }).click();
  await faultPage.getByRole("alert").waitFor({ state: "hidden" });
  const searchAfter = await faultPage.locator("#dashboard-search").count();
  const headingAfter = await faultPage
    .getByRole("heading", { name: "Venus", exact: true })
    .isVisible();
  const storedFault = await faultPage.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const request = indexedDB.open("Venus-p00");
      request.onsuccess = () => resolve(request.result);
    });
    return new Promise((resolve, reject) => {
      const request = db
        .transaction("widgets")
        .objectStore("widgets")
        .get("22222222-2222-4222-8222-222222222222");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  record(
    "widget-fault-isolation",
    headingAfter &&
      widgetsBefore > 1 &&
      searchBefore === 1 &&
      searchAfter === 1 &&
      alertText.includes("The rest of the dashboard is still available.") &&
      storedFault?.settings?.fault !== true &&
      faultFiles.length > 0 &&
      productionFault.length === 0
      ? "PASS"
      : "FAIL",
    JSON.stringify({
      alertText,
      widgetsBefore,
      searchBefore,
      searchAfter,
      headingAfter,
      storedFault,
      faultFiles: faultFiles.length,
      productionFault: productionFault.length,
    }),
  );
} catch (error) {
  record(
    "widget-fault-isolation",
    "FAIL",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
}
await faultContext.close();
await rm(profile, { recursive: true, force: true }).catch(() => {});
await rm(adapterProfile, { recursive: true, force: true }).catch(() => {});
await rm(faultProfile, { recursive: true, force: true }).catch(() => {});
await writeFile(
  join(evidenceDir, "results.json"),
  JSON.stringify(
    { at: new Date().toISOString(), browserVersion, checks },
    null,
    2,
  ),
);
process.exit(checks.some((item) => item.status === "FAIL") ? 1 : 0);
