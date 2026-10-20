# 12 — QA Strategy, Acceptance and Traceability

## 12.1 Test layers

1. **Unit:** calendar arithmetic (especially Jalali), recurrence, timer math, URL guards, Zod schema validation, policy decision functions, merge planner, note editor serialize/deserialize.
2. **Repository/integration:** Dexie transactions, schema migrations, concurrent writes, background alarm reconcile, imported plugin quota, ZIP parser with hostile files.
3. **UI/e2e:** onboarding, profile switching, RTL keyboard accessibility, notes CRUD, calendar editor, timers, bookmark permissions, plugin builder, backup restore, Home/New Tab.
4. **Browser-real:** Firefox stable selected target; Chrome MV3 smoke every milestone; OS notification differences documented.
5. **Security regression:** XSS, javascript URLs, archive zip-slip/bombs, invalid plugin capabilities, storage quota, import rollback.
6. **Visual/accessibility:** screenshots light/dark FA/EN, keyboard, a11y automated audit and manual screen-reader spot-check.

## 12.2 Test data fixtures

Use fake notes with Persian/English/mixed language, nested folders, large body, 20 bookmarks with valid/invalid URLs, Jalali new year/month edge, 29/30 Esfand cases, DST gap/fold time zones, recurring future event, overdue reminder, paused timer, plugin package with seven blocks, corrupted file, cross-browser backup. Include fixtures committed without private user data.

## 12.3 P0 / P1 / P2 severity

- **P0:** data loss, executable code injection, unauthorized native bookmark mutation, irreversible import failure, browser unusable/crash on launch.
- **P1:** recurrence inaccurate, duplicate/missing reminders when browser active, unsupported Home behavior claims, broken bilingual major workflow, restore missing major entity.
- **P2:** aesthetic defect, noncritical feature edge, minor layout issue, polishing.

Stop release for any P0 and serious P1; document every P2 with owner/impact/ETA (not invented). Tests must return pass/fail with logs and environment.

## 12.4 Example end-to-end acceptance journey

Fresh Firefox profile, install -> choose FA/Jalali/dark -> add browser bookmark permission (or deny and verify fallback) -> create 2 layout profiles -> add local bookmark -> write note with nested folder/tag -> add repeat Jalali event and 2 alerts -> start 1-minute timer -> close New Tab; on end, check native/internal notices (when browser running) -> reopen, check saved states -> build counter plugin, export, disable, re-import -> export Full -> import into clean profile -> compare normalized datasets. This journey must work without backend.

## 12.5 Release test coverage map

Functional IDs FR-001..FR-103 mapped by feature in `docs/17_TRACEABILITY.md` and `qa/TEST_MATRIX.csv`; edge cases named `CAL`, `NOT`, `TIM`, `PLG`, `BAK`. Every task PR must list affected FR IDs and tests. Use `qa/AGENT_TASK_BACKLOG.csv` to track implementation phases and owner-agent status.

## 12.6 Test execution proof

Required report per phase: exact command, browser version, OS, commit hash, totals pass/fail/skip, screenshots or logs artifact paths, notes about unsupported tests and follow-up issue. No "all tests pass" claims without actual execution. Unit tests not a substitute for real browser feature smoke, especially Home and notifications.

## 12.7 Final UAT / launch checklist

- [ ] Core flows tested in FA and EN, light/dark, RTL/LTR
- [ ] IndexedDB survives restart and update; no silent migration failure
- [ ] Browser bookmark mutation requires user awareness; optional denial fallback
- [ ] Closed-tab timers and reminders work while browser running; full shutdown limitation documented
- [ ] Home behavior demonstrated in supported Firefox config and graceful fallback demonstrated
- [ ] Native notification unavailable -> internal center correct
- [ ] Calendar exceptions, Jalali leap days, DST cases pass
- [ ] Imported malicious plugin rejected; Safe Mode works
- [ ] Full/selective/portable restore and rollback pass
- [ ] P0/P1 issues zero for release, performance budget measured
- [ ] Firefox beta packaging and store disclosures ready; Chrome MV3 build smoke pass
