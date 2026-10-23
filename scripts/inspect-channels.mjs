import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { validateCandidate, p00Id } from "./firefox-package.mjs";
const beta = validateCandidate(".output-beta/firefox-mv3", "beta");
const release = validateCandidate(".output-release/firefox-mv3", "release");
const p00 = JSON.parse(readFileSync(".output/firefox-mv3/manifest.json"));
const chrome = JSON.parse(readFileSync(".output/chrome-mv3/manifest.json"));
assert.equal(p00.browser_specific_settings.gecko.id, p00Id);
assert.equal(p00.name, "Venus Workspace — Development Build");
assert.match(p00.description, /Local-first personal workspace/);
assert.ok(
  !chrome.browser_specific_settings && !chrome.chrome_settings_overrides,
);
assert.equal(chrome.name, "Venus Workspace — Development Build");
assert.match(chrome.description, /Local-first personal workspace/);
assert.deepEqual(chrome.background, { service_worker: "background.js" });
const dir = process.env.P00_EVIDENCE_DIR ?? "evidence/P00/beta-identity";
mkdirSync(dir, { recursive: true });
writeFileSync(
  `${dir}/channel-manifests.json`,
  JSON.stringify(
    { p00, beta: beta.manifest, release: release.manifest, chrome },
    null,
    2,
  ),
);
console.log("P00/beta/release/Chrome manifest identities verified");
