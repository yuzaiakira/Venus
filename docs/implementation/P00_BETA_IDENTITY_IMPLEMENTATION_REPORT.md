# P00 beta identity implementation report

Status: **LOCAL IMPLEMENTATION/PACKAGING VERIFIED; P00 OPEN; F01 NOT VERIFIED.** Owner authorized local channel architecture, icon correction, metadata, application HTML prevention and verification. No Mozilla upload, signing, publication, credentials, commit/push, P01 work, ADR acceptance or security-exception approval occurred.

## Changes and task scope

- `wxt.config.ts`: explicit `VENUS_FIREFOX_CHANNEL` mapping and isolated Firefox output roots; approved permanent UUID for beta/release; fixed P00 ID preserved; truthful technical-preview metadata. WXT 0.21.4 uses a `config:resolved` hook for browser-specific output roots. Beta/release require production build command and MV3. Unset selector defaults to P00 for legacy commands; empty/unknown selectors fail for Firefox. Packaging requires explicit beta/release and has no default. Chrome always retains its existing target metadata/output independent of the Firefox selector.
- `package.json`: added beta/release build, channel inspection, beta packaging, packaging tests and identity smoke commands. All existing scripts retained. No dependency or lockfile changes.
- `public/icons/icon-48.png`: genuine 48×48 derivative made with `magick public/icons/icon.png -resize 48x48 public/icons/icon-48.png`; existing 96×96 `icon.png` retained, including notification icon reference.
- `eslint.config.js`: ignore generated candidate directories; prohibit application JSX raw-HTML attributes, raw-HTML props/sinks (including computed literal names), and JSX props spreads. No vendor changes or lint/security warning suppression.
- `scripts/firefox-package.mjs`: identity/channel/manifest/CSP/permission/icon/page dependency validation, artifact allowlist, development-code rejection, numeric package-version path guard, symlink/private-key rejection and hashed inventories.
- `scripts/inspect-channels.mjs`: exact P00/beta/release identities and Chrome separation assertions; manifest comparison evidence.
- `scripts/package-firefox-candidate.mjs`: local unsigned extension ZIP and separate allowlisted source ZIP, sorted paths/fixed ZIP metadata, reviewer instructions, inventories/checksums. No upload/signing capability.
- `scripts/reproduce-firefox-candidate.mjs`: extract actual source ZIP into its own temporary directory, locked offline install from local cache, prepare/build/package, compare every build file and both ZIP hashes, remove only its own temporary directory.
- `scripts/verify-beta-local.mjs`: commands, environments, exits/logs, intentional rejection checks and Chrome byte-equivalence assertion.
- `scripts/smoke-firefox.mjs`: opt-in identity verification hook, preserving default P00 smoke behavior.
- `scripts/smoke-firefox-identity.mjs`, `scripts/verify-firefox-identity.mjs`: temporary add-on installation in disposable Selenium profile; P00/beta `storage.local` and IndexedDB isolation, retained P00 synthetic data, hostile JSON text regression.
- `tests/packaging.test.mjs`: valid identities plus wrong ID/channel, missing channel/manifest, incorrect icon, development code, unexpected `.env`, missing chunk and unsafe version rejection.
- `tests/security.test.mjs`: application raw-HTML lint regression; existing checks retained.
- `.gitignore`: isolated candidate outputs ignored.
- Implementation documents: this report, follow-up records in the manual verification log and signing prerequisites. Existing owner observations/history remain intact. New evidence under `evidence/P00/beta-identity`; failed/intermediate runs retained separately.

No application/database/plugin identifiers or schemas changed. `Venus-p00`, schema version 1, P00 ID and the approved UUID are preserved exactly. ADR-001/002 remain proposed and untouched. This work adds scoped evidence for **T00.02/T00.03/T00.06**, not completion of those mandatory tasks or phase acceptance.

## Manifest comparison

Exact full manifests: `evidence/P00/beta-identity/channel-manifests.json`.

| Field | P00 Firefox | Beta Firefox | Release Firefox | Chrome |
|---|---|---|---|---|
| ID | `p00@Venus.invalid` | `{935006c2-63b4-4e03-b842-11b88571da3b}` | Same approved UUID | No Gecko identity |
| Output | `.output/firefox-mv3` | `.output-beta/firefox-mv3` | `.output-release/firefox-mv3` | `.output/chrome-mv3` |
| Name | Venus Workspace — P00 | Venus Workspace — Beta Technical Preview | Venus Workspace — Release Technical Preview | Existing P00 name |
| Description | Existing feasibility description | Local-only P00 Home/New Tab shell and storage/alarm/permission probes; explicitly no full workspace features | Same technical-preview description | Existing description |
| Version | `0.0.1` | `0.0.1` | `0.0.1`, local build only; not an upgrade | `0.0.1` |
| Manifest | MV3 | MV3 | MV3 | MV3 |
| Minimum | `140.0`, provisional | Same provisional minimum | Same | No Firefox minimum |
| Background | `background.scripts` | Same | Same | `background.service_worker` |
| Home | Bundled `newtab.html` | Same | Same | No Home override |
| New Tab | Bundled `newtab.html` | Same | Same | Same |
| Gecko data declaration | `required: ["none"]` | Same | Same | Absent |
| Android declaration / update URL | Both absent | Both absent | Both absent | Not applicable |
| Icons | True 48px/96px files | Same | Same | Same corrected asset mapping |

All targets retain required `storage`/`alarms`, optional `bookmarks`/`notifications`, no host permissions/content scripts, local options page, and `script-src 'self'; object-src 'none'`. Shared executable application bytes remain unchanged by channel selection. The final runner compared every Chrome output file/hash before and after building Chrome with `VENUS_FIREFOX_CHANNEL=beta`: **byte-identical**. Only the approved shared icon correction changes historical Chrome output.

## Local commands and results

Parent: `node scripts/verify-beta-local.mjs`, final exit **0**. Subprocess verification ran outside the filesystem sandbox after sandbox EPERM prevented launches. Base environment in `local-results.json`: v24.19.0, linux; reviewer source README records npm/WXT/Python/architecture. Source ZIP commands are the explicit beta commands, not a default build.

| Exact command | Extra environment (parent sets P00 selector/evidence directory) | Exit | Result | Log |
|---|---|---:|---|---|
| `npm run typecheck` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-01.log` |
| `npm run lint` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-02.log` |
| `npm run format:check` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-03.log` |
| `npm run unit` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-04.log` |
| `npm run test:integration` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-05.log` |
| `npm run build:firefox` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-06.log` |
| `npm run build:chrome` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-07.log` |
| `npm run build:firefox:beta` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-08.log` |
| `npm run build:firefox:release` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-09.log` |
| `npm run inspect:manifests` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-10.log` |
| `npm run inspect:channels` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-11.log` |
| `npm run test:security` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-12.log` |
| `npm run test:packaging` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-13.log` |
| `npm run package:firefox:beta` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-14.log` |
| `node scripts/reproduce-firefox-candidate.mjs` | `{"VENUS_FIREFOX_CHANNEL": "beta"}` | 0 | PASS | `evidence/P00/beta-identity/check-15.log` |
| `node node_modules/wxt/dist/cli/index.mjs build -b firefox --mv3` | `{"VENUS_FIREFOX_CHANNEL": "typo"}` | 1 | PASS — expected rejection | `evidence/P00/beta-identity/check-16.log` |
| `node scripts/package-firefox-candidate.mjs` | `{"VENUS_FIREFOX_CHANNEL": ""}` | 1 | PASS — expected rejection | `evidence/P00/beta-identity/check-17.log` |
| `node scripts/package-firefox-candidate.mjs` | `{"VENUS_FIREFOX_CHANNEL": "p00"}` | 1 | PASS — expected rejection | `evidence/P00/beta-identity/check-18.log` |
| `node node_modules/wxt/dist/cli/index.mjs build -b chrome --mv3` | `{"VENUS_FIREFOX_CHANNEL": "beta"}` | 0 | PASS | `evidence/P00/beta-identity/check-19.log` |
| `npm run inspect:channels` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-20.log` |
| `node node_modules/web-ext/bin/web-ext.js lint --source-dir .output-beta/firefox-mv3 --output json` | `{}` | 0 | PASS | `evidence/P00/beta-identity/check-21.log` |

Unit: **11 passed**. Integration: **10 passed**. Security: **5 passed**. Packaging test: passed all valid and rejection cases. Rejection command exits are intentionally nonzero; absence/invalidity cannot produce a candidate package. Firefox lint exit 0 is not security or AMO approval.

Actual source ZIP reproduction commands in an isolated temporary directory:

1. `npm ci --offline --ignore-scripts --cache /home/akira/Projects/git-contribute/Venus/.npm-cache`
2. `npm exec wxt prepare`
3. `npm run build:firefox:beta`
4. `node scripts/package-firefox-candidate.mjs` with `VENUS_FIREFOX_CHANNEL=beta`

Each exited 0; all ten build files and both ZIP archives reproduced **byte-for-byte**. Evidence: `reproduction.json`, `reproduce-1.log` through `reproduce-4.log`. Reviewer instructions use `npm ci --ignore-scripts` with ordinary npm access; the local cache was only an installation accelerator. Reproduction is established on this recorded local toolchain, not every OS/toolchain.

## Browser evidence and honest failures

- `P00_EVIDENCE_DIR=evidence/P00/beta-identity/browser npm run test:smoke:identity > /tmp/venus-beta-identity-browser.log 2>&1`: **exit 1** on both final assertions-complete runs due to `WebDriverError: Failed to decode response from marionette` during `driver.quit()`. This command is **FAIL**, not a fully passing smoke suite.
- Before that shutdown failure, Firefox **155.0.1** recorded PASS for actual fresh offline P00 New Tab via browser command, temporary-install Home rendering, storage/alarm API probes, and the new runtime isolation/HTML assertions. These scoped observations are retained in `browser/firefox-smoke.json` and `browser/firefox-identity.json`; prior assertions-complete run and shutdown log are under `beta-identity-third-checks/browser`. Beta page navigation was direct for storage/rendering inspection; it is not regular-install Home/New Tab consent evidence.
- Isolation test installed two temporary add-ons into a fresh disposable profile. P00 wrote only a synthetic marker/probe; beta read neither, had a distinct extension origin and the expected UUID, then wrote its own synthetic marker/probe. Revisiting P00 retained its marker/probe. Both `storage.local` and same-named IndexedDB isolation passed. No existing profile, real data, migration or deletion was involved.
- HTML regression stored an intentionally hostile-looking synthetic probe result in the disposable beta DB. Reading results displayed the exact payload as JSON text; no injected element or event-handler execution appeared. This exercises the existing app's data-to-text boundary, not a mock component. The test-only row intentionally challenges the rendering boundary; no production schema was changed.
- `P00_EVIDENCE_DIR=evidence/P00/beta-identity/browser npm run test:smoke:chrome > /tmp/venus-beta-chrome-smoke.log 2>&1`: approved retry **exit 0**, Chromium **153.0.8010.52**, offline actual New Tab and existing API probes passed, browser security sandbox enabled. Evidence/log in `beta-identity-third-checks/browser`. No branded Chrome-version certification is inferred.
- `P00_EVIDENCE_DIR=evidence/P00/beta-identity/firefox-existing npm run test:smoke:firefox > /tmp/venus-beta-existing-firefox.log 2>&1`: **exit 1**, the same Marionette decode failure during shutdown even without the identity hook. Fresh offline P00 New Tab, temporary Home and API assertions passed before failure. Evidence: `firefox-existing/firefox-smoke.json`, `firefox-existing/command-failure.log`. This establishes that the final command failure also affects the existing single-add-on smoke; it is not labeled a passing command.

Failure history: initial WXT callback configuration failed because the installed loader supplies no config-function browser argument; corrected to the supported resolved-config hook. Sandbox child launches failed EPERM, retained in `beta-identity-sandbox-attempt`. First outside-sandbox checks found an unused import and overly broad localhost detector that matched Dexie's origin-detection regex; corrected and retained in `beta-identity-first-checks`. Initial browser HTML assertion incorrectly compared a raw string with JSON-escaped text; corrected to compare the decoded value; original failure retained in `beta-identity-second-checks/browser/identity-failure.log`. Restricted browser launches failed socket/setsockopt EPERM; summary in `browser/environment-failures.json` identifies where the original Chrome temporary log was overwritten rather than inventing it. Intermediate successful runs are retained in second/third/fourth-checks directories. No failed run has been converted into a pass.

## All remaining Firefox lint warnings

Final beta lint: **0 errors, 0 notices, 3 warnings**, complete unfiltered output in `check-21.log`.

| Warning | Exact source and trust boundary | Assessment / handling |
|---|---|---|
| `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` | `manifest.json`: inherited Android minimum 140 predates data-declaration support at Android 142 | Desktop-only scope remains declared by omitting `gecko_android`. Omission is not an Android installation block for self-distributed XPI. No fake Android minimum or warning suppression added; platform scope must be explicit in reviewer notes. |
| `UNSAFE_VAR_ASSIGNMENT` | `chunks/App-Bj8s9EPH.js:49:1807`; React DOM 19.1.0 `setProp`, installed source `react-dom-client.production.js:12618` | `dangerouslySetInnerHTML.__html` → DOM `innerHTML`, with no sanitization. Currently no application caller supplies that prop. New lint guard and browser text-boundary regression address application usage; vendor sink remains visible. |
| `UNSAFE_VAR_ASSIGNMENT` | Same bundle `:49:4676`; React DOM 19.1.0 `setPropOnCustomElement`, installed source `:12832` | Same raw-HTML trust boundary for custom elements. No current app caller or untrusted props spread; same prevention. No vendor patch or security-exception approval. |

Both vendor branches could become exploitable if a future caller passes attacker-controlled HTML; React checks value shape/children conflicts, not safety. The reviewed app renders status as ordinary React text and neither page uses hydration/raw HTML. CSP adds defense but is not a substitute for the text boundary. Syntactic lint is not formal whole-program taint analysis; future rendering/import/plugin changes still require review. No remote plugin execution was introduced.

The original `ICON_SIZE_INVALID` warning is resolved: 48 maps to actual 48×48 and 96 maps to actual 96×96. React and its executable bundle hash are unchanged; no warning concealment occurred.

## Privacy declaration and compatibility risks

`required: ["none"]` is retained because inspected executable source implements only local IDB/browser settings, permission/native API probes and packaged UI/assets. No telemetry, data-upload backend, remote script, network-request primitive or remote resource is used by the current app. Native bookmark probing uses a synthetic URL without visiting it; notification icons are bundled. Diagnostic/status results are local. Browser-owned update checks are not an application data export. Static source inspection and offline rendering support this scoped declaration; comprehensive runtime traffic/privacy certification remains unverified. Any future feature/update-service change must recheck the declaration.

Minimum Firefox 140 remains provisional/runtime unverified; no ESR or Android certification. Regular-install consent, decline, browser-managed Home control, competing overrides, disable/uninstall restoration and persistence through a signed same-ID update remain **NOT VERIFIED**. WebDriver shutdown is an unresolved test/tooling failure in both the single-addon and identity commands. The previously reported node-forge development dependency risk remains open; no exception approved. License/distribution placeholders and original PRD provenance/hosted CI gates remain open per P00 reports.

## Update continuity and release strategy

The permanent UUID is shared by beta/release and never generated per build. AMO uniqueness/account ownership is still **NOT VERIFIED**. P00 retains its independent identity/data and is not migrated. Firefox's internal origin UUID is distinct from this permanent manifest UUID and must not be hard-coded.

Version `0.0.1` is the initial **local** technical-preview candidate. The release build at the same version is only an identity assertion, not a signed replacement/update. Every future signed update must use a version higher than the installed predecessor and suitable for the existing AMO add-on record; keep a single monotonic version sequence across beta/release, correct identity, signing and compatible data schemas. Matching UUID alone does not provide delivery, prove ownership or preserve data under incompatible schemas. Verify updates in disposable profiles without uninstalling the predecessor.

Initial proposed distribution is AMO **unlisted / On your own**, after separate exact-file upload approval. With no `update_url`, newer unlisted signatures alone do not deliver automatic updates; distribute owner-approved signed XPI updates manually. Mozilla documents that Firefox can check AMO for a higher listed version when no `update_url` exists. A future owner-approved public listed release using the same identity therefore needs an explicitly tested transition/version strategy. A self-hosted `update_url` would require separately authorized hosting/update-manifest/security/privacy planning; none was added. Beta/release cannot coexist as two add-ons in one profile because their IDs match.

Official references: [self-distribution/update delivery](https://extensionworkshop.com/documentation/publish/self-distribution/), [source/build submission](https://extensionworkshop.com/documentation/publish/source-code-submission/), [desktop/Android compatibility](https://extensionworkshop.com/documentation/publish/version-compatibility/), [identity](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/).

## Local packages and complete inventories

| Local path | Bytes | SHA-256 |
|---|---:|---|
| `.output-beta/packages/venus-beta-0.0.1-source.zip` | 107905 | `d48c9b37799856aede0723891bba201af187ea534dfe372fe612745dc899b6aa` |
| `.output-beta/packages/venus-beta-0.0.1-unsigned.zip` | 157901 | `7dbf5fbd6615d2262420e09ee883e3317d8fefb0693a6feff376408dc00e7850` |

Neither ZIP is signed or regularly installable in normal Firefox. The extension ZIP has exactly ten allowlisted build files, no parent directory. Source ZIP has 44 files, including generated `README_AMO_BUILD.md`, lockfile and required local build inputs/tests/tooling. It excludes Git internals, dependency cache/node_modules, `.env`, private keys, personal browser profiles, runtime data, evidence and reports. Package guards reject symlinks and unexpected artifacts; source files were inventoried and archive entries inspected. This is not a generic credential-discovery guarantee for arbitrary future source changes.

Machine-readable full inventory: `.output-beta/packages/venus-beta-0.0.1-inventory.json` and retained copy `evidence/P00/beta-identity/package-inventory.json`. ZIP metadata fixes dates/modes for reproducibility, not as an invented test timestamp.

### Extension files

| Path inside ZIP | Bytes | SHA-256 |
|---|---:|---|
| `assets/App-OzzWFVdl.css` | 304 | `041ca156a46e473086089a902827fb6004ea2b72dca239f458dc67e171202a9c` |
| `background.js` | 158674 | `ef700f2b47c415de67d20ee25639b6a5652ea237efb3b3f18e06f9f09f373a5e` |
| `chunks/App-Bj8s9EPH.js` | 353401 | `ee26309aabe73f0f5979a232356e09136d33f38656aafc1dbfc72b0d8616b89f` |
| `chunks/newtab-CQoZP86l.js` | 187 | `fadffe8e99a33e49c50f4261156420f2826e58d7560805b8298265de3ca56772` |
| `chunks/options-CQoZP86l.js` | 187 | `fadffe8e99a33e49c50f4261156420f2826e58d7560805b8298265de3ca56772` |
| `icons/icon-48.png` | 298 | `3eb720562dc0e18bb6fba550175ec9f7c0a6648d4e864e085062dcd93ff06fd9` |
| `icons/icon.png` | 253 | `732633369916ac1b7e8bfb1e786276b0916634f18692e69c5fad65a7ba7e8a2e` |
| `manifest.json` | 863 | `69b69f198a9257df2d0c03935b11a6a7b6ba11c427c0d0775ca964de8f9d944a` |
| `newtab.html` | 456 | `79ff85126771e1fd8aa2a9ee21d261a4aa921ac42e079c487a06746a5492e6f7` |
| `options.html` | 457 | `f7a0b082a5e59165a562bd8dfab13098382c623dab7c1d74f48301773e579ef6` |

### Source files

| Path inside ZIP | Bytes | SHA-256 |
|---|---:|---|
| `README_AMO_BUILD.md` | 825 | `247c52dd1d521c6c3e81a2ecff9349884f984472156c6dfa1f670e491ea8bd15` |
| `entrypoints/background.ts` | 2111 | `905fd3b9fa993240e42a5f32f8fdf0b6f3473b1bd6a2d5b778e3e15ab1fe3028` |
| `entrypoints/newtab/index.html` | 286 | `f667e00418a539936ceb29e1ec1d36470aa00ab0cd3a58fc4bac4ec7f59f5527` |
| `entrypoints/newtab/main.tsx` | 232 | `b8313e6b59ba2f5b63e24114a80811a6c9fe6cc1ed75f6717ee8f91a9d138723` |
| `entrypoints/options/index.html` | 286 | `f667e00418a539936ceb29e1ec1d36470aa00ab0cd3a58fc4bac4ec7f59f5527` |
| `entrypoints/options/main.tsx` | 232 | `b8313e6b59ba2f5b63e24114a80811a6c9fe6cc1ed75f6717ee8f91a9d138723` |
| `eslint.config.js` | 1619 | `b0e0a0bcb3597ff356ce1e9cad5f3ff5c397805fa6eff681f3c2b49c331ea028` |
| `package-lock.json` | 280394 | `841627e0f4348eae53796b17e376d3268a7a637d26bb62e6148b5d26e4421ec4` |
| `package.json` | 2264 | `82dce31ec0bea15248704bb259c1d4af424cc93ef6f23c4c373a0d4c9eb4f90b` |
| `public/icons/icon-48.png` | 298 | `3eb720562dc0e18bb6fba550175ec9f7c0a6648d4e864e085062dcd93ff06fd9` |
| `public/icons/icon.png` | 253 | `732633369916ac1b7e8bfb1e786276b0916634f18692e69c5fad65a7ba7e8a2e` |
| `scripts/browser-probes.mjs` | 2093 | `6c96096acf76ab080dba079e38c6cee27bb6af0f9739aaf4e43ecfe643b931d3` |
| `scripts/chrome-lifecycle.mjs` | 5627 | `72e4162fe95dcb30fa6dbe30d583a00d7f14fe87421fd020f813ef928c65503b` |
| `scripts/firefox-package.mjs` | 4548 | `de4155a6143ddbf8f62bc04aeb7c24da18e5e7605cfde5e95aad6fee50527d96` |
| `scripts/inspect-channels.mjs` | 1140 | `5e63f3e2fb8ce2a7579d3bceb9024885b95704d24bc9953765ac87fde6ef8f72` |
| `scripts/inspect-manifests.mjs` | 2108 | `d9a1fece56b651e69350552eb3b6a39f5ae2e6f870fa1a69a971be05a5f77af7` |
| `scripts/package-firefox-candidate.mjs` | 3812 | `dc4d4e75cdc266a26b663ab4b103876b07099eb89a8d2cf7cd93c08216b35772` |
| `scripts/reconcile-prd.mjs` | 2685 | `f57cfb35e768c49844232bb7a61bed0af6e7bb856b6ee5de34d62b86cee6954a` |
| `scripts/reproduce-firefox-candidate.mjs` | 2782 | `973973ea001ed9160d88bdceb62b9e82f6c7333fb7f90f35e41e0b13c8c51545` |
| `scripts/reproduce-install.mjs` | 2194 | `b45fa6364f923dbcaaf5beec76cb63d315020b01a4bad8d30cf81368e3c93862` |
| `scripts/setup-browsers.mjs` | 2270 | `d915859d90e57a5f5448b6b3e77e36525851d1c535d0e2dd9b4726707ea26e9e` |
| `scripts/smoke-chrome.mjs` | 2851 | `6a978520782553c27c248475feb72648cce4857c755486240e5a9aabbc8f8086` |
| `scripts/smoke-firefox-identity.mjs` | 75 | `fa72296c31eb19c51d8113136f8fdbbf133386168f2b640790efdff02a939553` |
| `scripts/smoke-firefox.mjs` | 7011 | `7ed7f963d6ee4f22895a632aafbfd649940d61dc5d1b132b90f77f62d3404920` |
| `scripts/verify-beta-local.mjs` | 3096 | `59c5fff44a1737abe1bb90fd44d5e5afcea837bb1c3ff96f640af3820177a8f3` |
| `scripts/verify-firefox-identity.mjs` | 4288 | `f9b96ea911d3ac5cd95539fb06eaf18a5028e106e9a5a974bec613e1003e2ec1` |
| `scripts/verify-p00.mjs` | 2254 | `21fbef0152300c647137aea056be325be254870c01cac004a9febc45ccc8bcd2` |
| `src/app/App.tsx` | 5271 | `13a9a0d1d48c98555e61cfb7d2280e5b68221cb1f7bb94b18c852e815916b01e` |
| `src/app/style.css` | 379 | `90a51d8769f9d43fa5bd76bc5b81276de10ff26e8be8928475eddc0e210700e0` |
| `src/application/lifecycle.ts` | 812 | `c6a85a9a1344429f9f2de0c4477d50d3d4e613c7add622228d30a1c7c206ac5d` |
| `src/application/probes.ts` | 612 | `e9a7fcaa0d28b69b2348378eb3cb0678f5f06c03c278c48b057c83b4c498a78b` |
| `src/application/scheduler.ts` | 1132 | `c40fa7e444d12f8a5c4239779faeb2ebf9793232f66d6a5828f83ac9749e7ca4` |
| `src/domain/foundation.ts` | 1693 | `e568aefcde51944b4748c2c9602d0413d01c8e3185581dcb15bbcadc5a5b0a07` |
| `src/infrastructure/browser.ts` | 2769 | `5be0f778f5c281e22baa2edc4efd256f9d29223e4352b87ca5a9121127e6884a` |
| `src/infrastructure/db.ts` | 1236 | `2c71c1aae44f63c45b91cff5cf89da25e3fbfecac0a8252aeedbbddbea885dc7` |
| `tests/integration/scheduler.test.ts` | 4991 | `79313fe89a0e44b6a8b10282e9dab8a5cea9054744d082a237de2d3720b5f4f4` |
| `tests/packaging.test.mjs` | 2364 | `435f5268e3c0278e0d86b86af30b8db3246e6e406c0edb7073495de21e044a21` |
| `tests/security.test.mjs` | 3047 | `f06754cf0ddf8762549d2837fa5cd2466aa9d4b498d7f11b8864ec8bb95b5fa7` |
| `tests/unit/browser-adapters.test.ts` | 3207 | `6785cc29d8ac64b05a4e35ecbf43dbffeb5ec0cea0e561d36e867253f2afa0fe` |
| `tests/unit/foundation.test.ts` | 1945 | `4500c4846cb8624f256d94e008a36a23062eecda0786dcd4851451e1f6823fc9` |
| `tests/unit/setup.ts` | 30 | `063a1b601fd84ac4cdcc40a81a22b3c87d7d91875f8780d646500e4233bcf8cf` |
| `tsconfig.json` | 189 | `f5aeccefa7bee41de58442cc4502ed70a0bf45190b6d25ff62d237759a5766fd` |
| `vitest.config.ts` | 212 | `ef10c90e9bfe068a664c763ad5517fe82cd13664bb043145799f01d25f9eb5bd` |
| `wxt.config.ts` | 2475 | `e316150a868944b1477bef294da40ec94bb53a8239ebce6898a5b4fab1bb614d` |

## Exact next steps before Mozilla unlisted signing

1. Review this candidate's inventories/hashes, truthful preview metadata, desktop scope and the three visible lint warnings. Resolve distribution/license prerequisites and owner security/browser-target decisions; no automatic acceptance of warnings or residual risk is implied.
2. Resolve or independently verify the failing Firefox shutdown/test completion. Collect any required minimum-version/regular lifecycle evidence separately; temporary-install results cannot close F01.
3. Review `README_AMO_BUILD.md` in the source archive, reproducibility evidence and AMO reviewer notes tracing both React findings. Establish the owner's Mozilla developer account and rights to the add-on; do not share credentials in chat/reports.
4. **Obtain separate explicit owner approval to upload these exact two archives/checksums to Mozilla AMO's unlisted channel.** Local implementation approval does not authorize uploading, signing, publication or distribution. Any package change invalidates the exact-file approval candidate and requires regenerated inventories/reproduction.
5. Only after that approval: owner-controlled AMO workflow → Submit new add-on → **On your own** → approved extension ZIP, matching source/build instructions and desktop notes. Retain actual validator messages; do not bypass warnings or assume signing succeeds. No workflow action has been performed here.
6. After a compatible signed XPI becomes available, inspect its ID/version/files and hashes, then guide F01 in a fresh disposable Firefox profile one action at a time. Record install UI, Home consent, actual Home, fresh New Tab and browser control separately, waiting for each observation. No signature-enforcement changes or personal profile access.

Recommendation: remain in **P00** for owner review and missing evidence. P01 is not started or recommended for authorization on this report alone. Stop after local implementation, packaging and verification.

Final documentation check: `git diff --check` exited 0. Direct `sha256sum` of both ZIPs matched the inventories. No runtime source or package inputs changed after final reproduction.
