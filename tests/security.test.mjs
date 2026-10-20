import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
test("P00 configuration has no host access, content injection or unsafe CSP", () => {
  const source = readFileSync("wxt.config.ts", "utf8");
  for (const token of [
    "<all_urls>",
    "unsafe-eval",
    "unsafe-inline",
    "host_permissions",
    "content_scripts",
  ])
    assert.ok(!source.includes(token), token);
  assert.ok(
    /optional_permissions:\s*\[["']bookmarks["'],\s*["']notifications["']\]/.test(
      source,
    ),
  );
});
test("reviewed shell-quote override preserves fx-runner argument parsing", () => {
  const require = createRequire(import.meta.url);
  const runner = require("fx-runner/lib/run.js");
  assert.deepEqual(
    runner.buildArgs({
      profile: "/tmp/Venus fixture",
      "binary-args": '--headless --width "1200"',
    }),
    ["-profile", "/tmp/Venus fixture", "--headless", "--width", "1200"],
  );
  const scoped = createRequire(require.resolve("fx-runner/lib/run.js"));
  assert.equal(scoped("shell-quote/package.json").version, "1.11.0");
});
test("P00 diagnostics accept codes only and notification results avoid claiming OS delivery", () => {
  const source = readFileSync("src/domain/foundation.ts", "utf8");
  assert.ok(source.includes("return { code, at }"));
  const adapter = readFileSync("src/infrastructure/browser.ts", "utf8");
  assert.ok(/return ["']api_accepted["']/.test(adapter));
  assert.ok(!/return ["']shown["']/.test(adapter));
});
test("built extension pages and bundles contain no remote script tags or dynamic execution", () => {
  for (const target of ["firefox", "chrome"]) {
    const dir = `.output/${target}-mv3`;
    const files = readdirSync(dir, { recursive: true }).filter((file) =>
      /\.(js|html|css)$/.test(file),
    );
    assert.ok(
      files.length > 0,
      "Build missing; no security pass on empty artifacts",
    );
    for (const file of files) {
      const source = readFileSync(`${dir}/${file}`, "utf8");
      for (const pattern of [
        /\beval\s*\(/,
        /new\s+Function\s*\(/,
        /<script[^>]+src=["']https?:/i,
      ])
        assert.ok(!pattern.test(source), `${target}/${file}: ${pattern}`);
    }
  }
});
test("plugin sources do not execute imported code", () => {
  const files = [
    "src/domain/plugins/manifest.ts",
    "src/domain/plugins/blocks.ts",
    "src/infrastructure/zip-archive.ts",
    "src/app/plugin-blocks.tsx",
    "src/application/plugins.ts",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("@zip.js/zip.js/index.js"), false, file);
    assert.equal(source.includes("zip-core-wasm"), false, file);
    assert.equal(source.includes("dangerouslySetInnerHTML"), false, file);
    for (const pattern of [/\beval\s*\(/, /new\s+Function\s*\(/])
      assert.equal(pattern.test(source), false, file);
  }
  assert.match(
    readFileSync("src/infrastructure/zip-archive.ts", "utf8"),
    /index-native\.js/,
  );
  assert.match(
    readFileSync("src/infrastructure/zip-archive.ts", "utf8"),
    /useWebWorkers:\s*false/,
  );
  assert.doesNotMatch(
    readFileSync("src/infrastructure/zip-archive.ts", "utf8"),
    /registerCodec|codecURI|useWebWorkers:\s*true/,
  );
});
test("untrusted plugin fields cannot name the zip.js codec import", () => {
  const roots = ["src", "entrypoints"];
  const offenders = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        const source = readFileSync(path, "utf8");
        if (/registerCodec|codecURI/.test(source)) offenders.push(path);
      }
    }
  }
  for (const root of roots) walk(root);
  assert.deepEqual(offenders, []);
  const library = readFileSync(
    "node_modules/@zip.js/zip.js/lib/core/codec-registry.js",
    "utf8",
  );
  assert.match(
    library,
    /await import\(\/\* webpackIgnore: true \*\/ \/\* @vite-ignore \*\/ codecURI\)/,
  );
  assert.match(library, /if \(!codecStreams\.has\(format\) && codecURI\)/);
  const tokens = readdirSync(".output/firefox-mv3/chunks").find((name) =>
    name.startsWith("tokens-"),
  );
  assert.ok(tokens);
  const bundle = readFileSync(
    join(".output/firefox-mv3/chunks", tokens),
    "utf8",
  );
  const imports = bundle.match(/import\s*\(/g) ?? [];
  assert.equal(imports.length, 1);
  const at = bundle.indexOf("await import(e)");
  assert.ok(at > 0);
  const around = bundle.slice(Math.max(0, at - 80), at + 40);
  assert.match(around, /&&e&&/);
  assert.match(bundle.slice(at, at + 180), /Invalid uncompressed size/);
  const manifest = JSON.parse(
    readFileSync(".output/firefox-mv3/manifest.json", "utf8"),
  );
  assert.equal(
    manifest.content_security_policy.extension_pages,
    "script-src 'self'; object-src 'none'",
  );
});
test("application lint blocks JSX, object and computed raw HTML sinks", async () => {
  const { ESLint } = await import("eslint");
  const lint = new ESLint();
  for (const code of [
    "const data = {}; const x = <div {...data}/>; void x;",
    'const x = <div dangerouslySetInnerHTML={{__html: "untrusted"}}/>; void x;',
    'const x = {dangerouslySetInnerHTML: {__html: "untrusted"}}; void x;',
    'document.body["innerHTML"] = "untrusted";',
    'document.body.insertAdjacentHTML("beforeend", "untrusted");',
  ]) {
    const [result] = await lint.lintText(code, {
      filePath: "src/app/raw-html-boundary.tsx",
    });
    assert.ok(
      result.messages.some((m) => m.ruleId === "no-restricted-syntax"),
      code,
    );
  }
});
