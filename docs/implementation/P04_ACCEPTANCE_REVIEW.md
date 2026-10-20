# P04 focused acceptance review

This review does not accept P04. It does not start P05, does not mark P00 passed, and does not accept the node-forge toolchain risk. No production source was changed, so the local archive hashes in `P04_REPORT.md` are unchanged and remain local evidence.

## Decision

| Decision | Result |
| --- | --- |
| Mark P04 accepted | **NO-GO.** Owner decision is still separate. |
| Start P05 | **NO-GO.** |
| Treat P00 as passed | **NO-GO.** |
| Accept node-forge | **NO-GO.** |
| Firefox plugin click-path | **PASS** on a disposable offline profile. |
| zip.js dynamic-import reachability | **PASS** as a documented third-party warning. The library was not patched. |
| New Tab performance | **Measured.** Heading time increased. No bundle split was made. |

## Firefox plugin click-path

Command: `node scripts/p04-firefox-acceptance.mjs`  
Exit: **0**, including `driver.quit()`.  
Evidence: `evidence/P04/p04-firefox.json` (gitignored).  
Profile: disposable. Network: offline. Build: `.output/firefox-mv3`. Fault build: `.output-p04-fault/firefox-mv3`.

| Step | Result |
| --- | --- |
| Open Plugins from New Tab | PASS. 61 ms from the click to the Builder heading. |
| Build and save a counter | PASS. |
| Widget value persists after reload | PASS. The counter read `1` after reload. |
| Export | PASS. One `.zplugin` download. |
| Import that file through the file input | PASS. Preview in 206 ms, then Install. The installed copy had been removed with Keep plugin data so the same package id could be imported. |
| Hostile file through the same input | PASS. Visible text: “The archive structure is not valid. Nothing was changed.” Package rows and instance rows were unchanged. The file name was `hostile.zplugin`. |
| Safe Mode | PASS. Imported plugin hidden. Instance row remained. |
| Re-enable one package | PASS. The counter button returned. |
| Fault build | PASS. Heading stayed `Venus`. Visible text included “This widget failed”. Instance row count stayed 1. |
| `driver.quit()` | PASS. |

The handmade traversal ZIP was rejected in Firefox as an invalid archive structure. The unit catalogue still rejects a traversal name as a disallowed path. Both outcomes leave plugin rows unchanged.

## zip.js dynamic import

`web-ext lint` still warns on `await import(e)` in the tokens chunk. zip.js 2.23.0 was not modified.

| Check | Evidence |
| --- | --- |
| Venus calls `registerCodec` | No match in `src/` or `entrypoints/`. |
| Manifest, block, or ZIP entry can supply `codecURI` | Schema rejects a manifest or block `codecURI`. A ZIP entry named `codec.js` is rejected. |
| Workers and WASM | `zip-archive.ts` sets `useWebWorkers: false` and `useCompressionStream: false` and imports `index-native.js`. |
| Untrusted input reaches `import(e)` | The only `import(` in the Firefox tokens chunk is guarded by a truthy codec argument, next to the library string “Invalid uncompressed size”. Venus never passes a codec URI. |
| Attribution | The same call exists in unmodified `node_modules/@zip.js/zip.js/lib/core/codec-registry.js` as `import(codecURI)` inside `ensureCodecStreams`, and only when `codecURI` is set. |
| CSP | `script-src 'self'; object-src 'none'`. |

Command: `node --test tests/security.test.mjs` exit 0. `npx vitest run tests/unit/plugins.test.ts` exit 0.

## New Tab timing

Chromium command: `node scripts/p04-heading-timing.mjs` exit 0.  
Method matches the P01 heading timer: start at `page.goto` or reload after the browser process is running, stop when the Venus heading is visible. p90 uses nearest rank `ceil(0.9*n)`.

| Sample | P01 recorded | P04 Chromium |
| --- | --- | --- |
| Cold ms | 71, 67, 71, 71, 64 | 116, 113, 124, 114, 112 |
| Cold p90 | 71 ms | 124 ms |
| Warm ms | 45, 42, 38, 36, 33 | 70, 49, 50, 45, 47 |
| Warm p90 | 45 ms | 70 ms |
| Browser | Chromium 153.0.8010.52 | HeadlessChrome/153.0.0.0 at `/usr/bin/chromium` |

Firefox, same process already running, timer from `BrowserCommands.openTab` or reload until `h1`:

| Sample | ms |
| --- | --- |
| Cold navigations | 237, 234, 265 |
| Fresh additional tabs | 220, 219, 218 |
| Warm reloads | 59, 54, 63, 62, 55 |

Plugins first open was 48 ms in Chromium and 61 ms in Firefox. ZIP preview was 206 ms. Both browsers reported 0 long tasks on the ordinary New Tab. Chromium `usedJSHeapSize` was 6,940,230 bytes. Firefox `performance.memory` was unavailable.

`performance.getEntriesByType("resource")` did not list the tokens chunk in either browser. That API result is not the load graph. Built `newtab.html` modulepreloads `chunks/tokens-DJR8oiAm.js` (899.14 kB), and the newtab chunk imports it. ZIP code is therefore on the ordinary New Tab load. No code split was made: absolute heading time stayed under 130 ms in Chromium and under 270 ms for a Firefox new-tab command, and a split would change the production bundle. The increase from the P01 Chromium p90 (71 ms cold, 45 ms warm) is real and is left for the owner. No size cap was invented.

## Still open

- P04 owner acceptance
- P05
- P00, including regular-install Home, native permission lifecycle, and OS notification display
- ADR-001 and ADR-002
- node-forge CVE-2026-85393 / GHSA-86w9-cpqp-85rv through development tooling
- Whether the measured heading increase should be reduced by a later split of the ZIP code
