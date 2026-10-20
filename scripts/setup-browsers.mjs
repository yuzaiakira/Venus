import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
mkdirSync("evidence/P00", { recursive: true });
mkdirSync(".browser-cache", { recursive: true });
const manager = resolve(
  "node_modules/selenium-webdriver/bin/linux/selenium-manager",
);
const commands = [
  {
    label: "chromium",
    binary: process.execPath,
    args: ["node_modules/playwright/cli.js", "install", "chromium"],
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: resolve(".browser-cache"),
    },
  },
  {
    label: "geckodriver",
    binary: manager,
    args: [
      "--browser",
      "firefox",
      "--cache-path",
      resolve(".browser-cache/selenium"),
      "--timeout",
      "15",
      "--output",
      "json",
    ],
    env: process.env,
  },
];
const target = process.argv[2] ?? "all";
if (!["all", "firefox", "chrome"].includes(target))
  throw new Error("Expected setup target: firefox, chrome, or all");
let failed = false;
for (const command of commands.filter(
  (item) =>
    target === "all" ||
    item.label === (target === "firefox" ? "geckodriver" : "chromium"),
)) {
  let success = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`${command.label}: download attempt ${attempt}/3`);
    const result = spawnSync(command.binary, command.args, {
      encoding: "utf8",
      env: command.env,
      timeout: 120000,
    });
    const output =
      (result.stdout ?? "") +
      (result.stderr ?? "") +
      (result.error?.message ?? "");
    writeFileSync(`evidence/P00/setup-${command.label}-${attempt}.log`, output);
    if (result.status === 0) {
      success = true;
      if (command.label === "geckodriver") {
        const data = JSON.parse(result.stdout);
        writeFileSync(
          ".browser-cache/driver.json",
          JSON.stringify({ geckodriver: data.result.driver_path }, null, 2),
        );
      }
      console.log(`${command.label}: installed`);
      break;
    }
    console.error(
      `${command.label}: FAILED (see evidence/P00/setup-${command.label}-${attempt}.log)`,
    );
  }
  if (!success) failed = true;
}
// Fail honestly if even one required download failed.
process.exitCode = failed ? 1 : 0;
