# Venus repair report

2026-10-20. Baseline: `00071d9351375de20c24f13a2c8eff20ad18f8cf`.

**Status: substantial core repairs implemented; the full requested restoration is incomplete.** Browser interaction, approved-design fidelity and release readiness are not certified. Nothing was committed, pushed, signed or published.

## Fixed and verified at the service/test level

The existing WXT + React + TypeScript + Dexie architecture remains in place. No new dependencies, backend, permissions or CSP exceptions were introduced. The database name and historical versions 1–5 remain intact.

- **Tasks:** additive three-column board model; create/edit/delete, completion/reopen, details, priority, due date, labels, checklists, persisted column/order. Transactions reject stale writers and stale reorder/delete operations. Existing `status: open/done`, task IDs, completion timestamps and Top Three `focusRank` are preserved.
- **Today's priorities:** an independent unlimited `today` selection and order use the same task rows. Completed selected tasks remain present for accurate progress. The UI shares its task editor with the board; it does not duplicate records. Top Three remains separate.
- **Notes:** atomic compare-and-write; persisted ordering; folder moves; pin/archive/trash/restore; persistent local draft recovery. Permanent purge requires trash state. Rich-text editing/formatting preserves list items, checks and individual marks, renders every item, and escapes unsafe text/URLs.
- **Calendar:** event/rule updates are transactional. Recurrence can be disabled. Series edits retain valid future reminders; skipping one occurrence cancels that occurrence. Invalid rule input rolls back the event creation. Concurrent event edits reject stale revisions.
- **Timers/notifications:** one active timer across concurrent services; pause/resume/reset survives database reopening. Notification completion no longer marks a task reminder completed before a task operation succeeds. Reconciliation rereads current records and preserves dismissal during an in-flight native API call. Finished timer state can be displayed.
- **Bookmarks:** atomic edits/deletion and persisted ordering; unsafe native bookmark URLs render inertly. Existing optional permission boundaries remain. Portable snapshot export now downloads a JSON file instead of only storing a snapshot internally.
- **Workspace/search:** concurrent first loads seed one default profile. Palette content search uses persisted records, including Persian/Arabic character normalization, and keeps offline web search unavailable. Invalid timezone writes are rejected.
- **Baseline gates:** corrected the broken TypeScript fixtures, formatting failures and security test's obsolete chunk-name assumption without disabling assertions. All seven existing security tests pass against the generated artifacts.

These results use real Dexie transactions with **fake-indexeddb** and simulated browser ports. Database close/reopen tests are not evidence of real browser restart behavior.

## UI implementation present, browser verification blocked

Implemented in the actual extension components:

- Task board cards, drag/drop handlers, keyboard movement buttons and column selectors; shared task dialog for board/dashboard edits and deletion.
- Dashboard initial schedule loading; Dexie observation of calendar/background changes; selected note/task navigation and actionable search results.
- Note gallery search includes body/tags; reorder controls and recoverable draft choices; visible save/conflict failures.
- Calendar editor hydrates selected data, converts display dates correctly, and exposes event description, zone, minute and recurrence-until fields.
- Countdown/Pomodoro controls, visible action errors, and appropriate pause/resume controls.
- Local bookmark search/folder filtering; selected native bookmark editing/moving with confirmation boundaries.
- Settings section links, mobile Settings access, timezone draft/save input, profile-deletion confirmation.
- Persisted widget coordinates are used; failed drag writes reach the error notice. Responsive editing uses the current viewport column count.
- Native dialogs provide focus containment for task editing and quick capture. The existing cosmic palette, sidebar, hero and glass styling remain; glass opacity, media-preference changes and connectivity changes now update the UI.

None of these UI interactions is reported as browser-passed. Desktop/mobile/RTL screenshots were **not generated** because browser launch failed. Existing div-based dialogs elsewhere, touch dragging, occupied-cell widget reordering and all modal/keyboard paths still require browser review.

## Validation executed

Working directory: `/workspace/Venus`.

| Command | Result |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run unit` | PASS: 49 tests in 7 files |
| `npm run test:integration` | PASS: 43 tests in 7 files |
| `npm run format:check` | PASS |
| `npm run build:firefox` | PASS: `.output/firefox-mv3` |
| `npm run build:chrome` | PASS: `.output/chrome-mv3` |
| `npm run inspect:manifests` | PASS |
| `npm run test:security` | PASS: 7/7 |
| `npm run test:smoke:firefox` | FAIL before application interaction: Firefox binary absent |
| `npm run test:smoke:chrome` | FAIL before application interaction: invalid system sandbox helper ownership |
| `node scripts/repair-browser-acceptance.mjs` | BLOCKED at browser launch; zero feature checks executed |
| `git diff --check` | PASS |

The combined command was:

```sh
P00_EVIDENCE_DIR=evidence/repair/verified npm run p00:verify
```

Its exit status is **1**, because both browser smokes failed. Source hashes and per-command logs are in `evidence/repair/verified/final-results.json`. Earlier runs under `evidence/repair/final` retain the formatting failure that was subsequently fixed; use `verified` for the final non-browser results.

`evidence/repair/browser/results.json` records the blocked UI attempt. The new acceptance script exercises offline production-extension startup, task/checklist/Today synchronization, note CRUD/pin/archive/restore/reload, mobile Settings and RTL, and captures 1440px/390px screenshots **when a supported browser can run**. Its planned steps are not test passes.

Both development servers were restarted successfully:

```sh
npm run dev -- --host 127.0.0.1 --port 3000
npm run preview:ui -- --host 127.0.0.1
```

The ignored `.webextrc` from onboarding disables automatic browser launch. HTTP checks verified actual HTML and transformed JavaScript content, not just status codes. Results: `evidence/repair/server-health.json`. The preview uses a browser API shim and is not extension-runtime evidence.

## Still incomplete or blocked

1. **Approved visual design:** `Venus-UI-Concept-v2.html`, `Venus-UI-Source-v2.zip` and reference screenshots are absent. The linked ChatGPT conversation cannot be opened with this session's tools. The historical gap-analysis document is not a substitute for the source design. Attach the real files before claiming fidelity.
2. **Browser runtime:** Firefox is absent. Official Playwright Firefox downloads were denied with HTTP 403 for `cdn.playwright.dev` and `playwright.download.prss.microsoft.com`. Chromium aborts because its SUID sandbox helper is not root-owned; unprivileged namespace setup also fails on the read-only uid-map mount. No sandbox was disabled. A browser-capable environment is required; allowlisting downloads alone may not resolve the OS restrictions.
3. **Full backup/restore:** P05 is still missing. This repair does not implement full/selective/portable archive backup, import preview/merge/replace, cross-store rollback or data-erasure flows. Plugin package exports and the bookmark snapshot download do not substitute for full backup.
4. **Remaining calendar/product scope:** complete task-reminder creation/association, arbitrary rich recurrence editing and recurring agenda behavior across months still need further implementation/review. Existing calendar engines and tests were preserved; not every PRD acceptance criterion was audited to browser completion.
5. **Real browser gates:** install consent, native permission grant/deny/revoke, Home conflicts/restoration, OS notification display, service-worker suspension, regular-install restart/migration and cross-browser data portability remain unverified.
6. **Plugins:** existing safe renderer/manager code was preserved and its automated tests pass. Owner acceptance, full browser integration and all imported-package lifecycle paths are not certified by this repair.

## Concise change log / paths

- Shell, navigation and design: `src/app/dashboard.tsx`, `src/app/document.ts`, `src/app/widgets.tsx`, `src/app/settings.tsx`, `src/app/capture.tsx`, `src/app/modal.tsx`, `src/design/tokens.css`, `src/locales/messages.ts`.
- Task/note/bookmark UI and services: `src/app/tasks.tsx`, `src/app/library.tsx`, `src/application/productivity.ts`, `src/domain/productivity.ts`, `src/domain/commands.ts`.
- Calendar/lifecycle/workspace: `src/app/calendar-panel.tsx`, `src/app/notification-center.tsx`, `src/application/calendar.ts`, `src/application/workspace.ts`, `src/infrastructure/db.ts`, `src/infrastructure/browser-workspace.ts`, `entrypoints/background.ts`.
- Validation: `tests/integration/repair.test.ts`, `tests/unit/repair.test.ts`, `tests/integration/migration.test.ts`, `tests/integration/calendar-schedule.test.ts`, `tests/integration/workspace.test.ts`, `tests/unit/productivity.test.ts`, `tests/security.test.mjs`, `scripts/repair-browser-acceptance.mjs`, `scripts/smoke-firefox.mjs`, `scripts/smoke-chrome.mjs`.
- Formatting-only baseline fixes: `src/app/icons.tsx`, `scripts/p04-firefox-acceptance.mjs`.
- Reports: `VENUS_REPAIR_AUDIT.md`, this report.

Version 6 adds task-board/today/checklist/label/order fields, note ordering and a `noteDrafts` table. Upgrade tests retain old probes, profiles, widgets, notes, tasks, events and timers. No real user database was reset during the work. The migration has not been tested through an actual installed-extension upgrade. No store publication, signing or fresh-environment restoration is claimed.
