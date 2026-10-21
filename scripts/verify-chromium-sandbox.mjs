import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve(".browser-cache");
const { chromium } = await import("@playwright/test");
const executablePath = chromium.executablePath();
const sandboxHelper = join(dirname(executablePath), "chrome_sandbox");

if (process.argv.includes("--helper-path")) {
  if (!existsSync(executablePath))
    throw new Error(
      `Playwright Chromium executable is missing: ${executablePath}`,
    );
  if (!existsSync(sandboxHelper))
    throw new Error(
      `Playwright Chromium sandbox helper is missing: ${sandboxHelper}`,
    );
  process.stdout.write(sandboxHelper);
  process.exit(0);
}

const evidenceDir = resolve(process.env.P00_EVIDENCE_DIR ?? "evidence/P00");
const evidencePath = join(evidenceDir, "chromium-sandbox.json");

function read(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch (error) {
    return `UNAVAILABLE: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function command(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 10_000 });
  return {
    exitCode: result.error ? null : result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: [result.stderr, result.error?.message]
      .filter(Boolean)
      .join("\n")
      .trim(),
  };
}

function helperDetails() {
  if (!existsSync(sandboxHelper)) return { path: sandboxHelper, exists: false };
  const details = statSync(sandboxHelper);
  return {
    path: sandboxHelper,
    exists: true,
    uid: details.uid,
    gid: details.gid,
    mode: `0${(details.mode & 0o7777).toString(8)}`,
  };
}

const evidence = {
  runner: {
    platform: process.platform,
    arch: process.arch,
    uid: typeof process.getuid === "function" ? process.getuid() : null,
    gid: typeof process.getgid === "function" ? process.getgid() : null,
    osRelease: read("/etc/os-release"),
    lsm: read("/sys/kernel/security/lsm"),
    unprivilegedUserNamespaces: read(
      "/proc/sys/kernel/unprivileged_userns_clone",
    ),
    appArmorUserNamespaces: read(
      "/proc/sys/kernel/apparmor_restrict_unprivileged_userns",
    ),
    confinement: read("/proc/self/attr/current"),
    status: read("/proc/self/status"),
    executableMount: command("findmnt", [
      "--target",
      executablePath,
      "--noheadings",
      "--output",
      "TARGET,SOURCE,FSTYPE,OPTIONS",
    ]),
    sandboxMount: command("findmnt", [
      "--target",
      sandboxHelper,
      "--noheadings",
      "--output",
      "TARGET,SOURCE,FSTYPE,OPTIONS",
    ]),
    userNamespaceProbe: command("unshare", [
      "--user",
      "--map-root-user",
      "true",
    ]),
    appArmorStatus: command("aa-status", ["--json"]),
    kernelSandboxDenials: command("sudo", [
      "-n",
      "journalctl",
      "--no-pager",
      "--kernel",
      "--lines=200",
      "--grep=apparmor|DENIED|sandbox",
    ]),
  },
  executablePath,
  sandboxHelper: helperDetails(),
  chromiumSandbox: true,
  headed: true,
  launch: "not-started",
};

await mkdir(evidenceDir, { recursive: true });
try {
  if (!existsSync(executablePath))
    throw new Error(
      `Playwright Chromium executable is missing: ${executablePath}`,
    );
  if (
    evidence.sandboxHelper.exists !== true ||
    evidence.sandboxHelper.uid !== 0 ||
    evidence.sandboxHelper.gid !== 0 ||
    evidence.sandboxHelper.mode !== "04755"
  )
    throw new Error(
      "Playwright Chromium sandbox helper must be owned by root:root with mode 04755",
    );

  const browser = await chromium.launch({
    executablePath,
    chromiumSandbox: true,
    headless: false,
  });
  evidence.launch = "sandboxed-headed-browser-started";
  evidence.browserVersion = browser.version();
  await browser.close();
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  console.log(`Chromium sandbox preflight passed: ${evidence.browserVersion}`);
} catch (error) {
  evidence.launch = "failed";
  evidence.error =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  throw error;
}
