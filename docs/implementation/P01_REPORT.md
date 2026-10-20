# P01 dashboard foundation report

Date: 2026-10-10.

P00 remains **NOT PASS**. ADR-001 and ADR-002 remain proposed. This work does not sign, upload, or publish anything, and it does not change `p00@Venus.invalid` or `{935006c2-63b4-4e03-b842-11b88571da3b}`. No commit or push was made. P02 was not started.

## 1. Completed task IDs

Implemented, with the limits in section 4:

- T01.01 / T-011 design tokens, glass surfaces, light/dark/system, reduced motion, local gradient scenes
- T01.02 / T-012 FA/EN catalogs, separate locale, numerals, calendar, hour format, week start, and time zone
- T01.03 / T-013 Dexie version 2 on `Venus-p00`, `storage.local` bootstrap, revision checks, cross-tab notice
- T01.04 / T-015, T-016, T-022 widget registry, 1x1 / 2x1 / 2x2, keyboard move, pointer drag, responsive reflow, error boundary
- T01.05 / T-014 create, duplicate, rename, delete, switch; Minimal, Productivity, and Personal presets; shared fixture rows
- T01.06 / T-017 dashboard shell on the existing New Tab/Home page
- T01.07 / T-018, T-019 searchable settings, module toggles, wallpaper limits, gradient, blur, opacity, confirmed reset
- T01.08 / T-020, T-021 skippable onboarding and a dashboard command palette

Not done, because they belong to later phases: note, task, event, and timer creation. The palette lists those commands as unavailable and does not report success.

## 2. Files created or changed

Created:

- `docs/implementation/P00_TO_P01_CONDITIONAL_TRANSITION.md`
- `docs/implementation/P01_REPORT.md`
- `src/domain/dashboard.ts`, `src/domain/commands.ts`, `src/locales/messages.ts`
- `src/application/workspace.ts`, `src/infrastructure/browser-workspace.ts`
- `src/design/tokens.css`
- `src/app/dashboard.tsx`, `src/app/settings.tsx`, `src/app/widgets.tsx`, `src/app/document.ts`
- `tests/unit/dashboard.test.ts`, `tests/integration/workspace.test.ts`, `tests/integration/migration.test.ts`

Changed:

- `src/infrastructure/db.ts` adds Dexie version 2 stores without removing `probes`
- `src/app/App.tsx` remains the P00 probe panel and is shown from Settings
- `entrypoints/newtab/main.tsx` renders the dashboard
- `entrypoints/options/main.tsx` renders Settings
- `scripts/smoke-chrome.mjs` opens `options.html` for the probe button after the New Tab heading check
- `scripts/firefox-package.mjs` allowlist now names the shared `tokens-*` chunk instead of `App-*`

Manifest permissions, CSP, Firefox IDs, `strict_min_version`, `data_collection_permissions`, and the Firefox Home/New Tab targets were not changed. Names and descriptions were left unchanged because the beta packaging check still requires the technical-preview sentence, and P01 is not the full workspace.

## 3. Commands and tests

| Command | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npx eslint` on `src`, `entrypoints`, and the new tests | pass |
| `npx vitest run tests/unit tests/integration` | 6 files, 32 tests, pass |
| `npm run build:firefox` and `npm run build:chrome` | pass |
| `node --test tests/security.test.mjs` | 5 tests, pass |
| `P00_EVIDENCE_DIR=evidence/P01 npm run test:smoke:firefox` | One run failed only at `driver.quit` after the New Tab and temporary Home assertions had passed. The next run, and the run after the final rebuild, exited 0. Firefox 155.0.1. Teardown of the passing run is PASS. |
| `P00_EVIDENCE_DIR=evidence/P01 npm run test:smoke:chrome` | pass after the options-page probe navigation. Chromium 153.0.8010.52. |

Chromium heading timings, after the browser process was already launched, five fresh profiles and five reloads in the first profile:

- Cold samples ms: 68, 76, 82, 72, 75. p90: **82**
- Warm samples ms: 50, 37, 39, 41, 35. p90: **50**

This is document time until the Venus heading, not process startup and not Firefox. Evidence JSON is under `evidence/P01/`, which is gitignored.

## 4. Acceptance criteria

| Criterion | Result |
|---|---|
| First load offline, no remote assets | **PASS** in the Firefox and Chromium smoke profiles. Search stays closed offline. |
| Persian/Jalali RTL and time | **PASS** in unit tests via `Intl` (`Asia/Tehran`, 2026-03-21 renders 1 Farvardin 1405, Persian and Latin digits separately). Not exercised as a clicked browser wizard in smoke. |
| Theme, wallpaper, and glass survive restart | **PARTIAL.** Preferences persist through the repository. No browser-process restart test was run. |
| Three profiles, shared fixtures, isolated layouts | **PASS** in the integration test on fake IndexedDB. |
| Drag, keyboard reorder, no responsive overlap | **PARTIAL.** Placement rules, overlap rejection, and one-column reflow are unit-tested. No automated browser reopen covered a real drag. |
| Denied bookmark/notification permission does not block onboarding | **PASS** for the product rule. Native grant, deny, and revoke remain **NOT VERIFIED** and do not close T00.04. |
| One broken widget does not crash the page | **PASS** for `getDerivedStateFromError`. A thrown widget render was not driven in a browser. |
| Command palette avoids inputs | **PASS** for the shortcut guard and unavailable note/task/event/timer commands. |
| Firefox and Chrome smoke, manifest stable | **PASS** with the Chrome probe control now on Settings. Home consent, minimum Firefox 140, and native prompts remain open P00 items. |

## 5. Outstanding risks

- P00 is not accepted. Signing, AMO ownership, regular-install Firefox lifecycle, Firefox 140, native permission and notification proof, hosted CI, node-forge, and the unsigned ADRs stay open. See `P00_TO_P01_CONDITIONAL_TRANSITION.md`.
- The shared bundle file is now `chunks/tokens-*.js` because Vite named it from `tokens.css`. The packaging allowlist matches that name. Existing beta archives were not rebuilt and must not be treated as this dashboard.
- Firefox `driver.quit` failed once after a passing page check, then passed. That failure stays a failed command when it happens. It is not a New Tab failure and not a P00 closure.
- Wallpaper bytes and profile rows are local. Upload size and pixel limits are tested as pure checks, not with a real file in the browser.
- No new production dependency was added.

## 6. Recommendation

Stop. Do not start P02. Use the dashboard in disposable profiles. Keep the deferred P00 checks in front of any beta or public release.
