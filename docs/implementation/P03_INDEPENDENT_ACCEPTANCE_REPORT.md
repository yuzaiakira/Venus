# P03 independent acceptance report

Date: 2026-10-11.

This audit does not accept P03. It does not accept P00. P01 and P02 stay conditionally accepted. P04 is not authorized and was not started. No extension id, permission, CSP, or Home/New Tab mapping was changed. node-forge was not approved. Nothing was uploaded, signed, committed, or pushed.

## 1. T03.01–T03.07

| Task | Result | Evidence |
| --- | --- | --- |
| T03.01 | Pass | Jalali/Gregorian arithmetic, DST, and product-window tests in `tests/unit/calendar.test.ts`. Unit suite exit 0. |
| T03.02 | Pass | Separate Jalali arithmetic and Gregorian `rrule-temporal` path. Count and until cannot both be set. `fillHorizon` continues after a full batch. |
| T03.03 | Conditional pass | The calendar form can edit a series, edit one generated occurrence, skip one occurrence, set interval, weekdays, nth/last weekday, count or until, invalid-day policy, fold policy, and relative plus absolute reminders. Basis and time zone are kept on series edit. Browser evidence rendered the calendar offline in English LTR and Persian RTL. The occurrence buttons were not clicked in the browser; their behavior is covered by the service tests. |
| T03.04 | Conditional pass | One sweep alarm, claim-before-show, and uncertain recovery. Chromium showed a real alarm after the Venus tab was closed, and a missed row after the browser process was closed. Firefox process restart was not repeated for this scenario. |
| T03.05 | Conditional pass | In-app rows remain when permission is missing or denied. Quiet hours suppress the native call and an important override allows it. `osDisplay` stays `unobserved`. OS popup visibility was not observed. |
| T03.06 | Pass | Countdown, pause, resume, reset, Pomodoro phases, and auto-next only when enabled. Remaining time comes from `endsAtUTC` and elapsed time. Chromium restart marked an overdue timer finished. |
| T03.07 | Conditional pass | Duplicate claim, tab close, Chromium restart, missing permission, DST, and clock warning are tested. Firefox process kill, permission revoke, and observed OS display remain open. |

`THIS_AND_FOLLOWING` stays out of scope. The P03 specification does not require it.

## 2. CAL-01–CAL-08

| Id | Result | How it was checked |
| --- | --- | --- |
| CAL-01 | Pass | Unit golden test. Esfand 30 is skipped or clamped by the selected policy. |
| CAL-02 | Pass | Unit golden test. Last Thursday of a Jalali month. |
| CAL-03 | Pass | Unit golden test. Every two Jalali weeks on Saturday. |
| CAL-04 | Pass | Unit golden test. Yearly Farvardin 1 stays Jalali when viewed through Gregorian conversion. Series save rejects a recurrence basis or zone that differs from the stored event. |
| CAL-05 | Pass | Unit golden test. Spring-forward 02:30 moves forward and is marked adjusted. The calendar shows that adjustment when a listed occurrence was adjusted. |
| CAL-06 | Pass | Unit golden test. The repeated 01:30 uses the earlier offset unless the fold policy says later. |
| CAL-07 | Pass | Integration test. A generated occurrence key is edited, other occurrences keep the series title, and the same keys remain after closing and reopening the database and reconciling. |
| CAL-08 | Pass | Integration test. Deleting the series cancels future pending rows, keeps a completed historical row, removes reminder rules, and does not recreate the event on a later reconcile. |

## 3. NOT-01–NOT-04

| Id | Result | How it was checked |
| --- | --- | --- |
| NOT-01 | Pass | Two overlapping `reconcile(false)` calls on one due row. The native adapter was called once. A second call does not start another automatic attempt. An attempt left `started` with no API result becomes `uncertain` and is not retried. |
| NOT-02 | Conditional pass | A disposable Chromium process was closed before the due instant and the same profile was reopened after it. The row became `missed`, with `nativeAttempt` still `not_started` and no API result. The same case was not run by quitting Firefox. The older injected `browserQuit` flag remains a test double, not this result. |
| NOT-03 | Pass | Integration test at 23:00 UTC with quiet hours 22:00–07:00. The normal row stays due and `quiet_suppressed`. An important override is delivered to the adapter. The internal row is kept in both cases. |
| NOT-04 | Conditional pass | A test double distinguishes `denied` from `missing`. The live browser path cannot. Chromium, with notifications permission never granted, stored `unavailable` and `not_attempted` while keeping the internal row. Never requested, denied, and revoked are not separate live signals. API unsupported was not observed. |

## 4. TIM-01–TIM-04

| Id | Result | How it was checked |
| --- | --- | --- |
| TIM-01 | Pass | A running timer survives without a UI interval. Closing the Venus tab is covered by the persisted `endsAtUTC`. A second start while one timer is active is rejected. |
| TIM-02 | Pass | Injected time reaching `endsAtUTC` finishes the timer. Chromium reopen finished a timer whose end was already past. No second completion row is created. |
| TIM-03 | Pass | Pause stores elapsed time and clears the end. Resume sets a new absolute end from the remaining duration. |
| TIM-04 | Pass | A backward clock sets `clockWarning` and does not produce a negative remaining time. Completion still uses the absolute end. |

Pomodoro auto-next queues a short break only when `autoNext` is true. The fourth work cycle queues a long break. Reset cancels the session.

## 5. Defects corrected

- An occurrence edit also changed the series title and added the occurrence to the exclusion list. A this-occurrence title edit now leaves the series title and the other occurrences unchanged. Skip is a separate action.
- Two concurrent reconciles could both pass the native call after the claim write. The winner is chosen inside the database transaction, and calls in the same worker are serialized. A lost claim does not call the adapter.
- Horizon refill did not run again for an existing series. Reconcile now continues from the stored cursor.
- A 50-pass loop could have looked like a silent cap. It is `reconcileGenerationPasses`. A paused batch keeps the cursor and the next reconcile continues. A test fills four of six daily occurrences, then the rest.
- The timer did not record an abnormal backward clock. It now sets `clockWarning` and clamps remaining time at zero.

## 6. Real-browser evidence

Disposable Chromium profile only. Clock is the browser wall clock. Notifications permission was not requested. `osDisplay` was not observed. Evidence file: `evidence/P03/p03-browser-acceptance.json`.

| Check | Result | Mechanism |
| --- | --- | --- |
| A. Browser stays open, Venus tab closed, due alarm | Pass | Real `chrome.alarms`. The row changed from pending to due while no Venus tab was open. |
| B. Browser process closed before due, same profile reopened | Pass | Chromium process restart. The new row was missed. |
| C. No native burst after restart | Pass | The missed row kept `nativeAttempt: not_started` and a null API result. This is stored state, not an observed OS popup. |
| D. Schedule restored from IndexedDB | Pass | Both rows were still in `Venus-p00` after reopen. |
| E. Center without notification permission | Pass | The due row was `unavailable` / `not_attempted` and remained readable. |
| F. Timer overdue after restart | Pass | The running timer was `finished` from its stored end time. |
| G. Calendar offline, English LTR and Persian RTL | Pass | `dir` was `ltr` then `rtl`, and `navigator.onLine` was false. |

Firefox New Tab, identity, and Chrome New Tab smokes passed. Those smokes do not prove the alarm or restart cases. A Firefox process quit was not run in this audit.

## 7. Idempotency and uncertain delivery

The idempotency key is owner, rule, occurrence, scheduled instant, and attempt. The first reconcile that commits `nativeAttempt: started` is the only one allowed to call the adapter. If that call never records a result, recovery stores `uncertain` and does not retry. Accepted and rejected adapter results are API results. Neither is recorded as OS display.

## 8. Calendar editing and recurrence UI

The month grid and editor expose interval, frequency, weekday checkboxes, nth or last weekday, count or until, invalid-day policy, hour, fold policy, one relative reminder, one absolute reminder, and the important override. Create, save series, edit this occurrence, skip this occurrence, and delete series are separate actions. The stored basis control is disabled while an existing event is selected. Jalali rules are not rewritten as Gregorian rules.

## 9. Timer and Pomodoro

One active running or paused session is enforced. Pause and resume use accumulated elapsed time. Pomodoro uses the work duration, a five-minute short break, and a fifteen-minute long break on every fourth work cycle. Auto-next is off unless the caller enables it. The widget's ticking display is not the source of truth.

## 10. Data migration

Dexie remains version 4 and the database name remains `Venus-p00`. Integration tests open version 1, version 2, and version 3 data and upgrade to version 4 without dropping the earlier notes and profile rows. No new schema version was added. `clockWarning` defaults to false for a timer row that does not have it yet.

## 11. Commands and exits

The first full lint failed before the fixes below. The later lint passed. The first failure is not relabeled.

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` (first run, unused variable and browser globals) | 1 |
| `npm run format:check` | 0 |
| `npm run unit` | 0 (40 tests) |
| `npm run test:integration` | 0 (26 tests) |
| `npm run test:security` | 0 |
| `npm run test:packaging` | 0 |
| `npm run build:firefox` | 0 |
| `npm run build:chrome` | 0 |
| `npm run inspect:manifests` | 0 |
| `P00_EVIDENCE_DIR=evidence/P03 npm run test:smoke:firefox` | 0 |
| `P00_EVIDENCE_DIR=evidence/P03 npm run test:smoke:chrome` | 0 |
| `P00_EVIDENCE_DIR=evidence/P03 npm run test:smoke:identity` | 0 |
| `P00_EVIDENCE_DIR=evidence/P03 node scripts/p03-browser-acceptance.mjs` (first two runs) | 1 |
| `npx web-ext lint --source-dir .output/firefox-mv3` | 0, with 3 warnings |
| `npm run build:firefox:beta` | 0 |
| `npm run build:firefox:release` | 0 |
| `npm run inspect:channels` | 0 |
| `npm audit --omit=dev` | 0 |
| `npm audit` | 1 |
| `npx eslint . --max-warnings 0` after the lint fixes | 0 |
| `P00_EVIDENCE_DIR=evidence/P03 node scripts/p03-browser-acceptance.mjs` after the dialog fix | 0 |

`web-ext lint` reported no errors. It warned that the Firefox for Android minimum version predates support for the data-collection manifest key, and it warned twice about dynamic `innerHTML` in the production bundle. Those warnings were not treated as a pass to change CSP or the manifest. The log is `evidence/P03/remediation-commands.log`.

## 12. Dependencies, licenses, and security

Production audit found 0 vulnerabilities. The full-tree audit still exits 1 on node-forge `GHSA-86w9-cpqp-85rv` through `web-ext` and `@devicefarmer/adbkit`. It is not a production extension dependency. It remains open and is not approved or suppressed.

`jalaali-js@2.0.1` (MIT), `rrule-temporal@2.2.8` (MIT), `temporal-polyfill@1.0.5` (MIT), `temporal-utils` (MIT), and `temporal-spec` (Apache-2.0) stay at the accepted pins. Their notices remain in `THIRD_PARTY_NOTICES.md` and the packaging license copies. Packaging tests compared those license bytes with the installed packages.

The Firefox and Chrome production bundles are 1.21 MB. The `tokens` chunk is 690.99 kB and includes the Temporal polyfill. A safe later optimization is to load that polyfill from the calendar and background entries only, without changing the approved package versions. That split was not made here.

## 13. Outstanding P00 verification

These remain P00 items and were not closed:

- Observed OS notification display, icon, and click.
- A real permission grant, explicit denial, and revocation cycle.
- Home-page install consent.
- The node-forge development-tool finding.

## 14. Remaining P03 gaps

- Firefox was not quit and reopened around a due reminder in this audit. Chromium was.
- Live permission state cannot distinguish never requested, denied, and revoked. The adapter reports `missing` when `permissions.contains` is false.
- No test observed an OS popup. API acceptance is not OS display.
- The new occurrence buttons were exercised through the calendar service, not by a browser click.
- `web-ext` still emits the Android minimum-version warning and two bundled `innerHTML` warnings.
- The Temporal chunk remains large.

## 15. Recommendation

GO to request conditional owner acceptance of P03, limited to the results above.

NO-GO for this audit to accept P03.

NO-GO for accepting P00.

NO-GO for starting P04. P04 needs a separate owner authorization.
