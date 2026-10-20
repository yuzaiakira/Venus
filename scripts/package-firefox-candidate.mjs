import { mkdirSync, cpSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  inventory,
  reviewerReadme,
  stageDistribution,
  validateCandidate,
} from "./firefox-package.mjs";
const channel = process.env.VENUS_FIREFOX_CHANNEL;
// No default: absence and unknown channels fail before any package is written.
const root = resolve(`.output-${channel}/firefox-mv3`);
const candidate = validateCandidate(root, channel);
const dir = resolve(`.output-${channel}/packages`);
mkdirSync(dir, { recursive: true });
const stem = `venus-${channel}-${candidate.manifest.version}`;
function zip(root, target) {
  execFileSync("python3", [
    "-c",
    `import pathlib,zipfile,sys
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file():
   i=zipfile.ZipInfo(p.relative_to(root).as_posix(), (1980,1,1,0,0,0)); i.compress_type=zipfile.ZIP_DEFLATED; i.external_attr=0o100644<<16; z.writestr(i,p.read_bytes())
`,
    root,
    target,
  ]);
}
const scratch = mkdtempSync(join(tmpdir(), "venus-source-"));
try {
  for (const path of [
    "package.json",
    "package-lock.json",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "licenses",
    "wxt.config.ts",
    "tsconfig.json",
    "vitest.config.ts",
    "eslint.config.js",
    "entrypoints",
    "src",
    "public",
    "scripts",
    "tests",
  ])
    cpSync(path, join(scratch, path), { recursive: true, dereference: false });
  writeFileSync(
    join(scratch, "README_AMO_BUILD.md"),
    reviewerReadme({
      channel,
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      npm: execFileSync("npm", ["--version"], { encoding: "utf8" }).trim(),
      python: execFileSync("python3", ["--version"], {
        encoding: "utf8",
      }).trim(),
    }),
  );
  const sourceFiles = inventory(scratch);
  for (const { path } of sourceFiles)
    if (
      !/^(?:package(?:-lock)?\.json|LICENSE|THIRD_PARTY_NOTICES\.md|wxt\.config\.ts|tsconfig\.json|vitest\.config\.ts|eslint\.config\.js|README_AMO_BUILD\.md|licenses\/[\w./-]+|(?:src|entrypoints|public|scripts|tests)\/[\w./-]+)$/.test(
        path,
      ) ||
      /(^|\/)(?:\.env|\.git|node_modules|evidence|profiles?|credentials|secrets)(\/|\.|$)/i.test(
        path,
      )
    )
      throw new Error(`Source exclusion: ${path}`);
  const extensionStage = mkdtempSync(join(tmpdir(), "venus-extension-"));
  try {
    stageDistribution(root, extensionStage);
    zip(extensionStage, join(dir, `${stem}-unsigned.zip`));
  } finally {
    rmSync(extensionStage, { recursive: true, force: true });
  }
  zip(scratch, join(dir, `${stem}-source.zip`));
  const packages = inventory(dir).filter(
    (f) => f.path === `${stem}-unsigned.zip` || f.path === `${stem}-source.zip`,
  );
  const record = {
    ...candidate,
    sourceFiles,
    packages,
    commands: [
      `npm run build:firefox:${channel}`,
      `VENUS_FIREFOX_CHANNEL=${channel} node scripts/package-firefox-candidate.mjs`,
    ],
    unsigned: true,
  };
  writeFileSync(
    join(dir, `${stem}-inventory.json`),
    JSON.stringify(record, null, 2),
  );
  console.log(JSON.stringify({ directory: dir, packages }, null, 2));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
