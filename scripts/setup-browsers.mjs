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

function run(label, binary, args, env = process.env, attempts = 1) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`${label}: attempt ${attempt}/${attempts}`);
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
    if (result.status === 0) return { ok: true, stdout: result.stdout ?? "" };
    console.error(
      `${label}: FAILED (see ${evidenceDir}/setup-${label}-${attempt}.log)`,
    );
  }
  return { ok: false, stdout: "" };
}

const setup = { target, chromium: undefined, firefox: undefined };
let failed = false;

if (target === "all" || target === "chrome") {
  const result = run(
    "chromium",
    process.execPath,
    ["node_modules/playwright/cli.js", "install", "chromium"],
    { ...process.env, PLAYWRIGHT_BROWSERS_PATH: cache },
    3,
  );
  if (!result.ok) {
    setup.chromium = { installed: false };
    failed = true;
  } else {
    // Resolve through the same @playwright/test package imported by the
    // acceptance scripts. This catches cache/version mismatches before a
    // system browser can be selected as an accidental fallback.
    const { chromium } = await import("@playwright/test");
    const executablePath = chromium.executablePath();
    if (!existsSync(executablePath)) {
      console.error(
        `chromium: Playwright installed successfully but its expected executable is missing: ${executablePath}`,
      );
      setup.chromium = {
        installed: false,
        expectedExecutablePath: executablePath,
        error: "Playwright Chromium cache/version mismatch",
      };
      failed = true;
    } else {
      const version = run("playwright-chromium", executablePath, ["--version"]);
      setup.chromium = {
        installed: version.ok,
        executablePath,
        version: version.stdout.trim(),
      };
      if (!version.ok) failed = true;
    }
  }
}

if (target === "all" || target === "firefox") {
  // Firefox acceptance must use the official Firefox binary provisioned by
  // the runner (for example browser-actions/setup-firefox), not Playwright's
  // patched Firefox build. Selenium Manager only resolves geckodriver for it.
  const firefoxPath = process.env.FIREFOX_BIN;
  if (!firefoxPath || !existsSync(firefoxPath)) {
    console.error(
      "firefox: FIREFOX_BIN must point to an installed official Firefox binary",
    );
    setup.firefox = { installed: false, error: "FIREFOX_BIN unavailable" };
    failed = true;
  } else {
    const version = run("official-firefox", firefoxPath, ["--version"]);
    if (!version.ok) {
      setup.firefox = { installed: false, path: firefoxPath };
      failed = true;
    } else {
      const driver = run(
        "geckodriver",
        manager,
        [
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
        ],
        process.env,
        3,
      );
      if (!driver.ok) {
        setup.firefox = { installed: true, path: firefoxPath, driver: false };
        failed = true;
      } else {
        const data = JSON.parse(driver.stdout);
        setup.firefox = {
          installed: true,
          path: firefoxPath,
          version: version.stdout.trim(),
          geckodriver: data.result.driver_path,
        };
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
}

writeFileSync(
  `${evidenceDir}/browser-setup.json`,
  JSON.stringify(setup, null, 2),
);

// Fail honestly if a required browser or driver could not be provisioned.
process.exitCode = failed ? 1 : 0;
