# P01 acceptance remediation report

Date: 2026-10-10

This report covers scoped P01 remediation after the independent acceptance audit. It does not accept P00, P01, ADR-001, or ADR-002. It does not approve the node-forge residual risk. It does not authorize P02. Nothing in this run was uploaded, signed, submitted, or published through Mozilla AMO. No commit or push was made.

The product decision applied here: each workspace profile stores its own theme, wallpaper, blur, and glass opacity. Global bootstrap appearance values remain the fallback. A null profile field inherits the matching bootstrap value. Language, calendar, numerals, hour format, week start, and time zone stay on the bootstrap record.

## 1. Original findings and root causes

Source: `docs/implementation/P01_INDEPENDENT_ACCEPTANCE_REPORT.md`. That audit concluded **NO-GO**. Its evidence and the earlier failed browser commands are preserved under `evidence/P01/acceptance/` and in `scripts/p01-acceptance.mjs`, `scripts/p01-acceptance-followup.mjs`, and `scripts/p01-fault-recheck.mjs`.

| Finding | Root cause | Remediation |
| --- | --- | --- |
| Profile visual settings were global. One dark selection made every profile render `data-theme=dark`. Profile rows kept `themeMode`, `wallpaper`, `blurPx`, and `glassAlpha` null. | Settings and onboarding wrote appearance through `updateAppearance` into `venus.bootstrap`. `appearanceOf` already preferred a profile value and fell back to bootstrap, but nothing wrote the profile fields. | Appearance controls and the onboarding theme choice now call `patchProfileAppearance` on the active profile. Null fields still inherit. |
| “Request permission bookmarks” did not show the denial sentence within 5 seconds. Finish stayed enabled. | Headless Chromium did not settle `permissions.request`. The UI only renders a note after that promise settles. A hang is not a denial. There was no production timeout that would relabel a hang as denial. | `requestOptional` now returns `granted`, `denied`, `dismissed`, `failed`, or `unsupported`. The onboarding note uses that result. A controlled adapter can return a real denial for the UI. Native grant, deny, and revoke stay **NOT VERIFIED**. |
| `npm run test:packaging` and `npm run inspect:channels` exited 1. | `.output-beta/firefox-mv3` still contained pre-P01 `assets/App-OzzWFVdl.css`. The allowlist expects `assets/tokens-*.css`. The beta and release trees and `venus-beta-0.0.1-unsigned.zip` predated the dashboard. | Beta and release were rebuilt from the current source. The allowlist was not widened. |
| Firefox identity smoke later failed on the new-tab page. | “Read durable probe results” lives in Settings (`options.html`), which mounts `src/app/App.tsx`. The identity script clicked that button on `newtab.html`. | The script opens `options.html` on the same extension before the click. Isolation assertions were not weakened. The rerun still exits 1 because `driver.quit` failed. See section 8. |

Layout isolation, the shared note, and Dexie v1 to v2 migration were already real in the audit. This remediation does not replace that history.

## 2. Files changed

Product and tests:

- `src/application/workspace.ts` — `patchProfileAppearance`, `clearProfileAppearance`
- `src/app/settings.tsx` — active-profile appearance controls, upload, reset
- `src/app/dashboard.tsx` — onboarding theme and permission note
- `src/app/document.ts` — scene/gradient clear the uploaded image; upload paint helper
- `src/domain/commands.ts` — `PermissionOutcome`, `permissionNoteKey`
- `src/infrastructure/browser-workspace.ts` — `requestOptional` outcome mapping
- `src/locales/messages.ts` — grant, denial, dismissal, failure, unsupported, unresolved copy in English and Persian
- `tests/integration/workspace.test.ts`
- `tests/unit/dashboard.test.ts`

Verification only:

- `scripts/p01-remediation-acceptance.mjs`
- `scripts/verify-firefox-identity.mjs` — options-page navigation for the existing probe button

`src/infrastructure/db.ts` was not changed. Extension IDs, CSP, permissions, and Home / New Tab manifest mappings were not changed.

## 3. Per-profile appearance

`appearanceOf` resolves each visual field independently:

- `themeMode`, `wallpaper`, `blurPx`, `glassAlpha`, and `accent` use the profile value when it is not null.
- A null profile value uses the bootstrap value.
- `motion`, `density`, and `fontScale` stay on bootstrap.
- Locale, calendar, numerals, hour format, week start, and time zone stay on bootstrap.

`patchProfileAppearance` validates accent, integer blur from 0 to 16, glass alpha from 0.65 to 0.95, and wallpaper shape. It reads the current profile inside a Dexie transaction and bumps that revision. It does not require a stale caller revision. `clearProfileAppearance` writes null for the five profile visual fields.

New profiles are created with those five fields null, so they inherit the bootstrap defaults. Duplication copies the source profile’s appearance and layout. Deleting a profile removes that profile and its widgets. Other profiles keep their own appearance. If no profile remains, a new Minimal profile is inserted with null appearance fields. Reset of appearance nulls the active profile’s visual fields and restores bootstrap motion, density, and font scale. It does not rewrite bootstrap theme, wallpaper, blur, or glass, because those values are the inherited defaults.

Onboarding theme selection writes the active profile, not the bootstrap default. A later profile therefore still inherits the factory bootstrap appearance unless that profile is edited.

Accent is stored on the profile because `ProfileRecord` and `appearanceOf` already treated it as a profile override. The owner decision named theme, wallpaper, blur, and glass. Accent follows the same inheritance rule so a null accent cannot be mistaken for corruption.

## 4. Storage and migration impact

No Dexie schema change. No data reset. No destructive migration.

Existing P01 rows stay valid. A profile row whose visual fields are null is inheritance, not a corrupt record. Bootstrap `venus.bootstrap` remains the fallback and still holds the global preferences. IndexedDB name remains `Venus-p00`. Schema version remains the existing Dexie v2 (IndexedDB version 20).

Integration coverage in `tests/integration/workspace.test.ts` checks dark/nebula/blur 4/glass 0.72 on the first profile, null inheritance for a new profile, a duplicate that keeps dark/nebula, a clear that nulls only the source, and deletion of another profile without removing the copy.

## 5. Optional-permission feedback

`requestOptional` in `src/infrastructure/browser-workspace.ts`:

| Result | Meaning |
| --- | --- |
| `granted` | `permissions.request` resolved `true` |
| `denied` | `permissions.request` resolved `false` |
| `dismissed` | the call rejected with a gesture, dismiss, or closed message |
| `failed` | any other rejection |
| `unsupported` | `browser.permissions.request` is missing |

The onboarding note maps those outcomes, plus `unresolved`, to distinct English and Persian strings. `onboardingContinues` still returns true, so a denial does not block Finish. There is no production timeout. A promise that never settles does not become a denial.

### Native prompt

`scripts/p01-remediation-acceptance.mjs` check `native-permission-prompt`: **NOT VERIFIED**.

On headless Chromium 153.0.8010.52, after “Request permission bookmarks”:

- denial copy was absent immediately and after 3 seconds
- `chrome.permissions.contains` for bookmarks was false
- Finish stayed enabled
- the note stayed empty

Interpretation recorded in `evidence/P01/remediation/results.json`: the browser did not return a permission result during the wait. An empty note is not a denial. Native grant, deny, and revoke were not performed. This does not close the P00 permission lifecycle.

### Controlled denial

Check `controlled-permission-denial`: **PASS**.

A test build with `VITE_VENUS_PERMISSION_ADAPTER=denied` sets `documentElement.dataset.permissionAdapter` to `controlled-denial` and shows “Permission was not granted. Setup can continue.” Finish stayed enabled. After Finish the dialog was hidden. The adapter marker is present in that test build and absent from the production build. `nativeLifecycle` on that check is **NOT VERIFIED**. The controlled adapter is not a native denial and does not close P00.

## 6. Browser evidence

Runner: `node scripts/p01-remediation-acceptance.mjs`

Log: `evidence/P01/remediation/run.log` and the final regression invocation in `evidence/P01/remediation/regression.log` (exit 0).

Result file: `evidence/P01/remediation/results.json`

Recorded at `2026-10-10T14:09:07.025Z`. Browser: Chromium 153.0.8010.52 at `/usr/bin/chromium`, headless, offline, disposable profile. Playwright persistent context. This is not Firefox, and it is not a regular install.

| Check | Status |
| --- | --- |
| offline-first-load | PASS (`remote=0`) |
| profile-appearance-switch | PASS. Minimal dark / nebula / blur 2px. Beta light with gradient `rgb(17, 34, 51)` to `rgb(171, 205, 239)`. A → B → A restored both. |
| active-profile-only | PASS. Minimal `blurPx` 6. Beta `blurPx` null and computed blur 8px. Bootstrap theme stayed `system`, wallpaper stayed orbit. |
| profile-appearance-restart | PASS. After a new browser process, Minimal stayed dark/nebula/blur 6px and Beta stayed light gradient. |
| new-profile-inherits | PASS. Gamma row fields null. Computed appearance was system / orbit / blur 8px. |
| duplicate-and-reset | PASS. The copy stayed dark/nebula after the source was reset to inherited system/orbit. |
| wallpaper-upload | PASS. A text file and a file over 5MB showed “That change was not saved.” A 1×1 PNG became a blob background on the active profile only. |
| reduced-motion | PASS. Motion off applied `off`. System plus emulated reduce applied `off`. System plus no-preference applied `system`. |
| command-palette | PASS. Ctrl+K did not open while `#dashboard-search` was focused. “New note” and “Start timer” showed the capture notice “Nothing was saved.” |
| native-permission-prompt | **NOT VERIFIED** |
| heading-timing | INFO. See below. |
| controlled-permission-denial | PASS |
| widget-fault-isolation | PASS. Heading stayed. Alert included “The rest of the dashboard is still available.” Search widget remained. After Reset the alert hid and stored `settings.fault` was not true. The fault string is in the fault build and absent from production. No pixel assertion. |

Gradient assertion compares Chromium’s computed `rgb()` serialization of the chosen gradient. The product still stores the gradient wallpaper.

Heading timing method, as stored in the result file: the timer starts at `page.goto` or reload after the browser process is already running, and stops when the Venus heading is visible. It excludes process startup. p90 uses nearest rank `ceil(0.9*n)`. For n=5 that rank is the maximum sample.

Last recorded samples: cold `[71, 67, 71, 71, 64]` ms, cold p90 **71 ms**. Warm `[45, 42, 38, 36, 33]` ms, warm p90 **45 ms**. Browser: Chromium 153.0.8010.52 Arch Linux. These numbers are heading visibility, not full browser startup.

Firefox process restart and Firefox regular-install lifecycle remain **NOT VERIFIED**. No temporary Firefox installation was used to invent that evidence. Chrome Home rows in `docs/implementation/P00_TO_P01_CONDITIONAL_TRANSITION.md` stay owner-reported for the earlier P00 build only. They were not re-run against this P01 tree.

## 7. Packaging

Pre-P01 beta archives were copied to `evidence/P01/historical-pre-p01-packages/beta/` before the rebuild and were not overwritten.

Historical SHA-256:

| File | SHA-256 |
| --- | --- |
| `venus-beta-0.0.1-inventory.json` | `48763068bbe44dc49365634b079fac3ebb7c35514629603867bb6580569515cf` |
| `venus-beta-0.0.1-source.zip` | `c49ece2018116c6bae292c0bdf1f2efc3e538dc71131f0b8e4c058ecbd808a5b` |
| `venus-beta-0.0.1-unsigned.zip` | `c38fc573833a4215b53e6a40ce07edd29b02c04f61b85cd615bce593b8536c47` |

No `.output-release/packages` archive existed before this rebuild.

Current unsigned archives, rebuilt from the current P01 source. These are **not** approved for Mozilla submission.

| File | SHA-256 |
| --- | --- |
| `.output-beta/packages/venus-beta-0.0.1-inventory.json` | `f10f94ff5ef7440e0afeb33fdd9034993089fe9021dc5071a763d9baa523bd38` |
| `.output-beta/packages/venus-beta-0.0.1-source.zip` | `80f2f77f3efc8e8debc89bca520bf44d00fb3977771fdbcee2f2284fe3ce21dd` |
| `.output-beta/packages/venus-beta-0.0.1-unsigned.zip` | `eea7d6c4924a267ec7a9eb36cdacb9106d5d5f8abaf775dc1757d758b4e77972` |
| `.output-release/packages/venus-release-0.0.1-inventory.json` | `9c59daaac8ade842412773823897de3ca7e0a52f4ca7a76e2488a9e2a0394a67` |
| `.output-release/packages/venus-release-0.0.1-source.zip` | `aa543a02ed15f4c01468ffa386c3f5ab04e378ec5231953babde6e15de06213f` |
| `.output-release/packages/venus-release-0.0.1-unsigned.zip` | `ea778cec1cfaf7f1ff7acc092d31f7a1f0b7d7b51b6cdda43e92778b97c843a0` |

`P00_EVIDENCE_DIR=evidence/P01/remediation/reproduction VENUS_FIREFOX_CHANNEL=beta node scripts/reproduce-firefox-candidate.mjs` exited 0 and reported byte-for-byte reproduction of the beta build files and both ZIP archives.

`npm run test:packaging` exited 0 (2 passed). `npm run inspect:channels` exited 0. MIT `LICENSE`, `THIRD_PARTY_NOTICES`, and upstream license files remain in the package checks. The CSS allowlist was not weakened.

Identities checked by the existing inspect commands, unchanged by this remediation:

- P00 Firefox id `p00@Venus.invalid`
- Beta and release Firefox id `{935006c2-63b4-4e03-b842-11b88571da3b}`
- Chrome build has no Firefox Home override

## 8. Regression results

Environment: Node v24.19.0, Firefox 155.0.1, Chromium 153.0.8010.52, web-ext 10.7.0, WXT 0.21.4, Vite 6.4.4, Vitest 4.1.11, TypeScript 5.8.3, ESLint 9.39.5, Prettier 3.5.3.

Log: `evidence/P01/remediation/regression.log`.

| Command | Exit |
| --- | --- |
| `npm run build:firefox:beta` | 0 |
| `npm run build:firefox:release` | 0 |
| `VENUS_FIREFOX_CHANNEL=beta node scripts/package-firefox-candidate.mjs` | 0 |
| `VENUS_FIREFOX_CHANNEL=release node scripts/package-firefox-candidate.mjs` | 0 |
| `npm run test:packaging` | 0 (2 passed) |
| `npm run inspect:channels` | 0 |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run format:check` | 0 |
| `npm run unit` | 0 (19 passed) |
| `npm run test:integration` | 0 (14 passed) |
| `npm run test:security` | 0 (5 passed) |
| `npm run build:firefox` | 0 |
| `npm run build:chrome` | 0 |
| `npm run inspect:manifests` | 0 |
| `P00_EVIDENCE_DIR=evidence/P01/remediation/smoke-firefox npm run test:smoke:firefox` | 0 |
| `P00_EVIDENCE_DIR=evidence/P01/remediation/smoke-chrome npm run test:smoke:chrome` | 0 |
| `P00_EVIDENCE_DIR=evidence/P01/remediation/identity npm run test:smoke:identity` | **1** |
| `npx web-ext lint --source-dir .output/firefox-mv3 --output text` | 0 |
| `npx web-ext lint --source-dir .output-beta/firefox-mv3 --output text` | 0 |
| `P00_EVIDENCE_DIR=evidence/P01/remediation/reproduction VENUS_FIREFOX_CHANNEL=beta node scripts/reproduce-firefox-candidate.mjs` | 0 |
| `node scripts/p01-remediation-acceptance.mjs` | 0 |

Firefox P00 smoke teardown in `evidence/P01/remediation/smoke-firefox/firefox-teardown.json` is **PASS**, including `driver.quit` PASS. Home rendering in that smoke is PASS for the temporary add-on. Home consent is **NOT VERIFIED**. API lifecycle remains partial: bookmarks and notifications are `DENIED_OBSERVED; GRANT_REVOKE_NOT_RUN`. That smoke observation is not a completed native permission lifecycle.

Chrome smoke `evidence/P01/remediation/smoke-chrome/chrome-smoke.json`: new tab PASS, offline true, storage and alarm create/list/clear PASS. Bookmarks and notifications are `DENIED_OBSERVED; GRANT_REVOKE_NOT_RUN`. Home consent **NOT_RUN**. API lifecycle remains partial.

web-ext lint on `.output/firefox-mv3` and `.output-beta/firefox-mv3`: 0 errors, 0 notices, 3 warnings. The warnings are `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` and two `UNSAFE_VAR_ASSIGNMENT` innerHTML warnings. Exit code 0. These warnings are not treated as a pass of a clean lint notice list.

### Identity smoke, not converted to PASS

First regression run, exit **1**: `JavascriptError: TypeError: can't access property "click"` at `scripts/verify-firefox-identity.mjs` while the page was beta `newtab.html`. The probe button is not on the new tab. That was a test-target defect. The script now navigates to `options.html` on the same extension and waits until the button exists. The isolation, retention, and unsafe-HTML assertions were not removed or weakened.

Rerun after that fix, log `evidence/P01/remediation/identity-rerun.log`, exit **1**:

- `evidence/P01/remediation/identity/firefox-identity.json` records p00 id `p00@Venus.invalid`, beta id `{935006c2-63b4-4e03-b842-11b88571da3b}`, storage and IndexedDB isolation PASS, p00 retention PASS, unsafe HTML text rendering PASS. Install is temporary developer add-ons, **NOT F01**.
- `evidence/P01/remediation/identity/firefox-teardown.json` status **FAIL**. `restore-online` PASS. `driver.quit` **FAIL**: `WebDriverError: Failed to decode response from marionette`.
- The process therefore exits 1. This is not recorded as PASS.

`npx eslint scripts/verify-firefox-identity.mjs` and `npx prettier --check scripts/verify-firefox-identity.mjs` were run after the regression log, both exit 0. The logged `npm run lint` and `npm run format:check` predate that one-file test fix.

## 9. Acceptance criteria

Resolved in this remediation:

1. Profile A can be dark with Nebula, including layout restore after switching away and back.
2. Profile B can be light with a gradient.
3. Switching A → B → A restores each profile’s appearance. Layout restore is covered by the same switch, which reads each profile’s stored widgets.
4. A blur change on the active profile leaves the other profile’s null blur and the bootstrap theme/wallpaper unchanged.
5. A full Chromium process restart preserved both profiles’ appearance.
6. A new profile with null visual fields inherited system / orbit / blur 8px.
7. Duplication copies appearance. Reset nulls the active profile and leaves the copy intact. Deletion removes only the targeted profile; a last-profile fallback is created with null visual fields. Integration test covers deletion. The browser script covers duplicate and reset.
8. No schema migration. Existing null profile fields remain readable and mean inheritance.
9. Local wallpaper upload rejects a non-image and an oversize file, and a small PNG applies to the active profile only.
10. Gradient control renders the stored gradient.
11. Reduced motion follows off, system+reduce, and system+no-preference.
12. A controlled denial shows the denial sentence and does not block Finish. Production bundles do not contain the adapter marker.
13. Command palette focus guard and unavailable commands behave as specified.
14. Widget fault isolation and reset work without a pixel assertion. Production bundles do not contain the fault throw string.
15. Beta and release packages rebuild, pass packaging and channel inspection, and the beta archives reproduce byte for byte.

Unresolved:

- Native optional-permission grant, denial, dismissal, and revoke. **NOT VERIFIED**.
- Firefox process restart. **NOT VERIFIED**.
- Firefox regular-install lifecycle (P00 F01). **NOT VERIFIED**.
- Firefox identity smoke command exit 0. Assertions passed on the rerun. `driver.quit` failed. Command exit **1**.
- Chrome Home on this P01 build. Earlier owner evidence does not certify this tree.
- P00 acceptance. **NOT PASS**.
- ADR-001 and ADR-002 approval. Not done.
- node-forge residual risk approval. Not done.
- Mozilla submission. Not done. New archives are local and unsigned.

## 10. Outstanding P00 obligations

P00 stays **NOT PASS** under `docs/implementation/P00_TO_P01_CONDITIONAL_TRANSITION.md`.

Still open:

- Firefox regular install, process restart, and the F01 lifecycle
- Native optional-permission grant, deny, and revoke, including the identity-smoke command’s teardown failure
- Alarm firing across restart and OS notification display
- Chrome Home consent and restart on a P01 build (CH-HOME-03, CH-HOME-04, and offline Settings remain **NOT VERIFIED** in the transition note)
- ADR-001 and ADR-002 are not approved
- The node-forge residual risk is not accepted

## 11. Recommendation

**GO to ask the owner to accept this P01 remediation and to decide whether to authorize P02.**

This report does not accept P01. The appearance gap that produced the audit NO-GO is implemented and checked in disposable Chromium, with null inheritance and no schema change. Packaging from the current source passes, and the new unsigned archives are hashed and reproducible.

P02 must wait for an explicit owner acceptance. The ask should carry these limits: P00 remains **NOT PASS**; native permissions, Firefox regular-install restart, and Chrome Home on this build remain **NOT VERIFIED**; the Firefox identity command exits **1** because `driver.quit` failed after the checks passed; ADR-001, ADR-002, and the node-forge residual risk are not approved; the new archives are not for Mozilla.
