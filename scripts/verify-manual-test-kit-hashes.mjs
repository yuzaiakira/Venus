import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const entries = readFileSync(resolve(root, "SHA256SUMS"), "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^([a-f0-9]{64}) {2}(.+)$/);
    if (!match) throw new Error(`Invalid SHA256SUMS entry: ${line}`);
    return { expected: match[1], path: match[2] };
  });

for (const entry of entries) {
  const target = resolve(root, entry.path);
  if (relative(root, target).startsWith(".."))
    throw new Error(`Hash path escapes kit: ${entry.path}`);
  const actual = createHash("sha256")
    .update(readFileSync(target))
    .digest("hex");
  if (actual !== entry.expected)
    throw new Error(`Hash mismatch: ${entry.path}`);
}

console.log(`Verified ${entries.length} kit artifact hashes`);
