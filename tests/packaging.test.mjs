import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  distributionLicenseFiles,
  validateCandidate,
  validateDistributionLicenses,
} from "../scripts/firefox-package.mjs";
test("beta/release validated and malformed packages rejected", () => {
  validateCandidate(".output-beta/firefox-mv3", "beta");
  validateCandidate(".output-release/firefox-mv3", "release");
  assert.throws(() => validateCandidate(".output/firefox-mv3", "beta"));
  assert.throws(() => validateCandidate(".output-beta/firefox-mv3", "release"));
  assert.throws(() => validateCandidate(".output-beta/firefox-mv3", undefined));
  assert.throws(() => validateCandidate(".output-beta/firefox-mv3", "typo"));
  for (const change of [
    "id",
    "manifest",
    "icon",
    "dev",
    "secret",
    "missing-chunk",
    "version",
  ]) {
    const root = mkdtempSync(join(tmpdir(), "venus-package-test-"));
    try {
      cpSync(".output-beta/firefox-mv3", root, { recursive: true });
      if (change === "id") {
        const p = join(root, "manifest.json"),
          m = JSON.parse(readFileSync(p));
        m.browser_specific_settings.gecko.id = "wrong@example.invalid";
        writeFileSync(p, JSON.stringify(m));
      }
      if (change === "version") {
        const p = join(root, "manifest.json"),
          m = JSON.parse(readFileSync(p));
        m.version = "../../../escape";
        writeFileSync(p, JSON.stringify(m));
      }
      if (change === "manifest") unlinkSync(join(root, "manifest.json"));
      if (change === "icon")
        cpSync(join(root, "icons/icon.png"), join(root, "icons/icon-48.png"));
      if (change === "dev")
        writeFileSync(
          join(root, "background.js"),
          'import "http://localhost:3000/@vite/client";',
        );
      if (change === "secret") writeFileSync(join(root, ".env"), "TOKEN=test");
      if (change === "missing-chunk") {
        const html = readFileSync(join(root, "newtab.html"), "utf8");
        const path = html.match(/src="([^"]+)"/)[1];
        unlinkSync(join(root, path.replace(/^\//, "")));
      }
      assert.throws(() => validateCandidate(root, "beta"), change);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});
test("bundled license texts match installed packages and reject gaps", () => {
  validateDistributionLicenses(".");
  for (const [pkg, file] of [
    ["react", "LICENSE"],
    ["react-dom", "LICENSE"],
    ["scheduler", "LICENSE"],
    ["dexie", "LICENSE"],
    ["dexie", "NOTICE"],
    ["zod", "LICENSE"],
    ["jalaali-js", "LICENSE"],
    ["rrule-temporal", "LICENSE"],
    ["temporal-polyfill", "LICENSE"],
    ["temporal-spec", "LICENSE"],
    ["temporal-utils", "LICENSE"],
  ]) {
    assert.deepEqual(
      readFileSync(join("licenses", pkg, file)),
      readFileSync(join("node_modules", pkg, file)),
    );
  }
  assert.deepEqual(
    readFileSync("licenses/zip.js/LICENSE"),
    readFileSync("node_modules/@zip.js/zip.js/LICENSE"),
  );
  const root = mkdtempSync(join(tmpdir(), "venus-license-"));
  try {
    for (const relative of distributionLicenseFiles) {
      const target = join(root, relative);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(relative, target);
    }
    validateDistributionLicenses(root);
    unlinkSync(join(root, "licenses/dexie/NOTICE"));
    assert.throws(() => validateDistributionLicenses(root));
    cpSync("licenses/dexie/NOTICE", join(root, "licenses/dexie/NOTICE"));
    writeFileSync(
      join(root, "LICENSE"),
      readFileSync("LICENSE", "utf8").replace(
        "Copyright (c) 2026 Akira Yuzai",
        "Copyright (c) 1999 Example",
      ),
    );
    assert.throws(() => validateDistributionLicenses(root));
    unlinkSync(join(root, "LICENSE"));
    assert.throws(() => validateDistributionLicenses(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
