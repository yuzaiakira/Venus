# P04 implementation report

Date: 2026-10-12.

Status: **implemented and verified, not accepted.** P00 remains **NOT PASS**. P01, P02, and P03 remain **conditionally accepted**. ADR-004, ADR-008, and ADR-010 are unchanged. ADR-001 and ADR-002 remain unsigned. ADR-011 records only the ZIP reader decision below. The node-forge residual risk remains open and is not accepted. This report does not start P05, does not upload or sign an add-on, and does not commit or push.

## 1. T04.01–T04.07

| Task | Status |
| --- | --- |
| T04.01 ZDPS v1 runtime validation | Implemented. Unknown fields, capabilities, URLs, versions, duplicate ids, and prototype keys are rejected. The contract maximum of 10 blocks is unchanged. |
| T04.02 Seven host blocks | Implemented as typed host renderers and forms. The calculator uses only add, subtract, multiply, and divide. The countdown reads the host clock and creates no reminder, alarm, or notification row. |
| T04.03 Capability host | Implemented. The only capabilities are `clock.read`, `selfStorage.readWrite`, and `safeNavigation.open`. |
| T04.04 Builder | Implemented in the dashboard Plugins view, in English and Persian, with fixed templates, block fields, live preview through the production renderer, validation text, profile placement, and ZIP export. |
| T04.05 Manager | Implemented. File-picker import, preview, atomic install, enable, disable, version-aware update, export without live instance data, and uninstall with keep or delete. |
| T04.06 Recovery | Implemented. Per-widget error boundary, crash count, quarantine at 3 crashes, Safe Mode for imported instances, and one-package re-enable. |
| T04.07 Hostile suite | Implemented in `tests/unit/plugins.test.ts` and exercised in the disposable Chromium session. |

## 2. ZIP library ADR and audit

ADR-011 is `docs/implementation/ADR-011-zip-reader.md`. The owner authorized `@zip.js/zip.js@2.23.0` subject to the pre-install gate. The gate passed before the package was installed:

- Lockfile pin `2.23.0`, integrity `sha512-K5obAqfrO7zhycnCupM9aaoZ9kx0SA0kv7+Z2oOUsdpWquv4s/Z4zyD7AdTqxrK3pgPM+ozaUi8kdRQbCWaIrQ==`, no runtime dependencies.
- Tarball SHA-256 `f19393bfefb5a232635ec48bc3650b846af49f30eb2f139bde540d1ce79b06cb`.
- Production `npm audit --omit=dev` after the pin: 0 vulnerabilities, exit 0.
- Full-tree `npm audit` after the pin: the same 4 high findings as before the pin (`node-forge` via `@devicefarmer/adbkit`, `web-ext`, and `wxt`). No new advisory was added.
- License is BSD-3-Clause. `licenses/zip.js/LICENSE` matches `node_modules/@zip.js/zip.js/LICENSE`. SHA-256 `1b7ebc8d7889ed25491484ab2b102370742ca6c0b26650a0c62cc2269b579b84`.
- Production imports `@zip.js/zip.js/index-native.js` only, with `useWebWorkers: false` and `useCompressionStream: false` so decompression stays on the package’s JavaScript zlib. `wasm-unsafe-eval`, `unsafe-eval`, remote workers, and remote scripts were not added.
- The reader uses strict filename checks, CRC-32 checks, signature checks, and overlapping-entry checks. Declared uncompressed size is rejected before decompression when it exceeds 2 MiB. The writer is read back by the same validator.

After the production build, `web-ext lint` reported one new warning: an unsafe dynamic `import()` in the bundled codec registry (`await import(e)` inside the tokens chunk). Venus does not pass a codec URI, and the call is gated on that argument. The warning is still present in the artifact. It is recorded below and is not treated as a clean lint result.

## 3. Approved quotas

Enforced on create, update, install, and import. A violation throws before the write, or inside a Dexie transaction that rolls back. Existing rows are not deleted to make room. Messages are stored in English and Persian.

| Limit | Value |
| --- | --- |
| JSON per instance | 64 KiB UTF-8 |
| Raster images per package | 1 MiB |
| Instances per profile | 20 |
| Installed packages | 50 |
| Stored plugin images | 5 MiB |
| ZIP compressed input | 2 MiB |
| ZIP uncompressed total | 2 MiB |
| ZIP entries | 32 |
| `manifest.json` | 64 KiB |
| Blocks per package | 10, from the ZDPS schema |
| Compression ratio | 100:1 |

`tests/unit/plugins.test.ts` covers a rejected oversized JSON write that leaves the stored value unchanged, and a rejected archive that leaves the package table unchanged.

## 4. Seven-block coverage

Host renderers exist for `text-image`, `countdown`, `counter`, `checklist`, `quick-links`, `calculator`, and `progress`. Templates for all seven validate. Text is rendered as text. A markup string in a text block is escaped by React (`&lt;img` in static markup). Calculator division by zero returns an explicit error state. Countdown remaining time changes when the injected clock changes.

## 5. Capability isolation

The plugin platform has no notes, events, bookmarks, reminders, profiles, or other-plugin methods that succeed. `rejectForeign` throws for those store names and does not touch the Dexie tables. A write whose instance belongs to another plugin is rejected. `http` links require confirmation. `javascript:` URLs fail validation. Quick links open only URLs present on that package, through `window.open` with `noopener,noreferrer`. No new manifest permission was added.

## 6. Hostile-package results

`tests/unit/plugins.test.ts` rejected archives for traversal, an absolute path, case-insensitive duplicate names, 33 entries, the encryption flag, compression method 99, a Unix symlink attribute, `plugin.js`, `plugin.wasm`, overlapping central-directory offsets, and a 2 MiB + 1 byte input. It also rejected prototype keys, an unknown capability, a `javascript:` URL, a duplicate block id, and bytes that are not a PNG. All 6 tests in that file passed.

The disposable Chromium session rejected a traversal ZIP through the file picker and showed the bilingual failure text. The package table was not given a partial row by that import. Evidence: `evidence/P04/p04-browser.json` (`hostileRejected: true`).

## 7. Safe Mode and quarantine

Safe Mode sets a host preference and hides imported instances. It does not delete `pluginInstanceData`. Re-enable adds one package id to the exception list per action. Three recorded crashes quarantine the package, clear its enabled flag, and leave the instance row in place.

Chromium evidence: one instance row remained after Safe Mode (`instanceRows: 1`). A separate fault build, `.output-p04-fault/chrome-mv3`, with `VITE_VENUS_PLUGIN_FAULT=1`, threw inside the plugin renderer. The Venus heading stayed visible, the widget error boundary rendered, and the instance row remained (`faultInstanceRows: 1`). The production Firefox and Chrome bundles do not contain the string `plugin fault`.

## 8. Dexie version 5

Database name remains `Venus-p00`. Version 5 repeats every version 4 store and adds `pluginPackages` (`id, enabled, installedAt`) and `pluginInstanceData` (`id, pluginId, instanceId, updatedAt`).

`tests/integration/migration.test.ts` upgraded version 1 and version 2 fixtures, and a version 4 fixture with a probe, note, event, and timer. `tests/integration/calendar-schedule.test.ts` upgraded a version 3 database and kept the note. Current schema version observed by those tests is 5. No reset or delete migration was added.

## 9. Browser acceptance

Disposable Chromium, offline, not a personal profile (`scripts/p04-browser-acceptance.mjs`, final exit 0):

- Built a counter, saved it, saw it on the dashboard, and exported `local.counter.zplugin`.
- Switched the document to Persian `rtl`.
- Rejected a hostile file.
- Turned on Safe Mode and kept the instance row.
- Confirmed manifest permissions `storage` and `alarms`, and CSP `script-src 'self'; object-src 'none'`.
- On the fault build, a crashing plugin left the Venus heading up and left instance data in place.

Screenshot: `evidence/P04/p04-plugins-fa.png`.

Firefox New Tab smoke and Firefox identity smoke passed on the final Firefox build. Those smokes do not click through the plugin builder. A Firefox click-path for builder, import, and Safe Mode was not run. That limit is open.

An earlier Chromium run failed because a successful save cleared its own status message. That bug was fixed and the session above was rerun against the rebuilt extension. The failed session is not counted as acceptance.

## 10. Packages, licenses, and hashes

`@zip.js/zip.js@2.23.0`, BSD-3-Clause, bundled through `index-native.js`. License SHA-256 `1b7ebc8d7889ed25491484ab2b102370742ca6c0b26650a0c62cc2269b579b84`.

Final local archives, each produced twice with the same hash:

| Archive | SHA-256 |
| --- | --- |
| `venus-beta-0.0.1-source.zip` | `6f9bfa04a5f5f24dcff13a8c4522dccf7d5b3571862701020098a615cc9cddf2` |
| `venus-beta-0.0.1-unsigned.zip` | `8469834c4cb44d775d4f1264b7e06354873de63b8b15d535b631bf2ea65ba72f` |
| `venus-release-0.0.1-source.zip` | `0ea62378e6d9bfb3f1706b4080e14a2a58a6fe2195986daec02045ddec4de138` |
| `venus-release-0.0.1-unsigned.zip` | `21c7bd0cab2ab59bba3e011202f03ff31f8e86b9d5873f0f204b1b20d96ed7f7` |

These archives were not uploaded or signed.

Production bundle sizes on the final Firefox build: `background.js` 534.06 kB, `newtab` chunk 72.49 kB, `tokens` chunk 899.14 kB. The P03 tokens chunk was 690.99 kB. ADR-004 libraries were not replaced. The increase includes the ZIP reader and the plugin UI that Vite placed in the shared chunk.

## 11. Outstanding P00, P01, P02, and P03 obligations

Unchanged by this work:

- P00 is not PASS. Home consent, closed-browser notification proof, and the node-forge finding stay open.
- P01 and P02 stay conditionally accepted.
- P03 stays conditionally accepted. Firefox reminder restart, real notification grant and revocation, OS notification display, occurrence click behavior, and the Temporal chunk size stay open.
- `web-ext lint` still warns about Firefox for Android `strict_min_version` and two dynamic `innerHTML` assignments. P04 adds a fourth warning for dynamic `import()`.
- ADR-001 and ADR-002 stay unsigned.

## 12. Regression command exits

Final commands, after the save-status fix and rebuild. The command log is `evidence/P04/commands.log`. Earlier sandbox and pre-fix runs are in that log and are not the results below.

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run format:check` | 0 |
| `npm run unit` | 0 (46 tests) |
| `npm run test:integration` | 0 (27 tests) |
| `npm run test:security` | 0 |
| `npm run test:packaging` | 0 |
| `npm run build:firefox` | 0 |
| `npm run build:chrome` | 0 |
| `npm run build:firefox:beta` | 0 |
| `npm run build:firefox:release` | 0 |
| `VENUS_PLUGIN_FAULT_OUT=1 VITE_VENUS_PLUGIN_FAULT=1 npm run build:chrome` | 0 |
| `npm run inspect:manifests` | 0 |
| `npm run inspect:channels` | 0 |
| `npm run test:smoke:firefox` | 0 |
| `npm run test:smoke:identity` | 0 |
| `npm run test:smoke:chrome` | 0 |
| `npx web-ext lint --source-dir .output/firefox-mv3 --output text` | 0, with 4 warnings and 0 errors |
| `node scripts/p04-browser-acceptance.mjs` | 0 |
| `npm audit --omit=dev` | 0 |
| `npm audit` | 1, pre-existing node-forge chain only |
| `npm run package:firefox:beta` | 0, hash stable on a second run |
| `VENUS_FIREFOX_CHANNEL=release node scripts/package-firefox-candidate.mjs` | 0, hash stable on a second run |

One `npm run test:smoke:firefox` inside the command sandbox exited 1 because WebDriver could not be reached. The same command outside the sandbox exited 0. The sandbox failure is not a Firefox product failure.

`npm audit` exit 1 is the open node-forge finding. It was not fixed and is not accepted.

## 13. Recommendation

**NO-GO** to mark P04 accepted.

The focused acceptance review after this report is recorded in `docs/implementation/P04_ACCEPTANCE_REVIEW.md`. That review ran the Firefox plugin click-path, the zip.js reachability checks, and the New Tab timing comparison. It does not accept P04, P00, node-forge, or a P05 start. The owner still makes the acceptance decision.
