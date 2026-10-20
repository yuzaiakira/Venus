import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { inventory } from "./firefox-package.mjs";
import { spawnSync } from "node:child_process";
const dir = "evidence/P00/beta-identity";
mkdirSync(dir, { recursive: true });
const commands = [
  ["npm", ["run", "typecheck"]],
  ["npm", ["run", "lint"]],
  ["npm", ["run", "format:check"]],
  ["npm", ["run", "unit"]],
  ["npm", ["run", "test:integration"]],
  ["npm", ["run", "build:firefox"]],
  ["npm", ["run", "build:chrome"]],
  ["npm", ["run", "build:firefox:beta"]],
  ["npm", ["run", "build:firefox:release"]],
  ["npm", ["run", "inspect:manifests"]],
  ["npm", ["run", "inspect:channels"]],
  ["npm", ["run", "test:security"]],
  ["npm", ["run", "test:packaging"]],
  ["npm", ["run", "package:firefox:beta"]],
  [
    "node",
    ["scripts/reproduce-firefox-candidate.mjs"],
    { VENUS_FIREFOX_CHANNEL: "beta" },
  ],
  [
    "node",
    ["node_modules/wxt/dist/cli/index.mjs", "build", "-b", "firefox", "--mv3"],
    { VENUS_FIREFOX_CHANNEL: "typo" },
    "reject",
  ],
  [
    "node",
    ["scripts/package-firefox-candidate.mjs"],
    { VENUS_FIREFOX_CHANNEL: "" },
    "reject",
  ],
  [
    "node",
    ["scripts/package-firefox-candidate.mjs"],
    { VENUS_FIREFOX_CHANNEL: "p00" },
    "reject",
  ],
  [
    "node",
    ["node_modules/wxt/dist/cli/index.mjs", "build", "-b", "chrome", "--mv3"],
    { VENUS_FIREFOX_CHANNEL: "beta" },
  ],
  ["npm", ["run", "inspect:channels"]],
  [
    "node",
    [
      "node_modules/web-ext/bin/web-ext.js",
      "lint",
      "--source-dir",
      ".output-beta/firefox-mv3",
      "--output",
      "json",
    ],
  ],
];
const results = [];
let chromeFiles;
for (const [
  i,
  [cmd, args, extra = {}, expect = "pass"],
] of commands.entries()) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: 180000,
    env: {
      ...process.env,
      VENUS_FIREFOX_CHANNEL: "p00",
      P00_EVIDENCE_DIR: dir,
      ...extra,
    },
  });
  const log = `${dir}/check-${String(i + 1).padStart(2, "0")}.log`;
  writeFileSync(
    log,
    (result.stdout ?? "") +
      (result.stderr ?? "") +
      (result.error?.message ?? ""),
  );
  const exitCode = result.error ? null : result.status;
  if (i === 6 && exitCode === 0) chromeFiles = inventory(".output/chrome-mv3");
  if (i === 18 && exitCode === 0)
    assert.deepEqual(
      inventory(".output/chrome-mv3"),
      chromeFiles,
      "Firefox selector altered Chrome build bytes",
    );
  const pass =
    exitCode !== null &&
    (expect === "reject" ? exitCode !== 0 : exitCode === 0);
  results.push({
    command: [cmd, ...args].join(" "),
    env: extra,
    exitCode,
    expect,
    pass,
    log,
  });
  console.log(`${i + 1} ${cmd} ${args.join(" ")}: ${pass ? "PASS" : "FAIL"}`);
}
writeFileSync(
  `${dir}/local-results.json`,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      results,
    },
    null,
    2,
  ),
);
process.exitCode = results.every((r) => r.pass) ? 0 : 1;
