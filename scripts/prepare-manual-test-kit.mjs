import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const cases = [
  ["RC-01", "Fresh disposable profile and extension loaded"],
  ["RC-02", "Actual browser New Tab shows Venus"],
  ["RC-03", "Onboarding, navigation and profile selection"],
  ["RC-04", "English LTR and Persian RTL"],
  ["RC-05", "Add, reorder and persist dashboard widgets"],
  ["RC-06", "Quick Capture and Daily Briefing"],
  ["RC-07", "Habit reminder create, reschedule, snooze and complete"],
  ["RC-08", "Finance month, zero opening balance and export"],
  ["RC-09", "Reload persistence"],
  ["RC-10", "Version, screenshot and report capture"],
  ["XW-01", "Goals, Knowledge Review and People follow-up"],
  ["XW-02", "Focus, AI Inbox, Weather and Commute"],
  ["NOT-OS-01", "Operating-system notification display observation"],
];
const prohibitedSegment = /^(?:\.git|node_modules|\.cache|cache|profiles?)$/i;
const prohibitedFile =
  /(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:pem|key)|id_rsa|credentials?(?:\..*)?)$/i;

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: node scripts/prepare-manual-test-kit.mjs [--firefox build-dir] [--chrome build-dir] [--out kit-dir] [--candidate commit]",
  );
  process.exitCode = 1;
}

function readArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || values[key]) {
      usage(`Invalid argument: ${key ?? ""}`);
      return null;
    }
    values[key] = value;
  }
  return values;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function filesAt(root) {
  const files = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      const segment = relative(root, path).replaceAll("\\", "/");
      const stat = lstatSync(path);
      if (stat.isSymbolicLink())
        throw new Error(`Symlink rejected: ${segment}`);
      if (stat.isDirectory()) {
        if (prohibitedSegment.test(name))
          throw new Error(`Prohibited directory rejected: ${segment}`);
        visit(path);
        continue;
      }
      if (!stat.isFile()) throw new Error(`Non-file rejected: ${segment}`);
      if (prohibitedFile.test(segment))
        throw new Error(`Sensitive file name rejected: ${segment}`);
      const bytes = readFileSync(path);
      files.push({ path: segment, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  visit(root);
  return files;
}

function requiredManifest(root, browser) {
  const manifestPath = join(root, "manifest.json");
  if (!existsSync(manifestPath))
    throw new Error(`Manifest missing: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.manifest_version !== 3)
    throw new Error(`${browser} build is not MV3`);
  if (manifest.chrome_url_overrides?.newtab !== "newtab.html")
    throw new Error(`${browser} build does not register the New Tab override`);
  if (!existsSync(join(root, "newtab.html")))
    throw new Error(`${browser} build is missing newtab.html`);
  return manifest;
}

function candidateCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function workingTreeState() {
  try {
    return execFileSync("git", ["status", "--porcelain"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
      ? "dirty"
      : "clean";
  } catch {
    return "unknown";
  }
}

function kitReadme(report) {
  return `# Venus manual browser test kit

This is a local test kit built from the included Firefox and Chrome MV3 extension directories. It is **not** signed, store-submitted, or a release decision. Its artifact hashes and manifests are in \`manifest-inventory.json\` and \`SHA256SUMS\`.

Candidate commit: \`${report.candidate.commit}\`
Source tree: **${report.candidate.sourceState}**

## Verify the copied artifacts

Run \`node verify-hashes.mjs\` from this directory. It uses only Node's standard library to compare each copied extension artifact with \`SHA256SUMS\`; no network access is used.

## Prerequisites

- An official current Firefox Desktop for the Firefox pass.
- A current Chrome/Chromium browser for the Chrome pass.
- A newly-created disposable browser profile for each browser. Do not use a normal, synced, or personal profile.
- Node.js 22 or newer only for the result recorder. No package installation, network access, signing, or browser-profile path is required after this kit is generated.

The kit does not read, copy, create, modify, or delete browser profile directories. The browser itself will write its ordinary disposable-profile data after you load the extension.

## Load the actual extension

Firefox: open \`about:debugging#/runtime/this-firefox\`, choose **Load Temporary Add-on**, and select \`extensions/firefox-mv3/manifest.json\`. Open a browser New Tab through the browser UI.

Chrome/Chromium: open \`chrome://extensions\`, enable **Developer mode**, choose **Load unpacked**, and select \`extensions/chrome-mv3\`. Open a browser New Tab through the browser UI. Do not start Chrome with \`--no-sandbox\`.

## Record results without editing a Markdown table

Run this from the kit directory after each case. The command updates the machine-readable \`acceptance-results.json\` and regenerates the reviewable \`acceptance-summary.md\`.

\`\`\`sh
node record-result.mjs --browser firefox --id RC-01 --status PASS --notes "Fresh disposable profile; extension ID recorded" --evidence evidence/firefox/rc-01-new-tab.png
\`\`\`

Allowed statuses are \`PASS\`, \`FAIL\`, \`BLOCKED\`, and \`NOT_EXECUTED\`. Keep evidence paths relative to this kit. Before sharing an image or console log, remove personal names, locations, finance values, API credentials, extension storage dumps, and browser profile paths. A browser notification API result does not prove an operating-system notification appeared; record that observation only in \`NOT-OS-01\`.

Read \`ACCEPTANCE_GUIDE.md\` for the ordered checks and \`acceptance-results.json\` for the blank per-browser report.
`;
}

function acceptanceGuide() {
  const steps = cases
    .slice(0, 10)
    .map(([id, title], index) => `${index + 1}. **${id} — ${title}.**`)
    .join("\n");
  const remaining = cases
    .slice(10)
    .map(([id, title]) => `- **${id} — ${title}.**`)
    .join("\n");
  return `# Venus manual acceptance guide

Run the initial sequence in each browser and record each result with \`node record-result.mjs\`. Use synthetic data only. Capture a screenshot after every failed or blocked step and save sanitized console errors beside it under \`evidence/\`.

## Initial release-candidate sequence

${steps}

For **RC-07**, create daily and weekly habits; enable a local reminder; change its time or weekday; snooze it from Notification Center; complete it once; and confirm the occurrence's local-date check-in is not duplicated and a future occurrence remains. Disable the reminder and ensure new pending occurrences disappear. Record browser notification API acceptance separately from OS display.

For **RC-08**, use only synthetic finance values. Verify a zero opening balance, signed opening balance where available, selected-month income/expense/budget values, CSV/JSON export safety, and profile-scoped deletion.

For **RC-10**, record browser/OS versions, extension ID, manifest version, viewport, locale, timezone, screenshot and sanitized console result in the evidence path named in the result command.

## Remaining cross-widget cases

${remaining}

For \`XW-01\`, verify a goal linked to task/habit data, a knowledge-review rating/postpone flow, and people follow-up snooze/completion without deleting the person. For \`XW-02\`, verify Focus conflict guidance, local AI Inbox classification/undo, and Weather/Commute consent and persistence. For \`NOT-OS-01\`, visually observe the target operating system notification if possible; otherwise record \`NOT_EXECUTED\` or a precise \`BLOCKED\` reason.

No case is accepted in Firefox because it passed in Chrome, or because a unit/integration test passed. Do not open an extension page directly as proof of the browser New Tab override.
`;
}

const values = readArguments(process.argv.slice(2));
if (!values) process.exit();
const firefox = resolve(values["--firefox"] ?? ".output/firefox-mv3");
const chrome = resolve(values["--chrome"] ?? ".output/chrome-mv3");
const output = resolve(values["--out"] ?? "artifacts/venus-manual-test-kit");
if (existsSync(output)) {
  usage(`Refusing to overwrite existing kit: ${output}`);
} else {
  try {
    const targets = { firefox, chrome };
    const manifest = Object.fromEntries(
      Object.entries(targets).map(([browser, root]) => [
        browser,
        requiredManifest(root, browser),
      ]),
    );
    const inventory = Object.fromEntries(
      Object.entries(targets).map(([browser, root]) => [
        browser,
        filesAt(root),
      ]),
    );
    const report = {
      schemaVersion: 1,
      candidate: {
        commit: values["--candidate"] ?? candidateCommit(),
        sourceState: workingTreeState(),
      },
      generatedAt: new Date().toISOString(),
      results: Object.fromEntries(
        ["firefox", "chrome"].map((browser) => [
          browser,
          cases.map(([id, title]) => ({
            id,
            title,
            status: "NOT_EXECUTED",
            notes: "",
            evidence: [],
            recordedAt: null,
          })),
        ]),
      ),
    };
    mkdirSync(dirname(output), { recursive: true });
    const staging = mkdtempSync(join(dirname(output), ".venus-manual-kit-"));
    try {
      mkdirSync(join(staging, "extensions"));
      for (const [browser, root] of Object.entries(targets))
        cpSync(root, join(staging, "extensions", `${browser}-mv3`), {
          recursive: true,
          dereference: false,
        });
      cpSync("LICENSE", join(staging, "LICENSE"));
      cpSync("THIRD_PARTY_NOTICES.md", join(staging, "THIRD_PARTY_NOTICES.md"));
      cpSync(
        "scripts/record-manual-test-result.mjs",
        join(staging, "record-result.mjs"),
      );
      cpSync(
        "scripts/verify-manual-test-kit-hashes.mjs",
        join(staging, "verify-hashes.mjs"),
      );
      writeFileSync(join(staging, "README.md"), kitReadme(report));
      writeFileSync(join(staging, "ACCEPTANCE_GUIDE.md"), acceptanceGuide());
      writeFileSync(
        join(staging, "acceptance-results.json"),
        `${JSON.stringify(report, null, 2)}\n`,
      );
      writeFileSync(
        join(staging, "manifest-inventory.json"),
        `${JSON.stringify(
          { candidate: report.candidate, manifest, artifacts: inventory },
          null,
          2,
        )}\n`,
      );
      const sums = Object.entries(inventory)
        .flatMap(([browser, files]) =>
          files.map(
            (file) => `${file.sha256}  extensions/${browser}-mv3/${file.path}`,
          ),
        )
        .sort();
      writeFileSync(join(staging, "SHA256SUMS"), `${sums.join("\n")}\n`);
      renameSync(staging, output);
    } catch (error) {
      rmSync(staging, { recursive: true, force: true });
      throw error;
    }
    console.log(
      JSON.stringify(
        {
          directory: output,
          firefoxFiles: inventory.firefox.length,
          chromeFiles: inventory.chrome.length,
          candidate: report.candidate.commit,
        },
        null,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
