/* eslint-disable no-undef */
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");
const executablePath =
  process.env.CHROME_BIN ??
  [
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].find(existsSync);
if (!executablePath) throw new Error("P04 heading timing: Chromium missing");
if (!existsSync(".output/chrome-mv3/manifest.json"))
  throw new Error("P04 heading timing: Chrome build missing");

function p90(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(0.9 * sorted.length) - 1];
}

const cold = [];
const warm = [];
let resources = [];
let longTasks = null;
let heap = null;
let pluginsOpenMs = null;
const browserVersion = { executablePath };
for (let index = 0; index < 5; index += 1) {
  const profile = await mkdtemp(join(tmpdir(), "venus-p04-cold-"));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: true,
    args: [
      `--disable-extensions-except=${resolve(".output/chrome-mv3")}`,
      `--load-extension=${resolve(".output/chrome-mv3")}`,
    ],
  });
  const page = await context.newPage();
  const started = Date.now();
  await page.goto("chrome://newtab/");
  await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
  cold.push(Date.now() - started);
  if (index === 0) {
    resources = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    longTasks = await page.evaluate(() => {
      const tasks = performance.getEntriesByType("longtask");
      return {
        count: tasks.length,
        totalMs: tasks.reduce((sum, task) => sum + task.duration, 0),
      };
    });
    heap = await page.evaluate(() =>
      performance.memory ? performance.memory.usedJSHeapSize : null,
    );
    browserVersion.version = await page.evaluate(() => navigator.userAgent);
    for (let reload = 0; reload < 5; reload += 1) {
      const warmStarted = Date.now();
      await page.reload();
      await page.getByRole("heading", { name: "Venus", exact: true }).waitFor();
      warm.push(Date.now() - warmStarted);
    }
    const skip = page.getByRole("button", { name: "Skip setup" });
    if (await skip.count()) await skip.click();
    const pluginsStarted = Date.now();
    await page.getByRole("button", { name: "Plugins", exact: true }).click();
    await page.getByRole("heading", { name: "Builder" }).waitFor();
    pluginsOpenMs = Date.now() - pluginsStarted;
  }
  await context.close();
  await rm(profile, { recursive: true, force: true });
}

const result = {
  method:
    "Timer starts at page.goto or reload after the browser process is already running, and stops when the Venus heading is visible. It excludes process startup. p90 uses nearest rank ceil(0.9*n).",
  coldMs: cold,
  warmMs: warm,
  coldP90: p90(cold),
  warmP90: p90(warm),
  tokensOnOrdinaryNewTab: resources.some((name) =>
    name.includes("/chunks/tokens-"),
  ),
  pluginsOpenMs,
  longTasks,
  heap,
  browser: browserVersion,
  historicalP01: {
    coldP90: 71,
    warmP90: 45,
    browser: "Chromium 153.0.8010.52",
  },
};
await mkdir("evidence/P04", { recursive: true });
await writeFile(
  "evidence/P04/p04-heading.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
