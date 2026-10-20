# Venus repair audit

Baseline: `00071d9351375de20c24f13a2c8eff20ad18f8cf`, 2026-10-20. Scope: owner's full repair request; existing WXT/React/TypeScript/Dexie application. This authorizes incremental repair and additive task fields while preserving the Top Three contract. No publication is authorized.

## Architecture and evidence

New Tab mounts `DashboardScreen` through `entrypoints/newtab/main.tsx`; options remains a platform-diagnostics page. React component state controls navigation. Application services own content; IndexedDB `Venus-p00` versions 1–5 holds content, profiles and plugin data. Bootstrap uses extension storage.local. `browser-workspace.ts` publishes same-page/BroadcastChannel updates. Domain schemas validate data. Calendar has its own persistent scheduler. Plugins are declarative bundled renderers. No backend is required.

Baseline onboarding executed lint, typecheck, unit/integration, formatting, dual production builds, manifest inspection, security checks and both browser smokes. See `evidence/P00/cloud-setup/`. 47 unit + 27 integration tests and both builds passed; three type errors, seven formatting warnings, one of seven security tests failed. Both browser smokes were blocked by runtime prerequisites.

| Priority | Feature / state | Files / actual failure and cause | Repair / verification |
| --- | --- | --- | --- |
| P0 | Note concurrency / broken guarantee | `application/productivity.ts`: revision read and put are separate transactions; competing writers can both succeed | Atomic compare/write, concurrent real-Dexie regression tests |
| P1 | Initial calendar/timer dashboard / disconnected | `app/dashboard.tsx`: initial effect loads workspace/library only; schedule loads only after subsequent updates | Load all state at mount, refresh calendar changes including background writes; test reload |
| P1 | Task board / missing | `domain/productivity.ts`, `app/library.tsx`: open/done only, no delete, ordering, labels, checklist, three-column board | Additive v6 migration retaining status, completion, IDs and focusRank; shared service/UI tests |
| P1 | Today's priorities / partial | `widgets.tsx`: open-only preview makes completion progress always zero; no edit/delete/reorder controls | Separate unlimited today selection from Top Three; use shared task records and shared editor |
| P1 | Notes editor / partial | `library.tsx`: dashboard click ignores note ID; list search excludes body; no note ordering/folder move UI; block formatting/type conversion collapses lists | Selected-record navigation, body search, persisted ordering, preserve list items/marks; unit/integration coverage |
| P1 | Note conflict/error handling / partial | Unmount launches uncaught save outside queue; save status can repeatedly retry on storage failure; metadata can use stale revision | Serialize saves, explicit retry/conflict handling, do not overwrite newer content |
| P1 | Navigation/search / disconnected | Search hits are plain text; palette web command opens nothing; mobile hides Settings with sidebar footer | Connect hits/commands, maintain mobile Settings access; browser checks where available |
| P1 | Security test / broken assertion | `tests/security.test.mjs`: assumes obsolete tokens-* chunk; actual chunk is browser-workspace-* | Inspect all emitted chunks for codec boundary rather than filename; retain assertions |
| P2 | Type/format gates / broken | `tests/unit/productivity.test.ts`: missing completedAt, invalid bookmark tags/missing sortOrder; formatting seven source/script files | Correct fixtures, run full gates |
| P2 | Bookmarks / partial | Local CRUD/folders exist; quick-link preview ignores persisted order; native editor operates on first node only | Respect persisted order; document native editor limitations unless repaired |
| P2 | Timer/calendar/plugins / implemented | Domain calendar, recurrence, reminder and timer tests exist; plugin builder/manager present | Preserve engines, run existing tests; do not equate mocks with browser evidence |
| P1 | Backup / missing | No full backup service, settings entry, or import state machine exists | Must remain accurately unavailable until bounded archive/schema/rollback/conflict validation is implemented; do not fake success |
| External | Approved visual reference / blocked | HTML/ZIP/screenshots absent. Historical `UI_V2_GAP_ANALYSIS.md` describes prior port but is not the source artifact. Linked conversation unreadable with available tools | Retain existing cosmic tokens/layout; no fidelity claim. Owner must attach original design artifacts |
| External | Real extension runtime / blocked | No Firefox. Firefox smoke hardcodes /usr/lib/firefox layout. Chromium sandbox helper is not root-owned; user namespace setup fails on read-only uid_map | Preserve sandbox; environment runtime provisioning needed for real-browser certification/screenshots |

## Safety boundaries

Preserve extension identifiers, versions 1–5, all existing tables and data. New fields require an additive migration. Do not change permissions/CSP, execute imported code, reset production databases, commit, push or publish. Browser consent, Home takeover, OS notifications and restart behavior require actual browser evidence. Missing references and platform limitations must remain explicit in the repair report.

## Repair follow-up

Implemented changes and final validation are recorded in `VENUS_REPAIR_REPORT.md`. Additional established defects repaired during execution:

- Calendar editor selection did not populate fields; recurrence date conversion could reinterpret a display date in the wrong calendar; recurrence `null` was ignored by a nullish-coalescing expression.
- Series edits cancelled pending projections but materialization skipped those same cancelled keys, losing future reminders.
- Event/rule/timer writes were not atomic; invalid rule input could leave a partial event, and concurrent starts could create two timers.
- Background reconciliation could overwrite a concurrent event edit or revive a notification dismissed during a native API call.
- Concurrent startup loads could seed duplicate default profiles.
- Command palette searched only command labels; note-body hits were disconnected, and arbitrary web-search queries did not expose a web action.
- Mobile hid Settings in the sidebar footer; persisted widget coordinates were ignored in rendering; failed drag promises escaped the synchronous error handler.
- Glass opacity was converted into an opaque background, ignoring the transparency control.
- Browser smoke assertions waited for the initial loading heading instead of the hydrated dashboard. The Firefox runner assumed one system installation directory.

The owner's v2 source remains missing, browser validation remains blocked, and full backup/restore remains unimplemented. These are not marked completed.
