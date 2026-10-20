# P03 implementation report

Date: 2026-10-10.

Phase: P03 only. The owner authorized implementation. This report does not accept P03. P00 remains **NOT PASS**. P01 and P02 remain **CONDITIONAL OWNER ACCEPTANCE**. ADR-001 and ADR-002 remain unsigned. ADR-004, ADR-008, and ADR-010 stay accepted on their recorded terms. The node-forge residual risk remains open and is not approved. Nothing was uploaded, signed, submitted, published, committed, or pushed.

Recommendation: **NO-GO** for treating P03 as accepted. **GO** only as a request for the owner to review this implementation. P04 does not start.

## 1. Task status

| Task | Status | Notes |
| --- | --- | --- |
| Dependency gate | Passed for the new production tree | Production audit exit 0. Full-tree audit exit 1 only for the existing node-forge chain. |
| T03.01 | Implemented | Plain date tuples, epoch milliseconds, Jalali leap and month length, DST gap and fold, product window 1900-01-01 through 2100-12-31. |
| T03.02 | Implemented | Jalali arithmetic stays off Gregorian month addition and off RFC 7529 `RSCALE`. Gregorian daily, weekly, and skip-policy monthly/yearly rules go through `rrule-temporal`. |
| T03.03 | Implemented | Month grid, agenda, upcoming widget, create/delete, basis, frequency, invalid-day policy, one relative reminder, Quick Capture save. |
| T03.04 | Implemented | Dexie version 4 on `Venus-p00`. Sweep alarm `venus-sweep`. Claims, missed-after-quit, uncertain attempt, duplicate protection. P00 probes stay on their own alarm names. |
| T03.05 | Implemented | In-app center with upcoming, open, history, snooze, done, dismiss, read, quiet hours. Native call happens only after `nativeAttempt = started`. `osDisplay` stays `unobserved`. |
| T03.06 | Implemented | One active countdown or Pomodoro. Remaining time uses `endsAtUTC`. Pause, resume, reset, and optional next round. |
| T03.07 | Partial | Quit-browser miss and uncertain-attempt behavior passed with injected doubles in `tests/integration/calendar-schedule.test.ts`. Disposable Firefox and Chromium smokes loaded New Tab. They did not kill the browser around a due reminder, and they are not T00.04 proof. |

## 2. Dependency gate

Lockfile resolution used `npm install --package-lock-only --ignore-scripts` before any install. `node_modules/jalaali-js` was absent at that point. After the audit, install used `npm install --ignore-scripts`.

Exact pins:

| Package | Version | License | Transitive |
| --- | --- | --- | --- |
| `jalaali-js` | 2.0.1 | MIT | none |
| `rrule-temporal` | 2.2.8 | MIT | `temporal-spec@1.0.1` Apache-2.0 |
| `temporal-polyfill` | 1.0.5 | MIT | `temporal-spec@1.0.1` Apache-2.0, `temporal-utils@1.0.3` MIT |

Published unpacked sizes from the earlier registry read: jalaali-js 108 KB, rrule-temporal 463 KB, temporal-polyfill 1.0 MB. The production Firefox build is about 1.20 MB. Vite warned that one chunk is larger than 500 KB. That chunk includes the Temporal polyfill. No package was substituted.

`npm audit --omit=dev` exit **0**, zero production findings.

`npm audit` exit **1**. Four high entries, one advisory: `node-forge` GHSA-86w9-cpqp-85rv via `@devicefarmer/adbkit`, `web-ext`, and `wxt`. Those are development-only. This report does not approve that residual risk.

License texts were copied verbatim into `licenses/` for the five new packages. `temporal-spec` has no NOTICE file. Its Apache-2.0 license is included. Packaging tests compare those files with `node_modules`.

## 3. What was built

Calendar domain lives in `src/domain/time/`. Persisted values are plain records. `src/domain/time/temporal.ts` is the only Temporal import, and that namespace is passed into `rrule-temporal`. Code does not use `instanceof` across Temporal implementations.

Jalali month and year steps use Jalali month indexes and `jalaaliMonthLength`. Daily and weekly steps use civil day counts. Gregorian RFC 5545 expansion uses `rrule-temporal` without `RSCALE`.

Dexie schema version 4 adds `events`, `reminderRules`, `notificationOccurrences`, `timerSessions`, and `quietHours`. Versions 1–3 stores stay. The database name stays `Venus-p00`.

The background listener still delivers P00 probe alarms by probe id. `venus-sweep` is the product reminder and timer alarm. A full-session start reconciles product rows as missed when they are due and the native attempt has not started. A started attempt with no stored API result becomes `uncertain` and is not retried. API acceptance is stored separately from `osDisplay: "unobserved"`.

History pruning removes eligible terminal rows older than 90 days, and it keeps at most 2,000 eligible terminal rows. Pending, due, scheduled snoozes, and unseen missed rows stay.

The materializer loops at most 50 bounded batches and then saves the generation cursor. That pacing bound is not an extra owner-approved cap. A full batch does not delete the series definition.

## 4. Scenario evidence

| Scenario | Evidence | Result |
| --- | --- | --- |
| CAL-01 Esfand 29/30 | `tests/unit/calendar.test.ts` | Passed |
| CAL-02 last Thursday | same file | Passed |
| CAL-03 every 2 Jalali weeks on Saturday | same file, 14-day gap | Passed |
| CAL-04 Farvardin 1 stays Jalali | same file | Passed |
| CAL-05 spring-forward 02:30 America/New_York | same file, adjusted to 03:30 | Passed |
| CAL-06 fall-back 01:30, earlier offset | same file, later policy is a later instant | Passed |
| CAL-07 edit one occurrence | Domain `saveEvent(..., "THIS")` exists. The calendar screen does not yet choose a generated occurrence key, so this scenario is not covered by a UI test. | Partial |
| CAL-08 delete series keeps history | `deleteEvent` cancels pending and due rows and leaves other statuses. Not separately asserted in a test. | Partial |
| NOT-01 duplicate delivery | Integration test: a started attempt with no result becomes `uncertain`; `show` is not called | Passed for the uncertain path |
| NOT-02 browser quit | Integration test with `reconcile(true)` marks missed and does not call `show` | Passed with a double, not a killed browser |
| NOT-03 quiet hours wrap midnight | Unit test of 22:00–07:00 | Passed |
| NOT-04 permission denied | Center remains the record. The live adapter treats `permissions.contains === false` as `missing`, not a distinguished deny. A double can return `denied`. | Partial |
| TIM-01–TIM-04 | Timer math uses `endsAtUTC`. Pause, resume, reset, and auto-next are implemented. Dedicated TIM tests were not added. | Partial |

## 5. Commands

| Command | Exit |
| --- | --- |
| `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` | 0 |
| `npm audit --omit=dev` | 0 |
| `npm audit` | 1, pre-existing node-forge chain only |
| `npm install --ignore-scripts --no-audit --no-fund` | 0 |
| `npx tsc --noEmit` | 0 |
| `npx eslint . --max-warnings 0` | 0 |
| `npx vitest run` | 0, 10 files, 58 tests |
| `node --test tests/security.test.mjs tests/packaging.test.mjs` | 0 |
| `npm run inspect:manifests` | 0 |
| `npm run build:firefox` | 0 |
| `npm run build:chrome` | 0 |
| `P00_EVIDENCE_DIR=evidence/P03 npm run test:smoke:firefox` | 0 |
| `P00_EVIDENCE_DIR=evidence/P03 npm run test:smoke:chrome` | 0 |
| `P00_EVIDENCE_DIR=evidence/P03 npm run test:smoke:identity` | 0 |

Smokes used disposable profiles. They confirm New Tab load. They do not confirm an operating-system popup, a permission grant, or a full browser restart around a due reminder.

## 6. Migration

`tests/integration/migration.test.ts` opens a version 1 database and a version 2 database, then opens version 4 and reads the probe, profile, widget, and shared item back.

`tests/integration/calendar-schedule.test.ts` opens a version 3 database with a note and reads that note back at version 4.

## 7. Remaining defects and blockers

- P00 is not accepted. T00.04 native permission grant, denial, revoke, icon, click, and observed OS display are not verified. P03 tests do not close them.
- ADR-001 and ADR-002 remain unsigned.
- The node-forge development advisory remains unapproved.
- The calendar form does not edit nth-weekday rules, count, until, or a specific occurrence exception. Those rules exist in the domain.
- No automated test kills Firefox or Chromium at a due instant. The missed-row rule is covered by an injected `browserQuit` flag.
- The live permission adapter cannot tell “never asked” from “denied” with `permissions.contains`.
- The Temporal polyfill makes a large bundle chunk.
- Firefox 140, regular-install Home consent, and hosted CI stay open.

## 8. Files

New domain and application code: `src/domain/time/`, `src/application/calendar.ts`, `src/app/calendar-panel.tsx`, `src/app/notification-center.tsx`, `tests/unit/calendar.test.ts`, `tests/integration/calendar-schedule.test.ts`.

Also changed: Dexie schema, background alarm branch, dashboard, capture, widgets, messages, browser ports, `package.json`, `package-lock.json`, `THIRD_PARTY_NOTICES.md`, `licenses/`, packaging checks, and this report.

Extension IDs, permissions, CSP, and Home/New Tab manifest mappings were not changed.
