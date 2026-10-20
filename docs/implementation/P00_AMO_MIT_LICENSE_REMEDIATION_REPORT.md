# P00 MIT license remediation

Date: 2026-10-10. Local licensing and packaging only. No AMO upload, submission, signing, publication, commit, push, P01 work, ADR approval, or residual-risk acceptance. P00 is not complete. Technical ZIP checks are not Mozilla policy acceptance.

## 1. Owner decision

The owner replaced the earlier proprietary / All Rights Reserved direction. Original Venus Workspace code is MIT-licensed.

Confirmed copyright notice, used exactly:

`Copyright (c) 2026 Akira Yuzai`

Copyright holder: Akira Yuzai. Year: 2026. SPDX identifier: `MIT`. No other legal entity, ownership history, or trademark registration was added.

## 2. What changed

- `LICENSE` — placeholder replaced with the MIT text below.
- `THIRD_PARTY_NOTICES` — placeholder removed.
- `THIRD_PARTY_NOTICES.md` — attribution for bundled libraries.
- `licenses/react/LICENSE`, `licenses/react-dom/LICENSE`, `licenses/scheduler/LICENSE`, `licenses/dexie/LICENSE`, `licenses/dexie/NOTICE`, `licenses/zod/LICENSE` — verbatim copies from the installed lockfile packages.
- `package.json` — `"license": "MIT"` and `"author": "Akira Yuzai"`. `private: true` remains so npm does not publish the package.
- `README.md` — states the MIT notice and points at the third-party notices. No proprietary claim.
- `scripts/firefox-package.mjs` — distribution license checks and the AMO reviewer text.
- `scripts/package-firefox-candidate.mjs` — copies license files into both archives.
- `scripts/smoke-firefox.mjs` — the two `throw` statements that ESLint rejected inside `finally` now run after `finally`. The disposable Nimbus/WebDriver preferences are unchanged. Quit failures still fail the command.
- `tests/packaging.test.mjs` — upstream byte match, missing notice, and wrong copyright rejection.
- Regenerated `.output-beta/packages/venus-beta-0.0.1-unsigned.zip`, `venus-beta-0.0.1-source.zip`, and `venus-beta-0.0.1-inventory.json`.
- Evidence under `evidence/P00/mit-license/`, including copies of the previous archives.

Historical reports were not rewritten. Previous hashes remain in those reports and in `evidence/P00/mit-license/historical-before/`.

## 3. MIT text

`LICENSE` starts with `SPDX-License-Identifier: MIT`, then the standard MIT permission grant, the condition that the copyright and permission notices travel with copies, and the “AS IS” warranty disclaimer. The only copyright line is `Copyright (c) 2026 Akira Yuzai`. Packaging rejects a missing file, a different copyright line, or an “All Rights Reserved” notice.

## 4. Third-party inventory

Production install tree: Dexie 4.0.11, React 19.1.0, React DOM 19.1.0, scheduler 0.26.0 (React DOM dependency), Zod 3.24.2. No other production packages. The built extension JavaScript contains Dexie, React, scheduler, and Zod. Each license file in `licenses/` matches the installed package byte for byte. The packaging test checks that match and fails if it drifts.

| Package | Version | License | Copyright line preserved from the package | Extra notice |
|---|---|---|---|---|
| react | 19.1.0 | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | None shipped |
| react-dom | 19.1.0 | MIT | Same Meta copyright | None shipped |
| scheduler | 0.26.0 | MIT | Same Meta copyright | None shipped |
| dexie | 4.0.11 | Apache-2.0 | NOTICE: Copyright (c) 2014-2017 David Fahlander | `NOTICE` included verbatim. The year range was not extended |
| zod | 3.24.2 | MIT | Copyright (c) 2020 Colin McDonnell | None shipped |

Venus copyright does not appear in those third-party files. Dexie stays Apache-2.0. SHA-256 of the copied texts:

| File | SHA-256 |
|---|---|
| `licenses/react/LICENSE` | `da6d3703ed11cbe42bd212c725957c98da23cbff1998c05fa4b3d976d1a58e93` |
| `licenses/react-dom/LICENSE` | `da6d3703ed11cbe42bd212c725957c98da23cbff1998c05fa4b3d976d1a58e93` |
| `licenses/scheduler/LICENSE` | `da6d3703ed11cbe42bd212c725957c98da23cbff1998c05fa4b3d976d1a58e93` |
| `licenses/dexie/LICENSE` | `cb5e8e7e5f4a3988e1063c142c60dc2df75605f4c46515e776e3aca6df976e14` |
| `licenses/dexie/NOTICE` | `6176d2e8a3fd8a881828a1a27bbcc5a9e03a75f437ce3c4ddbedd94fdac475c1` |
| `licenses/zod/LICENSE` | `0225e7c0a96845a7477cd44d75d3dc9c999f673454efa84b54e218415055eece` |

React, React DOM, and scheduler use the same MIT file, so their hashes match. They stay separate copies because they are separate packages.

## 5. What each archive contains

Both archives contain `LICENSE`, `THIRD_PARTY_NOTICES.md`, and the six `licenses/` files. The extension archive needs them because the libraries are inside its JavaScript. The source archive needs them so a reviewer can rebuild the same archive. Inclusion only in the source ZIP was not treated as enough.

The ten previous extension build files are unchanged inside the new unsigned ZIP. Their SHA-256 values still match the 2026-10-10 pre-submission audit, including manifest `69b69f198a9257df2d0c03935b11a6a7b6ba11c427c0d0775ca964de8f9d944a`. That manifest still has:

- P00 builds keep `p00@Venus.invalid` (channel inspect and the identity smoke).
- Beta/release builds keep `{935006c2-63b4-4e03-b842-11b88571da3b}`.
- MV3, `storage` and `alarms`, optional `bookmarks` and `notifications`, CSP `script-src 'self'; object-src 'none'`, Home and New Tab both `newtab.html`, `data_collection_permissions.required` `["none"]`.
- Icons remain 48×48 and 96×96.

No private-key block, `ghp_` token, or `AKIA` key was found in either new archive. The unsigned ZIP has 18 entries. The source ZIP has 53.

## 6. New packages

Historical copies, not reused as the new candidate:

| Archive | Bytes | SHA-256 |
|---|---:|---|
| Previous unsigned | 157901 | `7dbf5fbd6615d2262420e09ee883e3317d8fefb0693a6feff376408dc00e7850` |
| Previous source | 111431 | `ca9df52ba88df3a369ea7fbfee06410f5d7dcfc3401906fcaa75711a3db63b07` |

Those files are stored at `evidence/P00/mit-license/historical-before/`.

New local candidates:

| Path | Bytes | SHA-256 |
|---|---:|---|
| `.output-beta/packages/venus-beta-0.0.1-unsigned.zip` | 167397 | `c38fc573833a4215b53e6a40ce07edd29b02c04f61b85cd615bce593b8536c47` |
| `.output-beta/packages/venus-beta-0.0.1-source.zip` | 125594 | `c49ece2018116c6bae292c0bdf1f2efc3e538dc71131f0b8e4c058ecbd808a5b` |

Full file inventories: `.output-beta/packages/venus-beta-0.0.1-inventory.json`.

## 7. Reproducibility

`P00_EVIDENCE_DIR=evidence/P00/mit-license/repro VENUS_FIREFOX_CHANNEL=beta node scripts/reproduce-firefox-candidate.mjs` exited 0. In a temporary directory it ran:

| Command | Exit |
|---|---:|
| `npm ci --offline --ignore-scripts` with the local npm cache | 0 |
| `npm exec wxt prepare` | 0 |
| `npm run build:firefox:beta` | 0 |
| `node scripts/package-firefox-candidate.mjs` | 0 |

The reproduced source ZIP and unsigned ZIP match the hashes above byte for byte. The offline installer line that says it found no vulnerabilities is not a new advisory review.

## 8. Commands and exits

| Command | Exit |
|---|---:|
| `npm run typecheck` | 0 |
| `npm run lint` (first run) | 1 |
| `npm run lint` after moving the smoke-test throws out of `finally` | 0 |
| `npm run format:check` | 0 |
| `npm run format:check` after the smoke-script edit | 0 |
| `npm run unit` | 0, 11 tests |
| `npm run test:integration` | 0, 10 tests |
| `npm run test:security` | 0, 5 tests |
| `npm run test:packaging` | 0, 2 tests |
| `npm run build:firefox` | 0 |
| `npm run build:firefox:beta` | 0 |
| `npm run build:firefox:release` | 0 |
| `npm run build:chrome` | 0 |
| `npm run inspect:channels` | 0 |
| `VENUS_FIREFOX_CHANNEL=beta node scripts/package-firefox-candidate.mjs` | 0 |
| `npm run test:smoke:firefox` | 0 |
| `npm run test:smoke:identity` | 0 |
| `npm run test:smoke:chrome` | 0 |
| `web-ext lint --source-dir .output-beta/firefox-mv3` | 0 |
| source reproduction | 0 |

Firefox and identity smokes printed the New Tab pass line and wrote `firefox-teardown.json` with `restore-online` PASS and `driver.quit` PASS. Identity isolation, retained P00 data, and the hostile-text check passed. P00 id `p00@Venus.invalid` and beta id `{935006c2-63b4-4e03-b842-11b88571da3b}` were observed in that disposable profile. Chrome New Tab smoke passed. Logs are under `evidence/P00/mit-license/logs/`.

The first ESLint failure was `no-unsafe-finally` in `scripts/smoke-firefox.mjs` at the teardown throws. Those throws were not converted into a pass. They were moved to after `finally`, lint was rerun, and that rerun exited 0.

## 9. Firefox lint warnings

`web-ext` reports 0 errors, 0 notices, 3 warnings:

| Warning | Meaning |
|---|---|
| `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` | Desktop minimum 140 is older than Firefox for Android 142, which is when the data-collection manifest key is supported. `gecko_android` is absent. That does not prove Android installation is impossible |
| `UNSAFE_VAR_ASSIGNMENT` column 1807 | React DOM standard-element branch assigns `innerHTML` from `dangerouslySetInnerHTML.__html` |
| `UNSAFE_VAR_ASSIGNMENT` column 4676 | React DOM custom-element branch does the same |

Application code still does not call those sinks. ESLint rejects them under `src/` and `entrypoints/`. The identity smoke’s hostile string was displayed as JSON text. The vendor sink remains. No security exception is approved.

Reviewer instructions in `README_AMO_BUILD.md` inside the source ZIP state the MIT license, third-party licenses, tool versions, Node/npm/Python download links, the reproduce commands, these three warnings, the disposable-only WebDriver workaround, desktop intent without an Android impossibility claim, and the `none` data-collection declaration.

## 10. AMO UUID ownership

`{935006c2-63b4-4e03-b842-11b88571da3b}` is the approved local beta/release id. Ownership and availability on AMO are **NOT VERIFIED**. This work did not create a listing or query AMO.

When the owner chooses to check it, using the owner’s own Mozilla developer account:

1. Sign in at addons.mozilla.org.
2. Submit a new add-on and choose On your own.
3. Upload only an archive whose SHA-256 the owner has approved.
4. If AMO says the ID is already registered to another account, stop and do not switch IDs in this tree without a separate decision.
5. Provide the matching source ZIP and the reviewer notes generated inside it.
6. Do not send passwords, API keys, or identity documents through this repository or chat.

P00 remains `p00@Venus.invalid` and is not the beta submission ID.

## 11. Remaining risks

- AMO may still reject the ID if another account owns it.
- Firefox 140, regular-install Home consent, disable/uninstall, and Android behavior are **NOT VERIFIED**.
- node-forge 1.4.0 remains an open high-severity development-tool finding through web-ext’s Android path. It is not in the extension bundle. This report does not accept that risk.
- ADR-001 and ADR-002 stay proposed.
- The three lint warnings stay visible.
- MIT covers original Venus code. It does not register a trademark, and it does not change Dexie’s Apache-2.0 terms.
- Offline `npm ci` “0 vulnerabilities” is not a fresh advisory clearance.

## 12. Previous AMO blockers

| Earlier finding | Now |
|---|---|
| Placeholder project license and missing notices in both ZIPs | **PASS** for these new archives. MIT text, third-party licenses, and the Dexie NOTICE are in both |
| Permanent UUID not shown to be free and owned on AMO | **NOT VERIFIED** |
| Extension hash `7dbf5fbd…` and source hash `ca9df52b…` as the upload candidate | **Historical only.** Do not approve those bytes for upload |
| WebDriver quit failure | **PASS** on this run, including teardown. The workaround remains limited to the disposable test profile |
| Three Firefox lint warnings | Still warnings, explained, not errors |
| Data-collection `none` | **PASS** for the inspected local behavior. Not a traffic certificate |
| node-forge residual | **NOT ACCEPTED** |

## 13. Recommendation

**GO for requesting a separate owner decision to upload these two new archives, and only these hashes:**

- `.output-beta/packages/venus-beta-0.0.1-unsigned.zip` — 167397 bytes — `c38fc573833a4215b53e6a40ce07edd29b02c04f61b85cd615bce593b8536c47`
- `.output-beta/packages/venus-beta-0.0.1-source.zip` — 125594 bytes — `c49ece2018116c6bae292c0bdf1f2efc3e538dc71131f0b8e4c058ecbd808a5b`

That request is not upload approval. This report does not upload, sign, or publish. A later approval would still leave AMO validation, UUID ownership, F01, the lint warnings, and the node-forge residual outside P00 acceptance. P01 was not started.
