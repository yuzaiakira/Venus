import assert from "node:assert/strict";
import { readFile, access, mkdir, writeFile } from "node:fs/promises";
const manifests = {};
const evidenceDir = process.env.P00_EVIDENCE_DIR ?? "evidence/P00";
for (const target of ["firefox", "chrome"]) {
  const dir = `.output/${target}-mv3`;
  const manifest = JSON.parse(await readFile(`${dir}/manifest.json`, "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.chrome_url_overrides.newtab, "newtab.html");
  await access(`${dir}/newtab.html`);
  await access(`${dir}/options.html`);
  assert.deepEqual([...manifest.permissions].sort(), ["alarms", "storage"]);
  assert.deepEqual([...manifest.optional_permissions].sort(), [
    "bookmarks",
    "notifications",
  ]);
  assert.deepEqual([...manifest.optional_host_permissions].sort(), [
    "https://customer-api.open-meteo.com/*",
    "https://geocoding-api.open-meteo.com/*",
  ]);
  assert.ok(
    !manifest.host_permissions?.length && !manifest.content_scripts?.length,
  );
  assert.deepEqual(manifest.content_security_policy, {
    extension_pages: "script-src 'self'; object-src 'none'",
  });
  if (target === "firefox") {
    assert.equal(manifest.chrome_settings_overrides.homepage, "newtab.html");
    assert.deepEqual(manifest.background, { scripts: ["background.js"] });
  } else {
    assert.ok(!manifest.chrome_settings_overrides);
    assert.deepEqual(manifest.background, { service_worker: "background.js" });
  }
  await access(`${dir}/background.js`);
  manifests[target] = manifest;
}
await mkdir(evidenceDir, { recursive: true });
await writeFile(
  `${evidenceDir}/generated-manifests.json`,
  JSON.stringify(manifests, null, 2),
);
const differences = Object.fromEntries(
  [
    ...new Set([
      ...Object.keys(manifests.firefox),
      ...Object.keys(manifests.chrome),
    ]),
  ]
    .filter(
      (key) =>
        JSON.stringify(manifests.firefox[key]) !==
        JSON.stringify(manifests.chrome[key]),
    )
    .map((key) => [
      key,
      {
        firefox: manifests.firefox[key] ?? null,
        chrome: manifests.chrome[key] ?? null,
      },
    ]),
);
await writeFile(
  `${evidenceDir}/manifest-differences.json`,
  JSON.stringify(differences, null, 2),
);
console.log("Dual MV3 manifest audit passed");
