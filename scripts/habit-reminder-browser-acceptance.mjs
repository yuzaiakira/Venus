/* global chrome, document, indexedDB, window */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";
import { chromiumExecutable } from "./chromium-executable.mjs";

// This is a production-extension test. All changes begin at the React UI;
// IndexedDB is inspected read-only only to verify persistence and the outcome
// of the background alarm lifecycle.
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const extension = resolve(".output/chrome-mv3");
const evidenceDir = resolve(
  process.env.P00_EVIDENCE_DIR ?? "evidence/habit-reminder-browser",
);
const executablePath = chromiumExecutable(chromium);
if (!existsSync(join(extension, "manifest.json")))
  throw new Error("Habit browser acceptance: Chrome build missing");
if (!executablePath)
  throw new Error(
    "Habit browser acceptance: no sandbox-capable Chrome executable is available",
  );

const profile = await mkdtemp(join(tmpdir(), "venus-habit-browser-"));
const evidence = {
  browser: null,
  executablePath,
  profile: "disposable",
  permission: "NOT_REQUESTED",
  osNotificationDisplay: "NOT_VERIFIED",
  checks: [],
  consoleErrors: [],
};
await mkdir(evidenceDir, { recursive: true });

async function readHabitData(page, title) {
  return page.evaluate(
    (habitTitle) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("Venus-p00");
        request.onerror = () => reject(request.error ?? new Error("indexedDB"));
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ["habits", "reminderRules", "notificationOccurrences"],
            "readonly",
          );
          const values = { habits: [], rules: [], notifications: [] };
          for (const [store, key] of [
            ["habits", "habits"],
            ["reminderRules", "rules"],
            ["notificationOccurrences", "notifications"],
          ]) {
            transaction.objectStore(store).openCursor().onsuccess = (event) => {
              const cursor = event.target.result;
              if (!cursor) return;
              values[key].push(cursor.value);
              cursor.continue();
            };
          }
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => {
            const habit = values.habits.find((row) => row.title === habitTitle);
            resolve({
              habit,
              rules: values.rules.filter((row) => row.habitId === habit?.id),
              notifications: values.notifications.filter(
                (row) =>
                  row.ownerId === habit?.id && row.sourceKind === "habit",
              ),
            });
          };
        };
      }),
    title,
  );
}

let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    chromiumSandbox: true,
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });
  await context.setOffline(true);
  evidence.browser = context.browser().version();
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") evidence.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => evidence.consoleErrors.push(String(error)));
  await page.goto("chrome://newtab/");
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  await page.getByRole("button", { name: "Skip setup", exact: true }).click();
  await page.locator(".dialog-backdrop").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Habits", exact: true }).click();
  await page
    .getByRole("heading", { name: "Habit tracker", exact: true })
    .waitFor();

  evidence.permission = await page
    .locator(".cluster[role='status']")
    .first()
    .textContent();
  assert.match(
    evidence.permission,
    /notifications/i,
    "Habit Tracker did not expose a notification-permission state",
  );
  evidence.checks.push("notification-permission-state");

  const title = "Browser reminder habit";
  await page.getByLabel("Habit name").fill(title);
  await page.getByLabel("Habit schedule").selectOption("daily");
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  const row = page.locator("li", { hasText: title });
  await row.getByText(title, { exact: true }).waitFor();
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await row.getByLabel("Habit name").fill("Browser reminder habit edited");
  await row.getByRole("button", { name: "Save", exact: true }).click();
  const savedTitle = "Browser reminder habit edited";
  const editedRow = page.locator("li", { hasText: savedTitle });
  await editedRow.getByText(savedTitle, { exact: true }).waitFor();

  const now = new Date();
  const reminderTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  await editedRow.getByRole("checkbox", { name: "Enable reminder" }).check();
  await editedRow.getByLabel("Time").fill(reminderTime);
  await editedRow.getByLabel("Timezone").fill("UTC");
  await editedRow
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await editedRow.getByRole("status").filter({ hasText: "Saved" }).waitFor();

  let stored = await readHabitData(page, savedTitle);
  assert.ok(stored.habit, "Habit was not persisted through the UI");
  assert.deepEqual(stored.habit.reminder, {
    enabled: true,
    time: reminderTime,
    timeZone: "UTC",
    weekdays: [],
  });
  assert.equal(stored.rules.length, 1, "Habit reminder rule was not created");
  assert.ok(
    stored.notifications.some((row) => row.internalStatus === "pending"),
    "Habit occurrence was not materialized",
  );
  evidence.checks.push("create-edit-save-materialize");

  await page.reload();
  await page.getByRole("button", { name: "Habits", exact: true }).click();
  const reloadedRow = page.locator("li", { hasText: savedTitle });
  await reloadedRow
    .getByRole("checkbox", { name: "Enable reminder" })
    .waitFor();
  assert.equal(
    await reloadedRow
      .getByRole("checkbox", { name: "Enable reminder" })
      .isChecked(),
    true,
    "Reminder enabled state did not persist after reload",
  );
  assert.equal(await reloadedRow.getByLabel("Time").inputValue(), reminderTime);
  assert.equal(await reloadedRow.getByLabel("Timezone").inputValue(), "UTC");
  evidence.checks.push("reminder-settings-reload");

  // The occurrence is at this minute. Trigger the existing production sweep
  // alarm instead of calling calendar services or changing IndexedDB.
  await page.evaluate(async () => {
    await chrome.alarms.create("venus-sweep", { when: Date.now() + 50 });
  });
  await page.waitForFunction(
    async (habitTitle) => {
      const request = indexedDB.open("Venus-p00");
      return await new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ["habits", "notificationOccurrences"],
            "readonly",
          );
          const values = { habits: [], notifications: [] };
          transaction.objectStore("habits").openCursor().onsuccess = (
            event,
          ) => {
            const cursor = event.target.result;
            if (!cursor) return;
            values.habits.push(cursor.value);
            cursor.continue();
          };
          transaction
            .objectStore("notificationOccurrences")
            .openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) return;
            values.notifications.push(cursor.value);
            cursor.continue();
          };
          transaction.oncomplete = () => {
            const habit = values.habits.find((row) => row.title === habitTitle);
            resolve(
              values.notifications.some(
                (row) =>
                  row.sourceKind === "habit" &&
                  row.ownerId === habit?.id &&
                  row.internalStatus === "due",
              ),
            );
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    savedTitle,
    { timeout: 15_000 },
  );
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  const notification = page
    .locator("li", { hasText: savedTitle })
    .filter({ hasText: "due" });
  await notification.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByText("completed", { exact: true }).waitFor();
  stored = await readHabitData(page, savedTitle);
  assert.equal(
    stored.habit.checkIns.length,
    1,
    "Done did not add one check-in",
  );
  assert.equal(
    stored.notifications.filter((row) => row.internalStatus === "completed")
      .length,
    1,
    "Done did not complete exactly one occurrence",
  );
  assert.ok(
    stored.notifications.some(
      (row) => row.internalStatus === "pending" && row.attempt === 1,
    ),
    "Completing today did not retain a future daily occurrence",
  );
  evidence.checks.push("alarm-notification-center-done-next-occurrence");
  await page.screenshot({ path: join(evidenceDir, "habit-reminder-en.png") });

  await page.getByRole("button", { name: "Habits", exact: true }).click();
  const completedRow = page.locator("li", { hasText: savedTitle });
  await completedRow
    .getByRole("checkbox", { name: "Enable reminder" })
    .uncheck();
  await completedRow
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await completedRow.getByRole("status").filter({ hasText: "Saved" }).waitFor();
  stored = await readHabitData(page, savedTitle);
  assert.ok(
    stored.notifications.every((row) => row.internalStatus !== "pending"),
    "Disabling a reminder left a future occurrence pending",
  );
  assert.equal(
    stored.notifications.filter((row) => row.internalStatus === "completed")
      .length,
    1,
    "Disabling a reminder changed notification history",
  );
  evidence.checks.push("disable-cancels-future-keeps-history");

  const weeklyTitle = "Browser weekly reminder";
  await page.getByLabel("Habit name").fill(weeklyTitle);
  await page.getByLabel("Habit schedule").selectOption("weekly");
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  const weeklyRow = page.locator("li", { hasText: weeklyTitle });
  await weeklyRow.getByText(weeklyTitle, { exact: true }).waitFor();
  await weeklyRow.getByRole("checkbox", { name: "Enable reminder" }).check();
  await weeklyRow.getByLabel("Time").fill(reminderTime);
  await weeklyRow.getByLabel("Timezone").fill("UTC");
  await weeklyRow
    .locator('[aria-label="Reminder weekdays"]')
    .getByRole("checkbox", { name: "Mon", exact: true })
    .check();
  await weeklyRow
    .getByRole("button", { name: "Save reminder", exact: true })
    .click();
  await weeklyRow.getByRole("status").filter({ hasText: "Saved" }).waitFor();
  const weekly = await readHabitData(page, weeklyTitle);
  assert.deepEqual(weekly.habit.reminder.weekdays, [1]);
  assert.ok(
    weekly.notifications.length > 1 &&
      weekly.notifications.every(
        (row) =>
          new Date(`${row.occurrenceKey.slice(-10)}T00:00:00Z`).getUTCDay() ===
          1,
      ),
    "Weekly reminder did not continue on its selected weekday",
  );
  evidence.checks.push("weekly-weekday-continuation");

  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Language").selectOption("fa");
  await page
    .getByRole("button", { name: "پیگیری عادت‌ها", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "پیگیری عادت‌ها", exact: true })
    .waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() =>
      Boolean(document.documentElement.scrollWidth <= window.innerWidth),
    ),
    true,
    "Habit layout overflows the mobile viewport",
  );
  await page.screenshot({ path: join(evidenceDir, "habit-reminder-fa.png") });
  evidence.checks.push("persian-rtl-responsive");

  await writeFile(
    join(evidenceDir, "habit-reminder-browser.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log("Habit Reminder Chrome browser acceptance passed");
} catch (error) {
  evidence.error =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  const failedPage = context?.pages().at(-1);
  await failedPage
    ?.screenshot({ path: join(evidenceDir, "habit-reminder-failure.png") })
    .catch(() => {});
  await writeFile(
    join(evidenceDir, "habit-reminder-browser.json"),
    JSON.stringify(evidence, null, 2),
  ).catch(() => {});
  throw error;
} finally {
  if (context) {
    await context.tracing
      .stop({ path: join(evidenceDir, "habit-reminder-trace.zip") })
      .catch(() => {});
    await context.close();
  }
  await rm(profile, { recursive: true, force: true });
}
