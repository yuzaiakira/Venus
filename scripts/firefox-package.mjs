import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  lstatSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
export const permanentId = "{935006c2-63b4-4e03-b842-11b88571da3b}";
export const p00Id = "p00@Venus.invalid";
export const distributionLicenseFiles = [
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "licenses/react/LICENSE",
  "licenses/react-dom/LICENSE",
  "licenses/scheduler/LICENSE",
  "licenses/dexie/LICENSE",
  "licenses/dexie/NOTICE",
  "licenses/zod/LICENSE",
  "licenses/jalaali-js/LICENSE",
  "licenses/rrule-temporal/LICENSE",
  "licenses/temporal-polyfill/LICENSE",
  "licenses/temporal-spec/LICENSE",
  "licenses/temporal-utils/LICENSE",
  "licenses/zip.js/LICENSE",
];
export function validateDistributionLicenses(root) {
  for (const relative of distributionLicenseFiles) {
    const bytes = readFileSync(join(root, relative));
    assert.ok(bytes.length > 0, `License file missing or empty: ${relative}`);
  }
  const venus = readFileSync(join(root, "LICENSE"), "utf8");
  assert.match(venus, /SPDX-License-Identifier: MIT/);
  assert.match(venus, /Copyright \(c\) 2026 Akira Yuzai/);
  assert.match(venus, /Permission is hereby granted, free of charge/);
  assert.match(
    venus,
    /THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND/,
  );
  assert.doesNotMatch(venus, /All Rights Reserved/i);
  for (const name of ["react", "react-dom", "scheduler"]) {
    const text = readFileSync(join(root, `licenses/${name}/LICENSE`), "utf8");
    assert.match(
      text,
      /Copyright \(c\) Meta Platforms, Inc\. and affiliates\./,
    );
    assert.equal(text.includes("Akira Yuzai"), false);
  }
  const dexieLicense = readFileSync(
    join(root, "licenses/dexie/LICENSE"),
    "utf8",
  );
  const dexieNotice = readFileSync(join(root, "licenses/dexie/NOTICE"), "utf8");
  assert.match(dexieLicense, /Apache License/);
  assert.match(dexieLicense, /Version 2\.0, January 2004/);
  assert.match(dexieNotice, /Copyright \(c\) 2014-2017 David Fahlander/);
  assert.match(dexieNotice, /Apache License, Version 2\.0/);
  assert.equal(dexieLicense.includes("Akira Yuzai"), false);
  assert.equal(dexieNotice.includes("Akira Yuzai"), false);
  const zod = readFileSync(join(root, "licenses/zod/LICENSE"), "utf8");
  assert.match(zod, /Copyright \(c\) 2020 Colin McDonnell/);
  assert.equal(zod.includes("Akira Yuzai"), false);
  const jalaali = readFileSync(
    join(root, "licenses/jalaali-js/LICENSE"),
    "utf8",
  );
  assert.match(jalaali, /Copyright \(c\) 2020 Behrang Norouzinia/);
  assert.equal(jalaali.includes("Akira Yuzai"), false);
  const rrule = readFileSync(
    join(root, "licenses/rrule-temporal/LICENSE"),
    "utf8",
  );
  assert.match(rrule, /Copyright \(c\) 2024 ggaabe/);
  const temporal = readFileSync(
    join(root, "licenses/temporal-polyfill/LICENSE"),
    "utf8",
  );
  assert.match(temporal, /Copyright \(c\) 2026 Adam Shaw/);
  const temporalSpec = readFileSync(
    join(root, "licenses/temporal-spec/LICENSE"),
    "utf8",
  );
  assert.match(temporalSpec, /Apache License/);
  assert.match(temporalSpec, /Copyright 2026 Adam Shaw/);
  const notices = readFileSync(join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  assert.match(notices, /Copyright \(c\) 2026 Akira Yuzai/);
  assert.match(notices, /retain their own license|keeps its own license/);
  assert.match(notices, /David Fahlander/);
  assert.match(notices, /temporal-spec/);
  assert.match(notices, /Apache-2\.0/);
  assert.match(notices, /@zip\.js\/zip\.js/);
  assert.match(notices, /BSD-3-Clause/);
  const zipLicense = readFileSync(
    join(root, "licenses/zip.js/LICENSE"),
    "utf8",
  );
  assert.match(zipLicense, /BSD 3-Clause License/);
  assert.match(zipLicense, /Gildas Lormeau/);
  assert.equal(zipLicense.includes("Akira Yuzai"), false);
}
export function stageDistribution(buildRoot, destination) {
  cpSync(buildRoot, destination, { recursive: true });
  for (const relative of distributionLicenseFiles) {
    const target = join(destination, relative);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(relative, target);
  }
  validateDistributionLicenses(destination);
  return destination;
}
export function reviewerReadme({ channel, platform, arch, node, npm, python }) {
  return `# Venus ${channel} technical preview — reviewer build

Unsigned local candidate, not a complete workspace release. This source archive is for AMO review and for rebuilding the extension. It is not itself the signed add-on.

Original Venus Workspace code is MIT-licensed. The copyright notice is \`Copyright (c) 2026 Akira Yuzai\`. \`LICENSE\` is that text, including \`SPDX-License-Identifier: MIT\`. React, React DOM, scheduler, Dexie, Zod, jalaali-js, rrule-temporal, temporal-polyfill, temporal-spec, temporal-utils, and @zip.js/zip.js keep their own licenses. temporal-spec is Apache-2.0. @zip.js/zip.js is BSD-3-Clause. \`THIRD_PARTY_NOTICES.md\` and \`licenses/\` contain those texts. The same files are copied into the unsigned extension archive because those libraries are bundled there. Venus copyright is not applied to them.

## Tools

This archive was packed on ${platform} ${arch} with Node ${node}, npm ${npm}, WXT 0.21.4 from the lockfile, and ${python} for ZIP packaging.

Official downloads:

- Node.js, which includes npm: https://nodejs.org/en/download
- npm installation notes: https://docs.npmjs.com/downloading-and-installing-node-js-and-npm
- Python 3: https://www.python.org/downloads/

No other download is required. WXT and the application dependencies come from the npm registry through the lockfile.

## Reproduce the extension archive

From the root of this extracted source archive:

\`\`\`sh
npm ci --ignore-scripts
npm exec wxt prepare
npm run build:firefox:${channel}
VENUS_FIREFOX_CHANNEL=${channel} node scripts/package-firefox-candidate.mjs
\`\`\`

Output directory: \`.output-${channel}/firefox-mv3\`. The unsigned archive is \`.output-${channel}/packages/venus-${channel}-0.0.1-unsigned.zip\`. Packaging sorts paths and fixes ZIP dates and modes. Compare every file with the submitted extension archive. Dependency installation needs npm access or a populated cache. No credentials or external services are required to build.

The Firefox ID in this ${channel} manifest stays \`{935006c2-63b4-4e03-b842-11b88571da3b}\`. Do not generate a new ID. Future updates use a higher version under the existing AMO add-on record, and only after the owner approves that submission. There is no \`update_url\`.

## Platform

The intended browser is Firefox Desktop. \`gecko_android\` is omitted. That omission does not prove a self-distributed XPI cannot be installed on Firefox for Android. Minimum Firefox 140.0 is declared and was not executed in the recorded checks. The recorded desktop run used Firefox 155.0.1.

\`data_collection_permissions.required\` is \`["none"]\`. The extension uses local storage, alarms, optional permission probes, and packaged pages. It declares no host permission and no remote script.

## Firefox lint warnings

\`web-ext lint\` on this build reports 0 errors and 3 warnings:

1. \`KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION\`. \`strict_min_version\` 140 is older than Firefox for Android 142, where \`data_collection_permissions\` is supported. The manifest does not declare an Android-specific block.
2. \`UNSAFE_VAR_ASSIGNMENT\` in the shared UI chunk \`chunks/tokens-*.js\`, the standard-element branch. Minified React DOM assigns \`innerHTML\` from \`dangerouslySetInnerHTML.__html\` when that prop is present.
3. \`UNSAFE_VAR_ASSIGNMENT\` in the same React DOM chunk, the custom-element branch, which uses the same raw-HTML prop path.

Application source does not call \`dangerouslySetInnerHTML\`, \`innerHTML\`, \`eval\`, or \`new Function\`. ESLint rejects those sinks in \`src/\` and \`entrypoints/\`. A disposable-profile identity check stored a hostile-looking synthetic string and read it back as JSON text, with no injected element and no handler execution. That check is not a whole-program guarantee. The React DOM sink remains in the vendor bundle. CSP is \`script-src 'self'; object-src 'none'\`.

## Tests and the WebDriver workaround

\`scripts/smoke-firefox.mjs\` can disable Firefox Labs, studies, and Nimbus rollouts. Those policies and preferences are written only into the disposable Selenium profile used by the smoke test, so Firefox can quit while that profile is offline. They are not part of the extension package, its manifest, or a user's profile.

## AMO identity

Availability and ownership of \`{935006c2-63b4-4e03-b842-11b88571da3b}\` on addons.mozilla.org are not verified by this archive. The owner checks that later, in the owner's own Mozilla account, by submitting a new add-on and choosing On your own. If AMO reports that the ID belongs to another account, stop. Do not send account passwords, API keys, or personal documents to the build. Local packaging is not submission, signing, or publication.
`;
}
export function inventory(root) {
  const files = [];
  function walk(dir, prefix = "") {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const relative = prefix + name;
      const stat = lstatSync(path);
      assert.ok(!stat.isSymbolicLink(), `Symlink rejected: ${relative}`);
      if (stat.isDirectory()) walk(path, relative + "/");
      else {
        assert.ok(stat.isFile(), `Non-file rejected: ${relative}`);
        const bytes = readFileSync(path);
        assert.ok(
          !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(
            bytes.toString(),
          ),
          `Private key rejected: ${relative}`,
        );
        files.push({
          path: relative,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  }
  walk(root);
  return files;
}
export function validateCandidate(root, channel) {
  assert.ok(
    ["beta", "release"].includes(channel),
    "Explicit beta/release channel required",
  );
  const files = inventory(root);
  for (const { path } of files)
    assert.match(
      path,
      /^(manifest\.json|background\.js|(?:newtab|options)\.html|icons\/(?:icon|icon-48)\.png|chunks\/(?:tokens|newtab|options)-[\w-]+\.js|assets\/tokens-[\w-]+\.css)$/,
      `Unexpected artifact: ${path}`,
    );
  const manifest = JSON.parse(
    readFileSync(join(root, "manifest.json"), "utf8"),
  );
  assert.match(
    manifest.version,
    /^\d{1,5}(?:\.\d{1,5}){0,3}$/,
    "Numeric safe package version required",
  );
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.browser_specific_settings?.gecko?.id, permanentId);
  assert.equal(
    manifest.name,
    `Venus Workspace — ${channel === "beta" ? "Beta" : "Release"} Technical Preview`,
  );
  assert.match(manifest.description, /no full workspace features/);
  assert.equal(
    manifest.browser_specific_settings.gecko.strict_min_version,
    "140.0",
  );
  assert.ok(!manifest.browser_specific_settings.gecko_android);
  assert.deepEqual(
    manifest.browser_specific_settings.gecko.data_collection_permissions,
    { required: ["none"] },
  );
  assert.deepEqual(manifest.background, { scripts: ["background.js"] });
  assert.deepEqual(manifest.permissions, ["storage", "alarms"]);
  assert.deepEqual(manifest.optional_permissions, [
    "bookmarks",
    "notifications",
  ]);
  assert.ok(
    !manifest.host_permissions &&
      !manifest.content_scripts &&
      !manifest.browser_specific_settings.gecko.update_url,
  );
  assert.deepEqual(manifest.content_security_policy, {
    extension_pages: "script-src 'self'; object-src 'none'",
  });
  assert.deepEqual(manifest.chrome_settings_overrides, {
    homepage: "newtab.html",
  });
  assert.deepEqual(manifest.chrome_url_overrides, { newtab: "newtab.html" });
  assert.deepEqual(manifest.icons, {
    48: "icons/icon-48.png",
    96: "icons/icon.png",
  });
  for (const [size, path] of Object.entries(manifest.icons)) {
    const png = readFileSync(join(root, path));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }
  for (const file of ["background.js", "newtab.html", "options.html"])
    assert.ok(readFileSync(join(root, file)).length > 0);
  for (const { path } of files.filter((f) => /\.(js|html|css)$/.test(f.path))) {
    const code = readFileSync(join(root, path), "utf8");
    assert.ok(
      !/https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/)|@vite\/client|wxt:reload|reload-html|websocket|import\.meta\.hot/i.test(
        code,
      ),
      `Development artifact: ${path}`,
    );
    assert.ok(
      !/<script[^>]+src=["']https?:|\beval\s*\(|new\s+Function\s*\(/i.test(
        code,
      ),
      `Unsafe executable artifact: ${path}`,
    );
    if (path.endsWith(".html")) {
      for (const match of code.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        assert.ok(
          !match[1].includes("..") && !match[1].includes(":"),
          "Non-local page dependency",
        );
        readFileSync(join(root, match[1].replace(/^\//, "")));
      }
    }
  }
  return { channel, manifest, files };
}
