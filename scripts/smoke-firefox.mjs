import { browserProbes } from "./browser-probes.mjs";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { verifyHabitReminderFirefox } from "./habit-reminder-firefox.mjs";
import { mkdir, writeFile, mkdtemp, rm, cp } from "node:fs/promises";
const evidenceDir = process.env.P00_EVIDENCE_DIR ?? "evidence/P00";
const cachedBrowser = existsSync(".browser-cache/driver.json")
  ? JSON.parse(readFileSync(".browser-cache/driver.json", "utf8")).firefox
  : undefined;
const binary =
  process.env.FIREFOX_BIN ??
  (cachedBrowser && existsSync(cachedBrowser)
    ? cachedBrowser
    : "/usr/bin/firefox");
await mkdir(evidenceDir, { recursive: true });
async function preflightFailure(message) {
  await writeFile(
    join(evidenceDir, "firefox-smoke-failure.json"),
    JSON.stringify({ binary, error: message }, null, 2),
  );
  throw new Error(message);
}
if (!existsSync(binary))
  await preflightFailure("Firefox smoke FAILED: browser binary unavailable");
if (!existsSync(".output/firefox-mv3/manifest.json"))
  await preflightFailure("Firefox smoke FAILED: build missing");
const cachedDriver = existsSync(".browser-cache/driver.json")
  ? JSON.parse(readFileSync(".browser-cache/driver.json", "utf8")).geckodriver
  : undefined;
const driverPath = process.env.GECKODRIVER_BIN ?? cachedDriver;
if (!driverPath || !existsSync(driverPath))
  await preflightFailure(
    "Firefox smoke FAILED: set GECKODRIVER_BIN to installed driver. No automatic download/pass.",
  );
const { Builder, By, until } = await import("selenium-webdriver");
const firefox = await import("selenium-webdriver/firefox.js");
const scratch = await mkdtemp(join(tmpdir(), "Venus-firefox-"));
const archive = join(scratch, "extension.xpi");
// Firefox 138+ blocks privileged about: navigation unless both flags are set.
// -remote-allow-system-access cannot be passed through WebDriver capabilities.
const policies = {
  policies: {
    UserMessaging: { FirefoxLabs: false },
    DisableFirefoxStudies: true,
    DisableRemoteImprovements: true,
  },
};
// Release Firefox ignores browser.policies.alternatePath unless
// Cu.isInAutomation is true, and MOZ_AUTOMATION does not set that flag.
// A disposable copy of the application bundle plus its own
// distribution/policies.json is loaded on a normal release build. It does
// not change /usr/lib/firefox or the user's Firefox profile.
const installedBinary = realpathSync(binary);
const installedApp = process.env.FIREFOX_APP_DIR ?? dirname(installedBinary);
// Preserve the command name used by the official Firefox distribution. A
// resolved source binary may be firefox-bin or a launcher target; running it
// under the original name keeps XREAppDist rooted in this disposable app.
const launcherName = basename(binary);
const appDir = join(scratch, "app");
const appDist = join(appDir, "distribution");
// Firefox resolves XREAppDist through resources such as libxul. Symlinking
// those resources to the runner's installation causes policy discovery to
// resolve there instead of in this disposable app. Copy the complete official
// bundle so its distribution directory, policy and loaded resources agree.
await cp(installedApp, appDir, { recursive: true, dereference: true });
if (!existsSync(join(appDir, launcherName)))
  await preflightFailure(
    `Firefox smoke FAILED: launcher ${launcherName} was not in the official application directory`,
  );
await mkdir(appDist, { recursive: true });
await writeFile(join(appDist, "policies.json"), JSON.stringify(policies));
const policiesPath = join(scratch, "policies.json");
await writeFile(policiesPath, JSON.stringify(policies));
const wrapper = join(scratch, "firefox-wrapper.sh");
await writeFile(
  wrapper,
  `#!/bin/sh\nexec '${join(appDir, launcherName).replaceAll("'", "'\\''")}' -remote-allow-system-access "$@"\n`,
  { mode: 0o755 },
);
const profileDir = join(scratch, "profile");
await mkdir(profileDir, { recursive: true });
await writeFile(
  join(profileDir, "user.js"),
  [
    `user_pref("browser.policies.alternatePath", ${JSON.stringify(policiesPath)});`,
    'user_pref("app.shield.optoutstudies.enabled", false);',
    'user_pref("nimbus.rollouts.enabled", false);',
    'user_pref("datareporting.healthreport.uploadEnabled", false);',
    "",
  ].join("\n"),
);
const options = new firefox.Options()
  .setBinary(wrapper)
  .setProfile(profileDir)
  .addArguments("-headless")
  .setPreference("browser.policies.alternatePath", policiesPath)
  .setPreference("app.shield.optoutstudies.enabled", false)
  .setPreference("nimbus.rollouts.enabled", false)
  .setPreference("datareporting.healthreport.uploadEnabled", false);
const service = new firefox.ServiceBuilder(driverPath).addArguments(
  "--allow-system-access",
);
let geckodriverLog;
if (process.env.GECKODRIVER_LOG) {
  geckodriverLog = openSync(process.env.GECKODRIVER_LOG, "a");
  service
    .enableVerboseLogging(true)
    .setStdio(["ignore", geckodriverLog, geckodriverLog]);
}
const driver = await new Builder()
  .forBrowser("firefox")
  .setFirefoxOptions(options)
  .setFirefoxService(service)
  .build();
const shutdown = {
  quitError: undefined,
  teardown: { status: "NOT_RUN", stages: [] },
};
try {
  await driver.manage().setTimeouts({ pageLoad: 15000, script: 15000 });
  // Selenium installs a developer temporary add-on; this DOES NOT test install-consent UI.
  // Archive the contents, not the parent directory.
  execFileSync("python3", [
    "-c",
    'import zipfile,pathlib,sys; root=pathlib.Path(".output/firefox-mv3"); z=zipfile.ZipFile(sys.argv[1],"w"); [z.write(p,p.relative_to(root)) for p in root.rglob("*") if p.is_file()]; z.close()',
    archive,
  ]);
  await driver.installAddon(archive, true);
  // Use Firefox's real New Tab command, not navigation to the extension URL.
  await driver.setContext("chrome");
  const policy = await driver.executeScript(`
    const appDist = Services.dirsvc.get("XREAppDist", Ci.nsIFile);
    const policyFile = appDist.clone();
    policyFile.append("policies.json");
    return {
      labsAllowed: Services.policies.isAllowed("FirefoxLabs"),
      rolloutsAllowed: Services.policies.isAllowed("NimbusRollouts"),
      shieldAllowed: Services.policies.isAllowed("Shield"),
      automation: Services.env.exists("MOZ_AUTOMATION"),
      componentsAutomation: Cu.isInAutomation,
      alternatePath: Services.prefs.getStringPref("browser.policies.alternatePath", ""),
      appDist: appDist.path,
      appExecutable: Services.dirsvc.get("XREExeF", Ci.nsIFile).path,
      policyFile: policyFile.path,
      policyFileExists: policyFile.exists(),
      status: String(Services.policies.status),
    };
  `);
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    join(evidenceDir, "firefox-policy.json"),
    JSON.stringify(policy, null, 2),
  );
  if (policy.appDist !== appDist || !policy.policyFileExists)
    throw new Error(
      "Firefox harness policy directory was not active: " +
        JSON.stringify({ expectedAppDist: appDist, policy }),
    );
  if (policy.labsAllowed !== false)
    throw new Error(
      "Firefox harness policy was not applied: " + JSON.stringify(policy),
    );
  const newTabURL = await driver.executeScript(`
    const { AboutNewTab } = ChromeUtils.importESModule(
      "resource:///modules/AboutNewTab.sys.mjs",
    );
    return AboutNewTab.newTabURL;
  `);
  if (
    typeof newTabURL !== "string" ||
    !newTabURL.startsWith("moz-extension://") ||
    !newTabURL.endsWith("/newtab.html")
  )
    throw new Error(
      "Firefox New Tab override not registered: " + String(newTabURL),
    );
  await driver.setContext("content");
  const handles = await driver.getAllWindowHandles();
  await driver.setContext("chrome");
  await driver.executeScript(`
    Services.io.manageOfflineStatus = false;
    Services.io.offline = true;
    BrowserCommands.openTab();
  `);
  await driver.setContext("content");
  await driver.wait(
    async () => (await driver.getAllWindowHandles()).length > handles.length,
    15000,
    "Firefox New Tab command did not create a fresh content tab",
  );
  const fresh = (await driver.getAllWindowHandles()).find(
    (handle) => !handles.includes(handle),
  );
  await driver.switchTo().window(fresh);
  await driver.setContext("content");
  await driver.wait(
    until.elementLocated(By.css(".hero h1")),
    15000,
    "Fresh offline Firefox tab did not render the bundled heading",
  );
  if (!(await driver.findElement(By.css(".hero h1")).getText()).trim())
    throw new Error("Firefox New Tab override not rendered");
  const offline = await driver.executeScript("return !navigator.onLine");
  if (!offline) throw new Error("Firefox isolated profile is not offline");
  const apiEvidence = await driver.executeAsyncScript(
    `const done=arguments[arguments.length-1]; (${browserProbes.toString()})().then(value=>done({ok:true,value}),error=>done({ok:false,error:String(error)}));`,
  );
  if (!apiEvidence.ok)
    throw new Error("Firefox API probe failed: " + apiEvidence.error);
  const habitReminder = await verifyHabitReminderFirefox(
    driver,
    By,
    evidenceDir,
  );
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    join(evidenceDir, "firefox-newtab.png"),
    Buffer.from(await driver.takeScreenshot(), "base64"),
  );
  const home = {
    rendering: "NOT_RUN",
    consent: "NOT_VERIFIED",
    install: "temporary developer add-on",
  };
  try {
    // Leave the app first, preventing a stale heading from passing this check.
    await driver.get("about:blank");
    await driver.setContext("chrome");
    await driver.executeScript("BrowserCommands.home();");
    await driver.setContext("content");
    await driver.wait(
      until.elementLocated(By.css(".hero h1")),
      15000,
      "Firefox Home command did not render bundled app",
    );
    if (
      !(await driver.findElement(By.css(".hero h1")).getText()).trim() ||
      (await driver.getCurrentUrl()) !== newTabURL
    )
      throw new Error("Home did not resolve to the same bundled shell");
    home.rendering = "PASS";
    await writeFile(
      join(evidenceDir, "firefox-home.png"),
      Buffer.from(await driver.takeScreenshot(), "base64"),
    );
  } catch (error) {
    home.rendering = "FAIL";
    home.error = String(error);
  }
  let identityEvidence;
  if (process.env.P00_IDENTITY_CHECK === "1") {
    const { verifyFirefoxIdentity } = await import(
      "./verify-firefox-identity.mjs"
    );
    identityEvidence = await verifyFirefoxIdentity(driver, newTabURL, scratch);
    await writeFile(
      join(evidenceDir, "firefox-identity.json"),
      JSON.stringify(identityEvidence, null, 2),
    );
  }
  await writeFile(
    join(evidenceDir, "firefox-smoke.json"),
    JSON.stringify(
      {
        browser: (await driver.getCapabilities()).get("browserVersion"),
        newtab: "PASS",
        freshTabAction: "BrowserCommands.openTab",
        offline,
        newTabURL,
        homeConsent: "NOT_RUN",
        home,
        apiEvidence: apiEvidence.value,
        habitReminder,
        identityEvidence,
        apiLifecycle:
          "PARTIAL: permission consent, alarm firing/restart and OS display remain manual",
      },
      null,
      2,
    ),
  );
  console.log(
    "Firefox New Tab smoke passed; Home consent and APIs require separate manual checks.",
  );
} catch (error) {
  await writeFile(
    join(evidenceDir, "firefox-smoke-failure.json"),
    JSON.stringify(
      {
        binary,
        installedBinary,
        installedApp,
        launcher: join(appDir, launcherName),
        expectedAppDist: appDist,
        error:
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error),
      },
      null,
      2,
    ),
  ).catch(() => {});
  throw error;
} finally {
  const teardown = { status: "PASS", stages: [] };
  try {
    // Restore only this disposable browser's network state before shutdown.
    await driver.setContext("chrome");
    await driver.executeScript(`
      Services.io.offline = false;
      Services.io.manageOfflineStatus = true;
    `);
    teardown.stages.push({ stage: "restore-online", status: "PASS" });
  } catch (error) {
    teardown.status = "FAIL";
    teardown.stages.push({
      stage: "restore-online",
      status: "FAIL",
      error: String(error),
    });
  }
  try {
    await driver.quit();
    teardown.stages.push({ stage: "driver.quit", status: "PASS" });
  } catch (error) {
    shutdown.quitError = error;
    teardown.status = "FAIL";
    teardown.stages.push({
      stage: "driver.quit",
      status: "FAIL",
      error: String(error),
    });
  }
  shutdown.teardown = teardown;
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    join(evidenceDir, "firefox-teardown.json"),
    JSON.stringify(teardown, null, 2),
  );
  await rm(scratch, { recursive: true, force: true });
  if (geckodriverLog !== undefined) closeSync(geckodriverLog);
}
if (shutdown.quitError) throw shutdown.quitError;
if (shutdown.teardown.status !== "PASS") {
  throw new Error(
    "Firefox smoke teardown failed: " +
      JSON.stringify(shutdown.teardown.stages),
  );
}
