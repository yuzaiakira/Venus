import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

// Never rewrite specifications or their baseline. Only try bounded brand-name
// reversals and newline encodings, then require the original SHA-256 to match.
const evidenceDir = process.env.P00_EVIDENCE_DIR ?? "evidence/P00/remediation";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const results = [];
for (const line of readFileSync("SHA256SUMS.txt", "utf8")
  .trim()
  .split(/\r?\n/)) {
  const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/);
  if (!match) throw new Error("Invalid baseline checksum row");
  const [, expected, file] = match;
  const current = readFileSync(file, "utf8");
  if (hash(current) === expected) {
    results.push({ file, expected, status: "EXACT_MATCH" });
    continue;
  }
  const chunks = current.replaceAll("\r\n", "\n").split("Venus");
  const count = chunks.length - 1;
  let recovered;
  if (2 ** count <= 100000) {
    for (let variant = 0; variant < 2 ** count && !recovered; variant++) {
      let choices = variant;
      let candidate = chunks[0];
      const replacements = [];
      for (let index = 0; index < count; index++) {
        const name = ["Venus", "venus"][choices % 2];
        choices = Math.floor(choices / 2);
        candidate += name + chunks[index + 1];
        if (name !== "Venus")
          replacements.push({
            occurrence: index + 1,
            baseline: name,
            current: "Venus",
          });
      }
      for (const [encoding, value] of [
        ["LF", candidate],
        ["CRLF", candidate.replaceAll("\n", "\r\n")],
      ]) {
        if (hash(value) === expected) recovered = { encoding, replacements };
      }
    }
  }
  results.push({
    file,
    expected,
    currentHash: hash(current),
    status: recovered ? "CHECKSUM_MATCH_RECONSTRUCTED" : "UNRESOLVED",
    ...recovered,
  });
}
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(
  `${evidenceDir}/prd-reconciliation.json`,
  JSON.stringify(
    {
      baselineHash: hash(readFileSync("SHA256SUMS.txt")),
      method:
        "Bounded name reversals plus LF/CRLF; exact original SHA-256 required. Original snapshot provenance still requires owner confirmation.",
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    Object.fromEntries(
      ["EXACT_MATCH", "CHECKSUM_MATCH_RECONSTRUCTED", "UNRESOLVED"].map(
        (status) => [
          status,
          results.filter((row) => row.status === status).length,
        ],
      ),
    ),
  ),
);
process.exitCode = results.some((row) => row.status === "UNRESOLVED") ? 1 : 0;
