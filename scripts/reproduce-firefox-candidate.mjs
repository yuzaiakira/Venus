import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { validateCandidate, inventory } from "./firefox-package.mjs";
const channel = process.env.VENUS_FIREFOX_CHANNEL;
assert.equal(channel, "beta", "Reproduction requires explicit beta channel");
const original = validateCandidate(".output-beta/firefox-mv3", "beta");
const dir = resolve(
  process.env.P00_EVIDENCE_DIR ?? "evidence/P00/beta-identity",
);
mkdirSync(dir, { recursive: true });
const source = resolve(
  `.output-beta/packages/venus-beta-${original.manifest.version}-source.zip`,
);
const scratch = mkdtempSync(join(tmpdir(), "venus-beta-repro-"));
const commands = [
  [
    "npm",
    ["ci", "--offline", "--ignore-scripts", "--cache", resolve(".npm-cache")],
  ],
  ["npm", ["exec", "wxt", "prepare"]],
  ["npm", ["run", "build:firefox:beta"]],
  ["node", ["scripts/package-firefox-candidate.mjs"]],
];
const results = [];
try {
  execFileSync("python3", [
    "-c",
    "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
    source,
    scratch,
  ]);
  for (const [i, [cmd, args]] of commands.entries()) {
    const r = spawnSync(cmd, args, {
      cwd: scratch,
      env: { ...process.env, VENUS_FIREFOX_CHANNEL: "beta" },
      encoding: "utf8",
      timeout: 180000,
    });
    writeFileSync(
      join(dir, `reproduce-${i + 1}.log`),
      (r.stdout ?? "") + (r.stderr ?? "") + (r.error?.message ?? ""),
    );
    results.push({
      command: [cmd, ...args].join(" "),
      cwd: scratch,
      exitCode: r.error ? null : r.status,
    });
    assert.equal(r.status, 0, results.at(-1).command);
  }
  const rebuilt = validateCandidate(
    join(scratch, ".output-beta/firefox-mv3"),
    "beta",
  );
  assert.deepEqual(rebuilt.files, original.files);
  const expected = inventory(".output-beta/packages").filter((f) =>
    f.path.endsWith(".zip"),
  );
  const actual = inventory(join(scratch, ".output-beta/packages")).filter((f) =>
    f.path.endsWith(".zip"),
  );
  assert.deepEqual(actual, expected);
  console.log(
    "Source archive reproduces all build files and both ZIP archives byte-for-byte",
  );
  writeFileSync(
    join(dir, "reproduction.json"),
    JSON.stringify(
      {
        results,
        buildFiles: rebuilt.files,
        packages: actual,
        byteIdentical: true,
      },
      null,
      2,
    ),
  );
} catch (error) {
  writeFileSync(
    join(dir, "reproduction-failure.json"),
    JSON.stringify({ results, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
