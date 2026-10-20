# P03 architecture decision report

Date: 2026-10-10.

Status: **architecture decisions recorded.** P03 implementation is not authorized. No packages were installed. No application code, extension ID, manifest, permission, or CSP was changed. P00 remains NOT PASS. ADR-001 and ADR-002 remain unsigned. ADR-010 remains accepted. The node-forge residual risk remains unapproved. Nothing was committed, pushed, uploaded, signed, or published.

## 1. Approved library pins

The owner accepted ADR-004 with conditions. The exact versions are:

| Package | Version | License | Role |
| --- | --- | --- | --- |
| `jalaali-js` | 2.0.1 | MIT | Jalali conversion, leap years, month length, Jalali day numbers |
| `rrule-temporal` | 2.2.8 | MIT | Gregorian RFC 5545 expansion only |
| `temporal-polyfill` | 1.0.5 | MIT | The Temporal namespace Venus uses |

`date-fns` stays deferred until a specific requirement justifies it. `rrule@2.8.1` is not approved. RFC 7529 `RSCALE` and `SKIP` are not used.

If a compatibility, security, or correctness check fails, implementation stops and asks for a new owner decision. Another library is not substituted under this decision.

## 2. Temporal interoperability contract

Persisted time is plain data:

- Calendar date: `{ calendar: "jalali" | "gregorian", year, month, day }` with 1-based month and day.
- Wall time: `{ hour, minute, second }` in the event’s IANA zone. All-day events stay on the calendar date.
- Zone: the IANA identifier stored on the event.
- Instant: UTC epoch milliseconds as a number, derived for scheduling. The series definition remains the date tuple, basis, zone, and rule.
- IndexedDB does not store `Date` or `Temporal` objects.

One module imports `temporal-polyfill` and passes that same namespace into `rrule-temporal`. Host `Temporal` and the polyfill are not treated as the same prototypes. Code does not use `instanceof` on those types. A foreign Temporal-like value is read through methods into the plain record, then rebuilt with the Venus namespace if a library call needs an object.

## 3. Jalali and Gregorian recurrence

Jalali series step with `jalaali-js`: day-number addition for daily and weekly rules, and Jalali month or year increments for monthly and yearly rules. A missing day, including 30 Esfand in a common year, uses `invalidDayPolicy` (`skip` by default, or `last_day`). This path does not add Gregorian months.

Gregorian series use `rrule-temporal` for RFC 5545 daily, weekly, monthly, and yearly rules, including interval, weekday, nth and last weekday, count, until, and exclusions.

The event stores its basis and its IANA zone. Display calendar, locale, and numerals do not rewrite them.

`jalaali-js@2.0.1` converts Jalali years `-61` through `3177`. It matches `Intl` Persian for Gregorian 1800 through 2256 and diverges after Gregorian 2256 (Jalali 1634). Venus accepts event dates from Gregorian 1900-01-01 through 2100-12-31, and the Jalali dates that library maps into that window. Arithmetic authority inside the window is `jalaali-js`.

Generation is bounded and resumable. Each series stores a cursor: the last emitted occurrence key and the horizon end it is filling. A batch processes at most 200 candidates, then stops. A later batch resumes from the cursor until the horizon is filled, or until count or until ends the series. Filling a batch does not delete the rest of the series and does not mark the series finished. A calendar view beyond the materialized horizon is computed on demand and is not written as alarms.

## 4. Approved notification state transitions

Four facts stay separate:

| Fact | Stored value |
| --- | --- |
| Internal occurrence | `pending`, `due`, `missed`, `snoozed`, `dismissed`, `completed`, `cancelled` |
| Native attempt | `not_started`, `started`, `not_attempted` |
| Native API response | `accepted`, `rejected`, `denied`, `unavailable`, `quiet_suppressed`, `uncertain` |
| OS display | `unobserved`, unless a future independent verification exists |

`accepted` is not confirmed OS display. `uncertain` is not confirmed OS display. The center read flag is separate from these fields.

Approved transitions:

- Claim at the fire time moves `pending` to `due` with `nativeAttempt = not_started`.
- Missing, denied, or revoked permission, decided before the attempt marker, sets `not_attempted` and `denied` or `unavailable`. The center keeps the row.
- Quiet hours without an important override set `not_attempted` and `quiet_suppressed`. The row stays. Ending quiet hours does not emit a native burst. `allowDuringQuietHours` permits the single attempt.
- When delivery is allowed, Venus commits `nativeAttempt = started` and only then calls the API.
- A resolved promise stores `accepted` and leaves `osDisplay = unobserved`. A rejected promise stores `rejected`.
- Snooze writes the old row `snoozed` and a new `pending` attempt. Done on an event reminder completes the reminder and leaves the event. Done on a task reminder completes the task. Dismiss completes the notification lifecycle without deleting the source.
- A notification click opens the in-app source when the browser callback works. It does not inject a script into a website.
- One sweep alarm, `venus-sweep`, points at the next due reminder or timer end.

## 5. Crash recovery and retry guarantees

1. The occurrence and the claim commit before any native call.
2. The attempt-started marker commits before the native call.
3. A later wake may start the native call when the claim exists and `nativeAttempt` is `not_started`, and the browser was not fully shut down across the fire time.
4. If the attempt marker is `started` and the API result was never stored, the response is `uncertain`.
5. Venus does not automatically retry an `uncertain` attempt.
6. The internal center keeps that occurrence.
7. Venus does not claim exactly-once OS delivery.
8. A duplicate alarm callback does not start another native attempt.
9. A full browser shutdown and a later reopen after the due instant mark the occurrence `missed` internally and do not generate a native burst.

The trade-off is intentional. A crash after the attempt marker can miss the native alert. The internal row remains. Avoiding a second automatic native attempt is preferred over retrying an unknown outcome.

A running browser still gets best-effort alarms, which the platform may delay. A fully quit browser cannot raise an on-time OS alert.

This rule was checked against FR-040, FR-041, FR-042, FR-044, FR-047, FR-048, and doc 06 sections 6.4–6.6. It does not replace the required internal statuses, and it still requires the native call on the normal path when the attempt has not started. The comparison is in ADR-008. The ADR is accepted.

## 6. Approved limits and pruning

Approved configurable constants, not domain invariants:

- Materialization horizon: 60 days, advanced by setting the horizon end to now plus 60 days and resuming from the series cursor.
- Batch size: 200 recurrence candidates per series per batch, with the resume cursor above.
- History: 90 days or 2,000 eligible terminal rows, whichever comes first.

Prune only `dismissed`, `completed`, and `cancelled` rows, oldest first, and `missed` rows the user has already opened. Do not prune `pending`, `due`, scheduled snoozes, or unseen missed notifications. Do not invent another owner-approved cap. A cap on pending notification rows, if one is ever needed, is a new decision.

## 7. Dependency-audit requirements

Before the three packages are added:

- Produce a lockfile for the exact versions and their transitive dependencies, including `temporal-spec` (Apache-2.0) and `temporal-utils` (MIT).
- Run a fresh lockfile-based vulnerability audit and record the result.
- Keep MIT notices and the Apache-2.0 notice for `temporal-spec` in the third-party notice set.
- Stop if the audit or the later correctness tests fail. Do not swap packages inside the implementation.

This report does not claim that audit has been run. The packages are not in the tree.

## 8. Remaining P00 verification gaps

Unchanged, and not closed by a future P03 pass:

- P00 is NOT PASS.
- T00.04 native notification permission grant, denial, revoke, icon, click, and observed OS delivery are NOT VERIFIED.
- Native bookmark grant, denial, revoke, and real browser-bookmark CRUD are NOT VERIFIED.
- Regular-install Home consent, Firefox 140, and hosted CI remain open.
- ADR-001 and ADR-002 remain unsigned.
- The node-forge residual risk remains unapproved.

P03 may later record a disposable-profile API result or a labeled test double. That record is not the P00 checklist. `osDisplay` stays `unobserved` unless a separate verification actually observes the operating system.

## 9. GO / NO-GO for implementation authorization

**GO** to request a separate owner authorization to implement P03.

The library pins, the recurrence split, the scheduler contract, the crash rule, and the three limits are decided. Implementation would still begin with the lockfile audit, would not install anything before that audit is accepted as a recorded result of the authorized work, and would stop on a failed check.

**NO-GO** for starting that implementation now. This report is not the authorization. P03 implementation waits for an explicit owner authorization. P04 does not start.
