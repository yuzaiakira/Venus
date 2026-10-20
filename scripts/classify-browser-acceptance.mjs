import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const target = process.env.BROWSER_TARGET;
const evidenceDir = resolve(process.env.P00_EVIDENCE_DIR ?? "evidence/P00");
if (!["firefox", "chrome"].includes(target))
  throw new Error("BROWSER_TARGET must be firefox or chrome");

const stages = [
  ["extension build", process.env.BUILD_OUTCOME],
  ["Xvfb display server", process.env.DISPLAY_OUTCOME],
  ["browser provisioning", process.env.SETUP_OUTCOME],
  ["New Tab and Habit Tracker acceptance", process.env.SMOKE_OUTCOME],
];
if (target === "firefox")
  stages.splice(1, 0, [
    "official Firefox provisioning",
    process.env.FIREFOX_PROVISION_OUTCOME,
  ]);
if (target === "chrome") {
  stages.splice(1, 0, [
    "Chromium runtime dependencies",
    process.env.CHROME_DEPS_OUTCOME,
  ]);
  stages.splice(2, 0, [
    "Playwright Chromium sandbox",
    process.env.CHROME_SANDBOX_OUTCOME,
  ]);
  stages.push(["Habit Reminder browser workflow", process.env.HABIT_OUTCOME]);
}

function files(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(path, entry.name))
      : [join(path, entry.name)],
  );
}

const diagnostics = files(evidenceDir)
  .filter((path) =>
    /(?:failure\.json|chromium-sandbox\.json|setup-.*\.log|browser\.json|geckodriver\.log)$/.test(
      path,
    ),
  )
  .map((path) => {
    try {
      return `${path}\n${readFileSync(path, "utf8")}`;
    } catch {
      return path;
    }
  })
  .join("\n");

const incomplete = stages.filter(([, outcome]) => outcome !== "success");
const failed = stages.filter(([, outcome]) =>
  ["failure", "cancelled"].includes(outcome),
);
const environmentPattern =
  /FIREFOX_BIN unavailable|browser binary unavailable|HTTP(?:\s+)?403|Domain.*forbidden|download.*forbidden|failed to install|no sandbox-capable|sandbox helper.*(wrong|invalid) ownership|No usable sandbox|setuid sandbox|Executable doesn't exist|missing .*runtime dependenc/i;
const harnessPattern =
  /Firefox harness policy (?:directory was not active|was not applied)|Disposable Firefox policy was not applied/i;
const infrastructureStage = new Set([
  "Xvfb display server",
  "official Firefox provisioning",
  "Chromium runtime dependencies",
  "Playwright Chromium sandbox",
  "browser provisioning",
]);
const environmentBlocked =
  incomplete.length > 0 &&
  (environmentPattern.test(diagnostics) ||
    (failed.length > 0 &&
      failed.every(([stage]) => infrastructureStage.has(stage))) ||
    failed.length === 0);
const status =
  incomplete.length === 0
    ? "PASS"
    : harnessPattern.test(diagnostics)
      ? "TEST_HARNESS_FAILURE"
      : environmentBlocked
        ? "ENVIRONMENT_BLOCKED"
        : "APPLICATION_FAILURE";
const lines = [
  `## ${target} extension acceptance: ${status}`,
  "",
  ...stages.map(([stage, outcome]) => `- ${stage}: ${outcome ?? "skipped"}`),
  `- Evidence: \`${evidenceDir}\``,
  "- OS notification display: not verified by this browser automation.",
];
const summary = `${lines.join("\n")}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  await import("node:fs/promises").then(({ appendFile }) =>
    appendFile(process.env.GITHUB_STEP_SUMMARY, summary),
  );
}

if (incomplete.length > 0) process.exitCode = 1;
