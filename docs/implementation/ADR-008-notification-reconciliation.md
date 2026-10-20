# ADR-008 — Durable notification reconciliation

- **Date:** 2026-10-10
- **Title:** Local-first reminder scheduling for Firefox and Chrome MV3
- **Status:** accepted with the amended delivery policy (owner decision, 2026-10-10). P03 implementation is not authorized.
- **Context/problem:** FR-040 through FR-048 and FR-055 require persisted reminders, alarms while the browser is running, an in-app center, quiet hours, snooze, and honest behavior when the operating system or the browser cannot show a native alert. Doc 06 defines the schedule order and says a fully closed browser cannot guarantee a timely OS notification. The architecture names ADR-008 for that reconciliation and shows a notification port that can return `shown`. That return value is too coarse. An extension can observe an API call. It cannot, in general, observe whether the operating system actually painted a popup. The owner accepted this architecture on 2026-10-10 and replaced the earlier single native retry with the at-most-once rule in the crash section. This file does not implement the scheduler.
- **Browser targets + tested versions:** Firefox MV3 background script and Chrome MV3 service worker, as already selected in the unsigned ADR-001 builds. Firefox 155.0.1 and Chromium 153.0.8010.52 are the local versions used elsewhere in this repository. This ADR does not add a browser run. Native permission grant, denial, revoke, icon, click, and restart remain the open P00 checks in T00.04.

## Four facts that stay separate

| Step | What Venus can know | Stored result |
| --- | --- | --- |
| 1. Internal occurrence becomes due | The scheduler’s clock says `fireAtUTC` has been reached and the row was claimed | `internalStatus = due` |
| 2. Native API attempt | A durable marker is written before `browser.notifications.create`, or the call is deliberately skipped | `nativeAttempt = not_started`, `started`, or `not_attempted` |
| 3. API acceptance or rejection | The promise resolved, or it rejected, or a prior permission check forbade the call | `nativeApiStatus` |
| 4. Operating-system display | Unknown unless some later check verifies it independently | `osDisplay = unobserved` |

`nativeApiStatus = accepted` means the API call was accepted. It does not mean the operating system displayed an alert. The UI and the database must not describe that row as shown on the system. Doc 06’s label `NATIVE_SHOWN` is a diagram name for the native-result branch. Stored rows use `nativeApiStatus` and `osDisplay`. The architecture sketch in section 3.6 that returns `'shown' | 'blocked' | 'failed'` is non-authoritative and is not the implementation contract.

`osDisplay` remains `unobserved` for every row. A future platform signal would need its own ADR before it could mean anything else.

## Delivery guarantee

While the browser process is running, alarms are a best-effort wake-up. Firefox and Chrome may delay an alarm. Chrome documents that it may defer alarms to limit load, and a periodic alarm cannot be requested more often than about once a minute. A service worker that has been stopped can be started by an alarm, and that start can be late. Venus treats a late wake as reconciliation, not as proof that the alert was on time.

A browser that has fully quit has no extension process. Venus does not promise an on-time OS alert in that state. On the next launch, rows whose fire time passed are marked `missed` in the center. They do not each produce a native call. Settings copy has to say this in both languages when the feature is implemented (FR-048).

Sleep, OS battery limits, and a notification permission that the operating system blocks are the same class of limit. The center still shows the internal row.

## Identity

- Occurrence key: `eventOrTaskId + local date + wall time + original IANA zone`. An adjusted gap instant keeps the original wall-time key and a separate `adjustedInstant` flag.
- Idempotency key: `ownerId:ruleId:occurrenceKey:scheduledInstant`.
- Snooze creates a new attempt: the same occurrence key plus `:attempt:<n>`, with its own fire time. Attempt numbers start at 1 for the scheduled reminder and increase by one for each snooze.
- Native notification id, when a call is made, is the idempotency key. A repeated create for that id replaces the browser’s notification record where the platform defines replacement. It is still one attempt, not a second product event.
- One active sweep alarm is named `venus-sweep`. Its `when` is the earliest pending fire time among reminders and the active timer. Venus does not create one platform alarm per occurrence.

## Persistence and the claim

IndexedDB name `Venus-p00`, Dexie schema version 4, as the P03 plan already describes. Occurrence rows live in `notificationOccurrences`. Writes use one Dexie transaction. The claim is compare-and-set inside that transaction:

1. Read the row by idempotency key.
2. If the row is `cancelled`, `completed`, `dismissed`, or `snoozed` onto a later attempt, stop.
3. If `nativeApiStatus` is already `accepted`, `rejected`, `denied`, `unavailable`, or `quiet_suppressed`, stop. This is the duplicate `onAlarm` path (NOT-01, FR-047).
4. If `internalStatus` is `pending` and `fireAtUTC <= now`, set `internalStatus = due`, `claimedAt`, `claimToken`, and `nativeAttempt = not_started`.
5. If `internalStatus` is `due` and `nativeAttempt` is `not_started`, recovery may continue to the attempt marker below. If `nativeAttempt` is `started` and `nativeApiStatus` is still unknown, stop. That row is `uncertain`.
6. Commit the claim before any native call.

Two tabs and two worker wakes serialize on the transaction. The loser sees the winner’s claim and does not call the API.

## State transitions

`internalStatus` and the center’s read flag are different fields. A row can be `due` and unread.

| From | Event | To | Native call |
| --- | --- | --- | --- |
| `pending` | fire time reached and claim commits | `due`, `nativeAttempt = not_started` | not yet |
| `due` | permission missing, denied, or revoked, before the attempt marker | stay `due`; `nativeAttempt = not_attempted`; `nativeApiStatus = denied` or `unavailable`; center visible | no |
| `due` | quiet hours apply and the row has no important override | stay `due`; `nativeAttempt = not_attempted`; `nativeApiStatus = quiet_suppressed`; center visible | no |
| `due` | delivery is allowed and `nativeAttempt` is `not_started` | commit `nativeAttempt = started`, then call the API | yes, once |
| `due` | API promise resolves | `nativeApiStatus = accepted`; `osDisplay = unobserved` | already made |
| `due` | API promise rejects | `nativeApiStatus = rejected`; center visible | already made |
| `due` | attempt marker is `started` and the process died before the result was stored | `nativeApiStatus = uncertain`; `osDisplay = unobserved`; center visible | no automatic retry |
| `pending` | startup finds `fireAtUTC` in the past after a full browser shutdown | `missed`; center visible; no native call | no |
| `due` or `missed` | user marks read | read flag `read` | no |
| `due` or `missed` | dismiss | `dismissed` | clear by id if a call had been accepted |
| `due` or `missed` | done on an event reminder | `completed`; event remains | no |
| `due` or `missed` | done on a task reminder | `completed`; task becomes complete | no |
| `due` or `missed` | snooze 5, 10, 30 minutes or a valid custom time | old row `snoozed`; new attempt `pending` | no immediate native call |
| any open row | series deleted or this occurrence excluded | `cancelled`; future sweep rebuilt | clear only a still-scheduled native id |

History retention is an approved configurable constant: 90 days or 2,000 eligible terminal rows, whichever is reached first. Eligible terminal rows are `dismissed`, `completed`, and `cancelled`. A `missed` row becomes eligible only after the user has opened it. Unseen missed rows stay. `pending`, `due`, and scheduled snoozes are never pruned to meet the cap.

## Requirement check for the amended retry rule

The owner’s at-most-once rule was compared with FR-040, FR-041, FR-042, FR-044, FR-047, FR-048, and doc 06 sections 6.4–6.6 before this ADR was marked accepted.

No conflict requires a stop. FR-040’s pending, fired, missed, dismissed, completed, and snoozed records stay on `internalStatus`. `uncertain` is a native-attempt result beside a still-visible internal row, not a replacement for those records. FR-041 still requires a native call when permission exists, the New Tab is closed, the browser is running, and `nativeAttempt` is `not_started`. The amendment withholds a second automatic call only when a started attempt has no stored result. FR-044 and FR-047, and doc 06’s rule against a native flood after restart, are the requirements this amendment follows. Doc 06’s `NATIVE_SHOWN` label is not stored as confirmed OS display.

## Crash and retry policy

The owner replaced the earlier single automatic retry. The approved policy is conservative at-most-once delivery for any native attempt whose outcome is ambiguous.

1. Persist the occurrence and the claim in one transaction. After that commit, `nativeAttempt` is `not_started`.
2. Persist `nativeAttempt = started` in a second transaction before calling the native API.
3. If a later wake finds the claim and `nativeAttempt = not_started`, the API has definitely not been called. That wake may write `started` and then call the API, unless the browser was fully shut down across the fire time. A full shutdown reconciles the row as `missed` and does not call the API.
4. If a later wake finds `nativeAttempt = started` and no stored API result, set `nativeApiStatus = uncertain`.
5. Do not automatically retry an `uncertain` attempt.
6. The internal center keeps the occurrence.
7. Venus does not claim exactly-once operating-system delivery. `osDisplay` stays `unobserved`.
8. A duplicate `onAlarm` sees `started`, `uncertain`, `accepted`, or `rejected` and does not start another native attempt.
9. After a full browser shutdown, reopening past a due instant marks the occurrence `missed` internally and does not emit a native notification for that row or a burst for the missed set.

Trade-off, stated on purpose: a crash after the attempt marker is written can leave the user without a native alert. The internal occurrence remains. The product prefers that miss over a second automatic native attempt whose first result is unknown. Settings copy discloses closed-browser limits and this crash miss when the feature is implemented (FR-048).

| Window | Row after the crash | Recovery |
| --- | --- | --- |
| Before the claim commits | `pending` | Next sweep or startup claims it. A fire time that passed during a full quit becomes `missed` with no native call. |
| Claim committed, `nativeAttempt = not_started` | `due` | A wake while the browser process never quit may start the one attempt. A full quit before delivery becomes `missed` with no native call. |
| `nativeAttempt = started`, result absent | `due`, then `nativeApiStatus = uncertain` | Center only. No automatic native retry. Do not invent `accepted`. |
| API result committed | `accepted` or `rejected`; `osDisplay = unobserved` | Duplicate alarms do not call the API again. |

## Startup, wake, restart, and duplicate alarms

Reconciliation runs from the background entrypoint on install, browser startup, and `onAlarm`. It also runs after a permission change and after an event or timer edit. The New Tab page is not required.

1. Open the database and read pending rows, the active timer, and `browser.alarms.getAll()`.
2. Move rows whose fire time passed during a quit to `missed`. One internal summary is enough. There is no native call per missed row (NOT-02).
3. Claim due rows that the browser was alive to deliver, using the transaction above.
4. Set `venus-sweep` to the next remaining fire time, or clear it when nothing is pending. Create and clear only that difference.
5. A second `onAlarm` for `venus-sweep` finds the claim and does not create a second native alert.

Firefox records background pages across sessions differently from a Chrome service worker. Both paths use the database as the source of truth. `storage.session` may still distinguish a fresh browser process from a worker wake, as P00 remediation already does for another scheduler. A worker wake is not evidence of an OS popup.

## Quiet hours and permission

Quiet hours store a local start, end, and IANA zone and wrap midnight. The check uses the clock at delivery, in that zone. Suppression writes `quiet_suppressed`, leaves the center row, and does not delete the event or task. When quiet hours end, suppressed rows stay in the center. They are not released as a burst of native alerts (NOT-03).

An important override is the row flag `allowDuringQuietHours`. It permits the native attempt. Sound, buttons, and whether the OS honors an override are platform facts. Unsupported controls are explained in the UI.

Permission is read before any create call.

- Permission missing or not granted: `nativeApiStatus = unavailable`. Center works (NOT-04, FR-044).
- Permission denied or revoked: `nativeApiStatus = denied`. Center works.
- A later grant does not rewrite old rows into `accepted` and does not emit a backlog.

P03 tests may use a labeled test double for denied and revoked results. A double does not close T00.04.

## Timer and Pomodoro

One active timer. `endsAtUTC` and the injected clock are the remaining-time source. `setInterval` is animation only. Pause stores elapsed time and clears the end. Resume writes a new end. The sweep alarm uses the timer end when it is sooner than the next reminder.

| Case | Recovery |
| --- | --- |
| Tab closed, browser running (TIM-01) | Remaining time is `endsAtUTC - now`. |
| Browser restarted after the end (TIM-02) | Status `finished`. The center or timer view shows overrun. A timer alert follows the same claim rules: a full quit across the end becomes a missed internal row with no native call. An attempt marker of `started` with no result becomes `uncertain` and is not retried. |
| Pause and resume (TIM-03) | Remaining time is recomputed from stored elapsed and the new end. |
| Clock jump (TIM-04) | Remaining time is never negative. A forward jump past the end finishes the timer and shows a clock-adjustment warning. A backward jump recomputes from `endsAtUTC` and shows the same warning. Stored end and start are not rewritten to hide the jump. |

Focus view does not change the stored layout.

## Clock, zone, and DST changes

- The event keeps its IANA zone. Changing the profile zone does not move the event.
- A DST gap or fold is resolved when the occurrence instant is calculated, with the doc 06 policy, before `fireAtUTC` is stored.
- If the browser’s zone database changes, the next reconciliation rebuilds future `fireAtUTC` values from the stored wall time and zone. Past terminal rows stay as history.
- A backward or forward system-clock jump uses the same warning rule as TIM-04 for timers and does not native-notify every skipped reminder.

## Owner decision

Accepted on 2026-10-10 with the amended delivery policy above. The IndexedDB scheduler, one next-due sweep alarm, and transactional claims are approved. The earlier one-retry crash rule is withdrawn. The 60-day horizon, the 200-candidate batch cap, and the 90-day or 2,000-row history rule are approved as configurable constants in the decision report. Native permission grant, denial, revoke, and observable OS delivery remain P00 verification gaps.

## Impact on owner-approved FR / privacy / security

No new permission. `alarms` and optional `notifications` stay as they are. No host permission, CSP change, or extension ID change. Notification text is product data in IndexedDB. Diagnostics must not copy note or event bodies into a log.

## Fallback / mitigation

If native notifications are unavailable, the center is the product. The approved uncertain state is the crash outcome. There is no second automatic native attempt behind it.

## Evidence

- Doc 06 sections 6.4–6.8, FR-040–FR-048, and the P00 statement that T00.04 is not verified.
- MDN alarms: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms
- Chrome alarms: https://developer.chrome.com/docs/extensions/reference/api/alarms
- MDN notifications: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/notifications

No new runtime trace was captured for this ADR.

## Approval needed?

Decided by the owner on 2026-10-10, with the amended delivery policy. This acceptance does not authorize P03 implementation, does not sign ADR-001 or ADR-002, does not mark P00 or T00.04 accepted, and does not approve the node-forge residual risk.

## Remaining verification gates

- Disposable-profile tests for duplicate `onAlarm`, full shutdown, quiet hours, and permission denial, after implementation is separately authorized.
- A test double that returns denied or revoked must be labeled as a double.
- T00.04 still owns real permission grant, denial, revoke, icon, click, and observed OS delivery.
