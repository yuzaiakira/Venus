/* eslint-disable no-undef */
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");
const evidenceDir = process.env.P00_EVIDENCE_DIR ?? "evidence/P03";
const executablePath =
  process.env.CHROME_BIN ??
  [
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].find(existsSync);
if (!executablePath)
  throw new Error("P03 browser acceptance: Chromium missing");
const profile = await mkdtemp(join(tmpdir(), "Venus-p03-chrome-"));
const extension = resolve(".output/chrome-mv3");
const evidence = {
  profile: "disposable",
  clock: "browser wall clock",
  permission: "not requested; notifications permission is absent",
  osDisplay: "unobserved",
};
const launch = async () => {
  const launched = await chromium.launchPersistentContext(profile, {
    executablePath,
    chromiumSandbox: true,
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  await launched.setOffline(true);
  return launched;
};
const readRows = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("Venus-p00");
        open.onerror = () => reject(new Error("indexedDB"));
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(
            ["notificationOccurrences", "timerSessions"],
            "readonly",
          );
          const rows = [];
          const timers = [];
          tx.objectStore("notificationOccurrences").openCursor().onsuccess = (
            event,
          ) => {
            const cursor = event.target.result;
            if (!cursor) return;
            rows.push(cursor.value);
            cursor.continue();
          };
          tx.objectStore("timerSessions").openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) return;
            timers.push(cursor.value);
            cursor.continue();
          };
          tx.oncomplete = () => resolve({ rows, timers });
        };
      }),
  );
let context = await launch();
try {
  const page = await context.newPage();
  await page.goto("chrome://newtab/");
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByRole("button", { name: "Skip setup" }).click();
  await page.locator(".dialog-backdrop").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Calendar" }).click();
  await page.getByRole("button", { name: "Create event" }).waitFor();
  const english = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    offline: !navigator.onLine,
  }));
  evidence.englishCalendar = {
    ...english,
    source: "rendered new tab, offline",
  };
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Language").selectOption("fa");
  await page.goto("chrome://newtab/");
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByRole("button", { name: "تقویم" }).click();
  evidence.persianCalendar = await page.evaluate(() => ({
    dir: document.documentElement.dir,
    offline: !navigator.onLine,
  }));
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, "p03-calendar-fa.png") });
  const due = Date.now() + 2000;
  await page.evaluate(
    (fireAt) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("Venus-p00");
        request.onerror = () => reject(new Error("indexedDB"));
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("notificationOccurrences", "readwrite");
          tx.objectStore("notificationOccurrences").put({
            idempotencyKey: "p03-tab-closed",
            ownerId: "00000000-0000-4000-8000-0000000000a1",
            ruleId: "00000000-0000-4000-8000-0000000000a2",
            occurrenceKey: "gregorian:2026:10:11:00:00:00:UTC",
            fireAtUTC: fireAt,
            internalStatus: "pending",
            read: false,
            seenMissed: false,
            nativeAttempt: "not_started",
            nativeApiStatus: null,
            osDisplay: "unobserved",
            attempt: 1,
            quietHoursOverride: false,
            sourceKind: "event",
            title: "Tab closed",
          });
          tx.oncomplete = () =>
            chrome.alarms
              .create("venus-sweep", { when: fireAt })
              .then(resolve, reject);
          tx.onerror = () => reject(tx.error);
        };
      }),
    due,
  );
  await page.close();
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const afterAlarm = await context.newPage();
  await afterAlarm.goto("chrome://newtab/");
  await afterAlarm.getByRole("heading", { name: "Venus" }).waitFor();
  evidence.tabClosedAlarm = {
    ...(await readRows(afterAlarm)),
    mechanism:
      "real chrome.alarms while the Venus tab was closed and the browser stayed open",
  };
  const restartDue = Date.now() + 1500;
  await afterAlarm.evaluate(
    (fireAt) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("Venus-p00");
        request.onerror = () => reject(new Error("indexedDB"));
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(
            ["notificationOccurrences", "timerSessions"],
            "readwrite",
          );
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
          tx.objectStore("notificationOccurrences").put({
            idempotencyKey: "p03-browser-quit",
            ownerId: "00000000-0000-4000-8000-0000000000b1",
            ruleId: "00000000-0000-4000-8000-0000000000b2",
            occurrenceKey: "gregorian:2026:10:11:01:00:00:UTC",
            fireAtUTC: fireAt,
            internalStatus: "pending",
            read: false,
            seenMissed: false,
            nativeAttempt: "not_started",
            nativeApiStatus: null,
            osDisplay: "unobserved",
            attempt: 1,
            quietHoursOverride: false,
            sourceKind: "event",
            title: "Quit before due",
          });
          tx.objectStore("timerSessions").put({
            id: "00000000-0000-4000-8000-0000000000c1",
            mode: "countdown",
            label: "Overdue",
            status: "running",
            durationMs: 1000,
            startedAtUTC: Date.now() - 5000,
            endsAtUTC: Date.now() - 1000,
            elapsedBeforePauseMs: 0,
            pauseAtUTC: null,
            cycleStep: "work",
            cycleIndex: 1,
            autoNext: false,
            workMs: 1000,
            shortBreakMs: 300000,
            longBreakMs: 900000,
            clockWarning: false,
          });
        };
      }),
    restartDue,
  );
  await context.close();
  await new Promise((resolve) => setTimeout(resolve, 3000));
  context = await launch();
  const reopened = await context.newPage();
  await reopened.goto("chrome://newtab/");
  await reopened.getByRole("heading", { name: "Venus" }).waitFor();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  evidence.restart = {
    ...(await readRows(reopened)),
    mechanism:
      "Chromium process closed before the due instant and the same disposable profile reopened after it",
  };
  await writeFile(
    join(evidenceDir, "p03-browser-acceptance.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log("P03 Chromium acceptance script finished");
} finally {
  await context?.close();
}
