import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const evidenceDir = process.env.P00_EVIDENCE_DIR ?? "evidence/P00";
mkdirSync(evidenceDir, { recursive: true });
const sourceHashes = Object.fromEntries(
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    {
      encoding: "utf8",
    },
  )
    .trim()
    .split("\n")
    .filter((file) =>
      /^(src\/|entrypoints\/|scripts\/|tests\/|package(?:-lock)?\.json$|.*config\.(?:ts|js)$)/.test(
        file,
      ),
    )
    .map((file) => [
      file,
      createHash("sha256").update(readFileSync(file)).digest("hex"),
    ]),
);
const checks = [
  "lint",
  "typecheck",
  "unit",
  "test:integration",
  "format:check",
  "build:firefox",
  "build:chrome",
  "inspect:manifests",
  "test:security",
  "test:smoke:firefox",
  "test:smoke:chrome",
];
const results = [];
for (const check of checks) {
  console.log(`Running npm run ${check}`);
  const result = spawnSync("npm", ["run", check], {
    encoding: "utf8",
    timeout: 180000,
    env: { ...process.env, P00_EVIDENCE_DIR: evidenceDir },
  });
  const log = `${evidenceDir}/final-${check.replaceAll(":", "-")}.log`;
  writeFileSync(
    log,
    (result.stdout ?? "") +
      (result.stderr ?? "") +
      (result.error?.message ?? ""),
  );
  const exitCode = result.error ? null : result.status;
  results.push({
    command: `npm run ${check}`,
    exitCode,
    signal: result.signal,
    log,
  });
  console.log(`${check}: ${exitCode === 0 ? "PASS" : "FAIL"}`);
}
writeFileSync(
  `${evidenceDir}/final-results.json`,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      commit: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      dirty: Boolean(
        execFileSync("git", ["status", "--porcelain"], {
          encoding: "utf8",
        }).trim(),
      ),
      sourceHashes,
      checks: results,
    },
    null,
    2,
  ),
);
process.exitCode = results.every((result) => result.exitCode === 0) ? 0 : 1;
