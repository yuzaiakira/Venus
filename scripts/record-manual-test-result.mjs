import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const statuses = new Set(["PASS", "FAIL", "BLOCKED", "NOT_EXECUTED"]);
const browsers = new Set(["firefox", "chrome"]);

function usage(message) {
  if (message) console.error(message);
  console.error(
    "Usage: node record-result.mjs --browser firefox|chrome --id CASE-ID --status PASS|FAIL|BLOCKED|NOT_EXECUTED [--notes text] [--evidence relative/path] [--file acceptance-results.json]",
  );
  process.exitCode = 1;
}

function argumentsFrom(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || values[key]) {
      usage(`Invalid argument: ${key ?? ""}`);
      return null;
    }
    values[key] = value;
  }
  return values;
}

function markdownReport(report) {
  const lines = [
    "# Venus manual browser acceptance summary",
    "",
    `Candidate commit: \`${report.candidate.commit}\``,
    `Generated: ${report.generatedAt}`,
    "",
  ];
  for (const browser of ["firefox", "chrome"]) {
    lines.push(`## ${browser === "firefox" ? "Firefox" : "Chrome"}`);
    lines.push(
      "",
      "| ID | Status | Notes | Evidence |",
      "| --- | --- | --- | --- |",
    );
    for (const result of report.results[browser]) {
      lines.push(
        `| ${result.id} | ${result.status.replace("_", " ")} | ${result.notes || "—"} | ${result.evidence.join(", ") || "—"} |`,
      );
    }
    lines.push("");
  }
  lines.push(
    "Native operating-system notification visibility is a separate observation. Do not infer it from an extension notification API result.",
    "",
  );
  return lines.join("\n");
}

const values = argumentsFrom(process.argv.slice(2));
if (!values) process.exit();
const browser = values["--browser"];
const id = values["--id"];
const status = values["--status"];
const output = resolve(values["--file"] ?? "acceptance-results.json");
if (!browsers.has(browser) || !id || !statuses.has(status)) {
  usage("A valid browser, case ID and status are required.");
} else {
  const report = JSON.parse(readFileSync(output, "utf8"));
  const result = report.results?.[browser]?.find((item) => item.id === id);
  if (!result) {
    usage(`Unknown ${browser} case ID: ${id}`);
  } else {
    result.status = status;
    result.notes = values["--notes"] ?? "";
    result.evidence = values["--evidence"]
      ? values["--evidence"].split(",").filter(Boolean)
      : [];
    result.recordedAt = new Date().toISOString();
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(
      resolve(output, "..", "acceptance-summary.md"),
      markdownReport(report),
    );
    console.log(
      JSON.stringify({ browser, id, status, report: output }, null, 2),
    );
  }
}
