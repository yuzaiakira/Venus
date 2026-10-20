/* global chrome, indexedDB, document, getComputedStyle, performance, navigator */
// Historical P01 runner. Its command-palette check expects "New note" to stay unsaved.
// P02 saves notes. Current acceptance is scripts/p02-acceptance.mjs.
// This file is not updated to the P02 behavior, and it is not run unless explicitly requested,
// because a run rewrites evidence/P01/acceptance.
if (process.env.VENUS_RUN_HISTORICAL_P01 !== "1") {
  console.error(
    "Historical P01 acceptance runner. It still expects New note to remain unsaved. Current runner: scripts/p02-acceptance.mjs. Set VENUS_RUN_HISTORICAL_P01=1 to re-run and overwrite evidence/P01/acceptance.",
  );
  process.exit(3);
}
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");

const executablePath =
  process.env.CHROME_BIN ??
  [
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find(existsSync);
if (!executablePath) throw new Error("No Chrome/Chromium executable");
const extension = resolve(".output/chrome-mv3");
if (!existsSync(join(extension, "manifest.json")))
  throw new Error("Chrome build missing");
const evidenceDir = resolve("evidence/P01/acceptance");
await mkdir(evidenceDir, { recursive: true });

const probeId = "f535d2b1-f815-41d9-9e61-2d2518ce30b8";
const checks = [];
function record(id, status, detail) {
  checks.push({ id, status, detail });
  console.log(`${status} ${id}: ${detail}`);
}

function productionHasFaultString() {
  const root = extension;
  const files = [];
  const walk = (dir) => {
    for (const name of execFileSync("find", [dir, "-type", "f"], {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean)) {
      files.push(name);
    }
  };
  walk(root);
  return files.filter((file) => {
    const text = readFileSync(file);
    return text.includes(Buffer.from("widget fault"));
  });
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
  await page
    .getByRole("heading", { name: "Venus", exact: true })
    .waitFor({ timeout: 20000 });
  return page;
}

async function skipOnboarding(page) {
  const skip = page.getByRole("button", { name: "Skip setup" });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page
    .getByRole("dialog", { name: "Welcome" })
    .waitFor({ state: "hidden", timeout: 10000 })
    .catch(() => {});
}

async function readStorage(page) {
  return page.evaluate(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    const bootstrap = stored["venus.bootstrap"];
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const names = [...db.objectStoreNames];
    const wanted = ["probes", "profiles", "widgets", "sharedItems"].filter(
      (name) => names.includes(name),
    );
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(wanted, "readonly");
      const out = {};
      let pending = wanted.length;
      if (!pending) resolve(out);
      for (const name of wanted) {
        const request = tx.objectStore(name).getAll();
        request.onsuccess = () => {
          out[name] = request.result;
          pending -= 1;
          if (!pending) resolve(out);
        };
        request.onerror = () => reject(request.error);
      }
    });
    return {
      version: db.version,
      stores: names,
      bootstrap,
      probes: rows.probes ?? [],
      profiles: rows.profiles ?? [],
      widgets: rows.widgets ?? [],
      shared: rows.sharedItems ?? [],
    };
  });
}

async function appearance(page) {
  return page.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    theme: document.documentElement.dataset.theme ?? "",
    scene: document.body.dataset.scene ?? "",
    blur: getComputedStyle(document.documentElement)
      .getPropertyValue("--blur")
      .trim(),
    canvas: getComputedStyle(document.documentElement)
      .getPropertyValue("--canvas")
      .trim()
      .toLowerCase(),
    background: document.body.style.background,
    remote: performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter(
        (name) => name.startsWith("http://") || name.startsWith("https://"),
      ),
  }));
}

function overlaps(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

async function widgetBoxes(page) {
  return page.locator("article.widget").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return {
        text: node.innerText.slice(0, 80),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        column: node.style.gridColumn,
      };
    }),
  );
}

const version = execFileSync(executablePath, ["--version"], {
  encoding: "utf8",
}).trim();
const browserVersion = version;
record("browser", "INFO", `${browserVersion}; executable ${executablePath}`);

const faultFiles = productionHasFaultString();
record(
  "fault-string-production",
  faultFiles.length === 0 ? "PASS" : "FAIL",
  faultFiles.length === 0
    ? "Production Chrome package has no widget fault string"
    : faultFiles.join(", "),
);

const profile = await mkdtemp(join(tmpdir(), "venus-p01-accept-"));
let context;
try {
  context = await launch(profile, extension);
  let page = await openNewTab(context);
  const first = await appearance(page);
  record(
    "offline-first-load",
    first.remote.length === 0 && !(await page.evaluate(() => navigator.onLine))
      ? "PASS"
      : "FAIL",
    `online=${await page.evaluate(() => navigator.onLine)} remote=${first.remote.length}`,
  );
  await page.screenshot({ path: join(evidenceDir, "first-load.png") });
  await skipOnboarding(page);
  await page.reload();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  const welcomeAfterReload = await page
    .getByRole("dialog", { name: "Welcome" })
    .isVisible()
    .catch(() => false);
  record(
    "onboarding-skip-reload",
    welcomeAfterReload ? "FAIL" : "PASS",
    welcomeAfterReload
      ? "Welcome dialog returned after reload"
      : "Skip stayed complete after reload",
  );

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("heading", { name: "Settings" }).waitFor();
  await page.getByLabel("Theme").selectOption("dark");
  await page.getByRole("button", { name: "Nebula" }).click();
  await page.getByLabel("Blur").fill("4");
  await page.getByLabel("Glass opacity").fill("0.72");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.close();
  page = await openNewTab(context);
  let look = await appearance(page);
  record(
    "persist-tab-reopen",
    look.theme === "dark" && look.scene === "nebula" && look.blur === "4px"
      ? "PASS"
      : "FAIL",
    JSON.stringify({ theme: look.theme, scene: look.scene, blur: look.blur }),
  );

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Create profile").fill("Alpha");
  await page.getByRole("button", { name: "Productivity", exact: true }).click();
  await page.waitForFunction(async () => {
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
    return rows.some((row) => row.title === "Alpha");
  });
  await page.getByLabel("Create profile").fill("Beta");
  await page.getByRole("button", { name: "Personal", exact: true }).click();
  await page.waitForFunction(async () => {
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
    return rows.some((row) => row.title === "Beta");
  });
  await page.getByRole("link", { name: "Venus" }).click();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  const options = await page
    .getByLabel("Switch profile")
    .locator("option")
    .allTextContents();
  record(
    "profiles-created",
    ["Alpha", "Beta", "Minimal"].every((title) => options.includes(title))
      ? "PASS"
      : "FAIL",
    options.join(" | "),
  );

  async function widgetCount() {
    return page.locator("article.widget").count();
  }
  await page.getByLabel("Switch profile").selectOption({ label: "Minimal" });
  await page.waitForTimeout(300);
  const minimalCount = await widgetCount();
  await page.getByLabel("Switch profile").selectOption({ label: "Alpha" });
  await page.waitForTimeout(300);
  const alphaCount = await widgetCount();
  const beforeShared = await readStorage(page);
  const alphaId = beforeShared.profiles.find(
    (item) => item.title === "Alpha",
  )?.id;
  await page.evaluate(async (profileId) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("sharedItems", "readwrite");
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
      tx.objectStore("sharedItems").put({
        id: "11111111-1111-4111-8111-111111111111",
        kind: "note",
        title: "Shared acceptance note",
        revision: 1,
      });
    });
    void profileId;
  }, alphaId);
  await page.reload();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByLabel("Switch profile").selectOption({ label: "Alpha" });
  await page.waitForTimeout(200);
  const alphaNote = await page.getByText("Shared acceptance note").count();
  await page.getByLabel("Switch profile").selectOption({ label: "Beta" });
  await page.waitForTimeout(200);
  const betaNote = await page.getByText("Shared acceptance note").count();
  const betaCount = await widgetCount();
  record(
    "profiles-layout-and-shared",
    minimalCount === 2 &&
      alphaCount > minimalCount &&
      alphaNote > 0 &&
      betaNote > 0
      ? "PASS"
      : "FAIL",
    `minimal=${minimalCount} alpha=${alphaCount} beta=${betaCount} notes=${alphaNote}/${betaNote}`,
  );
  const themes = {};
  for (const title of ["Minimal", "Alpha", "Beta"]) {
    await page.getByLabel("Switch profile").selectOption({ label: title });
    await page.waitForTimeout(150);
    themes[title] = (await appearance(page)).theme;
  }
  await page.getByLabel("Switch profile").selectOption({ label: "Alpha" });
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForFunction(async () => {
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
    return rows.every((row) => row.title !== "Alpha");
  });
  await page.getByRole("link", { name: "Venus" }).click();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  const afterDelete = await readStorage(page);
  record(
    "profiles-delete-keeps-shared",
    afterDelete.profiles.every((item) => item.title !== "Alpha") &&
      afterDelete.profiles.some((item) => item.title === "Beta") &&
      afterDelete.profiles.some((item) => item.title === "Minimal") &&
      afterDelete.shared.some((item) => item.title === "Shared acceptance note")
      ? "PASS"
      : "FAIL",
    JSON.stringify({
      profiles: afterDelete.profiles.map((item) => item.title),
      shared: afterDelete.shared.map((item) => item.title),
    }),
  );
  record(
    "profiles-visual-isolation",
    new Set(Object.values(themes)).size > 1 ? "PASS" : "FAIL",
    `Theme stayed ${JSON.stringify(themes)}. Settings writes theme, wallpaper, blur, and glass to the global bootstrap; profile visual fields stay null.`,
  );

  await page.getByLabel("Switch profile").selectOption({ label: "Beta" });
  await context.close();
  context = await launch(profile, extension);
  page = await openNewTab(context);
  look = await appearance(page);
  const afterRestart = await readStorage(page);
  const selected = afterRestart.profiles.find(
    (item) => item.id === afterRestart.bootstrap.selectedProfileId,
  );
  const restartOk =
    look.theme === "dark" &&
    look.scene === "nebula" &&
    look.blur === "4px" &&
    selected?.title === "Beta" &&
    afterRestart.shared.some((item) => item.title === "Shared acceptance note");
  record(
    "persist-browser-restart",
    restartOk ? "PASS" : "FAIL",
    JSON.stringify({
      theme: look.theme,
      scene: look.scene,
      blur: look.blur,
      profile: selected?.title,
      shared: afterRestart.shared.map((item) => item.title),
    }),
  );
  await page.screenshot({ path: join(evidenceDir, "after-restart.png") });

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Theme").selectOption("light");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  let lightLook = await appearance(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Theme").selectOption("system");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  const systemDark = await appearance(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  const systemLight = await appearance(page);
  record(
    "theme-light-dark-system",
    lightLook.theme === "light" &&
      lightLook.canvas === "#f6f6fb" &&
      systemDark.theme === "system" &&
      systemDark.canvas === "#111827" &&
      systemLight.theme === "system" &&
      systemLight.canvas === "#f6f6fb"
      ? "PASS"
      : "FAIL",
    JSON.stringify({
      light: lightLook,
      systemDark: { theme: systemDark.theme, canvas: systemDark.canvas },
      systemLight: { theme: systemLight.theme, canvas: systemLight.canvas },
    }),
  );

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Language").selectOption("fa");
  await page.getByLabel("تقویم").selectOption("jalali");
  await page.getByLabel("ارقام").selectOption("persian");
  await page.getByLabel("ساعت").selectOption("24");
  await page.getByLabel("شروع هفته").selectOption("6");
  await page.getByLabel("منطقه زمانی").fill("Asia/Tehran");
  await page.getByText("ذخیره شد", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  await page.locator("article .week").first().waitFor();
  const faPersian = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    clock:
      document.querySelector("article .week")?.parentElement?.innerText ?? "",
    week: [...document.querySelectorAll("article .week span")].map(
      (node) => node.textContent,
    ),
  }));
  await page.getByRole("link", { name: "تنظیمات" }).click();
  await page.getByLabel("ارقام").selectOption("latin");
  await page.getByText("ذخیره شد", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const faLatin = await page.evaluate(
    () =>
      document.querySelector("article .week")?.parentElement?.innerText ?? "",
  );
  await page.getByRole("link", { name: "تنظیمات" }).click();
  await page.getByLabel("زبان").selectOption("en");
  await page.getByLabel("Numerals").selectOption("persian");
  await page.getByLabel("Calendar").selectOption("gregorian");
  await page.getByLabel("Hour format").selectOption("12");
  await page.getByLabel("Week start").selectOption("1");
  await page.getByLabel("Time zone").fill("Pacific/Honolulu");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const enPersian = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    clock:
      document.querySelector("article .week")?.parentElement?.innerText ?? "",
    week: [...document.querySelectorAll("article .week span")].map(
      (node) => node.textContent,
    ),
  }));
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Numerals").selectOption("latin");
  await page.getByLabel("Calendar").selectOption("jalali");
  await page.getByLabel("Hour format").selectOption("24");
  await page.getByLabel("Time zone").fill("Asia/Tehran");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const enJalali = await page.evaluate(
    () =>
      document.querySelector("article .week")?.parentElement?.innerText ?? "",
  );
  await page.close();
  page = await openNewTab(context);
  const i18nStored = await readStorage(page);
  const prefs = i18nStored.bootstrap;
  const faClockOk =
    faPersian.dir === "rtl" &&
    faPersian.lang === "fa" &&
    /[۰-۹]/.test(faPersian.clock) &&
    /مهر|۱۴۰۵/.test(faPersian.clock) &&
    faPersian.week[0] === "شنبه";
  const independentOk =
    !/[۰-۹]/.test(faLatin) &&
    faLatin.includes("1405") &&
    enPersian.dir === "ltr" &&
    /[۰-۹]/.test(enPersian.clock) &&
    /AM|PM/.test(enPersian.clock) &&
    enPersian.week[0] === "Mon" &&
    /1405|Mehr/.test(enJalali) &&
    !/AM|PM/.test(enJalali);
  record(
    "i18n-browser",
    faClockOk && independentOk ? "PASS" : "FAIL",
    JSON.stringify({ faPersian, faLatin, enPersian, enJalali }),
  );
  record(
    "i18n-persist-tab",
    prefs?.locale === "en" &&
      prefs?.numeralSystem === "latin" &&
      prefs?.calendarDisplay === "jalali" &&
      prefs?.hourFormat === 24 &&
      prefs?.weekStart === 1 &&
      prefs?.timeZone === "Asia/Tehran"
      ? "PASS"
      : "FAIL",
    JSON.stringify(prefs),
  );

  await page.getByLabel("Switch profile").selectOption({ label: "Minimal" });
  await page.getByRole("button", { name: "Edit layout" }).click();
  const search = page
    .locator("article")
    .filter({ has: page.locator("#dashboard-search") });
  await search.getByRole("button", { name: "Move ←" }).click();
  await page.waitForTimeout(200);
  const toast = await page
    .getByRole("status")
    .innerText()
    .catch(() => "");
  const afterReject = await readStorage(page);
  const minimalIdEarly = afterReject.profiles.find(
    (item) => item.title === "Minimal",
  )?.id;
  const searchRow = afterReject.widgets.find(
    (item) => item.profileId === minimalIdEarly && item.widgetType === "search",
  );
  record(
    "widget-overlap-rejected",
    toast.includes("That change was not saved.") && searchRow?.x === 2
      ? "PASS"
      : "FAIL",
    JSON.stringify({ toast, search: searchRow }),
  );
  const beforeMove = await readStorage(page);
  const minimalId = beforeMove.profiles.find(
    (item) => item.title === "Minimal",
  )?.id;
  const clockBefore = beforeMove.widgets.find(
    (item) => item.profileId === minimalId && item.widgetType === "clock",
  );
  const clock = page.locator("article").filter({ has: page.locator(".week") });
  await clock.getByRole("button", { name: "Move ↓" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const afterKey = await readStorage(page);
  const clockKey = afterKey.widgets.find((item) => item.id === clockBefore?.id);
  record(
    "widget-keyboard-move",
    clockKey && clockBefore && clockKey.y === clockBefore.y + 1
      ? "PASS"
      : "FAIL",
    JSON.stringify({ before: clockBefore, after: clockKey }),
  );

  const handle = clock.getByRole("button", { name: "Move", exact: true });
  const box = await handle.boundingBox();
  if (!box) record("widget-pointer-drag", "FAIL", "Move handle has no box");
  else {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 200, {
      steps: 8,
    });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const afterDrag = await readStorage(page);
    const clockDrag = afterDrag.widgets.find(
      (item) => item.id === clockBefore?.id,
    );
    record(
      "widget-pointer-drag",
      clockDrag && clockKey && clockDrag.y === clockKey.y + 2 ? "PASS" : "FAIL",
      JSON.stringify({ from: clockKey, to: clockDrag }),
    );
  }
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const widgets = await new Promise((resolve, reject) => {
      const tx = db.transaction("widgets", "readonly");
      const request = tx.objectStore("widgets").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("widgets", "readwrite");
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
      for (const widget of widgets) {
        if (widget.widgetType === "clock")
          tx.objectStore("widgets").put({ ...widget, x: -3, w: 3, h: 3 });
        if (widget.widgetType === "search")
          tx.objectStore("widgets").put({ ...widget, x: 0, y: 0 });
      }
    });
  });
  await page.reload();
  const headingOk = await page
    .getByRole("heading", { name: "Venus", exact: true })
    .isVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(200);
  const wide = await widgetBoxes(page);
  await page.setViewportSize({ width: 480, height: 900 });
  await page.waitForTimeout(200);
  const narrow = await widgetBoxes(page);
  const narrowOverlap = narrow.some((left, index) =>
    narrow.slice(index + 1).some((right) => overlaps(left, right)),
  );
  record(
    "widget-invalid-and-reflow",
    headingOk &&
      !narrowOverlap &&
      narrow.every((item) => item.column === "span 1") &&
      narrow.every((item) => item.width > 0)
      ? "PASS"
      : "FAIL",
    JSON.stringify({ headingOk, narrowOverlap, wide, narrow }),
  );
  await page.screenshot({ path: join(evidenceDir, "narrow.png") });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.keyboard.press("Control+k");
  const paletteOpen = await page
    .getByRole("dialog", { name: "Commands" })
    .isVisible();
  await page.keyboard.press("Escape");
  await page.locator("#dashboard-search").focus();
  await page.keyboard.press("Control+k");
  const blocked = await page
    .getByRole("dialog", { name: "Commands" })
    .isVisible();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Filter commands").fill("New note");
  await page.getByRole("button", { name: /New note/ }).click();
  const noteNotice = await page.getByRole("status").innerText();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Filter commands").fill("New task");
  await page.getByRole("button", { name: /New task/ }).click();
  const taskNotice = await page.getByRole("status").innerText();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Filter commands").fill("New event");
  await page.getByRole("button", { name: /New event/ }).click();
  const eventNotice = await page.getByRole("status").innerText();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Filter commands").fill("Start timer");
  await page.getByRole("button", { name: /Start timer/ }).click();
  const timerNotice = await page.getByRole("status").innerText();
  const unavailableOk = [
    noteNotice,
    taskNotice,
    eventNotice,
    timerNotice,
  ].every(
    (text) =>
      text.includes("Nothing was saved.") && !/success|created/i.test(text),
  );
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Filter commands").fill("Toggle edit mode");
  await page.getByRole("button", { name: /Toggle edit mode/ }).click();
  const editing = await page.getByRole("button", { name: "Done" }).isVisible();
  record(
    "command-palette",
    paletteOpen && !blocked && unavailableOk && editing ? "PASS" : "FAIL",
    JSON.stringify({
      paletteOpen,
      blockedWhileSearchFocused: blocked,
      noteNotice,
      taskNotice,
      eventNotice,
      timerNotice,
      editing,
    }),
  );

  await page.getByRole("button", { name: "Quick capture" }).click();
  const capture = await page
    .getByRole("dialog", { name: "Quick capture" })
    .innerText();
  await page.getByRole("button", { name: "Close" }).click();
  record(
    "quick-capture-unavailable",
    capture.includes("Nothing was saved.") ? "PASS" : "FAIL",
    capture,
  );

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Run setup again" }).click();
  await page.getByRole("link", { name: "Venus" }).click();
  await page.getByRole("dialog", { name: "Welcome" }).waitFor();
  for (let step = 0; step < 4; step += 1)
    await page.getByRole("button", { name: "Next" }).click();
  await page
    .getByRole("button", { name: "Request permission bookmarks" })
    .click();
  const denied = await page
    .getByText("Permission was not granted. Setup can continue.")
    .waitFor({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  await page.getByRole("button", { name: "Finish" }).click();
  const finished = await page
    .getByRole("dialog", { name: "Welcome" })
    .isHidden();
  await page.reload();
  const stayed = await page.getByRole("dialog", { name: "Welcome" }).isHidden();
  record(
    "onboarding-finish-and-denial",
    finished && stayed ? "PASS" : "FAIL",
    JSON.stringify({
      deniedMessage: denied,
      finished,
      stayedAfterReload: stayed,
      nativePermission:
        "NOT VERIFIED. A missing grant dialog is not a native deny/revoke proof.",
    }),
  );
  await context.close();
  context = undefined;
} catch (error) {
  record(
    "browser-session",
    "FAIL",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  await context?.close().catch(() => {});
  context = undefined;
}

const migProfile = await mkdtemp(join(tmpdir(), "venus-p01-mig-profile-"));
const migExt = await mkdtemp(join(tmpdir(), "venus-p01-mig-ext-"));
try {
  await writeFile(
    join(migExt, "manifest.json"),
    JSON.stringify({
      manifest_version: 3,
      name: "Venus v1 seed",
      version: "0.0.1",
      chrome_url_overrides: { newtab: "newtab.html" },
    }),
  );
  await writeFile(
    join(migExt, "newtab.html"),
    "<!doctype html><html><head><meta charset='utf-8'></head><body><script src='dexie.min.js'></script><script src='seed.js'></script></body></html>",
  );
  await cp(
    resolve("node_modules/dexie/dist/dexie.min.js"),
    join(migExt, "dexie.min.js"),
  );
  await writeFile(
    join(migExt, "seed.js"),
    `const probe = { id: ${JSON.stringify(probeId)}, dueAt: 5, state: "pending", native: "not_attempted" };
const db = new Dexie("Venus-p00");
db.version(1).stores({ probes: "id,state,dueAt" });
db.open().then(() => db.table("probes").put(probe)).then(() => { document.documentElement.dataset.seeded = "yes"; });`,
  );
  let mig = await launch(migProfile, migExt);
  const seedPage = await mig.newPage();
  await seedPage.goto("chrome://newtab/");
  await seedPage.waitForFunction(
    () => document.documentElement.dataset.seeded === "yes",
    { timeout: 15000 },
  );
  const seeded = await seedPage.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("Venus-p00");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("probes", "readonly");
          const get = tx.objectStore("probes").getAll();
          get.onsuccess = () =>
            resolve({ version: db.version, probes: get.result });
          get.onerror = () => reject(get.error);
        };
      }),
  );
  await mig.close();
  await rm(migExt, { recursive: true, force: true });
  await mkdir(migExt, { recursive: true });
  await cp(extension, migExt, { recursive: true });
  mig = await launch(migProfile, migExt);
  const upgraded = await openNewTab(mig);
  const migrated = await readStorage(upgraded);
  const probe = migrated.probes.find((item) => item.id === probeId);
  record(
    "dexie-v1-to-v2",
    seeded.version === 1 &&
      migrated.version === 2 &&
      probe?.dueAt === 5 &&
      migrated.stores.includes("profiles") &&
      migrated.stores.includes("probes")
      ? "PASS"
      : "FAIL",
    JSON.stringify({
      seeded,
      version: migrated.version,
      probe,
      stores: migrated.stores,
    }),
  );
  await upgraded.screenshot({ path: join(evidenceDir, "migration.png") });
  await mig.close();
} catch (error) {
  record(
    "dexie-v1-to-v2",
    "FAIL",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
}

const faultExt = join(evidenceDir, "fault-extension");
try {
  execFileSync("npm", ["run", "build:chrome"], {
    env: { ...process.env, VITE_VENUS_WIDGET_FAULT: "1" },
    stdio: "inherit",
  });
  await rm(faultExt, { recursive: true, force: true });
  await cp(extension, faultExt, { recursive: true });
  const faultBuildHasString = productionHasFaultString();
  execFileSync("npm", ["run", "build:chrome"], { stdio: "inherit" });
  const restored = productionHasFaultString();
  record(
    "fault-build-restored",
    faultBuildHasString.length > 0 && restored.length === 0 ? "PASS" : "FAIL",
    `fault build files=${faultBuildHasString.length}; restored files=${restored.length}`,
  );
  const faultProfile = await mkdtemp(join(tmpdir(), "venus-p01-fault-"));
  const faultContext = await launch(faultProfile, faultExt);
  const faultPage = await openNewTab(faultContext);
  await skipOnboarding(faultPage);
  await faultPage.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const profiles = await new Promise((resolve, reject) => {
      const request = db
        .transaction("profiles", "readonly")
        .objectStore("profiles")
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const profileId = profiles[0]?.id;
    await new Promise((resolve, reject) => {
      const tx = db.transaction("widgets", "readwrite");
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error);
      const now = new Date().toISOString();
      tx.objectStore("widgets").put({
        id: "22222222-2222-4222-8222-222222222222",
        profileId,
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
  const otherWidgets = await faultPage.locator("article.widget").count();
  await alert.getByRole("button", { name: "Reset widget" }).click();
  await faultPage.waitForTimeout(400);
  const afterReset = await alert.isVisible().catch(() => false);
  record(
    "widget-fault-isolation",
    alertText.includes("The rest of the dashboard is still available.") &&
      otherWidgets > 1 &&
      !afterReset
      ? "PASS"
      : "FAIL",
    JSON.stringify({ alertText, otherWidgets, afterReset }),
  );
  await faultPage.screenshot({
    path: join(evidenceDir, "fault-after-reset.png"),
  });
  await faultContext.close();
  await rm(faultProfile, { recursive: true, force: true });
} catch (error) {
  record(
    "widget-fault-isolation",
    "FAIL",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
}

await rm(profile, { recursive: true, force: true }).catch(() => {});
await rm(migProfile, { recursive: true, force: true }).catch(() => {});
await rm(migExt, { recursive: true, force: true }).catch(() => {});
await rm(faultExt, { recursive: true, force: true }).catch(() => {});
await writeFile(
  join(evidenceDir, "results.json"),
  JSON.stringify(
    { at: new Date().toISOString(), browserVersion, checks },
    null,
    2,
  ),
);
const failed = checks.some((item) => item.status === "FAIL");
process.exit(failed ? 1 : 0);
