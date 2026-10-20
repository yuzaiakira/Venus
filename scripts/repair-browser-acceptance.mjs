import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { chromiumExecutable } from "./chromium-executable.mjs";

// Exercise the production extension, offline, in an isolated profile. Never
// disable the browser sandbox to make acceptance pass on an unsupported host.
const evidence = resolve(
  process.env.VENUS_REPAIR_EVIDENCE ?? "evidence/repair/browser",
);
await mkdir(evidence, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "venus-repair-"));
const executablePath = chromiumExecutable(chromium);
const extension = resolve(".output/chrome-mv3");
const results = [];
let context;
let stage = "browser startup";
const errors = [];
async function check(label, work) {
  stage = label;
  await work();
  results.push({ label, status: "PASS" });
}
try {
  assert.ok(existsSync(join(extension, "manifest.json")), "Build Chrome first");
  context = await chromium.launchPersistentContext(profile, {
    ...(executablePath ? { executablePath } : {}),
    chromiumSandbox: true,
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  await context.setOffline(true);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("chrome://newtab/");
  await page.locator(".hero h1").waitFor();
  await page.getByRole("button", { name: "Skip setup", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const nav = (name) =>
    page
      .locator(".side-nav")
      .getByRole("button", { name, exact: true })
      .click();
  await check("offline startup and profile layout", async () => {
    assert.equal(await page.evaluate(() => globalThis.navigator.onLine), false);
    await page
      .locator(".side-bottom")
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Productivity", exact: true })
      .click();
    await page.locator(".profile-switch").click();
    await page
      .getByRole("menuitem")
      .filter({ hasText: "Productivity" })
      .click();
    await nav("Dashboard");
    await expect(
      page.getByRole("heading", { name: "Today's priorities", exact: true }),
    ).toBeVisible();
  });
  await check(
    "task create, labels, checklist, column movement and dashboard synchronization",
    async () => {
      await nav("Tasks");
      const tasks = page.getByRole("region", { name: "Tasks", exact: true });
      await tasks
        .getByLabel("Title", { exact: true })
        .fill("Repair acceptance task");
      await tasks
        .getByRole("button", { name: "New task", exact: true })
        .click();
      await tasks
        .getByRole("button", { name: "Repair acceptance task", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Edit task",
        exact: true,
      });
      await dialog
        .getByLabel("Details", { exact: true })
        .fill("Persistent authoritative record");
      await dialog.getByLabel("Labels (comma separated)").fill("Work, Repair");
      await dialog.getByLabel("Column", { exact: true }).selectOption("doing");
      await dialog.getByLabel("Today's priorities", { exact: true }).check();
      await dialog
        .getByLabel("Checklist item", { exact: true })
        .fill("Check persistence");
      await dialog
        .getByRole("button", { name: "Add item", exact: true })
        .click();
      await dialog
        .getByRole("checkbox", { name: "Check persistence", exact: true })
        .check();
      await dialog
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(page.locator(".column-doing .task-card-title")).toHaveText(
        "Repair acceptance task",
      );
      await page.screenshot({
        path: join(evidence, "tasks-1440.png"),
        fullPage: true,
      });
      await nav("Dashboard");
      await page
        .getByRole("button", { name: "Repair acceptance task", exact: true })
        .click();
      await dialog.getByLabel("Column", { exact: true }).selectOption("done");
      await dialog
        .getByRole("button", { name: "Save task", exact: true })
        .click();
      await expect(
        page.getByRole("checkbox", {
          name: "Repair acceptance task",
          exact: true,
        }),
      ).toBeChecked();
      await page.reload();
      await page.locator(".hero h1").waitFor();
      await expect(
        page.getByRole("checkbox", {
          name: "Repair acceptance task",
          exact: true,
        }),
      ).toBeChecked();
      await nav("Tasks");
      await expect(page.locator(".column-done .task-card-title")).toHaveText(
        "Repair acceptance task",
      );
    },
  );
  await check(
    "note create, edit, pin, archive, restore, reload and selected dashboard navigation",
    async () => {
      await nav("Notes");
      const notes = page.getByRole("region", { name: "Notes", exact: true });
      await notes
        .getByRole("button", { name: "New note", exact: true })
        .click();
      const editor = notes.locator("form[data-note-revision]");
      await editor
        .getByLabel("Title", { exact: true })
        .fill("Repair acceptance note");
      await editor
        .locator("textarea")
        .first()
        .fill("Safe persistent text <script>inert</script>");
      await expect(editor.locator('[data-save-status="saved"]')).toBeVisible();
      await editor.getByRole("button", { name: "Pin", exact: true }).click();
      await expect(
        editor.getByRole("button", { name: "Unpin", exact: true }),
      ).toBeVisible();
      await editor
        .getByRole("button", { name: "Archive", exact: true })
        .click();
      await expect(
        editor.getByRole("button", { name: "Restore", exact: true }),
      ).toBeVisible();
      await editor
        .getByRole("button", { name: "Restore", exact: true })
        .click();
      await nav("Dashboard");
      await page
        .getByRole("button", { name: /Repair acceptance note/ })
        .click();
      await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
        "Repair acceptance note",
      );
      await page.screenshot({
        path: join(evidence, "notes-1440.png"),
        fullPage: true,
      });
      await page.reload();
      await page.locator(".hero h1").waitFor();
      await nav("Notes");
      await notes
        .getByRole("button", { name: "Repair acceptance note", exact: true })
        .click();
      await expect(editor.locator("textarea").first()).toHaveValue(
        "Safe persistent text <script>inert</script>",
      );
    },
  );
  await check(
    "desktop and mobile module layout with accessible Settings",
    async () => {
      await nav("Dashboard");
      await page.screenshot({
        path: join(evidence, "dashboard-1440.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.locator(".mobile-settings")).toBeVisible();
      await page.screenshot({
        path: join(evidence, "dashboard-390.png"),
        fullPage: true,
      });
      await nav("Tasks");
      await expect(page.locator(".task-board")).toBeVisible();
      assert.equal(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
        true,
        "Mobile document must not overflow",
      );
      await page.screenshot({
        path: join(evidence, "tasks-390.png"),
        fullPage: true,
      });
      await nav("Notes");
      await page.screenshot({
        path: join(evidence, "notes-390.png"),
        fullPage: true,
      });
      await page.locator(".mobile-settings").click();
      await expect(page.locator(".settings-screen")).toBeVisible();
    },
  );
  await check("Persian RTL mobile dashboard", async () => {
    await page.getByLabel("Language", { exact: true }).selectOption("fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.locator(".side-nav button").first().click();
    await page.screenshot({
      path: join(evidence, "dashboard-fa-390.png"),
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
      true,
    );
  });
  await check("no unhandled page runtime errors", async () => {
    assert.deepEqual(errors, []);
  });
  await writeFile(
    join(evidence, "results.json"),
    JSON.stringify(
      {
        status: "PASS",
        checks: results,
        note: "Screenshots capture this implementation; approved-design fidelity requires the owner's missing reference.",
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    join(evidence, "results.json"),
    JSON.stringify(
      {
        status: stage === "browser startup" ? "BLOCKED" : "FAIL",
        failedStage: stage,
        completedChecks: results,
        error: String(error),
        runtimeErrors: errors,
      },
      null,
      2,
    ),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
