# P03 to P04 conditional transition

Date: 2026-10-12.

Status: **P03 has CONDITIONAL OWNER ACCEPTANCE.** It is not unconditional acceptance. **P00 remains NOT PASS.** **P01 and P02 retain CONDITIONAL OWNER ACCEPTANCE.** ADR-004, ADR-008, and ADR-010 remain accepted on the terms already recorded. ADR-001 and ADR-002 remain proposed and unsigned. The node-forge residual risk remains open and is not approved. This record does not authorize Phase P04 implementation. It does not authorize Mozilla upload, signing, publication, commit, or push.

## Owner decision

The project owner reviewed `docs/implementation/P03_REPORT.md`, `docs/implementation/P03_INDEPENDENT_ACCEPTANCE_REPORT.md`, `docs/implementation/P03_ARCHITECTURE_DECISION_REPORT.md`, and the accepted ADR-004, ADR-008, and ADR-010. On 2026-10-12 the owner approved conditional acceptance of the verified P03 implementation and evidence. The owner explicitly did not authorize implementing P04.

## What the conditional acceptance covers

Supporting evidence is in `docs/implementation/P03_INDEPENDENT_ACCEPTANCE_REPORT.md` and `evidence/P03/p03-browser-acceptance.json`. Earlier implementation detail is in `docs/implementation/P03_REPORT.md`. A conditional result below is not an unconditional pass.

- Jalali recurrence uses Jalali arithmetic. Gregorian recurrence uses the accepted RFC 5545 path. Display conversion does not rewrite a stored recurrence basis or IANA time zone.
- CAL-01 through CAL-08 passed the tests recorded in the independent report. That includes one-occurrence edit, stable occurrence identity, series deletion, future-reminder cancellation, and retained history.
- NOT-01 passed: one due occurrence receives at most one automatic native attempt.
- NOT-03 passed: overnight quiet hours suppress the native call, an important override may proceed, and the internal record remains.
- NOT-02 remains conditional. A disposable Chromium process was closed before a due instant and reopened afterward; the row was missed and no native attempt was stored. A Firefox process shutdown and restart around a due reminder was not run.
- NOT-04 remains conditional. A test double distinguishes denied from missing. The live browser, when notification permission was not granted, stored an internal row as unavailable. Never requested, explicit denial, and revocation are not separate live signals.
- TIM-01 through TIM-04 passed. Timer state uses persisted absolute timestamps and accumulated elapsed time. A Chromium restart finished an overdue timer.
- The calendar UI can edit a series, edit one generated occurrence, skip one occurrence, set interval, weekday and nth/last-weekday rules, choose count or until, choose the invalid-day policy, and configure more than one reminder rule.
- Alarm claims are transactional. A started attempt with no stored API result stays uncertain and is not retried. `osDisplay` stays unobserved unless a test actually sees the operating system popup. No such observation is in the P03 evidence.
- The notification center still works when optional notification permission is absent.
- Chromium raised a real `chrome.alarms` callback after the Venus tab was closed and the browser stayed open.
- Disposable Firefox and Chromium New Tab smokes passed, including the Firefox identity smoke. Those smokes do not prove alarm delivery or operating-system notification display.
- IndexedDB remains `Venus-p00` at Dexie version 4. Upgrades from versions 1, 2, and 3 keep earlier rows.

## What this acceptance does not close

| Item | State |
| --- | --- |
| P00 phase acceptance | **NOT PASS** |
| P01 phase acceptance | **CONDITIONAL OWNER ACCEPTANCE** |
| P02 phase acceptance | **CONDITIONAL OWNER ACCEPTANCE** |
| P03 phase acceptance | **CONDITIONAL OWNER ACCEPTANCE**, not unconditional |
| P04 implementation | **Not authorized** |
| Firefox process shutdown and restart around a due reminder | **NOT VERIFIED** |
| Real notification permission grant, explicit denial, and revocation | **NOT VERIFIED** |
| Observed OS notification display, icon, and click | **NOT VERIFIED** |
| Browser click-through of occurrence edit and skip | **NOT VERIFIED** |
| Firefox `web-ext lint` warnings | **Open** |
| Large Temporal bundle chunk | **Open** |
| Native bookmark permission lifecycle from P02 | **NOT VERIFIED** |
| ADR-001 and ADR-002 | **Proposed, unsigned** |
| node-forge residual risk | **Open, not approved** |
| Mozilla upload, signing, or publication | **Not authorized** |

API acceptance is not observed OS display. A fully closed browser cannot guarantee an on-time operating-system alert. ADR-008 remains at-most-once for the native attempt: uncertain delivery is not retried, and the product does not claim exactly-once OS delivery.

## Historical failures

Historical reports and failed command results were not rewritten.

- `docs/implementation/P03_REPORT.md` remains the implementation report that recommended NO-GO for treating P03 as accepted.
- `docs/implementation/P03_INDEPENDENT_ACCEPTANCE_REPORT.md` remains the re-audit. Its own recommendation was only to request owner review. The owner decision in this file is later and does not erase that recommendation.
- `evidence/P03/remediation-commands.log` still records the first ESLint exit 1 and the first two browser-acceptance exits 1. Later exits 0 are appended; they do not replace the failures.
- Earlier P00, P01, and P02 NO-GO reports, audit logs, and conditional transitions stay in place. The P02 transition’s historical statement that ADR-010 was proposed is preserved there; ADR-010’s acceptance is the separate editor record.

## Outstanding P03 obligations

These stay open. P04 work must not mark them passed, delete their evidence, or change notification semantics to make them look closed.

1. Firefox process shutdown and restart around a due reminder.
2. Real native notification grant, denial, and revocation.
3. Actual OS notification display, icon, and click handling.
4. Real-browser interaction with the individual-occurrence edit and skip controls.
5. Remaining Firefox `web-ext lint` warnings: the Android minimum-version notice and two dynamic `innerHTML` warnings in the production bundle.
6. The Temporal `tokens` chunk, measured at 690.99 kB in the P03 production build, and any later split that does not change the accepted ADR-004 libraries.
7. Any other P03 acceptance criterion that has not been demonstrated in an actual browser. New Tab smokes are not those demonstrations.

## P04 boundary

P04 implementation waits for a separate explicit owner authorization. The planning record is `docs/implementation/P04_IMPLEMENTATION_PLAN.md`. When implementation is authorized, it is limited to `phases/P04_SAFE_PLUGIN_PLATFORM.md`, FR-080 through FR-086, and `docs/07_PLUGIN_SYSTEM.md`. A plugin countdown must not schedule native notifications. Plugin storage must not read notes, events, bookmarks, or other plugin namespaces. No imported package may execute JavaScript, WebAssembly, or remote code.
