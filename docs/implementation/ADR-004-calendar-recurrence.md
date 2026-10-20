# ADR-004 — Calendar and recurrence libraries

- **Date:** 2026-10-10
- **Title:** Pinned Jalali arithmetic, Gregorian RRULE, and zoned-time libraries
- **Status:** accepted with conditions (owner decision, 2026-10-10). Packages are not installed. P03 implementation is not authorized.
- **Context/problem:** P03 must implement FR-030 through FR-036 and the calendar rules in `docs/06_TIME_AND_NOTIFICATIONS.md`. Gregorian recurrence and Jalali recurrence are different calculations. A Jalali series such as “1 Farvardin every year” or “the last Thursday of a Jalali month” is defined on Jalali month lengths and leap days. Converting those dates to Gregorian and then stepping with Gregorian months produces different dates. `docs/03_ARCHITECTURE.md` names date-fns, a verified Jalali library, and a tested RRULE library, and it requires an ADR before those libraries are pinned. No calendar package is installed. The owner accepted the pins below on 2026-10-10. This file does not install them and does not authorize P03 implementation.
- **Browser targets + tested versions:** The proposal is for the existing Firefox MV3 and Chrome MV3 extension builds. Local browsers already used in this repository are Firefox 155.0.1 and Chromium 153.0.8010.52. Those versions were not used to execute these libraries. Nothing in this ADR was imported into the extension.

## Options evaluated

Registry metadata below was read from the public npm registry on 2026-10-10. Unpacked size is the published package size, before a bundler drops unused files. Integrity hashes are the registry `dist.integrity` values for those exact versions.

| Package | Version | License | Registry modified | Unpacked size | Role considered |
| --- | --- | --- | --- | --- | --- |
| `jalaali-js` | 2.0.1 | MIT | 2026-08-09 | 108 KB | Jalali conversion, leap years, month length |
| `date-fns-jalali` | 4.4.0-0 | MIT | 2026-05-31 | 4.5 MB | Full date-fns fork on a Jalali calendar |
| `@internationalized/date` | 3.12.4 | Apache-2.0 | 2026-10-08 | 1.2 MB | Multi-calendar arithmetic, including a Persian calendar |
| `moment-jalaali` | 0.10.5 | MIT | 2026-08-09 | 132 KB package, plus `moment` and `moment-timezone` | Jalali wrapper over Moment |
| `persian-date` | 1.1.0 | MIT | 2022-06-23 | 691 KB | Older Persian date package |
| `rrule` | 2.8.1 | BSD-3-Clause | 2023-11-10 | 687 KB | RFC 5545 on JavaScript `Date` |
| `rrule-temporal` | 2.2.8 | MIT | 2026-10-01 | 463 KB | RFC 5545 on Temporal zoned values |
| `temporal-polyfill` | 1.0.5 | MIT | 2026-09-11 | 1.0 MB | Temporal implementation for browsers |
| `date-fns` | 4.4.0 | MIT | 2026-05-29 | 10.9 MB published tree | Named in the architecture for general date helpers |
| `@date-fns/tz` | 1.5.0 | MIT | 2026-05-21 | 101 KB | date-fns time-zone helpers |
| `luxon` | 3.7.2 | MIT | 2025-09-05 | 4.6 MB | IANA zones on its own `DateTime` type |

Direct dependencies that would be pulled in if the recommendation below is later accepted:

- `jalaali-js@2.0.1` has no runtime dependencies. Integrity: `sha512-qzTmjw6lZ3V4znyNA8ceYoGgFR+CcF+xEfIYZNcK2ZR0mzdMpMZ6iAcdRPvMgxUVdPMh6QLWCANpTcCJow2U+Q==`.
- `rrule-temporal@2.2.8` depends on `temporal-spec@^1.0.0`. Integrity: `sha512-+wWUe0J02oMh1UWKIt1RTu2H0Cz+gP11O/iweK0MN2UP6JLGeepTUkbSBa90Hxq0W+ywSxM9IlJNouIUdMOwhg==`.
- `temporal-polyfill@1.0.5` depends on `temporal-spec@1.0.1` (Apache-2.0) and `temporal-utils@1.0.3` (MIT). Integrity: `sha512-+H/mmY74i6wXCMcjIhGuSnODcyZnc4eois2myhOyX0UqRAKNXQY5m9iB1en5jQ/n4SXtjLXo1ElBI5bmn8tZwQ==`.

`temporal-spec@1.0.1` is Apache-2.0. An MIT application may depend on it. If the packages are later bundled, the Apache-2.0 notice has to stay with the third-party notices. That license review is part of implementation, and this proposal does not perform it.

The OSV advisory API was not reachable from this environment. This proposal does not claim a completed vulnerability scan. Before any later install, the lockfile audit has to be run and its result recorded.

### Jalali arithmetic and leap years

`jalaali-js@2.0.1` implements Kazimierz M. Borkowski’s algorithm. Its published types state that the conversion is exact for Jalali years `-61` through `3177`, and that it agrees with `Intl` Persian (`en-US-u-ca-persian`) for Gregorian years 1800 through 2256. After Gregorian 2256 (Jalali 1634) the two leap rules diverge. The published functions include `toJalaali`, `toGregorian`, `isValidJalaaliDate`, `isLeapJalaaliYear`, `jalaaliMonthLength`, `j2d`, and `d2j`. Month length is 31 for months 1–6, 30 for months 7–11, and 29 or 30 in Esfand according to `isLeapJalaaliYear`. That is the leap behavior CAL-01 needs.

The package does not expand recurrences, and it does not resolve IANA time zones. `jalaaliToDateObject` builds a local JavaScript `Date`. The calendar engine must ignore that helper and build zoned instants from the numeric Gregorian conversion plus the event’s IANA zone.

`date-fns-jalali@4.4.0-0` is a large fork, and the version tag is a prerelease. `@internationalized/date@3.12.4` is actively maintained and can add Persian calendar months, but it is Apache-2.0, it depends on `@swc/helpers`, and its Persian calendar follows the internationalization stack rather than the pinned Borkowski algorithm Venus would test. `moment-jalaali` brings Moment and a time-zone database Venus does not need. `persian-date@1.1.0` has had no release since 2022.

### Gregorian RFC 5545

`rrule@2.8.1` is the older JavaScript port. Its own readme says results are floating or UTC `Date` values and tells callers to be careful with offsets. GitHub issue `jkbrzt/rrule` #649, still open as of the 2026-10-10 reading, includes a 2025-07-11 comment that the library is no longer maintained and points readers to `rrule-temporal`. Issue #607 records `EXDATE` values that do not keep the `TZID` offset. Those reports are the reason this proposal does not pin `rrule` for zoned Gregorian series. BSD-3-Clause would otherwise be usable beside MIT.

`rrule-temporal@2.2.8` takes RFC 5545 text or fields and returns `Temporal.ZonedDateTime`. The published feature list includes `FREQ`, `INTERVAL`, `COUNT`, `UNTIL`, `BYDAY` including ordinal and last weekday, `WKST`, `EXDATE`, and a caller-supplied iteration cap. Registry metadata shows a release on 2026-10-01. The library also advertises RFC 7529 `RSCALE` / `SKIP` for non-Gregorian calendars. Venus must not use that feature for Jalali series. Jalali recurrence stays in the separate generator below. The library’s “fully compliant” wording is a publisher claim. Venus accepts the package only after the Gregorian golden tests pass; this proposal does not treat the claim as evidence.

### IANA zones, DST, gaps, and folds

`temporal-polyfill@1.0.5` supplies `Temporal.ZonedDateTime` where the extension runtime must not depend on a partial host `Temporal`. Time-zone data comes from the runtime `Intl` implementation, which Firefox 155 and Chromium 153 both provide. The polyfill does not bundle a private copy of the IANA database. Zone behavior therefore follows the browser’s ICU/CLDR data and can change when the browser updates. Tests must pin the expected offsets for the fixture zones used in CAL-05 and CAL-06, and a browser update that changes historical zone data is a test update, not a silent rewrite of stored events.

Gap and fold policy stays in Venus code, as doc 06 already requires:

- A wall time that falls in a spring-forward gap moves to the next valid local instant, and the occurrence records that it was adjusted.
- A wall time that falls in a fall-back fold uses the earlier offset unless the event stores an explicit user choice.
- All-day values stay on the calendar date. They are not stored as midnight UTC.

`luxon` and `@date-fns/tz` can format zones, but they are extra stacks beside Temporal. This proposal does not add them.

### Separate generators

Stored series keep `basis`, the source local date tuple, the IANA zone, and the original rule. Display calendar never rewrites that basis (CAL-04).

**Jalali generator, Venus-owned, using `jalaali-js` only for calendar facts:**

1. Start from the source Jalali year, month, and day.
2. Step `DAILY` and `WEEKLY` with `j2d` / `d2j` by `interval` days, or by 7 times `interval` for weeks. Weekday filters use the Jalali date’s weekday. “Every 2 Jalali weeks on Saturday” is a 14-day step, not a Gregorian week-of-year rule (CAL-03).
3. Step `MONTHLY` by adding `interval` to the Jalali month and carrying the year. Step `YEARLY` by adding `interval` to the Jalali year. Neither step converts to Gregorian and calls a Gregorian month adder.
4. `monthDay` that does not exist, including 30 Esfand in a common year, follows `invalidDayPolicy`: `skip` omits the occurrence, `last_day` uses `jalaaliMonthLength`. Default is `skip` (CAL-01).
5. “Last Thursday of the Jalali month” walks that Jalali month’s real length and picks the last matching weekday (CAL-02).
6. `count` and `untilLocalDate` are mutually exclusive. Generation stops at the first bound that is set, and also at the batch cap in the limits section.
7. Exclusions match the occurrence key. Overrides replace one key and do not rewrite the series.

**Gregorian generator, `rrule-temporal` only:**

1. Build a Gregorian `DTSTART` with the event zone. Pass only Gregorian `FREQ`, `INTERVAL`, `BYDAY`, `COUNT` or `UNTIL`, and `WKST`.
2. Do not set `RSCALE`. Do not send Jalali dates through this generator.
3. Ask for occurrences inside the bounded horizon. Keep the original rule string and zone in the event record.
4. Resolve each result with the same gap and fold policy. If a library result disagrees with that policy, Venus adjusts the instant and stores the adjusted flag. The library does not become the policy.
5. Apply exclusions and overrides by occurrence key after expansion.

Invalid month days, leap days, exclusions, overrides, count, and until are covered by both generators. An unbounded `between` or `all()` call is forbidden. Each batch has a finite end.

### Offline and extension compatibility

All three recommended packages are local computations. They do not open the network. They do not require a DOM. They can run in a Firefox background script, a Chrome MV3 service worker, and Vitest. `jalaali-js@2.0.1` declares `engines.node >= 20`; the repository already requires Node `>=22`. The browser build uses the ESM entry, not the Node engine field.

### date-fns

The architecture names date-fns. It is not installed, and recurrence does not need it. Formatting can use `Intl` with the locale, calendar, and numeral preferences already stored for the profile. This proposal defers `date-fns@4.4.0`. Adding it later is a separate small decision if a concrete formatter gap appears. Deferring it avoids a second date stack in P03.

### Approved limits

The owner approved these as configurable implementation constants on 2026-10-10. They are not calendar-domain invariants and they are not hard-coded into recurrence mathematics:

- Recurrence materialization horizon: 60 days.
- Maximum recurrence candidates processed per series per batch: 200.
- Notification history retention: 90 days or 2,000 eligible terminal rows, whichever is reached first. Pruning rules are in ADR-008.

A batch that hits 200 candidates records a resume cursor and continues on a later bounded batch. The series definition stays complete. Distant calendar views are computed on demand. Details are in `docs/implementation/P03_ARCHITECTURE_DECISION_REPORT.md`.

## Owner decision

Accepted on 2026-10-10, with the conditions in this section. The earlier “proposed” wording in this file is the evaluation record. It is not the current status.

Exact pins:

- `jalaali-js@2.0.1`
- `rrule-temporal@2.2.8`
- `temporal-polyfill@1.0.5`

Conditions:

1. Jalali recurrence uses Jalali calendar arithmetic through `jalaali-js` month length, leap tests, and Jalali day numbers. It does not add Gregorian months and it does not set RFC 7529 `RSCALE` or `SKIP`.
2. Gregorian recurrence uses RFC 5545 semantics through `rrule-temporal` for daily, weekly, monthly, and yearly rules, including interval, weekday, nth and last weekday, count, until, and exclusions.
3. Each event stores its recurrence basis and its IANA time zone. Profile display calendar, locale, and numerals do not rewrite them.
4. The stable internal temporal representation is the plain record in the next section. IndexedDB does not store `Date` or `Temporal` objects.
5. Native `Temporal` and `temporal-polyfill` are not assumed to share prototypes. Code must not use `instanceof` across those implementations.
6. Implementation tests must cover DST gaps and folds, leap years, invalid dates, exclusions, count/until, and recurrence boundaries. Those tests do not exist yet.
7. The supported Jalali range is the range in the next section, including the published divergence from `Intl` after Gregorian 2256.
8. A fresh lockfile-based dependency and transitive security audit is required before these libraries are integrated. This decision does not install them and does not record that audit.
9. MIT notices, and the Apache-2.0 notice for transitive `temporal-spec`, stay with the third-party notices if the packages are later bundled.
10. If compatibility, security, or correctness checks fail, implementation stops and asks for a new owner decision. Substituting another library is not allowed under this ADR.

`date-fns` stays deferred. Adding it requires a specific requirement and a separate decision.

`rrule@2.8.1`, `date-fns-jalali`, `moment-jalaali`, `luxon`, and `@internationalized/date` are not approved.

## Stable temporal representation

Persisted values are plain data:

| Field | Representation |
| --- | --- |
| Calendar date | `{ calendar: "jalali" or "gregorian", year, month, day }` as integers. Month and day are 1-based. |
| Wall time | `{ hour, minute, second }` in the event zone. All-day events omit the wall time and stay on the calendar date. |
| Zone | IANA time zone identifier string stored on the event. |
| Instant | UTC epoch milliseconds as a number, used only for schedule comparison. It is derived. The series definition remains the date tuple, basis, zone, and rule. |
| Rule | The `RecurrenceSpec` fields from doc 06, including the original basis. A Gregorian series also keeps the RFC 5545 text that was expanded. |

In memory, domain code holds those plain fields. A `Temporal` value is an intermediate calculation result. Before it crosses a persistence or message boundary, Venus reads `epochMilliseconds`, the time zone id, and the calendar year, month, and day through methods, then drops the object.

## Temporal interoperability

One Venus module is the only place that imports `temporal-polyfill`. That module passes the same `Temporal` namespace into `rrule-temporal` through the library’s namespace option, so library outputs and Venus calculations are created by one implementation.

Rules:

- Do not branch on `instanceof` for `ZonedDateTime`, `Instant`, `PlainDate`, or `PlainDateTime`.
- A value that might come from the host’s native `Temporal` is read by method (`epochMilliseconds`, `year`, `month`, `day`, `hour`, `minute`, `second`, `timeZoneId`) into the plain record, then reconstructed with the Venus namespace if a library call needs an object.
- Tests inject the clock and the namespace. They do not depend on whether Firefox or Chromium exposes a global `Temporal`.

## Supported Jalali range

`jalaali-js@2.0.1` converts Jalali years `-61` through `3177` inclusive. Its published types state that this algorithm matches `Intl` Persian (`en-US-u-ca-persian`) for Gregorian years 1800 through 2256, and that the two leap rules diverge after Gregorian 2256 (Jalali 1634).

Venus event validation accepts dates in Gregorian 1900-01-01 through 2100-12-31, and the Jalali dates that `jalaali-js` maps inside that Gregorian window. That product window sits inside both the library’s legal range and the 1800–2256 agreement with `Intl`. Arithmetic uses `jalaali-js`, not `Intl`. A display formatter may use `Intl` inside this window. It must not be treated as a second leap-year authority, and it must not be used to extend the product past Gregorian 2256 without a new decision.

Doc 06’s golden-test span of 1900–2100 is inside this window. Dates outside the product window are rejected at validation.

## Why

The split matches FR-033 and doc 06. `jalaali-js` is small, MIT, dependency-free, and explicit about its leap algorithm and the year it diverges from `Intl`. `rrule-temporal` is the maintained RFC 5545 option that speaks in zoned Temporal values. `temporal-polyfill` is the matching MIT runtime. The rejected packages are larger, less aligned with the leap algorithm, or known to mishandle zoned recurrence.

## Impact on owner-approved FR / privacy / security

No new permission, host access, CSP change, or extension ID. Calendar data stays in IndexedDB. The Apache-2.0 attribution duty for `temporal-spec` applies when the packages are integrated. A wrong leap rule would shift Jalali occurrences. The required control is the golden tests, which remain an implementation gate.

## Fallback / mitigation

There is no silent substitute. If `jalaali-js@2.0.1`, `rrule-temporal@2.2.8`, or `temporal-polyfill@1.0.5` fails the compatibility, security, or correctness checks, implementation stops and the owner decides again. A Venus-owned Gregorian generator is not authorized by this acceptance.

## Evidence

- npm registry metadata and integrity strings collected 2026-10-10, listed above.
- `jalaali-js@2.0.1` type declarations in the published tarball, including the Borkowski range and `jalaaliMonthLength`.
- `rrule@2.8.1` readme and GitHub issues #607 and #649.
- `rrule-temporal@2.2.8` registry readme, including RFC 7529 support that Venus must leave unused for Jalali.
- No unit test, browser run, or bundle-size measurement of these packages exists yet, because they were not installed.

## Approval needed?

Decided by the owner on 2026-10-10, with the conditions above. This acceptance does not install the packages, does not authorize P03 implementation, does not sign ADR-001 or ADR-002, and does not approve the node-forge residual risk.

## Remaining verification gates

- Fresh lockfile audit of these versions and their transitive dependencies, recorded before integration.
- MIT and Apache-2.0 notices preserved in the third-party notice set.
- Golden tests for the condition list, run after implementation is separately authorized.
- No library substitution without a new owner decision.

## References

- `docs/06_TIME_AND_NOTIFICATIONS.md` sections 6.1–6.3 and CAL-01–CAL-08
- `docs/04_DATA_MODEL.md` section 4.3
- `docs/03_ARCHITECTURE.md` sections 3.1 and 3.7
- `phases/P03_CALENDAR_TIMERS_NOTIFICATIONS.md`
- RFC 5545 recurrence: https://www.rfc-editor.org/rfc/rfc5545
- RFC 7529 non-Gregorian recurrence scales: https://www.rfc-editor.org/rfc/rfc7529
- Borkowski, as cited by `jalaali-js`: https://www.astro.uni.torun.pl/~kb/Papers/EMP/PersianC-EMP.htm
- `rrule` maintenance comment: https://github.com/jkbrzt/rrule/issues/649
- `rrule` EXDATE time-zone report: https://github.com/jkbrzt/rrule/issues/607
