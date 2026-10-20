# P03 implementation plan

Date: 2026-10-10.

Status: **implemented, not accepted.** The owner authorized P03 implementation on 2026-10-10 after this plan was written. That authorization is not phase acceptance. P00 remains NOT PASS. P01 and P02 have conditional owner acceptance only. ADR-001 and ADR-002 are unsigned. ADR-010 remains accepted. ADR-004 is accepted with conditions. ADR-008 is accepted with the amended at-most-once native-attempt policy. The 60-day horizon, the 200-candidate batch cap, and the 90-day or 2,000-row history cap are approved configurable constants. The ADR-004 packages are installed at the approved versions. Phase acceptance is still open. This plan does not change extension ids or authorize Mozilla upload. The decision record is `docs/implementation/P03_ARCHITECTURE_DECISION_REPORT.md`.

Source: `phases/P03_CALENDAR_TIMERS_NOTIFICATIONS.md`, FR-030–FR-048, FR-056 for the Quick Capture event that the phase names, `docs/06_TIME_AND_NOTIFICATIONS.md`, and `docs/04_DATA_MODEL.md` sections 4.2–4.5. FR-055 says task reminders use this shared engine. That is the only task-reminder scope in this plan.

## 1. Task ids and dependencies

P03 depends on P01 and P02. It does not depend on P00 being accepted.

| Task | Scope | Depends on |
| --- | --- | --- |
| T03.01 | Canonical UTC instant, zoned local date-time, and calendar-local date. Jalali and Gregorian arithmetic, formatters, week start, numerals, and timezone. Golden tests for leap years and DST. | P01 preferences for locale, numerals, week start, timezone, and calendar display |
| T03.02 | Gregorian RRULE path and a separate Jalali recurrence generator. Daily, weekly, monthly, and yearly intervals. Weekday, nth weekday, and last weekday. Count and until, mutually exclusive. Exception occurrences. Invalid-day policy `skip` or `last_day`, default skip. | T03.01 |
| T03.03 | Month calendar, day agenda, upcoming widget. Create, edit, and delete timed and all-day events. Recurrence editor stores source basis and timezone. Multiple relative or absolute reminder rules and exceptions. Quick Capture can create an event instead of leaving an unsaved draft. | T03.01, T03.02, P02 capture |
| T03.04 | Reminder rows and occurrence keys, bounded horizon, alarm listener, cold-start rebuild, deterministic reconciliation, idempotent claim and cancellation, missed reminders after shutdown. | T03.02, existing `alarms` permission and background entrypoint |
| T03.05 | In-app center plus native notification when the API accepts it. Upcoming, read, snooze, completed, dismissed, history, quiet hours, and important override. Permission denied stays internal. Click routes to the source when the browser supports it. | T03.04, optional `notifications` permission |
| T03.06 | One active countdown or Pomodoro. Absolute end time. Pause, resume, reset, and overdue after restart. Work, short break, and long break. Next round only if the user opted in. Focus view does not change the stored layout. | T03.01 clock rules, T03.04 reconciliation |
| T03.07 | Failover: tab closed during a timer, browser restarted around a due time, duplicate `onAlarm`, native blocked, permission revoked, DST boundary. Import of recurrence waits for P05. | T03.04, T03.05, T03.06 |

Mandatory scenario ids from `docs/06_TIME_AND_NOTIFICATIONS.md`: CAL-01 through CAL-08, NOT-01 through NOT-04, TIM-01 through TIM-04.

## 2. Proposed implementation order

1. T03.01 domain types and golden tests, with no browser alarm yet.
2. T03.02 recurrence generators. Changing the display calendar must not rewrite a stored rule.
3. T03.04 persistence and claim rules, still without treating a P00 probe as a product reminder.
4. T03.03 event UI and Quick Capture save, writing events and reminder rules before any native alert.
5. T03.05 center and native adapter. The center works when the permission is missing, denied, or revoked.
6. T03.06 timer and Pomodoro on the same clock and reconciliation path.
7. T03.07 disposable-browser failover. A controlled adapter result is labeled as controlled. It does not close T00.04.

## 3. Database migration strategy

Keep the IndexedDB name `Venus-p00`. Add Dexie schema version 4. Do not clear version 1 probes, version 2 profiles, widgets, appearance, or shared items, or version 3 notes, folders, tasks, local bookmarks, or bookmark snapshots.

New stores, matching the data model:

- `events` — title, description, calendar basis, all-day flag, local date and time, IANA zone, recurrence spec, exclusions, overrides, revision
- `reminderRules` — one owner, either `eventId` or `taskId`, relative offset or absolute time, severity, quiet-hours override
- `notificationOccurrences` — unique `idempotencyKey` of `ownerId:ruleId:occurrenceKey:scheduledInstant`, fire time, internal state, native state, snooze time
- `timerSessions` — duration, start, end, elapsed before pause, status, cycle step

Upgrade tests must open a version 1 database, a version 2 database, and a version 3 database, then open version 4 and read the old rows back. A fresh version 4 install is not that test. The background worker must not open the new schema before a migration fixture has seeded the older schema. Derived next instants may be stored. The series definition remains the local date tuple, basis, zone, and rule.

Doc 04 requires a recovery snapshot before an irreversible migration. Adding empty stores is not a wipe. If a later migration rewrites existing rows, stage it and keep the previous rows until the new rows verify.

## 4. Calendar and reminder architecture

Domain code takes an injected clock and returns plain values. Browser alarms and notifications stay behind the existing ports. The application layer does not call `browser` directly.

An event stores its own basis, `gregorian` or `jalali`, and its own IANA zone. Profile display settings format the UI only. All-day values stay on the local calendar date. Timed values store the intended wall time. A spring-forward gap moves to the next valid local time and shows that it was adjusted. A fall-back fold uses the earlier offset unless the user picks otherwise. CAL-05 and CAL-06 lock that behavior before the UI ships.

Gregorian series use a tested RRULE library for rules that RFC 5545 can express, and the original rule plus timezone stay stored. Jalali series use Jalali arithmetic. A Gregorian rule computed from converted instants does not satisfy FR-033. `docs/implementation/ADR-004-calendar-recurrence.md` accepts `jalaali-js@2.0.1`, `rrule-temporal@2.2.8`, and `temporal-polyfill@1.0.5`, with Jalali recurrence kept out of the RRULE library. When this plan was written, the packages were not installed and integration waited for a fresh lockfile audit and a separate implementation authorization. That authorization was later given. The approved packages are now installed, and the lockfile audit is recorded in `docs/implementation/P03_REPORT.md` and `docs/implementation/P03_INDEPENDENT_ACCEPTANCE_REPORT.md`. A failed audit or golden test still stops for a new owner decision.

Occurrence identity is the event id plus the local date, time, and original zone. Edits are `THIS` or `ENTIRE_SERIES`. `THIS_AND_FOLLOWING` is out of scope until it has its own semantics and tests. Count and until cannot both be set. The owner approved a 60-day materialization horizon and a 200-candidate batch cap as configurable constants. A batch that reaches 200 records a resume cursor and continues later. The series definition is never discarded because a batch filled. Those rows are not an endless cache. Distant month views are computed on demand. The cursor and horizon rules are in `docs/implementation/P03_ARCHITECTURE_DECISION_REPORT.md`.

Quick Capture's event action creates a real event draft and saves it through the same validator. It no longer stops at the P02 unsaved message.

## 5. Native notification integration

`storage` and `alarms` are already required. `notifications` is already optional. This plan does not add a host permission or change the manifest.

Schedule order from doc 06:

1. Commit the event and rules.
2. Expand a bounded set of occurrences.
3. Build the idempotency key before scheduling.
4. Write the pending occurrence in IndexedDB.
5. Reconcile `alarms.getAll()` and create or clear only the difference. Prefer one next-due sweep alarm over one platform alarm per occurrence.
6. On `onAlarm`, claim the row in a transaction. A second delivery finds the claim and does not create a second native alert.
7. Call the notifications API only after the claim and only after a persisted `nativeAttempt = started` marker, only when permission is granted, and only outside quiet hours unless that occurrence allows an exception. ADR-008 keeps four facts: internal state, native attempt, API response, and OS display. OS display stays `unobserved`. An accepted API call is not stored as a verified OS popup. If the attempt marker is `started` and the result was never stored, the row is `uncertain` and is not retried automatically. The center keeps the row.
8. On startup, install, and background wake, reconcile again. Items whose fire time passed while the browser was closed become `missed` in the center. Do not emit one native alert per missed row. A fully quit browser is not described as able to raise an on-time OS alert.

Quiet hours use a local start, end, and zone, and wrap midnight. They suppress the native alert. They do not delete the event, the task, or the center row. A quiet-hours backlog does not become a burst of native alerts.

Snooze uses 5, 10, 30 minutes or a valid custom time, with a new attempt suffix on the same occurrence key. Done on an event reminder acknowledges the reminder and leaves the event. Done on a task reminder marks the task complete. History retention of 90 days or 2,000 eligible terminal rows, whichever is reached first, is an approved configurable constant. Eligible rows are dismissed, completed, and cancelled, plus missed rows the user has already opened. Pending, due, scheduled snoozes, and unseen missed rows are not pruned.

A notification click opens the in-app source when the browser callback works. It does not inject a script into a website. If the platform cannot route the click, the center remains the control.

## 6. Browser restart and offline test strategy

Use disposable Firefox and Chromium profiles only. Do not open a personal profile.

| Case | How to test | What a pass means |
| --- | --- | --- |
| Offline | Existing isolated offline profile | Calendar math, local save, and the center do not require a network. No new host request. |
| Tab closed, browser running | Close the Venus tab, leave the browser process up, let a short disposable alarm fire | Internal row reaches due. A native call is recorded only if the permission is actually granted in that disposable profile. |
| Full browser shutdown | Quit the disposable browser before the due time, reopen the same disposable profile | The row is `missed` in the center. The UI states that a closed browser cannot promise an on-time OS alert. |
| Duplicate alarm | Deliver the same alarm name twice in a test | One internal row and at most one native call. |
| Permission denied or revoked | Use the real permission API in a disposable profile when the owner runs that check. Until then, a test double may return denied or revoked and must be labeled as a double. | The center still shows the item. The UI does not say the OS displayed it. |
| Native blocked by the OS | Record the API result separately from OS display | Absence of an OS popup is not converted into `native_shown`. |
| DST | CAL-05 and CAL-06 unit fixtures, then one disposable UI check that the adjusted indicator is visible | Gap moves forward. Fold uses the earlier offset. |
| Timer restart | TIM-01 through TIM-04 | Remaining time comes from `endsAtUTC` and the clock, not from `setInterval`. |

Firefox background is a background script. Chrome is a service worker. Reconciliation runs on install, startup, and alarm, not only while the New Tab page is open. A service-worker wake is not evidence that an OS notification was shown.

## 7. Known risks and blockers

- P00 is not accepted. T00.04 has no owner-verified native notification grant, deny, revoke, icon, click, or restart proof.
- Firefox 140, regular install, Home consent, hosted CI, and the node-forge residual risk stay open.
- ADR-004 and ADR-008 are accepted with the conditions and the amended delivery policy recorded on 2026-10-10. The plan originally recorded that the named packages were not installed and that the lockfile audit was still open. They are now installed at the approved versions. The audit and later acceptance results are in the P03 report and the independent acceptance report. A failed check still stops for a new owner decision instead of a silent library change. Phase acceptance remains open.
- A closed or sleeping browser can deliver late or not at all. The product must say so.
- Chrome service-worker lifetime can delay an alarm until the browser wakes the worker. That is a platform limit, not a missed-row bug, as long as the later reconciliation marks the internal state once.
- Quiet-hour sound and action buttons are platform-dependent. Unsupported controls stay explained, not faked.
- `web-ext` still warns about `innerHTML` assignments and the Android minimum version. Those warnings are not P03 scope, and they are not cleared by this plan.
- The Firefox smoke policy fix uses a disposable application directory. It does not change the user's Firefox. It also does not prove a regular install.

## 8. Acceptance criteria

From the phase checklist:

- CAL-01 through CAL-08, NOT-01 through NOT-04, and TIM-01 through TIM-04 pass deterministically.
- Switching the UI between Jalali and Gregorian does not change the stored recurrence basis.
- A yearly 1 Farvardin series and a last-Thursday Jalali month series produce the expected occurrences.
- Two tabs or two background wakes do not create two internal notifications or two native alerts.
- With the browser running and the Venus tab closed, a due alarm is still processed. After a full shutdown, reopen shows a missed internal item and discloses the limit.
- Quiet hours suppress the native alert, keep the center row, and honor an important override only where the OS allows it.
- A timer restarted with the browser shows the correct remaining or overdue state. An interval on screen is animation only.
- Firefox and Chrome production builds and their smoke commands pass.

A P03 pass does not rewrite a failed historical command, and it does not mark P00 accepted.

## 9. Work that belongs to P00 rather than P03

T00.04 owns the feasibility evidence for permission prompts, grant and revoke, alarms across browser restart, notification icon and callback, bookmark read and write, and background startup. Those checks are still NOT VERIFIED.

P03 builds the product behavior on top of the same permissions. It may record, in a disposable profile, the API's returned state. It must not cite that record as the P00 owner checklist, and it must not cite a controlled adapter as a native grant, denial, revoke, or OS popup.

Native bookmark CRUD remains a P00 gap even though P02 shipped local bookmarks. P03 does not absorb that work.

Regular-install Home and New Tab consent, Firefox 140, hosted CI, ADR-001, ADR-002, and the node-forge disposition also stay in P00.

## 10. Decisions requiring owner approval

- A separate authorization to implement P03. This plan is not that authorization. Acceptance of ADR-004, ADR-008, ADR-010, and the limits is not that authorization.
- The lockfile audit and third-party notices required by ADR-004, before the accepted packages are integrated.
- ADR-001 and ADR-002, which remain unsigned and are unchanged by this plan.
- ADR-010 remains accepted and independent of P03.
- The 60-day horizon, the 200-candidate batch cap, and the 90-day or 2,000-row history cap are approved configurable constants. No further numeric cap is approved.
- Any manifest, permission, CSP, or extension-id change. None is proposed here.
- Mozilla upload, signing, or publication. Not authorized.
