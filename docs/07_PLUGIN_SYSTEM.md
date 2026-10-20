# 07 — ZDPS v1 Safe Declarative Plugin Specification

## 7.1 Objective and trust boundary

Users can build and share useful dashboard widgets, but **imported packages are untrusted data, never executable code**. All actual behaviors exist in reviewed host code. The specification name **ZDPS v1 — Venus Declarative Plugin Specification** is internal/product-specific, not an industry standard. No online store or plugin server in MVP.

## 7.2 Package format

Suggested `.zplugin` extension containing bounded ZIP with `manifest.json`, optional sanitized local assets (`assets/*.png|jpg|webp|svg` only if secure sanitizer can be proven; simplest: deny SVG), `data/defaults.json`. All paths relative, no `../`, symlinks, absolute paths or duplicate case-insensitive paths. MIME sniff and compressed/uncompressed limits enforced. Use `contracts/plugin-manifest.schema.json` as normative base plus Zod runtime validators.

**Manifest required:** `specVersion:1`, `id` reverse-DNS style, `version` semver, localizable `name`/`description`, `type:'declarative-widget'`, `minHostVersion`, `blocks[]`, `requestedCapabilities[]`, optional asset references and recommended size. No entrypoint script; `entry` is static data schema. The manifest schema must reject unknown fields except explicit vendor metadata field with bounded JSON.

## 7.3 Seven supported block types

| ID | Fields | Allowed operation / limits |
|---|---|---|
| `text-image` | localized title, safe text, optional local raster asset | text display only; no raw HTML or remote images in MVP |
| `countdown` | label, target ISO time or calendar date, display format | read clock, deterministic remaining, does NOT schedule OS notifications via plugin |
| `counter` | label, current, min/max/step | increment/decrement within bounds, host persists |
| `checklist` | label, <=50 localized items | toggle status; no arbitrary actions |
| `quick-links` | <=25 links (HTTPS/HTTP with user confirmation as needed) | open safe external URL in new tab, no javascript/data/file URLs |
| `calculator` | two finite decimal operands, operation `+ - * /` | finite result, explicit division by zero; no expression evaluator |
| `progress` | label, current, goal, unit | clamp to valid numeric range, render accessible progress |

Note: calculator **must not** parse/evaluate freeform equations. Builder fields configure one bounded operation only. Multiple blocks per package allowed within strict limits and without dataflow/conditional execution graph.

## 7.4 Capabilities and per-instance data

`requestedCapabilities` defaults to `[]`, allowed host APIs: `clock.read` for countdown, `selfStorage.readWrite` for counter/checklist/progress, `safeNavigation.open` for link list. These are internal host operations, not direct browser or network permissions; user sees manifest requested capabilities during import. No access to arbitrary `browser.*`, notes, bookmarks, events, clipboard, files, pages, cookies or remote network.

Storage namespace `plugin:<pluginId>:<instanceId>` with schema-checked data. Hard limits proposed: max 64 KB JSON per instance, 1 MB per package local raster assets, 20 instances per profile, 50 installed packages, 10 blocks/package, 5 MB total plugin assets; exact caps confirmed by performance tests and documented before beta. Capped render frequency; quarantine packages causing repeated runtime errors. Preview never executes plugin logic outside fixed host renderers.

## 7.5 Builder user flow

Start with template -> name/description/two locales -> select block -> configure valid fields and preview -> set approximate size/theme behavior -> validate and save -> install/use -> export `.zplugin`. Package must roundtrip import/export byte-safe or canonical normalized form. Defaults and example data may be exported; sensitive live plugin data exported separately in user-requested profile backup, not automatically shared by 'Share plugin' (privacy-critical).

## 7.6 Import/install transaction

Open file -> ZIP bounded reader -> verify CRC/hash, paths, mime, decoded quotas -> validate JSON syntax/schemas/id/version/duplicates/capability allowlist/host version -> preview read-only -> user confirms -> persist package -> add optional widget to profile. If same ID: compare version and warn update/replace; incompatible schema/update rollbacks. On failure, no partial installation; store original package only after validation.

## 7.7 No-code policy enforcement

Blacklist executable fields and suspicious formats, but rely on strict allowlists, not blacklists alone. No `eval`, `Function`, script URLs, dynamic JavaScript modules from file, remote `<script>`, arbitrary DOM HTML injection, user CSS, expression parsers, WebAssembly or formula engines. Imported data is rendered via React text nodes or safe asset URLs created internally. CSP restrictive. Remote marketplace beyond MVP subject to store legal/policy re-evaluation.

## 7.8 Plugin management & safe mode

Manager: name/ID/version/description/capabilities/data usage/enabled state, configure, duplicate own package, update/import new version, export, uninstall keep/delete data, reset broken plugin. **Safe Mode:** query/route control or Settings action disables all imported instances for this session and persists an explicit reset action, while leaving data unchanged; user can reenable selectively. If plugin renderer crashes, error boundary isolates from dashboard, count crashes and quarantine it.

## 7.9 Plugin acceptance & adversarial tests

- PLG-01 valid seven template packages install, edit, export, reinstall and restore state.
- PLG-02 reject scripts, event handler attributes, `<script>` markup, `javascript:` links, CSS payload, WASM.
- PLG-03 reject zip slip `../`, absolute paths, symlinks, ZIP bomb, duplicate file names, too many entries and oversized images.
- PLG-04 reject manifest unknown capability, invalid semver/ID, unsupported host, unknown block type.
- PLG-05 imported package cannot read/change note or native bookmark records; inspect host API and test storage boundaries.
- PLG-06 package sharing excludes user's *live* private widget data unless explicitly selected in a **profile backup**.
- PLG-07 faulty plugin renderer recovers via Safe Mode, no entire dashboard crash.
- PLG-08 no external networking or code loading when installed and used offline.

## 7.10 Reference contract

`contracts/plugin-manifest.schema.json` and `contracts/plugin-example.json`. Schema `additionalProperties: false` and finite constraints in runtime validator are mandatory. Example intentionally exercises more than one safe block.
