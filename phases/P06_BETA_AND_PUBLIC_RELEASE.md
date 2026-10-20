# P06 — Verification, Limited Firefox Beta and Public Readiness

**Depends:** P00..P05 exit gates. **FR:** 100–103.

## Work packages

**T06.01 — Browser UAT.** Test clean/upgrade/restart Firefox and Chrome dev across OS versions available; Home overrides and precedence, New Tab, permissions denial, OS notifications, clock/locale.

**T06.02 — QA evidence.** Execute all test matrices and release checklist, measure load speed, accessibility audits, visual snapshots FA/EN dark/light, recurrence/backup/plugin adversarial suites. Record test command and results, not assumptions.

**T06.03 — Documentation.** User help in fa/en, keyboard shortcuts, Home activation/reset, closed-browser notification limitation, backup privacy, plugin warnings, troubleshooting, permission explanations, source notices.

**T06.04 — Package.** Build signed/publishable Firefox limited beta artifact subject to AMO account and signing; release notes, migration/rollback plan, privacy statement, store listing assets, support channel. Prepare unsigned Chrome MV3 dev artifact + compatibility evidence.

**T06.05 — Limited beta feedback.** Owner recruits limited users; beta manual feedback opt-in, no tracking. Triage P0/P1, fix and retest regressions. Keep release candidate versioned.

**T06.06 — Public release gate.** Owner approvals, brand/store checks, explicit sign-off on no P0/P1, privacy and performance; publish Firefox through authorized store account. Chrome public release separate later.

## Tests and acceptance

[ ] P0/P1 blockers resolved; real browser manual test evidence.
[ ] Firefox New Tab and Home support/fallback behave truthfully and can be reverted.
[ ] Import/export tested with real user-style data; no data loss on migration.
[ ] No code execution from plugins; dependency and manifest reviews archived.
[ ] Beta testers complete scripted flows; important feedback addressed.
[ ] Firefox public store publishing only reported after confirmed owner action/review.
[ ] Chrome MV3 builds and smoke report exists, with Home divergence acknowledged.

## Final deliverable checklist

Repo + lockfile; unit/integration/e2e tests; `web-ext`/WXT build commands; Firefox signed-compatible package as platform allows; Chrome dev build; generated manifest permissions diff; user manual fa/en; privacy policy and terms if needed; screenshots/icons with licensing; ADRs; changelog; `qa/` reports; release notes; known limitations.
