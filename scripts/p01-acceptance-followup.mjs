/* global chrome, indexedDB, document, getComputedStyle */
// Historical P01 follow-up. It expects Quick Capture, including New note, to save nothing.
// Current acceptance is scripts/p02-acceptance.mjs. A run rewrites evidence/P01/acceptance.
if (process.env.VENUS_RUN_HISTORICAL_P01 !== "1") {
  console.error(
    "Historical P01 follow-up runner. It still expects New note to remain unsaved. Current runner: scripts/p02-acceptance.mjs. Set VENUS_RUN_HISTORICAL_P01=1 to re-run and overwrite evidence/P01/acceptance.",
  );
  process.exit(3);
}
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");
const executablePath = ["/usr/bin/google-chrome", "/usr/bin/chromium"].find(
  existsSync,
);
const extension = resolve(".output/chrome-mv3");
const evidenceDir = resolve("evidence/P01/acceptance");
await mkdir(evidenceDir, { recursive: true });
const checks = [];
const record = (id, status, detail) => {
  checks.push({ id, status, detail });
  console.log(`${status} ${id}: ${detail}`);
};

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
  const button = page.getByRole("button", { name: "Skip setup" });
  if ((await button.count()) > 0) await button.click({ force: true });
  await page.waitForFunction(async () => {
    const stored = await chrome.storage.local.get("venus.bootstrap");
    return stored["venus.bootstrap"]?.onboardingComplete === true;
  });
  const stillOpen = await page
    .getByRole("dialog", { name: "Welcome" })
    .isVisible();
  if (stillOpen) await page.reload();
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  const hidden = await page.getByRole("dialog", { name: "Welcome" }).isHidden();
  if (!hidden) {
    const onboardingComplete = await page.evaluate(async () => {
      const stored = await chrome.storage.local.get("venus.bootstrap");
      return stored["venus.bootstrap"]?.onboardingComplete ?? null;
    });
    throw new Error(
      `Welcome stayed open after skip; stored onboardingComplete=${String(onboardingComplete)}; neededReload=${String(stillOpen)}`,
    );
  }
  return stillOpen;
}
async function clockText(page) {
  await page.locator("article .week").first().waitFor();
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
    clock:
      document.querySelector("article .week")?.parentElement?.innerText ?? "",
    week: [...document.querySelectorAll("article .week span")].map(
      (node) => node.textContent,
    ),
  }));
}

const profile = await mkdtemp(join(tmpdir(), "venus-p01-follow-"));
let context = await launch(profile, extension);
try {
  let page = await openNewTab(context);
  const other = await openNewTab(context);
  const skipNeededReload = await skip(page);
  await other.waitForTimeout(1000);
  const otherClosedLive = await other
    .getByRole("dialog", { name: "Welcome" })
    .isHidden();
  record(
    "onboarding-skip-live-update",
    !skipNeededReload && otherClosedLive ? "PASS" : "FAIL",
    JSON.stringify({
      writerStillShowedDialogUntilReload: skipNeededReload,
      otherTabClosedWithoutReload: otherClosedLive,
    }),
  );
  await other.close();
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Theme").selectOption("light");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  let light = await clockText(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Theme").selectOption("dark");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const dark = await clockText(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Theme").selectOption("system");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const systemDark = await clockText(page);
  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  const systemLight = await clockText(page);
  record(
    "theme-light-dark-system",
    light.theme === "light" &&
      light.canvas === "#f6f6fb" &&
      dark.theme === "dark" &&
      dark.canvas === "#111827" &&
      systemDark.theme === "system" &&
      systemDark.canvas === "#111827" &&
      systemLight.theme === "system" &&
      systemLight.canvas === "#f6f6fb"
      ? "PASS"
      : "FAIL",
    JSON.stringify({
      light: { theme: light.theme, canvas: light.canvas },
      dark: { theme: dark.theme, canvas: dark.canvas },
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
  const faPersian = await clockText(page);
  await page.getByRole("link", { name: "تنظیمات" }).click();
  await page.getByLabel("ارقام").selectOption("latin");
  await page.getByText("ذخیره شد", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const faLatin = await clockText(page);
  await page.getByRole("link", { name: "تنظیمات" }).click();
  await page.getByLabel("زبان").selectOption("en");
  await page.getByLabel("Numerals").selectOption("persian");
  await page.getByLabel("Calendar").selectOption("gregorian");
  await page.getByLabel("Hour format").selectOption("12");
  await page.getByLabel("Week start").selectOption("1");
  await page.getByLabel("Time zone").fill("Pacific/Honolulu");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const enPersian = await clockText(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Numerals").selectOption("latin");
  await page.getByLabel("Calendar").selectOption("jalali");
  await page.getByLabel("Hour format").selectOption("24");
  await page.getByLabel("Time zone").fill("Asia/Tehran");
  await page.getByText("Saved", { exact: true }).first().waitFor();
  await page.getByRole("link", { name: "Venus" }).click();
  const enJalali = await clockText(page);
  await page.close();
  page = await openNewTab(context);
  const stored = await page.evaluate(
    async () =>
      (await chrome.storage.local.get("venus.bootstrap"))["venus.bootstrap"],
  );
  const faOk =
    faPersian.dir === "rtl" &&
    /[۰-۹]/.test(faPersian.clock) &&
    faPersian.clock.includes("مهر") &&
    faPersian.week[0] === "شنبه";
  const splitOk =
    faLatin.dir === "rtl" &&
    !/[۰-۹]/.test(faLatin.clock) &&
    faLatin.clock.includes("1405") &&
    enPersian.dir === "ltr" &&
    /[۰-۹]/.test(enPersian.clock) &&
    /AM|PM/.test(enPersian.clock) &&
    enPersian.week[0] === "Mon" &&
    enJalali.clock.includes("Mehr") &&
    enJalali.clock.includes("1405") &&
    !/AM|PM/.test(enJalali.clock);
  record(
    "i18n-browser",
    faOk && splitOk ? "PASS" : "FAIL",
    JSON.stringify({ faPersian, faLatin, enPersian, enJalali, stored }),
  );

  await page.locator("#dashboard-search").focus();
  await page.keyboard.press("Control+k");
  const blocked = await page
    .getByRole("dialog", { name: "Commands" })
    .isVisible();
  await page.locator("#dashboard-search").blur();
  await page.locator("h1").click();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Filter commands").waitFor();
  const notices = {};
  for (const label of ["New note", "New task", "New event", "Start timer"]) {
    await page.keyboard.press("Escape");
    await page.locator("h1").click();
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Filter commands").waitFor();
    await page.getByPlaceholder("Filter commands").fill(label);
    await page.getByRole("button", { name: new RegExp(label) }).click();
    notices[label] = await page.getByRole("status").innerText();
  }
  await page.keyboard.press("Escape");
  await page.locator("h1").click();
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Filter commands").waitFor();
  await page.getByPlaceholder("Filter commands").fill("Toggle edit mode");
  await page.getByRole("button", { name: /Toggle edit mode/ }).click();
  const editing = await page.getByRole("button", { name: "Done" }).isVisible();
  await page.getByRole("button", { name: "Quick capture" }).click();
  const capture = await page
    .getByRole("dialog", { name: "Quick capture" })
    .innerText();
  await page.getByRole("button", { name: "Close" }).click();
  const unavailableOk = Object.values(notices).every(
    (text) =>
      text.includes("Nothing was saved.") && !/created|success/i.test(text),
  );
  record(
    "command-palette",
    blocked === false && unavailableOk && editing ? "PASS" : "FAIL",
    JSON.stringify({
      blockedWhileSearchFocused: blocked,
      notices,
      editing,
      capture,
    }),
  );
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
  const finishEnabled = await page
    .getByRole("button", { name: "Finish" })
    .isEnabled();
  await page.getByRole("button", { name: "Finish" }).click();
  await page
    .getByRole("dialog", { name: "Welcome" })
    .waitFor({ state: "hidden" });
  await page.reload();
  const stayed = await page.getByRole("dialog", { name: "Welcome" }).isHidden();
  record(
    "onboarding-finish-and-denial",
    finishEnabled && stayed ? "PASS" : "FAIL",
    JSON.stringify({
      deniedMessage: denied,
      finishEnabled,
      stayedAfterReload: stayed,
      nativePermission: "NOT VERIFIED",
    }),
  );
  await context.close();
} catch (error) {
  record(
    "followup-session",
    "FAIL",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  await context.close().catch(() => {});
}

const faultExt = join(evidenceDir, "fault-extension");
try {
  execFileSync("npm", ["run", "build:chrome"], {
    env: { ...process.env, VITE_VENUS_WIDGET_FAULT: "1" },
    stdio: "inherit",
  });
  await rm(faultExt, { recursive: true, force: true });
  await cp(extension, faultExt, { recursive: true });
  execFileSync("npm", ["run", "build:chrome"], { stdio: "inherit" });
  const faultProfile = await mkdtemp(join(tmpdir(), "venus-p01-fault2-"));
  const faultContext = await launch(faultProfile, faultExt);
  const faultPage = await openNewTab(faultContext);
  await skip(faultPage);
  await faultPage.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
    const profiles = await new Promise((resolve, reject) => {
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
  await faultPage.reload();
  await skip(faultPage);
  const alert = faultPage.getByRole("alert");
  const alertText = await alert.innerText();
  const heading = await faultPage
    .getByRole("heading", { name: "Venus", exact: true })
    .isVisible();
  const others = await faultPage.locator("article.widget").count();
  await alert
    .getByRole("button", { name: "Reset widget" })
    .click({ force: true });
  await faultPage.waitForTimeout(500);
  const stillFailed = await alert.isVisible().catch(() => false);
  record(
    "widget-fault-isolation",
    heading &&
      others > 1 &&
      alertText.includes("The rest of the dashboard is still available.") &&
      !stillFailed
      ? "PASS"
      : "FAIL",
    JSON.stringify({ heading, others, alertText, stillFailed }),
  );
  await faultPage.screenshot({
    path: join(evidenceDir, "fault-after-reset.png"),
  });
  await faultContext.close();
  await rm(faultProfile, { recursive: true, force: true });
  await rm(faultExt, { recursive: true, force: true });
} catch (error) {
  record(
    "widget-fault-isolation",
    "FAIL",
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
}

await rm(profile, { recursive: true, force: true }).catch(() => {});
await writeFile(
  join(evidenceDir, "followup.json"),
  JSON.stringify({ at: new Date().toISOString(), checks }, null, 2),
);
process.exit(checks.some((item) => item.status === "FAIL") ? 1 : 0);
