# P01 independent acceptance report

Date: 2026-10-10.

Auditor scope: evidence check of the implemented P01 dashboard. P00 stays **NOT PASS**. ADR-001 and ADR-002 stay **proposed and unsigned**. This audit does not accept P01, does not authorize P02, and does not sign, upload, publish, commit, or push.

## 1. Scope and authoritative requirements

Authoritative inputs:

- `AGENTS.md`, `phases/P01_DASHBOARD_FOUNDATION.md` (T01.01–T01.08 and the acceptance checklist)
- `docs/implementation/P01_REPORT.md`
- `docs/implementation/P00_TO_P01_CONDITIONAL_TRANSITION.md`
- `docs/implementation/P00_OWNER_VERIFICATION.md`
- `docs/implementation/P00_MANUAL_VERIFICATION_LOG.md`
- `docs/implementation/P00_REPORT.md` and the related P00 remediation, audit, and browser records
- `docs/implementation/ADR-001.md` and `docs/implementation/ADR-002.md` (both still proposed)

P01 acceptance that this audit treated as mandatory:

- Offline first load with no remote assets
- Persian/Jalali RTL and time, plus independent numeral, hour, week-start, and time-zone behavior
- Light, dark, and system theme, wallpaper, and glass surviving reopen and a browser-process restart
- Three profiles, switch and delete, shared business rows, isolated layouts
- Pointer drag, keyboard move, no overlap after reflow, safe invalid placements
- One failed widget isolated from the rest of the dashboard
- Onboarding skip and finish, including reload, without a denied optional permission blocking access
- Command palette shortcuts, input-focus guard, and no success claim for note, task, event, or timer creation
- Firefox and Chrome builds and smoke, with manifests otherwise unchanged

P00 gates that stay open are listed in section 11. A simulated permission result does not close them.

## 2. Task results

| Task | Result | Why |
|---|---|---|
| T01.01 Design system | **PARTIAL** | Light, dark, and system themes, the Nebula scene, blur `4px`, and glass alpha `0.72` were set in Chromium and survived tab reopen and a full browser-process restart. Reduced motion and contrast floors were not exercised in the browser. |
| T01.02 i18n | **PASS** | Real Chromium UI, not only unit tests. Details in section 7. |
| T01.03 Local settings and migration | **PASS** | Dexie `Venus-p00` upgraded from a real version-1 database to version 2 and kept the probe row. Preferences survived process restart. A same-tab refresh defect was found and the minimal fix below was applied and rechecked. |
| T01.04 Layout engine | **PASS** | Pointer drag, keyboard activation, overlap rejection, narrow reflow, invalid stored placements, and fault isolation were observed in Chromium. |
| T01.05 Profiles | **PARTIAL** | Create, switch, delete, last-active profile, isolated widget counts, and a shared note all passed. Theme, wallpaper, blur, and glass are stored on the global bootstrap. Switching profiles does not change them. |
| T01.06 Dashboard shell | **PASS** | New Tab rendered the Venus shell offline: header, clock, search, profile switcher, edit mode, quick capture, commands, and Settings. |
| T01.07 Settings | **PARTIAL** | Theme, locale, calendar, numerals, hour format, week start, time zone, scene wallpaper, blur, and glass opacity were changed from Settings and persisted. A local image upload and the gradient control were not driven. |
| T01.08 Onboarding and palette | **PARTIAL** | Skip, finish, and reload passed. Ctrl/Cmd-style Ctrl+K, the search-field guard, edit mode, and the four unavailable commands passed. Clicking “Request permission bookmarks” did not show the denial sentence within 5 seconds. Finish stayed available. Native grant, deny, and revoke remain **NOT VERIFIED**. |
| Cold/warm p90 benchmark | **NOT VERIFIED** in this audit | `P01_REPORT.md` records an earlier Chromium heading sample (cold p90 82 ms, warm p90 50 ms). This audit did not repeat that sample. |
| Firefox and Chrome smoke, manifest | **PASS** for the final tree | See section 9. Regular-install Firefox Home consent remains **NOT VERIFIED**. |

## 3. Real-browser evidence

Disposable Chromium profiles only. No personal profile was used.

- Browser: Chromium **153.0.8010.52** Arch Linux, `/usr/bin/chromium`, Playwright persistent context, headless, offline, extension loaded from `.output/chrome-mv3` except for the fault-only copy.
- Firefox smoke and identity used Mozilla Firefox **155.0.1** and a temporary developer install. That is not a regular install.
- Logs and JSON: `evidence/P01/acceptance/results.json`, `followup.json`, `fault-recheck.json`, `regression.log`, plus `evidence/P01/firefox-smoke.json`, `chrome-smoke.json`, `firefox-teardown.json`, and `evidence/P01/identity/`.

Chrome Home was not retested on the P01 build. Section 8 keeps the older owner record separate.

## 4. Persistence and migration

Passed in the disposable Chromium profile:

- Dark theme, Nebula scene, and blur `4px` survived closing the tab and opening `chrome://newtab/` again.
- The same profile directory was closed and launched again as a new browser process. Dark theme, Nebula, blur `4px`, selected profile **Beta**, and the shared note were still there. Later storage still showed `glassAlpha: 0.72`.
- Light canvas `#f6f6fb`, dark canvas `#111827`, system theme under an emulated dark scheme (`#111827`), and system theme under an emulated light scheme (`#f6f6fb`) were read from the live page after Settings changes.
- Language, numerals, calendar, hour format, week start, and time zone survived a tab close. See section 7.

Migration, isolated and offline:

1. A temporary MV3 extension at a fixed unpacked path created IndexedDB `Venus-p00` with Dexie 4.0.11, schema version 1, store `probes: "id,state,dueAt"`, and probe `f535d2b1-f815-41d9-9e61-2d2518ce30b8` (`dueAt: 5`, `state: "pending"`, `native: "not_attempted"`).
2. The browser process was closed. The same directory was replaced with the P01 Chrome build and reopened on the same profile, so the extension id stayed path-stable.
3. After upgrade the database version reported by IndexedDB was **20**. Dexie stores the schema version times 10, so this is schema **2**. The integration test still expects `db.verno === 2`.
4. The probe row was still present with `dueAt: 5`. Its state was **`missed`**. That is the existing P00 `recoverProbes` path (`dueAt` is in the past), not a deleted row.
5. Stores present: `assets`, `probes`, `profiles`, `sharedItems`, `widgets`.

Firefox process-restart persistence was **not run**. Temporary Firefox installs are not the regular-install lifecycle. That check stays under the P00 F01 gate as **NOT VERIFIED**.

## 5. Pointer and keyboard layout

Minimal profile, edit mode, Chromium:

- Keyboard: focus `Move ↓` on the clock and press Enter. Stored `y` went from **0 to 1**. Revision became 2.
- Pointer: pointer down on the `Move` handle and a 200px downward gesture. Stored `y` went from **1 to 2**. The 96px step means a clamped or shorter pointer delta still counts as one row. The widget did move from the pointer-up handler.
- Overlap: `Move ←` on the search widget, which would intersect the clock. Toast: **“That change was not saved.”** Search `x` stayed **2**.
- Invalid stored data: clock written as `x: -3`, `w: 3`, `h: 3`, search written to `x: 0`, `y: 0`. Reload still showed the Venus heading.
- Reflow at 480px width: both widgets reported `grid-column: span 1`, had positive size, and their bounding boxes did not overlap. At 1280px the search span was 2.

## 6. Widget fault isolation

The production `WidgetBody` throw was reachable from any stored `settings.fault` or `widgetType: "fault"`. That failure mechanism was gated on `import.meta.env.VITE_VENUS_WIDGET_FAULT === "1"`. Production Vite replaces the unset variable, and the branch is absent from the packaged extension.

Evidence:

- Final `.output/chrome-mv3` and `.output/firefox-mv3`: no file contains `widget fault`.
- A Chrome build with `VITE_VENUS_WIDGET_FAULT=1` contained the string in one file. That directory was used only for the fault session and was not left as `.output/chrome-mv3`.
- In that session a clock row with `settings.fault: true` was inserted. The page still showed the Venus heading and three widget articles. The failed widget’s alert was: **“This widget failed. The rest of the dashboard is still available.”**
- **Reset widget** cleared the alert without a reload (`stillFailed: false`). Two clock bodies rendered afterward (`evidence/P01/acceptance/fault-recheck.json`).

Same-tab defect found and fixed before that recheck: Dexie writes notified other tabs with `BroadcastChannel`, which does not deliver to the sender. The open dashboard did not see its own widget reset, so the error boundary stayed up after a successful write. `src/infrastructure/browser-workspace.ts` now calls the current tab’s listeners directly and still posts the channel message for other tabs. Onboarding skip already updated the other open tab without a reload (`otherTabClosedWithoutReload: true`).

## 7. Internationalization

Observed in Chromium on 2026-10-10, after waiting for the clock widget:

| Setting | Direction | Clock text observed |
|---|---|---|
| Persian, Jalali, Persian numerals, 24-hour, week starts Saturday, `Asia/Tehran` | `rtl`, `lang=fa` | `۱۲:۰۳` and `۱۴۰۵ مهر ۱۸, شنبه`. Week starts `شنبه`. |
| Same, Latin numerals | `rtl` | `12:03` and `1405 مهر 18`. No Persian digits. |
| English, Gregorian, Persian numerals, 12-hour, week starts Monday, `Pacific/Honolulu` | `ltr` | `۱۰:۳۳ PM` and `Friday, October ۹, ۲۰۲۶`. Week starts `Mon`. |
| English, Jalali, Latin numerals, 24-hour, `Asia/Tehran` | `ltr` | `12:05` and `Saturday, Mehr 18, 1405 AP`. No AM/PM marker. |

Reopen stored `locale: "en"`, `numeralSystem: "latin"`, `calendarDisplay: "jalali"`, `hourFormat: 24`, `weekStart: 1`, `timeZone: "Asia/Tehran"`.

## 8. Chrome Home evidence reconciliation

`P00_TO_P01_CONDITIONAL_TRANSITION.md` had said the Chrome manual Home path was **NOT VERIFIED**. That contradicted `P00_MANUAL_VERIFICATION_LOG.md`. The transition document now follows the log.

Owner-verified behavior of the **earlier P00 build**, status **PASS (OWNER-REPORTED)**, recorded 2026-10-09:

- CH-HOME-01: Home opened Venus offline in Chrome **154.0.8037.57**, Linux x86_64, owner’s **main** profile, Home set to the New Tab page. Loaded build identity, test timestamp, and the method used to disable the network were not established.
- CH-HOME-02: separate disposable Chrome profile, same browser and architecture. Home as New Tab page opened Venus. Home changed to `https://example.com` opened that site. Ctrl+T still opened Venus.
- CH-HOME-05: scoped to those CH-HOME-02 observations.

Those records do **not** certify the current P01 dashboard. This audit did not click Chrome’s Home button on the P01 build.

Still **NOT VERIFIED** in the manual log: CH-HOME-03 restart, CH-HOME-04 competing extensions, and offline Settings. ADR-002’s own text still says the Chrome fallback was not runtime verified. That ADR was not edited and is not signed.

## 9. Regression commands and exit codes

Final run after the same-tab listener fix, 2026-10-10. Log: `evidence/P01/acceptance/regression.log`.

| Command | Exit |
|---|---|
| `npm run typecheck` | **0** |
| `npm run lint` | **0** |
| `npm run format:check` | **0** |
| `npm run unit` | **0** — 3 files, 19 tests |
| `npm run test:integration` | **0** — 3 files, 13 tests |
| `npm run test:security` | **0** — 5 tests |
| `npm run build:firefox` | **0** |
| `npm run build:chrome` | **0** |
| `npm run inspect:manifests` | **0** |
| `npm run test:packaging` | **1** |
| `npm run inspect:channels` | **1** |
| `P00_EVIDENCE_DIR=evidence/P01 npm run test:smoke:firefox` | **0** — Firefox 155.0.1. `driver.quit` **PASS** in `evidence/P01/firefox-teardown.json` |
| `P00_EVIDENCE_DIR=evidence/P01 npm run test:smoke:chrome` | **0** — Chromium 153.0.8010.52 |
| `P00_EVIDENCE_DIR=evidence/P01/identity npm run test:smoke:identity` | **0** — `driver.quit` **PASS**. `p00@Venus.invalid` and `{935006c2-63b4-4e03-b842-11b88571da3b}` isolated. `storageLocalIsolation` and `indexedDBIsolation` **PASS** |

`npm run test:packaging` and `npm run inspect:channels` fail because `.output-beta/firefox-mv3` still contains `assets/App-OzzWFVdl.css`. The P01 allowlist expects `assets/tokens-*.css`. Those beta and release trees, and `venus-beta-0.0.1-unsigned.zip`, predate this dashboard. They were not rebuilt and are not P01 artifacts. The license-text packaging test passed. Nothing was submitted to Mozilla.

Browser acceptance scripts, not part of the package scripts above:

- `node scripts/p01-acceptance.mjs` exit **1** (profile visual isolation, plus later checks that the follow-up remeasured)
- `node scripts/p01-acceptance-followup.mjs` exit **1** on the pre-fix fault session; theme, i18n, palette, and onboarding finish were **PASS** in `followup.json`
- `node scripts/p01-fault-recheck.mjs` exit **1** only because the extra pixel assertion did not move (reflow placed the clock beside search). Fault isolation itself matched the PASS condition in section 6.

Historical record, unchanged: `P01_REPORT.md` documents an earlier Firefox smoke whose `driver.quit()` failed after the page assertions. A failed quit remains a failed command when it happens. This audit’s final Firefox smokes quit successfully. That does not erase the earlier failure.

Manifests on the final builds:

- Firefox id `p00@Venus.invalid`, Home and New Tab `newtab.html`, permissions `storage` and `alarms`, optional `bookmarks` and `notifications`
- Chrome has New Tab only and no Home override
- CSP remains `script-src 'self'; object-src 'none'`

## 10. Outstanding P01 gaps

1. **Profile visual settings are global.** Settings writes theme, wallpaper, blur, and glass to `venus.bootstrap`. Profile rows keep those fields `null`, and every profile showed `data-theme=dark` after one dark selection. Layouts and the shared note are isolated. **Minimal fix, not applied:** bind the appearance controls to the active profile through `updateProfile`, and keep null profile fields as inheritance from the bootstrap defaults.
2. **Optional-permission denial copy was not observed.** Finish stayed enabled after “Request permission bookmarks”, and the denial sentence did not appear within 5 seconds. Native grant, deny, and revoke were not performed.
3. **Local wallpaper upload and the gradient control** were not driven in the browser. Scene wallpaper and numeric glass/blur were.
4. **Reduced motion** was not switched in the browser.
5. **Cold/warm p90** was not re-measured.
6. **Firefox process restart** of the P01 dashboard was not run.
7. **Packaging/channel validation** fails until the beta and release output directories are rebuilt from this source. Do not treat the current unsigned ZIP as a P01 package.

## 11. Deferred P00 items that stay open

P00 is **NOT PASS**. None of these were closed by this audit:

- Phase acceptance for T00.01–T00.06
- ADR-001 and ADR-002, unsigned
- Mozilla signing, upload, and publication
- AMO ownership of `{935006c2-63b4-4e03-b842-11b88571da3b}`
- Regular-install Firefox F01, F02, F04–F07
- Firefox 140, ESR, and Android runtime (declared minimum remains 140.0; this run was 155.0.1)
- Native bookmark and notification grant, deny, revoke, OS display, and click. Smoke still records `DENIED_OBSERVED; GRANT_REVOKE_NOT_RUN`
- Alarm firing, worker suspension, restart, and closed-browser behavior beyond create/list/clear
- Hosted CI
- `node-forge` advisory through web-ext, with no approved exception
- Original PRD checksum provenance
- CH-HOME-03, CH-HOME-04, and offline Settings

## 12. Recommendation

**NO-GO** for treating P01 as accepted, and **NO-GO** for requesting authorization to start P02, until the owner decides the profile visual-settings gap.

P00 remains **NOT PASS**. The P01 shell, persistence, migration, keyboard and pointer layout, fault isolation, and bilingual clock behavior are real in disposable Chromium. They do not close Firefox regular-install lifecycle, native permissions, or the per-profile appearance requirement.

## Files changed for this audit

- `src/app/widgets.tsx` and `src/env.d.ts` — test-only widget fault gate
- `src/infrastructure/browser-workspace.ts` — same-tab listener for Dexie writes
- `scripts/p01-acceptance.mjs`, `scripts/p01-acceptance-followup.mjs`, `scripts/p01-fault-recheck.mjs` — browser evidence runners
- `docs/implementation/P00_TO_P01_CONDITIONAL_TRANSITION.md` — Chrome Home reconciliation
- `docs/implementation/P01_INDEPENDENT_ACCEPTANCE_REPORT.md` — this report

No commit, push, Mozilla submission, ID change, or P02 work was done.
