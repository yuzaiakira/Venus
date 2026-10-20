/**
 * Standalone Firefox WebDriver shutdown diagnostics for P00.
 * Does not install Venus unless a scenario requests it.
 * Records assertion-phase and teardown-phase results separately.
 */
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const evidenceRoot =
  process.env.P00_EVIDENCE_DIR ?? "evidence/P00/webdriver-resolution/diagnose";
const binary = process.env.FIREFOX_BIN ?? "/usr/bin/firefox";
const cachedDriver = existsSync(".browser-cache/driver.json")
  ? JSON.parse(readFileSync(".browser-cache/driver.json", "utf8")).geckodriver
  : undefined;
const driverPath = process.env.GECKODRIVER_BIN ?? cachedDriver;
if (!existsSync(binary)) throw new Error("Firefox binary missing");
if (!driverPath || !existsSync(driverPath))
  throw new Error("geckodriver missing");

const { Builder } = await import("selenium-webdriver");
const firefox = await import("selenium-webdriver/firefox.js");

const scenarios = (
  process.env.P00_WD_SCENARIOS ??
  "bare,chrome-context,offline-restore,p00-addon"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

await mkdir(evidenceRoot, { recursive: true });

async function runScenario(name) {
  const scratch = await mkdtemp(join(tmpdir(), "Venus-wd-diag-"));
  const logPath = join(evidenceRoot, `${name}-geckodriver.log`);
  const logFd = openSync(logPath, "a");
  const result = {
    scenario: name,
    assertions: { status: "NOT_RUN" },
    teardown: { status: "NOT_RUN", stages: [] },
    versions: {},
    geckodriverLog: logPath,
    scratch,
  };
  const wrapper = join(scratch, "firefox-wrapper.sh");
  await writeFile(
    wrapper,
    `#!/bin/sh\nexec '${binary.replaceAll("'", "'\\''")}' -remote-allow-system-access "$@"\n`,
    { mode: 0o755 },
  );
  const options = new firefox.Options()
    .setBinary(wrapper)
    .addArguments("-headless");
  const service = new firefox.ServiceBuilder(driverPath)
    .addArguments("--allow-system-access")
    .enableVerboseLogging(true)
    .setStdio(["ignore", logFd, logFd]);
  let driver;
  try {
    driver = await new Builder()
      .forBrowser("firefox")
      .setFirefoxOptions(options)
      .setFirefoxService(service)
      .build();
    result.versions.browser = (await driver.getCapabilities()).get(
      "browserVersion",
    );
    result.versions.geckodriver = execFileSync(driverPath, ["--version"], {
      encoding: "utf8",
    }).split("\n")[0];
    result.versions.selenium = JSON.parse(
      readFileSync(
        new URL(
          "../node_modules/selenium-webdriver/package.json",
          import.meta.url,
        ),
      ),
    ).version;

    if (name === "bare") {
      await driver.get("about:blank");
      const title = await driver.getTitle();
      result.assertions = { status: "PASS", title };
    } else if (name === "chrome-context") {
      await driver.get("about:blank");
      await driver.setContext("chrome");
      const ok = await driver.executeScript("return !!Services;");
      result.assertions = {
        status: "PASS",
        chromeServices: ok,
        leftInChromeContext: true,
      };
    } else if (name === "offline-restore") {
      await driver.get("about:blank");
      await driver.setContext("chrome");
      await driver.executeScript(`
        Services.io.manageOfflineStatus = false;
        Services.io.offline = true;
      `);
      await driver.setContext("content");
      const offline = await driver.executeScript("return !navigator.onLine");
      await driver.setContext("chrome");
      await driver.executeScript(`
        Services.io.offline = false;
        Services.io.manageOfflineStatus = true;
      `);
      result.assertions = {
        status: offline ? "PASS" : "FAIL",
        offlineObserved: offline,
        restoredThenLeftInChromeContext: true,
      };
    } else if (name === "p00-addon") {
      if (!existsSync(".output/firefox-mv3/manifest.json"))
        throw new Error("P00 build missing");
      const archive = join(scratch, "extension.xpi");
      execFileSync("python3", [
        "-c",
        'import zipfile,pathlib,sys; root=pathlib.Path(".output/firefox-mv3"); z=zipfile.ZipFile(sys.argv[1],"w"); [z.write(p,p.relative_to(root)) for p in root.rglob("*") if p.is_file()]; z.close()',
        archive,
      ]);
      await driver.installAddon(archive, true);
      await driver.setContext("chrome");
      const newTabURL = await driver.executeScript(`
        const { AboutNewTab } = ChromeUtils.importESModule(
          "resource:///modules/AboutNewTab.sys.mjs",
        );
        return AboutNewTab.newTabURL;
      `);
      await driver.setContext("content");
      await driver.get(newTabURL);
      const heading = await driver.executeScript(
        'return document.querySelector("h1")?.textContent ?? null',
      );
      // Match smoke finally: restore offline path not used; leave content context.
      result.assertions = {
        status: heading === "Venus" ? "PASS" : "FAIL",
        heading,
        newTabURL,
      };
    } else if (name === "p00-addon-smoke-teardown") {
      if (!existsSync(".output/firefox-mv3/manifest.json"))
        throw new Error("P00 build missing");
      const archive = join(scratch, "extension.xpi");
      execFileSync("python3", [
        "-c",
        'import zipfile,pathlib,sys; root=pathlib.Path(".output/firefox-mv3"); z=zipfile.ZipFile(sys.argv[1],"w"); [z.write(p,p.relative_to(root)) for p in root.rglob("*") if p.is_file()]; z.close()',
        archive,
      ]);
      await driver.installAddon(archive, true);
      await driver.setContext("chrome");
      await driver.executeScript(`
        Services.io.manageOfflineStatus = false;
        Services.io.offline = true;
        BrowserCommands.openTab();
      `);
      await driver.setContext("content");
      await driver.wait(
        async () => (await driver.getAllWindowHandles()).length >= 1,
        15000,
      );
      const heading = await driver
        .executeScript(
          'return document.querySelector("h1")?.textContent ?? null',
        )
        .catch(() => null);
      result.assertions = { status: "PASS", headingNote: heading };
      // Exact smoke finally prelude
      await driver.setContext("chrome");
      await driver.executeScript(`
        Services.io.offline = false;
        Services.io.manageOfflineStatus = true;
      `);
      result.teardown.stages.push({ stage: "offline-restore", status: "PASS" });
    } else {
      throw new Error("Unknown scenario: " + name);
    }

    try {
      const context = await driver.getContext();
      result.teardown.stages.push({
        stage: "get-context-before-quit",
        status: "PASS",
        value: context,
      });
    } catch (error) {
      result.teardown.stages.push({
        stage: "get-context-before-quit",
        status: "FAIL",
        error: String(error),
      });
    }
    try {
      await driver.quit();
      result.teardown.stages.push({ stage: "quit", status: "PASS" });
      result.teardown.status = "PASS";
      driver = undefined;
    } catch (error) {
      result.teardown.stages.push({
        stage: "quit",
        status: "FAIL",
        error: String(error),
        stack: error?.stack ?? null,
      });
      result.teardown.status = "FAIL";
      result.teardown.failedStage = "quit";
    }
  } catch (error) {
    if (result.assertions.status === "NOT_RUN") {
      result.assertions = {
        status: "FAIL",
        error: String(error),
        stack: error?.stack,
      };
    } else {
      result.teardown.status = "FAIL";
      result.teardown.error = String(error);
      result.teardown.stack = error?.stack;
    }
    if (driver) {
      try {
        await driver.quit();
        result.teardown.stages.push({
          stage: "quit-after-assertion-failure",
          status: "PASS",
        });
      } catch (quitError) {
        result.teardown.status = "FAIL";
        result.teardown.stages.push({
          stage: "quit-after-assertion-failure",
          status: "FAIL",
          error: String(quitError),
        });
      }
      driver = undefined;
    }
  } finally {
    closeSync(logFd);
    await writeFile(
      join(evidenceRoot, `${name}-result.json`),
      JSON.stringify(result, null, 2),
    );
    await rm(scratch, { recursive: true, force: true }).catch((error) => {
      result.teardown.scratchCleanup = String(error);
    });
  }
  return result;
}

const summary = { startedAt: new Date().toISOString(), results: [] };
let failed = false;
for (const name of scenarios) {
  process.stderr.write(`\n=== scenario: ${name} ===\n`);
  const result = await runScenario(name);
  summary.results.push(result);
  if (result.assertions.status !== "PASS" || result.teardown.status !== "PASS")
    failed = true;
  process.stderr.write(
    `assertions=${result.assertions.status} teardown=${result.teardown.status}` +
      (result.teardown.failedStage
        ? ` failedStage=${result.teardown.failedStage}`
        : "") +
      "\n",
  );
}
summary.finishedAt = new Date().toISOString();
summary.overall = failed ? "FAIL" : "PASS";
await writeFile(
  join(evidenceRoot, "summary.json"),
  JSON.stringify(summary, null, 2),
);
console.log(
  JSON.stringify(
    { overall: summary.overall, count: summary.results.length },
    null,
    2,
  ),
);
process.exitCode = failed ? 1 : 0;
