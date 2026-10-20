import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Select } from "selenium-webdriver";

function readHabitData(driver, title) {
  return driver.executeAsyncScript(
    `
      const title = arguments[0];
      const done = arguments[arguments.length - 1];
      const request = indexedDB.open("Venus-p00");
      request.onerror = () => done({ error: String(request.error) });
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
        transaction.onerror = () => done({ error: String(transaction.error) });
        transaction.oncomplete = () => {
          const habit = values.habits.find((row) => row.title === title);
          done({
            habit,
            rules: values.rules.filter((row) => row.habitId === habit?.id),
            notifications: values.notifications.filter(
              (row) => row.ownerId === habit?.id && row.sourceKind === "habit",
            ),
          });
        };
      };
    `,
    title,
  );
}

async function setReactInput(driver, element, value) {
  await driver.executeScript(
    `
      const input = arguments[0];
      const value = arguments[1];
      const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(input), "value",
      ).set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    `,
    element,
    value,
  );
}

// Exercises real controls in Firefox's installed, temporary extension. Database
// access is read-only and only verifies effects caused by the UI and alarm.
export async function verifyHabitReminderFirefox(driver, By, evidenceDir) {
  const evidence = {
    browser: "firefox",
    permission: "NOT_REQUESTED",
    osNotificationDisplay: "NOT_VERIFIED",
    checks: [],
  };
  await mkdir(evidenceDir, { recursive: true });
  try {
    const title = "Firefox reminder habit";
    const skipSetup = await driver.findElements(
      By.xpath("//button[normalize-space()='Skip setup']"),
    );
    if (skipSetup.length > 0) {
      await skipSetup[0].click();
      await driver.wait(
        async () =>
          (await driver.findElements(By.css(".dialog-backdrop"))).length === 0,
        10_000,
        "Firefox onboarding dialog did not close after Skip setup",
      );
    }
    await driver.findElement(By.css('[aria-label="Habit tracker"]')).click();
    await driver.wait(
      async () =>
        (
          await driver.findElements(
            By.xpath("//h1[normalize-space()='Habit tracker']"),
          )
        ).length > 0,
      10_000,
      "Firefox did not open the Habit tracker screen",
    );
    evidence.permission = await driver
      .findElement(By.css(".cluster[role='status']"))
      .getText();
    assert.match(
      evidence.permission,
      /notifications/i,
      "Habit Tracker did not expose a Firefox notification-permission state",
    );
    evidence.checks.push("notification-permission-state");
    const name = await driver.findElement(By.css('[aria-label="Habit name"]'));
    await name.sendKeys(title);
    await driver
      .findElement(By.xpath("//button[normalize-space()='Add habit']"))
      .click();
    const row = await driver.findElement(
      By.xpath(`//li[.//strong[normalize-space()=${JSON.stringify(title)}]]`),
    );
    const enabled = await row.findElement(
      By.xpath(".//input[@type='checkbox']"),
    );
    await enabled.click();
    const now = new Date();
    const time = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
    await setReactInput(
      driver,
      await row.findElement(By.css('input[type="time"]')),
      time,
    );
    await setReactInput(
      driver,
      await row.findElement(
        By.xpath(".//label[contains(., 'Timezone')]//input"),
      ),
      "UTC",
    );
    await row
      .findElement(By.xpath(".//button[normalize-space()='Save reminder']"))
      .click();
    await driver.wait(
      async () =>
        (await row.findElement(By.css('[role="status"]')).getText()) ===
        "Saved",
      10_000,
      "Firefox did not report that the reminder was saved",
    );
    let stored = await readHabitData(driver, title);
    assert.ok(!stored.error, stored.error);
    assert.deepEqual(stored.habit?.reminder, {
      enabled: true,
      time,
      timeZone: "UTC",
      weekdays: [],
    });
    assert.equal(stored.rules.length, 1);
    assert.ok(
      stored.notifications.some((row) => row.internalStatus === "pending"),
    );
    evidence.checks.push("create-save-materialize");

    await driver.executeAsyncScript(
      `
        const done = arguments[arguments.length - 1];
        browser.alarms.create("venus-sweep", { when: Date.now() + 50 })
          .then(() => done({ ok: true }), (error) => done({ error: String(error) }));
      `,
    );
    await driver.wait(
      async () => {
        stored = await readHabitData(driver, title);
        return stored.notifications.some((row) => row.internalStatus === "due");
      },
      15_000,
      "Firefox background sweep did not reconcile the habit occurrence",
    );
    await driver.findElement(By.css('[aria-label="Notifications"]')).click();
    await driver
      .findElement(
        By.xpath(
          `//li[.//bdi[normalize-space()=${JSON.stringify(title)}]]//button[normalize-space()='Done']`,
        ),
      )
      .click();
    await driver.wait(
      async () => {
        stored = await readHabitData(driver, title);
        return (
          stored.habit?.checkIns.length === 1 &&
          stored.notifications.filter(
            (row) => row.internalStatus === "completed",
          ).length === 1
        );
      },
      10_000,
      "Firefox Done action did not persist exactly one habit check-in",
    );
    assert.ok(
      stored.notifications.some((row) => row.internalStatus === "pending"),
      "Firefox completion did not retain the next daily occurrence",
    );
    evidence.checks.push("alarm-notification-center-done-next-occurrence");
    await writeFile(
      join(evidenceDir, "habit-reminder-firefox-en.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"),
    );

    const notificationToggle = await driver.findElement(
      By.css('[aria-label="Notifications"]'),
    );
    if ((await notificationToggle.getAttribute("aria-expanded")) === "true") {
      await notificationToggle.click();
      await driver.wait(
        async () =>
          (
            await driver.findElements(
              By.xpath(
                "//section[contains(@class, 'menu')][.//h2[normalize-space()='Notifications']]",
              ),
            )
          ).length === 0,
        10_000,
        "Firefox Notification Center did not close before opening Settings",
      );
    }
    await driver.findElement(By.css('[aria-label="Settings"]')).click();
    await driver.wait(
      async () =>
        (
          await driver.findElements(
            By.xpath(
              "//main[contains(@class, 'settings-screen')]//h1[normalize-space()='Settings']",
            ),
          )
        ).length > 0,
      10_000,
      "Firefox did not open Settings",
    );
    const language = await driver.findElement(
      By.xpath(
        "//main[contains(@class, 'settings-screen')]//label[contains(normalize-space(), 'Language')]//select",
      ),
    );
    await new Select(language).selectByValue("fa");
    await driver.wait(
      async () =>
        (await driver.executeScript(
          "return document.documentElement.dir === 'rtl' && document.documentElement.lang === 'fa'",
        )) === true,
      10_000,
      "Firefox did not switch the Habit UI to RTL",
    );
    await driver.navigate().refresh();
    await driver.wait(
      async () =>
        (await driver.executeScript(
          "return document.documentElement.dir === 'rtl' && document.documentElement.lang === 'fa'",
        )) === true,
      10_000,
      "Firefox did not persist the Persian locale after reload",
    );
    await driver.findElement(By.css('[aria-label="تنظیمات"]')).click();
    const persistedLanguage = await driver.findElement(
      By.xpath(
        "//main[contains(@class, 'settings-screen')]//label[contains(normalize-space(), 'زبان')]//select",
      ),
    );
    assert.equal(
      await driver.executeScript(
        "return arguments[0].value",
        persistedLanguage,
      ),
      "fa",
      "Firefox did not save the Persian locale",
    );
    await driver.findElement(By.css('[aria-label="پیگیری عادت"]')).click();
    await driver.wait(
      async () =>
        (
          await driver.findElements(
            By.xpath("//h1[normalize-space()='پیگیری عادت']"),
          )
        ).length > 0,
      10_000,
      "Firefox did not render Habit tracker in Persian",
    );
    await driver.manage().window().setRect({ width: 390, height: 844 });
    assert.equal(
      await driver.executeScript(
        "return document.documentElement.scrollWidth <= window.innerWidth",
      ),
      true,
      "Firefox Habit UI overflows the mobile viewport",
    );
    evidence.checks.push("persian-rtl-persisted-responsive");
    await writeFile(
      join(evidenceDir, "habit-reminder-firefox-fa.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"),
    );
    await writeFile(
      join(evidenceDir, "habit-reminder-firefox.json"),
      JSON.stringify(evidence, null, 2),
    );
    return evidence;
  } catch (error) {
    evidence.error =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    await writeFile(
      join(evidenceDir, "habit-reminder-firefox-failure.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"),
    ).catch(() => {});
    await writeFile(
      join(evidenceDir, "habit-reminder-firefox.json"),
      JSON.stringify(evidence, null, 2),
    ).catch(() => {});
    throw error;
  }
}
