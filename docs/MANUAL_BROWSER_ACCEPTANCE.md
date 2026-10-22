# Venus manual browser acceptance checklist

This checklist verifies an unpacked Venus extension without GitHub Actions or a public store release. It complements local unit and IndexedDB integration tests; it does not replace them.

## Prerequisites

Use a desktop development machine with an official current Firefox and a current Chromium-based Chrome. Install the repository's locked dependencies and build each target:

```bash
npm ci
npm run build:firefox
npm run build:chrome
npm run inspect:manifests
npm run test:security
```

For **Firefox**, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select `.output/firefox-mv3/manifest.json`. Open a new tab through the browser UI. Use a fresh Firefox profile for the entire pass.

For **Chrome/Chromium**, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, select `.output/chrome-mv3`, and open a new tab through the browser UI. Use a fresh browser profile. Do not use `--no-sandbox`; automation must retain `chromiumSandbox: true`.

Before beginning, record browser version, OS version, extension ID, manifest version, viewport, locale and timezone. Keep DevTools console output and save screenshots under a date-stamped evidence directory. For each failed case, capture a screenshot, console errors and persisted IndexedDB state if safely available. Do not include real location, finance, contact or API-key data.

## Status vocabulary

- **PASS**: the expected UI and persisted data were observed in the named browser.
- **FAIL**: the scenario ran and differed from its expected result.
- **BLOCKED**: an environmental prerequisite prevented execution; record the exact prerequisite.
- **NOT EXECUTED**: the scenario has not run yet.

Normal extension notification API acceptance proves only that the browser accepted the request. Record native operating-system notification visibility in the separate final case; never infer it.

## Shared dashboard cases

| ID     | Initial state                                   | User action                                            | Expected UI result                                                                | Expected persisted data                  | Browser          | Evidence                                        | Status       |
| ------ | ----------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------- | ---------------- | ----------------------------------------------- | ------------ |
| DSH-01 | Fresh profile, English LTR desktop              | Open browser New Tab                                   | Venus dashboard, cosmic/glass styling, Dashboard navigation and no console error  | Default profile/layout exist             | Firefox + Chrome | New Tab screenshot, extension ID, console       | NOT EXECUTED |
| DSH-02 | Existing profile                                | Customize → add each standard widget twice             | First add creates one card; second selects/explains existing card                 | Exactly one instance/type/profile        | Firefox + Chrome | Before/after screenshots, IndexedDB widget rows | NOT EXECUTED |
| DSH-03 | Three or more cards                             | Drag/drop reorder, resize allowed card, reload New Tab | Grid reflows without overlap; keyboard move/resize remains reachable              | Same placements after reload             | Firefox + Chrome | Desktop + narrow screenshots, stored layout     | NOT EXECUTED |
| DSH-04 | Persian locale, narrow viewport, reduced motion | Switch language, resize, navigate cards with keyboard  | `dir=rtl`, Persian text/numerals, usable sidebar/dialog focus, no motion-only cue | Locale/motion preference survives reload | Firefox + Chrome | RTL screenshot, focus sequence, preference row  | NOT EXECUTED |

## Widget cases

| ID                            | Initial state                   | User action                                                                                              | Expected UI result                                                                                                                | Expected persisted data                                                    | Browser          | Evidence                                       | Status       |
| ----------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------- | ---------------------------------------------- | ------------ |
| BRI-01 Daily Briefing         | Empty dashboard data            | Create Today task, note and future event through Venus                                                   | Briefing updates with task count/next event and focus action                                                                      | Task/note/event remain after reload                                        | Firefox + Chrome | Before/after briefing screenshots              | NOT EXECUTED |
| CAP-01 Quick Capture          | Capture card added              | Save task, note and event; submit an invalid required field                                              | Clear success feedback; invalid input is actionable                                                                               | One record of each saved kind; no partial invalid record                   | Firefox + Chrome | Cards and IndexedDB rows                       | NOT EXECUTED |
| HAB-01 Habit lifecycle        | Habit Tracker added             | Create daily and weekly habits, check in, undo, inspect history                                          | Correct state/streak/history; unscheduled/future states are distinct                                                              | Check-ins survive reload; no duplicate date                                | Firefox + Chrome | History screenshots and habits row             | NOT EXECUTED |
| HAB-02 Habit reminder         | Daily and weekly habits         | Enable, edit and disable local reminder; snooze then complete Notification Center item                   | Saved time/timezone/weekdays; completion updates one check-in and future occurrence remains; disable removes future pending items | Rule/occurrence/check-in changes are idempotent                            | Firefox + Chrome | Notification Center, IndexedDB occurrence rows | NOT EXECUTED |
| GOL-01 Goals & Progress       | Task and habit exist            | Create goal, link records, complete milestone, create weekly review                                      | Progress and next milestone update without altering source task/habit                                                             | Goal, relation, milestone and review survive reload                        | Firefox + Chrome | Goal screenshots and rows                      | NOT EXECUTED |
| REV-01 Knowledge Review       | Note exists                     | Enroll note, rate recall, postpone, pause/resume                                                         | Due queue and next date reflect rating; original note remains available                                                           | Schedule/history survive reload                                            | Firefox + Chrome | Review queue/history evidence                  | NOT EXECUTED |
| PPL-01 People & Follow-ups    | People card added               | Create person, follow-up, interaction; snooze and complete follow-up                                     | Correct due grouping and interaction timeline                                                                                     | Person/follow-up/history survive reload; completion does not delete person | Firefox + Chrome | People page and rows                           | NOT EXECUTED |
| FOC-01 Focus Coach            | Open task and conflicting event | Inspect explanation, snooze/defer, start timer twice                                                     | Recommendation explains conflict; one existing timer runs; second start is rejected                                               | Deferral and timer survive reload; event unchanged                         | Firefox + Chrome | Focus explanation/timer evidence               | NOT EXECUTED |
| INB-01 AI Inbox               | Quick Capture available         | Submit English and Persian text, edit classification, accept; reject/restore/undo another                | Local reason/confidence visible; destination opens; undo removes only created destination                                         | Inbox record and destination statuses survive reload                       | Firefox + Chrome | Inbox, destination and console/network log     | NOT EXECUTED |
| WEA-01 Weather & Commute      | No consent or key               | Open Weather, decline/leave consent, then grant with test credential and manual city                     | No network request before consent; clear unavailable state; forecast and refresh timestamp after consent                          | Consent/location/cache are profile scoped; revoke clears credential/cache  | Firefox + Chrome | DevTools network log, consent views, rows      | NOT EXECUTED |
| WEA-02 Commute                | Saved local event/location      | Save commute travel/preparation estimate and reload                                                      | Leave-by is shown as user estimate; event is unchanged                                                                            | Plan persists; deleting event leaves no false event claim                  | Firefox + Chrome | Event/commute screenshots                      | NOT EXECUTED |
| FIN-01 Finance Snapshot       | Finance card added              | Create signed/zero account opening, income, expense, transfer, monthly budget, bill payment and reversal | Selected month totals/budget reflect only that period; balances are lifetime values and currencies stay separate                  | Records survive reload; bill payment stays idempotent                      | Firefox + Chrome | Month screenshots and finance rows             | NOT EXECUTED |
| FIN-02 Finance privacy/export | Two profiles with test records  | Export JSON/CSV, verify spreadsheet-safe fields, delete Finance data for one profile                     | Export contains only selected profile and safe CSV text; confirmation is clear                                                    | Other profile's finance data remains                                       | Firefox + Chrome | Redacted export and before/after rows          | NOT EXECUTED |

## Notification display observation

| ID        | Initial state                              | User action                                              | Expected UI result                                            | Expected persisted data                                                   | Browser                      | Evidence                                                       | Status       |
| --------- | ------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------- | ------------ |
| NOT-OS-01 | Permission granted and a due test reminder | Keep desktop visible until browser requests notification | Notification Center has the due item regardless of API result | Occurrence has native API outcome; `osDisplay` remains unobserved by code | Firefox + Chrome + target OS | Screenshot/video of OS notification or explicit “not observed” | NOT EXECUTED |

## Exit evidence

Mark a browser target ready only after every applicable row has a PASS or a documented non-product BLOCKED result. Keep Firefox and Chrome results separate. A feature is not accepted in a browser merely because it passed in the other browser or in an IndexedDB test.
