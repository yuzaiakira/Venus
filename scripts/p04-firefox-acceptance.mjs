import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";

const binaryRoot = "/usr/lib/firefox";
const evidenceDir = process.env.P00_EVIDENCE_DIR ?? "evidence/P04";
if (!existsSync("/usr/bin/firefox"))
  throw new Error("Firefox P04 acceptance: browser missing");
if (!existsSync(".output/firefox-mv3/manifest.json"))
  throw new Error("Firefox P04 acceptance: production build missing");
const cachedDriver = existsSync(".browser-cache/driver.json")
  ? JSON.parse(readFileSync(".browser-cache/driver.json", "utf8")).geckodriver
  : undefined;
const driverPath = process.env.GECKODRIVER_BIN ?? cachedDriver;
if (!driverPath || !existsSync(driverPath))
  throw new Error("Firefox P04 acceptance: geckodriver missing");
const { Builder, By, until } = await import("selenium-webdriver");
const firefox = await import("selenium-webdriver/firefox.js");

const evidence = {
  browser: "firefox",
  profile: "disposable",
  offline: false,
  pluginsOpened: false,
  saved: false,
  persistedAfterReload: false,
  exported: false,
  imported: false,
  hostileRejected: false,
  hostileRowsUnchanged: false,
  safeModeKeepsData: false,
  reenabled: false,
  tokensOnOrdinaryNewTab: false,
  pluginsOpenMs: null,
  importPreviewMs: null,
  warmReloadMs: [],
  freshTabMs: [],
  coldNavigationMs: [],
  longTasks: null,
  heap: null,
  fault: { ran: false, shellUp: false, widgetFailed: false, rows: 0 },
  teardown: { status: "NOT_RUN", stages: [] },
};

function makeHostile() {
  const data = Buffer.alloc(64);
  const name = Buffer.from("../manifest.json");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  const directory = Buffer.concat([central, name]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(30 + name.length + data.length, 16);
  return Buffer.concat([local, name, data, directory, end]);
}

const scratch = await mkdtemp(join(tmpdir(), "Venus-p04-firefox-"));
const downloads = join(scratch, "downloads");
const hostile = join(scratch, "hostile.zplugin");
await mkdir(downloads, { recursive: true });
await writeFile(hostile, makeHostile());
const policies = {
  policies: {
    UserMessaging: { FirefoxLabs: false },
    DisableFirefoxStudies: true,
    DisableRemoteImprovements: true,
  },
};
const appDir = join(scratch, "app");
const appDist = join(appDir, "distribution");
await mkdir(appDist, { recursive: true });
for (const name of await readdir(binaryRoot)) {
  if (name === "distribution") continue;
  if (name === "firefox") {
    await copyFile(join(binaryRoot, name), join(appDir, name));
    continue;
  }
  await symlink(join(binaryRoot, name), join(appDir, name));
}
await copyFile(
  join(binaryRoot, "distribution/distribution.ini"),
  join(appDist, "distribution.ini"),
);
await writeFile(join(appDist, "policies.json"), JSON.stringify(policies));
const policiesPath = join(scratch, "policies.json");
await writeFile(policiesPath, JSON.stringify(policies));
const wrapper = join(scratch, "firefox-wrapper.sh");
await writeFile(
  wrapper,
  `#!/bin/sh\nexec '${join(appDir, "firefox").replaceAll("'", "'\\''")}' -remote-allow-system-access "$@"\n`,
  { mode: 0o755 },
);

async function launch(extensionDir) {
  const profileDir = await mkdtemp(join(scratch, "profile-"));
  await writeFile(
    join(profileDir, "user.js"),
    [
      `user_pref("browser.policies.alternatePath", ${JSON.stringify(policiesPath)});`,
      'user_pref("app.shield.optoutstudies.enabled", false);',
      'user_pref("browser.download.folderList", 2);',
      `user_pref("browser.download.dir", ${JSON.stringify(downloads)});`,
      'user_pref("browser.download.useDownloadDir", true);',
      'user_pref("browser.helperApps.neverAsk.saveToDisk", "application/zip,application/octet-stream");',
      "",
    ].join("\n"),
  );
  const options = new firefox.Options()
    .setBinary(wrapper)
    .setProfile(profileDir)
    .addArguments("-headless")
    .setPreference("browser.download.folderList", 2)
    .setPreference("browser.download.dir", downloads)
    .setPreference("browser.download.useDownloadDir", true);
  const service = new firefox.ServiceBuilder(driverPath).addArguments(
    "--allow-system-access",
  );
  const driver = await new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(options)
    .setFirefoxService(service)
    .build();
  const archive = join(profileDir, "extension.xpi");
  execFileSync("python3", [
    "-c",
    'import zipfile,pathlib,sys; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w"); [z.write(p,p.relative_to(root)) for p in root.rglob("*") if p.is_file()]; z.close()',
    extensionDir,
    archive,
  ]);
  await driver.installAddon(archive, true);
  return driver;
}

async function openNewTab(driver) {
  await driver.setContext("chrome");
  await driver.executeScript(`
    Services.io.manageOfflineStatus = false;
    Services.io.offline = true;
  `);
  await driver.setContext("content");
  const before = await driver.getAllWindowHandles();
  await driver.setContext("chrome");
  const started = Date.now();
  await driver.executeScript("BrowserCommands.openTab();");
  await driver.setContext("content");
  await driver.wait(
    async () => (await driver.getAllWindowHandles()).length > before.length,
    20000,
    "Firefox New Tab command did not create a tab",
  );
  const fresh = (await driver.getAllWindowHandles()).find(
    (handle) => !before.includes(handle),
  );
  await driver.switchTo().window(fresh);
  await driver.setContext("content");
  try {
    await driver.wait(until.elementLocated(By.css("h1")), 20000);
  } catch (error) {
    const url = await driver.getCurrentUrl();
    throw new Error(`Firefox New Tab did not render at ${url}: ${error}`);
  }
  return Date.now() - started;
}

async function clickButton(driver, name) {
  const button = await driver.wait(
    until.elementLocated(
      By.xpath(`//button[normalize-space()=${JSON.stringify(name)}]`),
    ),
    15000,
    `Missing button ${name}`,
  );
  await button.click();
}

async function bodyText(driver) {
  return driver.findElement(By.css("body")).getText();
}

async function pluginRows(driver) {
  return driver.executeAsyncScript(`
    const done = arguments[arguments.length - 1];
    const request = indexedDB.open("Venus-p00");
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(["pluginPackages", "pluginInstanceData"], "readonly");
      const packages = [];
      const rows = [];
      tx.objectStore("pluginPackages").openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          packages.push({ id: cursor.value.id, origin: cursor.value.origin });
          cursor.continue();
        }
      };
      tx.objectStore("pluginInstanceData").openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          rows.push(cursor.value.id);
          cursor.continue();
        }
      };
      tx.oncomplete = () => done({ packages, rows });
    };
    request.onerror = () => done({ error: String(request.error) });
  `);
}

async function quit(driver, record) {
  try {
    await driver.setContext("chrome");
    await driver.executeScript(`
      Services.io.offline = false;
      Services.io.manageOfflineStatus = true;
    `);
    if (record) record.push({ stage: "restore-online", status: "PASS" });
  } catch (error) {
    if (record)
      record.push({
        stage: "restore-online",
        status: "FAIL",
        error: String(error),
      });
  }
  await driver.quit();
  if (record) record.push({ stage: "driver.quit", status: "PASS" });
}

const driver = await launch(".output/firefox-mv3");
try {
  evidence.coldNavigationMs.push(await openNewTab(driver));
  evidence.offline = await driver.executeScript("return !navigator.onLine");
  const resources = await driver.executeScript(`
    return performance.getEntriesByType("resource").map((entry) => entry.name);
  `);
  evidence.tokensOnOrdinaryNewTab = resources.some((name) =>
    String(name).includes("/chunks/tokens-"),
  );
  evidence.longTasks = await driver.executeScript(`
    const tasks = performance.getEntriesByType("longtask");
    return {
      count: tasks.length,
      totalMs: tasks.reduce((sum, task) => sum + task.duration, 0),
    };
  `);
  evidence.heap = await driver.executeScript(
    "return performance.memory ? performance.memory.usedJSHeapSize : null",
  );
  for (let index = 0; index < 5; index += 1) {
    const started = Date.now();
    await driver.navigate().refresh();
    await driver.wait(until.elementLocated(By.css("h1")), 20000);
    evidence.warmReloadMs.push(Date.now() - started);
  }
  for (let index = 0; index < 3; index += 1)
    evidence.freshTabMs.push(await openNewTab(driver));
  const skip = await driver.findElements(
    By.xpath('//button[normalize-space()="Skip setup"]'),
  );
  if (skip.length > 0) await skip[0].click();
  const pluginsStarted = Date.now();
  await clickButton(driver, "Plugins");
  await driver.wait(
    until.elementLocated(By.xpath('//h3[normalize-space()="Builder"]')),
    15000,
  );
  evidence.pluginsOpenMs = Date.now() - pluginsStarted;
  evidence.pluginsOpened = true;
  await clickButton(driver, "Save on this device");
  await driver.wait(
    async () =>
      (await bodyText(driver)).includes("Plugin saved on this device."),
    15000,
  );
  evidence.saved = true;
  await clickButton(driver, "Dashboard");
  const counter = By.xpath(
    '//button[normalize-space()="+"]/preceding-sibling::bdi[1]',
  );
  await clickButton(driver, "+");
  await driver.wait(async () => {
    const shown = await driver.findElements(counter);
    return shown.length > 0 && (await shown[0].getText()) === "1";
  }, 10000);
  await driver.navigate().refresh();
  await driver.wait(until.elementLocated(By.css("h1")), 20000);
  const reloaded = await driver.wait(until.elementLocated(counter), 15000);
  evidence.persistedAfterReload = (await reloaded.getText()) === "1";
  await clickButton(driver, "Plugins");
  await clickButton(driver, "Export package");
  const deadline = Date.now() + 10000;
  let exported = [];
  while (Date.now() < deadline) {
    exported = (await readdir(downloads)).filter((name) =>
      name.endsWith(".zplugin"),
    );
    if (exported.length > 0) break;
    await driver.sleep(250);
  }
  evidence.exported = exported.length === 1;
  if (!evidence.exported)
    throw new Error("Firefox did not save the exported package");
  await clickButton(driver, "Keep plugin data");
  const input = await driver.findElement(By.css('input[type="file"]'));
  const importStarted = Date.now();
  await input.sendKeys(join(downloads, exported[0]));
  await driver.wait(
    until.elementLocated(
      By.xpath('//button[normalize-space()="Install"]'),
    ),
    15000,
  );
  evidence.importPreviewMs = Date.now() - importStarted;
  await clickButton(driver, "Install");
  await driver.wait(
    async () => (await bodyText(driver)).includes("Plugin installed."),
    15000,
  );
  evidence.imported = true;
  await clickButton(driver, "Add to this profile");
  const beforeHostile = await pluginRows(driver);
  const hostileInput = await driver.findElement(By.css('input[type="file"]'));
  await driver.executeScript("arguments[0].value = ''", hostileInput);
  await hostileInput.sendKeys(hostile);
  await driver.executeScript(
    "arguments[0].dispatchEvent(new Event('change', { bubbles: true }))",
    hostileInput,
  );
  evidence.hostileInput = await driver.executeScript(`
    const input = document.querySelector('input[type="file"]');
    return {
      files: input.files.length,
      names: [...input.files].map((file) => file.name),
    };
  `);
  let hostileText = "";
  try {
    await driver.wait(async () => {
      hostileText = await bodyText(driver);
      return hostileText.includes("Nothing was changed.");
    }, 15000);
  } catch (error) {
    throw new Error(
      `Hostile validation text missing.\n${hostileText.slice(0, 1800)}\n${error}`,
    );
  }
  const afterHostile = await pluginRows(driver);
  evidence.hostileRejected = true;
  evidence.hostileRowsUnchanged =
    afterHostile.packages.length === beforeHostile.packages.length &&
    afterHostile.rows.length === beforeHostile.rows.length &&
    afterHostile.packages.every((row) => row.origin === "imported");
  await clickButton(driver, "Turn on Safe Mode");
  await driver.wait(
    async () => (await bodyText(driver)).includes("Safe Mode is on"),
    10000,
  );
  await clickButton(driver, "Dashboard");
  await driver.wait(
    async () =>
      (await bodyText(driver)).includes("Safe Mode hid this imported plugin"),
    10000,
  );
  evidence.safeModeKeepsData = (await pluginRows(driver)).rows.length > 0;
  await clickButton(driver, "Plugins");
  await clickButton(driver, "Re-enable this package");
  await clickButton(driver, "Dashboard");
  await driver.wait(
    until.elementLocated(By.xpath('//button[normalize-space()="+"]')),
    10000,
  );
  evidence.reenabled = !(await bodyText(driver)).includes(
    "Safe Mode hid this imported plugin",
  );
  evidence.teardown.status = "PASS";
} catch (error) {
  evidence.error = error instanceof Error ? error.message : String(error);
  evidence.teardown.status = "FAIL";
  throw error;
} finally {
  try {
    await quit(driver, evidence.teardown.stages);
  } catch (error) {
    evidence.teardown.status = "FAIL";
    evidence.teardown.stages.push({
      stage: "driver.quit",
      status: "FAIL",
      error: String(error),
    });
  }
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    join(evidenceDir, "p04-firefox.json"),
    JSON.stringify(evidence, null, 2),
  );
}

if (existsSync(".output-p04-fault/firefox-mv3/manifest.json")) {
  const fault = await launch(".output-p04-fault/firefox-mv3");
  evidence.fault.ran = true;
  try {
    await openNewTab(fault);
    const skip = await fault.findElements(
      By.xpath('//button[normalize-space()="Skip setup"]'),
    );
    if (skip.length > 0) await skip[0].click();
    await clickButton(fault, "Plugins");
    await clickButton(fault, "Save on this device");
    await fault.wait(
      async () => (await bodyText(fault)).includes("Plugin saved"),
      15000,
    );
    evidence.fault.updated = await fault.executeAsyncScript(`
      const done = arguments[arguments.length - 1];
      const request = indexedDB.open("Venus-p00");
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("widgets", "readwrite");
        const seen = [];
        tx.objectStore("widgets").openCursor().onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) return;
          if (cursor.value.widgetType === "plugin") {
            const next = cursor.value;
            next.settings = { ...next.settings, pluginFault: true };
            cursor.update(next);
          }
          seen.push(cursor.value.widgetType);
          cursor.continue();
        };
        tx.oncomplete = () => done(seen);
      };
      request.onerror = () => done({ error: String(request.error) });
    `);
    await fault.navigate().refresh();
    await fault.wait(until.elementLocated(By.css("h1")), 20000);
    const skipAgain = await fault.findElements(
      By.xpath('//button[normalize-space()="Skip setup"]'),
    );
    if (skipAgain.length > 0) await skipAgain[0].click();
    await fault.wait(async () => {
      const text = await fault.executeScript(
        "return document.querySelector('h1') ? document.querySelector('h1').textContent : ''",
      );
      return text === "Venus";
    }, 20000);
    evidence.fault.shellUp = true;
    evidence.fault.pageText = await fault.executeScript(
      "return document.body.textContent.includes('This widget failed')",
    );
    evidence.fault.widgetFailed =
      evidence.fault.pageText === true ||
      (await bodyText(fault)).includes("This widget failed");
    evidence.fault.rows = (await pluginRows(fault)).rows.length;
  } finally {
    await fault.quit();
    await writeFile(
      join(evidenceDir, "p04-firefox.json"),
      JSON.stringify(evidence, null, 2),
    );
  }
}

for (let index = 0; index < 2; index += 1) {
  const cold = await launch(".output/firefox-mv3");
  try {
    evidence.coldNavigationMs.push(await openNewTab(cold));
  } finally {
    await cold.quit();
  }
}

await writeFile(
  join(evidenceDir, "p04-firefox.json"),
  JSON.stringify(evidence, null, 2),
);
await rm(scratch, { recursive: true, force: true });
const required = [
  evidence.offline,
  evidence.pluginsOpened,
  evidence.saved,
  evidence.persistedAfterReload,
  evidence.exported,
  evidence.imported,
  evidence.hostileRejected,
  evidence.hostileRowsUnchanged,
  evidence.safeModeKeepsData,
  evidence.reenabled,
  evidence.fault.ran,
  evidence.fault.shellUp,
  evidence.fault.widgetFailed,
  evidence.fault.rows > 0,
  evidence.teardown.status === "PASS",
  evidence.teardown.stages.some(
    (stage) => stage.stage === "driver.quit" && stage.status === "PASS",
  ),
];
if (required.some((item) => item !== true))
  throw new Error("Firefox P04 acceptance failed: " + JSON.stringify(evidence));
console.log("Firefox P04 plugin acceptance passed");
