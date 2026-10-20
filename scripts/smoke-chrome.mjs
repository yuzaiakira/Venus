/* global chrome */
import { browserProbes } from "./browser-probes.mjs";
import { chromeLifecycle } from "./chrome-lifecycle.mjs";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { chromiumExecutable } from "./chromium-executable.mjs";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");
const executablePath = chromiumExecutable(chromium);
if (!executablePath || !existsSync(executablePath))
  throw new Error(
    "Chrome smoke FAILED: no CHROME_BIN/browser executable. No pass or skip.",
  );
if (!existsSync(".output/chrome-mv3/manifest.json"))
  throw new Error("Chrome smoke FAILED: build missing");

const profile = await mkdtemp(join(tmpdir(), "Venus-chrome-"));
const extension = resolve(".output/chrome-mv3");
const evidenceDir = process.env.P00_EVIDENCE_DIR ?? "evidence/P00";
const launchSettings = {
  executablePath,
  chromiumSandbox: true,
  // Chrome only enables unpacked extensions reliably in a headed persistent
  // context. CI supplies the display through xvfb-run.
  headless: false,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
};
const evidence = {
  executablePath,
  sandbox: true,
  launchSettings,
  extension: {
    directory: extension,
    manifest: JSON.parse(
      readFileSync(join(extension, "manifest.json"), "utf8"),
    ),
    serviceWorkers: [],
  },
  consoleErrors: [],
  pageExceptions: [],
};
let context;
let page;

async function collectExtensionEvidence() {
  if (!context) return;
  const workers = context.serviceWorkers();
  evidence.extension.serviceWorkers = await Promise.all(
    workers.map(async (worker) => ({
      url: worker.url(),
      runtime: await worker
        .evaluate(() => ({
          id: chrome.runtime.id,
          manifest: chrome.runtime.getManifest(),
        }))
        .catch((error) => ({ error: String(error) })),
    })),
  );
}

async function collectPageEvidence(stage) {
  if (!page) return;
  evidence.page = {
    stage,
    url: page.url(),
    title: await page.title().catch((error) => `ERROR: ${error}`),
    runtime: await page
      .evaluate(() => ({
        id: chrome.runtime?.id ?? null,
        manifest: chrome.runtime?.getManifest?.() ?? null,
      }))
      .catch((error) => ({ error: String(error) })),
  };
  const [html, body] = await Promise.all([
    page.content().catch((error) => `<!-- ${error} -->`),
    page
      .locator("body")
      .innerHTML()
      .catch((error) => `<!-- ${error} -->`),
  ]);
  await Promise.all([
    writeFile(join(evidenceDir, `chrome-newtab-${stage}.html`), html),
    writeFile(join(evidenceDir, `chrome-newtab-${stage}-body.html`), body),
    page
      .screenshot({ path: join(evidenceDir, `chrome-newtab-${stage}.png`) })
      .catch(() => {}),
  ]);
}

const launch = async () => {
  const launched = await chromium.launchPersistentContext(profile, {
    ...launchSettings,
  });
  await launched.setOffline(true);
  return launched;
};

try {
  await mkdir(evidenceDir, { recursive: true });
  context = await launch();
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: true,
  });
  evidence.version = context.browser()?.version();
  page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") evidence.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => evidence.pageExceptions.push(String(error)));
  if (context.serviceWorkers().length === 0)
    await context
      .waitForEvent("serviceworker", { timeout: 5_000 })
      .catch(() => undefined);
  await collectExtensionEvidence();

  // This must be Chrome's New Tab URL. Opening an extension URL directly does
  // not prove that the extension replaced the browser's New Tab page.
  await page.goto("chrome://newtab/");
  await page
    .getByRole("navigation", { name: "Dashboard", exact: true })
    .waitFor({ timeout: 15_000 });
  await page
    .getByRole("button", { name: "Habit tracker", exact: true })
    .waitFor({ timeout: 15_000 });
  await collectPageEvidence("success");
  await page.screenshot({ path: join(evidenceDir, "chrome-newtab.png") });

  const extensionId = evidence.extension.serviceWorkers
    .map((worker) => worker.runtime?.id)
    .find(Boolean);
  if (!extensionId)
    throw new Error("Chrome extension service worker did not expose an ID");
  if (evidence.page.runtime?.id !== extensionId)
    throw new Error(
      "Chrome New Tab content did not run in the loaded Venus extension",
    );

  const optionsUrl = await page.evaluate(() =>
    globalThis.chrome.runtime.getURL("options.html"),
  );
  await page.goto(optionsUrl);
  await page
    .getByRole("button", { name: "Inspect permissions and manifest" })
    .click();
  await page.getByRole("status").filter({ hasText: '"manifest": 3' }).waitFor();
  const apiEvidence = await page.evaluate(browserProbes);
  const offline = await page.evaluate(() => !globalThis.navigator.onLine);
  if (!offline) throw new Error("Chromium isolated profile is not offline");
  await writeFile(
    join(evidenceDir, "chrome-smoke.json"),
    JSON.stringify(
      {
        ...evidence,
        newtab: "PASS",
        offline,
        apiEvidence,
        apiLifecycle:
          "PARTIAL: permission consent, alarm firing/restart and OS display remain manual",
        homeConsent: "NOT_RUN",
      },
      null,
      2,
    ),
  );
  console.log(
    "Chrome New Tab smoke passed; API lifecycle/manual Home checks remain separate.",
  );
  if (process.env.P00_LIFECYCLE === "1")
    await chromeLifecycle(context, launch, evidenceDir);
} catch (error) {
  await mkdir(evidenceDir, { recursive: true });
  await collectExtensionEvidence();
  await collectPageEvidence("failure");
  evidence.error =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  await writeFile(
    join(evidenceDir, "chrome-smoke-failure.json"),
    JSON.stringify(evidence, null, 2),
  );
  throw error;
} finally {
  if (context) {
    await context.tracing
      .stop({ path: join(evidenceDir, "chrome-newtab-trace.zip") })
      .catch(() => {});
    await context.close();
  }
  await rm(profile, { recursive: true, force: true });
}
