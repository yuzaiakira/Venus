# P02 to P03 conditional transition

Date: 2026-10-10.

Status: **P02 has CONDITIONAL OWNER ACCEPTANCE.** It is not an unconditional clean verification PASS. **P00 remains NOT PASS.** **P01 retains CONDITIONAL OWNER ACCEPTANCE.** ADR-001 and ADR-002 remain proposed and unsigned. ADR-010 was later accepted by the owner on 2026-10-10; the sections below record the state at the time of the P02 decision, and the amendment at the end records that later editor decision. The node-forge residual security risk remains open and is not approved. This record does not authorize Phase P03 implementation. It does not authorize Mozilla upload, signing, publication, commit, or push.

## Owner decision

The project owner reviewed `docs/implementation/P02_ACCEPTANCE_REMEDIATION_REPORT.md` and approved conditional acceptance of the completed P02 product functionality. The owner explicitly did not authorize starting P03 implementation.

## What the conditional acceptance covers

Supporting evidence is in `docs/implementation/P02_ACCEPTANCE_REMEDIATION_REPORT.md`, `evidence/P02/results.json`, and `evidence/P02/remediation/`.

- P02 note revision and autosave defects from the independent audit have been remediated. Pin, archive, trash, restore, “Keep my draft,” and “Use stored note” use the revision returned by a successful save.
- Two-tab conflict protection passed in disposable Chromium 153.0.8010.52. Tab B did not replace “From tab A.”
- Notes, tasks, local bookmarks, folders, safe links, Quick Capture, local search, the command palette, and the HTTPS search-provider control have supporting disposable-browser evidence.
- A live Dexie upgrade from schema version 2 (IndexedDB version 20) to schema version 3 (IndexedDB version 30) passed. The database name stayed `Venus-p00`. The seeded P00 probe and the P01 profile, widget, and shared item survived.
- Firefox 155.0.1 smoke and identity commands in `evidence/P02/remediation/smoke-firefox` and `evidence/P02/remediation/identity` exited 0, including `driver.quit()`.

## What this acceptance does not close

| Item | State |
| --- | --- |
| P00 phase acceptance | **NOT PASS** |
| P01 phase acceptance | **CONDITIONAL OWNER ACCEPTANCE**, not a clean PASS |
| P02 phase acceptance | **CONDITIONAL OWNER ACCEPTANCE**, not an unconditional PASS |
| P03 implementation | **Not authorized** |
| Native bookmark permission grant, denial, revoke, and real browser-bookmark CRUD | **NOT VERIFIED** |
| Native notification permission grant, denial, revoke, and OS display | **NOT VERIFIED** |
| Regular Firefox installation, Home consent, and other P00 release gates | **Open** |
| Firefox 140 minimum and hosted CI | **Open** |
| ADR-001, ADR-002, and ADR-010 | **Proposed, unsigned** |
| node-forge residual risk | **Open, not approved** |
| Mozilla upload, signing, or publication | **Not authorized** |
| Settings deletion of a profile that is not the open profile | **PARTIAL** in the browser. The repository test covers an unselected delete. |

Controlled bookmark and notification results, including lines that say `DENIED_OBSERVED` or `GRANT_REVOKE_NOT_RUN`, do not satisfy native P00 permission acceptance.

## Historical failures

Historical reports and failed command results were not rewritten.

- `docs/implementation/P02_INDEPENDENT_ACCEPTANCE_REPORT.md` remains the NO-GO audit.
- `evidence/P02/audit/` keeps the earlier Firefox smoke and identity teardown failures.
- `evidence/P02/remediation/smoke-firefox-geckodriver.log` still contains the earlier sessions in which Firefox Labs stayed enabled. The later sessions in that same log exited 0 after the disposable distribution policy was applied. Both parts stand.

## P03 boundary

P03 implementation waits for a separate explicit owner authorization. When that authorization exists, P03 is limited to `phases/P03_CALENDAR_TIMERS_NOTIFICATIONS.md` and the requirements named there. Implementing a reminder or alarm path does not mark T00.04, native notification display, or native bookmark lifecycle as passed.

## Amendment — 2026-10-10, ADR-010 only

After this transition was written, the owner accepted ADR-010: Venus keeps the restricted JSON note editor. That acceptance does not sign ADR-001 or ADR-002, does not approve the node-forge residual risk, does not accept P00, and does not authorize P03. The table row above that lists ADR-010 as proposed is the historical P02-transition statement. The current editor decision is `docs/implementation/ADR-010-editor-library.md`.
