import { browserProbes } from "./browser-probes.mjs";
import { chromeLifecycle } from "./chrome-lifecycle.mjs";
import { existsSync } from "node:fs";
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
let context;
const launch = async () => {
  const launched = await chromium.launchPersistentContext(profile, {
    executablePath,
    chromiumSandbox: true,
    headless: process.env.P00_HEADED !== "1",
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  await launched.setOffline(true);
  return launched;
};
try {
  context = await launch();
  const page = await context.newPage();
  await page.goto("chrome://newtab/");
  await page.locator(".hero h1").waitFor({ timeout: 15000 });
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, "chrome-newtab.png") });
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
        version: context.browser()?.version(),
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
  await writeFile(
    join(evidenceDir, "chrome-smoke-failure.json"),
    JSON.stringify(
      {
        executablePath,
        sandbox: true,
        error:
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await context?.close();
  await rm(profile, { recursive: true, force: true });
}
