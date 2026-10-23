# Venus manual browser acceptance

This guide is the release-candidate browser checklist for the real unpacked Firefox and Chrome MV3 builds. It complements local unit and IndexedDB integration tests; it does not replace them. It neither signs an extension nor submits it to a browser store.

## Current status

The local release-candidate baseline is `d907ccec3ffb438bd74bbb6c49913f4f4e79c337` until a later validation report says otherwise. Firefox and Chrome browser acceptance are **NOT EXECUTED** in Codex Cloud: official Firefox and the exact Playwright Chromium are unavailable. Operating-system notification display is also **NOT VERIFIED**.

Do not use a system-browser substitute, `--no-sandbox`, a direct extension-page URL, or a passing unit test as browser acceptance evidence.

## Create the offline test kit

From a checkout with dependencies already installed, build both actual extension targets, audit their manifests, run the bundle checks, then create the kit:

```sh
npm run build:firefox
npm run build:chrome
npm run inspect:manifests
npm run test:security
npm run prepare:manual-test-kit
```

The command creates the ignored directory `artifacts/venus-manual-test-kit/`. It contains copies of the real Firefox and Chrome MV3 build directories, both generated manifests, a complete file/hash inventory, installation instructions, a blank per-browser result file, and an offline Node result recorder. Its inventory records the source commit and whether the source tree was clean or dirty when the artifacts were created. It creates no archive, browser profile, credential, cache, network request, signing request, or store submission.

The kit refuses symlinks and profile-, cache-, credential-, key-, environment- and dependency-like paths in either copied build. It does not read, copy, create, modify, or delete a user browser profile. Use a newly-created disposable browser profile with no sync, personal data, finance records, API credentials, or competing New Tab override.

Before loading an extension, verify the copied build artifacts from the kit directory with `node verify-hashes.mjs`. The command uses Node's standard library and does not need network access.

## Load the actual extension

Firefox: in the disposable profile, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, select `extensions/firefox-mv3/manifest.json` from the generated kit, then open a new tab through the browser UI.

Chrome/Chromium: in the disposable profile, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, select `extensions/chrome-mv3` from the generated kit, then open a new tab through the browser UI. Automation must keep `chromiumSandbox: true`; do not start Chromium with `--no-sandbox`.

Record the browser and OS versions, extension ID, manifest version, viewport, locale and timezone before the first case. Keep screenshots and console logs under a date-stamped `evidence/` directory inside the kit. Sanitize personal names, locations, finance values, API credentials, extension-storage dumps and browser-profile paths before sharing evidence.

## Record results without editing a Markdown table

Each Firefox and Chrome case starts as `NOT_EXECUTED` in `acceptance-results.json`. From the kit directory, record one case like this:

```sh
node record-result.mjs --browser firefox --id RC-02 --status PASS --notes "Venus rendered from a real New Tab" --evidence evidence/firefox/rc-02-new-tab.png
```

Allowed statuses are `PASS`, `FAIL`, `BLOCKED`, and `NOT_EXECUTED`. The command updates `acceptance-results.json` and regenerates the reviewable `acceptance-summary.md`; do not hand-edit a table. A `BLOCKED` result must name the exact unavailable prerequisite. A notification API result proves only that the browser accepted the request; record visible operating-system delivery only in `NOT-OS-01`.

## Initial 10-step release-candidate sequence

Run and record every case independently for Firefox and Chrome.

1. **RC-01 — Fresh disposable profile and extension loaded.** Confirm the extension ID and generated manifest match the kit.
2. **RC-02 — Actual browser New Tab shows Venus.** Open a genuine new tab; confirm the cosmic/glass dashboard and a clean console. Do not navigate directly to an extension URL.
3. **RC-03 — Onboarding, navigation and profile selection.** Complete or skip onboarding through visible controls, visit major navigation areas, and create/select a disposable profile.
4. **RC-04 — English LTR and Persian RTL.** Switch both ways, reload, verify `dir`, translated controls, keyboard focus and a narrow viewport.
5. **RC-05 — Add, reorder and persist dashboard widgets.** Use Customize, confirm standard-widget singleton behaviour, drag/reorder/resize as available, then reload.
6. **RC-06 — Quick Capture and Daily Briefing.** Create synthetic task, note and event data. Verify the briefing updates and invalid input gives a usable error without a partial record.
7. **RC-07 — Habit reminder lifecycle.** Create daily and weekly habits, enable/edit/reschedule their local reminder, snooze in Notification Center, complete once, verify one local-date check-in and a future occurrence, then disable and verify new pending occurrences clear.
8. **RC-08 — Finance month, zero opening balance and export.** Use only synthetic values. Verify selected-month figures, zero and signed opening balances where offered, safe JSON/CSV export, and profile-scoped deletion.
9. **RC-09 — Reload persistence.** Reload the extension/browser New Tab and verify the selected profile, widget layout, created records, habit history/reminder settings and finance data persist.
10. **RC-10 — Version, screenshot and report capture.** Save the manifest/version, viewport, locale, timezone, sanitized screenshot and console result to the evidence directory, then record the final result.

## Remaining cross-widget cases

- **XW-01 — Goals, Knowledge Review and People follow-up.** Create a goal linked to task/habit data, rate/postpone a note review, and snooze/complete a follow-up while retaining the person and history.
- **XW-02 — Focus, AI Inbox, Weather and Commute.** Verify Focus conflict guidance, local Inbox classification/undo, and consent-gated Weather/Commute data without real personal inputs.
- **NOT-OS-01 — Operating-system notification display observation.** Keep the target desktop visible for a due synthetic reminder. Capture a visible OS notification only if actually observed; otherwise record `NOT_EXECUTED` or the exact `BLOCKED` condition. Do not infer it from Notification Center or the extension API.

A browser is not accepted because the other browser passed. Release readiness remains **NO-GO** until each applicable browser case has a `PASS` or a documented non-product `BLOCKED` result and the separate operating-system notification observation is reviewed.
