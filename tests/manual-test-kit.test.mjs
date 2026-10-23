import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

function fixture(root, browser) {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "manifest.json"),
    JSON.stringify({
      manifest_version: 3,
      name: `Venus ${browser}`,
      version: "0.0.1",
      chrome_url_overrides: { newtab: "newtab.html" },
    }),
  );
  writeFileSync(join(root, "newtab.html"), "<main>Venus</main>");
  writeFileSync(join(root, "background.js"), "console.log('background');");
}

test("manual test kit inventories real-style MV3 bundles and records results", () => {
  const root = mkdtempSync(join(tmpdir(), "venus-manual-kit-"));
  try {
    const firefox = join(root, "firefox");
    const chrome = join(root, "chrome");
    const kit = join(root, "kit");
    fixture(firefox, "Firefox");
    fixture(chrome, "Chrome");
    execFileSync(
      process.execPath,
      [
        "scripts/prepare-manual-test-kit.mjs",
        "--firefox",
        firefox,
        "--chrome",
        chrome,
        "--out",
        kit,
        "--candidate",
        "test-candidate",
      ],
      { stdio: "pipe" },
    );
    const inventory = JSON.parse(
      readFileSync(join(kit, "manifest-inventory.json"), "utf8"),
    );
    const initialResults = JSON.parse(
      readFileSync(join(kit, "acceptance-results.json"), "utf8"),
    );
    assert.equal(inventory.candidate.commit, "test-candidate");
    assert.match(inventory.candidate.sourceState, /^(?:clean|dirty|unknown)$/);
    const caseIds = initialResults.results.firefox.map((result) => result.id);
    assert.equal(initialResults.results.firefox.length, 24);
    for (const id of ["XW-01", "XW-02", "WGT-BRI-01", "WGT-FIN-01"])
      assert.ok(caseIds.includes(id));
    assert.equal(inventory.manifest.firefox.manifest_version, 3);
    assert.equal(
      inventory.manifest.chrome.chrome_url_overrides.newtab,
      "newtab.html",
    );
    assert.match(
      readFileSync(join(kit, "SHA256SUMS"), "utf8"),
      /extensions\/firefox-mv3\/manifest\.json/,
    );
    assert.equal(
      existsSync(join(kit, "extensions", "firefox-mv3", "newtab.html")),
      true,
    );
    execFileSync(process.execPath, ["verify-hashes.mjs"], {
      cwd: kit,
      stdio: "pipe",
    });
    const archive = join(root, "venus-manual-test-kit.zip");
    const extracted = join(root, "extracted");
    execFileSync(
      process.execPath,
      ["scripts/package-manual-test-kit.mjs", "--input", kit, "--out", archive],
      { stdio: "pipe" },
    );
    execFileSync(
      "python3",
      [
        "-c",
        "import pathlib, sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(pathlib.Path(sys.argv[2]))",
        archive,
        extracted,
      ],
      { stdio: "pipe" },
    );
    execFileSync(
      process.execPath,
      ["scripts/verify-manual-test-kit-hashes.mjs", extracted],
      { stdio: "pipe" },
    );
    for (const path of [
      "README.md",
      "ACCEPTANCE_GUIDE.md",
      "acceptance-results.json",
      "record-result.mjs",
      "verify-hashes.mjs",
      "manifest-inventory.json",
      "extensions/firefox-mv3/manifest.json",
      "extensions/chrome-mv3/manifest.json",
    ])
      assert.equal(existsSync(join(extracted, path)), true, path);
    execFileSync(
      process.execPath,
      [
        "record-result.mjs",
        "--browser",
        "firefox",
        "--id",
        "RC-02",
        "--status",
        "PASS",
        "--notes",
        "Venus rendered in a browser New Tab",
        "--evidence",
        "evidence/firefox/rc-02.png",
      ],
      { cwd: kit, stdio: "pipe" },
    );
    const results = JSON.parse(
      readFileSync(join(kit, "acceptance-results.json"), "utf8"),
    );
    assert.deepEqual(
      results.results.firefox.find((result) => result.id === "RC-02"),
      {
        id: "RC-02",
        title: "Actual browser New Tab shows Venus",
        status: "PASS",
        notes: "Venus rendered in a browser New Tab",
        evidence: ["evidence/firefox/rc-02.png"],
        recordedAt: results.results.firefox.find(
          (result) => result.id === "RC-02",
        ).recordedAt,
      },
    );
    assert.equal(existsSync(join(kit, "acceptance-summary.md")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("manual test kit rejects a bundle containing profile-like data", () => {
  const root = mkdtempSync(join(tmpdir(), "venus-manual-kit-reject-"));
  try {
    const firefox = join(root, "firefox");
    const chrome = join(root, "chrome");
    fixture(firefox, "Firefox");
    fixture(chrome, "Chrome");
    mkdirSync(join(chrome, "profiles"));
    writeFileSync(join(chrome, "profiles", "places.sqlite"), "not allowed");
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            "scripts/prepare-manual-test-kit.mjs",
            "--firefox",
            firefox,
            "--chrome",
            chrome,
            "--out",
            join(root, "kit"),
          ],
          { encoding: "utf8", stdio: "pipe" },
        ),
      /Prohibited directory rejected: profiles/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
