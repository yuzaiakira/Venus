# P03 architecture readiness review

Date: 2026-10-10.

Status: **review, updated after the owner decision of 2026-10-10.** P03 implementation is not authorized. ADR-004 is accepted with conditions. ADR-008 is accepted with the amended at-most-once delivery policy. The limits in section 4 are now approved configurable constants. This update does not accept P00. P01 and P02 stay at conditional owner acceptance. ADR-001 and ADR-002 stay unsigned. ADR-010 stays accepted. The node-forge residual risk stays open and unapproved. Nothing was installed, committed, pushed, uploaded, signed, or published. The decision record is `docs/implementation/P03_ARCHITECTURE_DECISION_REPORT.md`.

Sources: `phases/P03_CALENDAR_TIMERS_NOTIFICATIONS.md`, `docs/06_TIME_AND_NOTIFICATIONS.md`, `docs/03_ARCHITECTURE.md`, `docs/04_DATA_MODEL.md`, `docs/implementation/P03_IMPLEMENTATION_PLAN.md`, `docs/implementation/ADR-010-editor-library.md`, `docs/implementation/ADR-004-calendar-recurrence.md`, and `docs/implementation/ADR-008-notification-reconciliation.md`.

## 1. Decisions now settled

| Decision | State |
| --- | --- |
| ADR-010 restricted JSON note editor | **Accepted by the owner on 2026-10-10.** Tiptap is not introduced. A later editor change needs a new decision, a compatibility demonstration, and a tested migration that preserves notes. |
| P01 and P02 | **Conditional owner acceptance.** Unchanged. |
| P00 | **NOT PASS.** Unchanged. |
| ADR-001 and ADR-002 | **Unsigned.** Unchanged. |
| node-forge residual risk | **Open, not approved.** |
| ADR-004 library pins | **Accepted with conditions.** Packages not installed. |
| ADR-008 scheduler | **Accepted with the at-most-once native-attempt amendment.** |
| 60-day horizon, 200-candidate batch, 90-day or 2,000-row history | **Approved configurable constants.** |
| Extension IDs, permissions, CSP, Home and New Tab mappings | **Unchanged by this review.** |

ADR-010 is independent of calendar and notification work. Accepting it does not authorize P03.

## 2. ADR-004 decision

Accepted with conditions. Pins: `jalaali-js@2.0.1`, `rrule-temporal@2.2.8`, `temporal-polyfill@1.0.5`. Jalali recurrence stays on Jalali arithmetic. Gregorian recurrence stays on RFC 5545. `RSCALE` is unused. `date-fns` stays deferred. `rrule@2.8.1` is not approved.

The packages are not installed. Before integration, a fresh lockfile audit and third-party notice check are required. Golden tests for gaps, folds, leap years, invalid dates, exclusions, count/until, and boundaries are required after implementation is authorized. A failed check stops for a new owner decision.

The product date window is Gregorian 1900-01-01 through 2100-12-31, and the Jalali dates `jalaali-js` maps into that window. `jalaali-js` and `Intl` Persian diverge after Gregorian 2256 (Jalali 1634). Arithmetic uses `jalaali-js`. Persisted time is a plain date tuple, wall time, IANA zone, and epoch milliseconds. `instanceof` is not used across native Temporal and the polyfill.

## 3. ADR-008 decision

Accepted with an amended delivery policy. One IndexedDB-backed sweep alarm and transactional claims. Four facts stay separate: internal state, native attempt, API response, and OS display. OS display stays `unobserved`. API acceptance is not confirmed OS display.

The earlier single automatic retry is withdrawn. A `nativeAttempt = started` marker is stored before the API call. Recovery may still start the call when the claim exists and the marker is `not_started`, unless a full browser shutdown has already made the row `missed`. If the marker is `started` and the result is missing, the status is `uncertain`, the center keeps the row, and Venus does not retry automatically. A native alert can be missed across that crash. Duplicate alarm callbacks do not start a second attempt. A full shutdown past the due instant reconciles missed internal rows and does not emit a native burst.

This amendment does not conflict with FR-040, FR-041, FR-042, FR-044, FR-047, FR-048, or doc 06. The comparison is recorded in ADR-008. Native permission grant, denial, revoke, and observed OS delivery remain P00 work.

## 4. Approved limits

The owner approved these numbers on 2026-10-10 as configurable implementation constants. They are not hard-coded calendar-domain invariants. No other numeric cap is approved.

### 60-day generation horizon

A daily series materializes about 60 occurrences. A weekly series materializes about nine. Monthly and yearly series materialize one or two. The stored series definition is the source of later dates, so a yearly Farvardin 1 event still exists after the window moves. The month grid and day agenda may compute the visible month in memory when the user navigates. Only reminder rows inside the horizon are written for alarms.

Sixty days covers the upcoming widget and the next month without storing a year of daily alarms.

A series that runs for years does not grow the table with its age. Each reconcile sets the horizon end to now plus 60 days and resumes from the stored generation cursor. New pending rows inside the new horizon are written. The series definition stays. Count and until still stop the generator. A daily series with no end stays correct because the window slides forward. If the user opens a month beyond the materialized horizon, that view is computed in memory and is not written as alarms until it enters the horizon.

### 200 candidates per series per batch

Inside 60 days, daily-or-slower MVP frequencies stay under 200 occurrences. The cap still matters when a rule is denser than expected or when exclusions are applied after a larger candidate list. The batch stops at 200, stores the last emitted occurrence key and the horizon end it was aiming for, and a later batch resumes there. Reaching 200 does not delete the rest of the series and does not mark the series finished.

Two hundred is a batch size, not a promise that every series has 200 visible dates. For a normal weekly rule the 60-day horizon binds first.

Reminder rules multiply rows: three offsets on 60 occurrences is 180 notification rows for one event. That multiplication is not an extra approved cap. A future cap on pending notification rows needs its own owner decision.

### 90 days or 2,000 terminal history rows

History is the terminal center log, not the pending schedule. At 20 terminal reminders a day, 90 days is about 1,800 rows, near 2,000. A busier installation hits 2,000 first and keeps fewer than 90 days. IndexedDB can hold 2,000 small rows. The user-visible consequence is a shorter history, which Settings states when the feature exists.

Prune only `dismissed`, `completed`, and `cancelled` rows, oldest first, and only `missed` rows the user has already opened. Never prune `pending`, `due`, a snooze that is still scheduled, or an unseen missed notification. A later user-configurable retention control is still out of scope until the owner asks for it. The constants themselves may live in one configuration module so they are not scattered as domain invariants.

## 5. Task and scenario review

| Item | Readiness | What is still open |
| --- | --- | --- |
| T03.01 | Library pins are accepted with conditions. | Lockfile audit before install. Golden leap and DST tests after implementation authorization. |
| T03.02 | Separate generators are specified and the split is approved. | Invalid-day, count/until, exclusion, override, and resume-cursor tests are implementation work. |
| T03.03 | UI scope matches FR-031–FR-035. `THIS_AND_FOLLOWING` stays out of scope. | Depends on T03.01 and T03.02. Quick Capture must save a real event. |
| T03.04 | Claim, sweep alarm, missed-after-quit, and uncertain-attempt rules are accepted in ADR-008. | Schema version 4 migration tests after implementation authorization. |
| T03.05 | Center is the fallback. Native status is split from OS display. Uncertain attempts are not retried. | Real permission behavior remains a P00 gap. |
| T03.06 | Absolute end time and one active timer match doc 06. | Shares the ADR-008 clock, sweep alarm, and uncertain-attempt rule. |
| T03.07 | Failover cases are listed. Import of recurrence waits for P05. | Disposable profiles only. A test double must be labeled and does not close T00.04. |
| CAL-01–CAL-04 | Defined in doc 06 and ADR-004. | Need the Jalali generator and fixtures. |
| CAL-05–CAL-06 | Gap and fold policy is specified. | Need Temporal fixtures. Browser zone data can change with a browser update. |
| CAL-07–CAL-08 | `THIS` versus `ENTIRE_SERIES`, history retained on series delete. | Occurrence-key stability. |
| NOT-01–NOT-04 | Match the ADR-008 claim, missed, quiet-hours, and denied paths. | Native grant/revoke evidence is P00, not a P03 substitute. |
| TIM-01–TIM-04 | Match the absolute clock and clock-jump warning. | Restart behavior must be tested in a disposable profile. |

## 6. Outstanding owner decisions

- Authorize P03 implementation as a separate act. This review is not that authorization.
- ADR-001 and ADR-002 remain unsigned. They block production manifest and Home claims. They do not have to be signed to implement P03, and they must not be changed as a side effect of P03.
- The node-forge residual risk remains unapproved.
- Any library substitution if the ADR-004 audit or golden tests fail. That substitution is not available in advance.
- Any additional numeric cap beyond the three approved constants.

## 7. Blocking dependencies

Implementation is blocked on a separate owner authorization. The lockfile audit is a gate inside that future implementation, before the packages are added. It is not a reason to install them now.

P03 also depends on the conditional P01 and P02 work already in the tree: preferences, IndexedDB `Venus-p00` through schema version 3, and Quick Capture. It does not depend on P00 being accepted. It must not be described as closing P00.

T00.04 is a standing gap: native notification permission grant, denial, revoke, icon, click, and restart are **NOT VERIFIED**. P03 can record a disposable-profile API result or a labeled test double. That record is not the P00 checklist.

## 8. Suggested safe order

After a separate implementation authorization:

1. T03.01 domain types and golden tests, with the accepted packages only.
2. T03.02 Jalali and Gregorian generators. Display calendar changes do not rewrite stored rules.
3. T03.04 schema version 4, claims, and the sweep alarm, without treating any P00 probe as a product reminder.
4. T03.03 event UI and Quick Capture save.
5. T03.05 center first. Native adapter second, with `osDisplay` left `unobserved`.
6. T03.06 timer and Pomodoro on the same clock.
7. T03.07 disposable-browser failover.

Until that separate authorization exists, the safe action is to stop. The lockfile audit is the first implementation step after authorization, and it happens before the packages are added.

## 9. P03 acceptance is separate from P00 native verification

A future P03 pass can show CAL, NOT, and TIM results for product behavior. It can show that a denied or missing permission leaves the center intact. It can show that a quit browser yields a missed internal row.

A future P03 pass cannot:

- mark P00 accepted;
- mark T00.04 verified;
- treat `nativeApiStatus = accepted` as an observed OS popup;
- treat a controlled adapter or a test double as a native grant, denial, revoke, or click;
- close native bookmark CRUD, regular-install Home consent, Firefox 140, hosted CI, ADR-001, ADR-002, or the node-forge residual risk.

## 10. GO / NO-GO

**GO** to request a separate owner authorization to implement P03.

ADR-004, ADR-008, and the three limits are now owner decisions. The remaining work is implementation under those conditions: lockfile audit before install, no silent library substitution, the at-most-once native-attempt rule, and the resumable horizon. That request is not made by this file, and this file does not authorize the work.

**NO-GO** for starting P03, installing dependencies, or treating P00 native notification checks as done.
