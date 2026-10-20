import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const evidenceDir = "evidence/P00";
const cache = resolve(".browser-cache");
mkdirSync(evidenceDir, { recursive: true });
mkdirSync(cache, { recursive: true });
process.env.PLAYWRIGHT_BROWSERS_PATH ??= cache;
const manager = resolve(
  "node_modules/selenium-webdriver/bin/linux/selenium-manager",
);
const target = process.argv[2] ?? "all";
if (!["all", "firefox", "chrome"].includes(target))
  throw new Error("Expected setup target: firefox, chrome, or all");

const targetName = target === "chrome" ? "chromium" : target;
const browserCommands = [
  {
    label: "chromium",
    binary: process.execPath,
    args: ["node_modules/playwright/cli.js", "install", "chromium"],
  },
  {
    label: "firefox",
    binary: process.execPath,
    args: ["node_modules/playwright/cli.js", "install", "firefox"],
  },
];

function run(label, binary, args, env = process.env) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    console.log(`${label}: download attempt ${attempt}/3`);
    const result = spawnSync(binary, args, {
      encoding: "utf8",
      env,
      timeout: 120_000,
    });
    const output =
      (result.stdout ?? "") +
      (result.stderr ?? "") +
      (result.error?.message ?? "");
    writeFileSync(`${evidenceDir}/setup-${label}-${attempt}.log`, output);
    if (result.status === 0) {
      console.log(`${label}: installed`);
      return { ok: true, stdout: result.stdout ?? "" };
    }
    console.error(
      `${label}: FAILED (see ${evidenceDir}/setup-${label}-${attempt}.log)`,
    );
  }
  return { ok: false, stdout: "" };
}

let failed = false;
for (const command of browserCommands.filter(
  (command) => target === "all" || command.label === targetName,
)) {
  const result = run(command.label, command.binary, command.args, {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: cache,
  });
  if (!result.ok) failed = true;
}

if ((target === "all" || target === "firefox") && !failed) {
  const { firefox } = await import("@playwright/test");
  const firefoxPath = firefox.executablePath();
  if (!existsSync(firefoxPath)) {
    console.error("firefox: Playwright did not provide an executable");
    failed = true;
  } else {
    const result = run("geckodriver", manager, [
      "--browser",
      "firefox",
      "--browser-path",
      firefoxPath,
      "--cache-path",
      resolve(".browser-cache/selenium"),
      "--timeout",
      "15",
      "--output",
      "json",
    ]);
    if (!result.ok) {
      failed = true;
    } else {
      const data = JSON.parse(result.stdout);
      writeFileSync(
        ".browser-cache/driver.json",
        JSON.stringify(
          { firefox: firefoxPath, geckodriver: data.result.driver_path },
          null,
          2,
        ),
      );
    }
  }
}

// Fail honestly if a required browser or driver could not be provisioned.
process.exitCode = failed ? 1 : 0;
