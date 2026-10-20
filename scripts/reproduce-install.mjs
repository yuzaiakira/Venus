import { mkdtempSync, cpSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const evidenceDir = resolve(
  process.env.P00_EVIDENCE_DIR ?? "evidence/P00/remediation",
);
mkdirSync(evidenceDir, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), "Venus-p00-repro-"));
const results = [];
try {
  for (const file of [
    "package.json",
    "package-lock.json",
    "wxt.config.ts",
    "tsconfig.json",
    "vitest.config.ts",
    "eslint.config.js",
    "entrypoints",
    "src",
    "public",
    "tests",
  ])
    cpSync(file, join(scratch, file), { recursive: true });
  const commands = [
    ["ci", "--offline", "--ignore-scripts", "--cache", resolve(".npm-cache")],
    ["run", "typecheck"],
    ["run", "unit"],
    ["run", "test:integration"],
    ["run", "build:firefox"],
    ["run", "build:chrome"],
  ];
  for (const [index, args] of commands.entries()) {
    const result = spawnSync("npm", args, {
      cwd: scratch,
      encoding: "utf8",
      timeout: 180000,
    });
    const log = join(evidenceDir, `fresh-${index + 1}.log`);
    writeFileSync(
      log,
      (result.stdout ?? "") +
        (result.stderr ?? "") +
        (result.error?.message ?? ""),
    );
    const exitCode = result.error ? null : result.status;
    results.push({
      command: "npm " + args.join(" "),
      cwd: scratch,
      exitCode,
      signal: result.signal,
      log,
    });
    console.log(
      `${results.at(-1).command}: ${exitCode === 0 ? "PASS" : "FAIL"}`,
    );
    if (exitCode !== 0) break;
  }
} finally {
  writeFileSync(
    join(evidenceDir, "fresh-results.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        node: process.version,
        installScripts: false,
        offline: true,
        results,
      },
      null,
      2,
    ),
  );
  // Only the directory created by this process is removed, never user profiles.
  rmSync(scratch, { recursive: true, force: true });
}
process.exitCode =
  results.length === 6 && results.every((result) => result.exitCode === 0)
    ? 0
    : 1;
