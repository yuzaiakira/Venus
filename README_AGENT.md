# Venus Workspace — Agent Entry Point

**Document set:** PRD + execution specification, version 1.0 (2026-10-08).  
**Inputs:** User-approved Blueprint v1.1 and decisions made throughout product discovery.  
**Target:** Firefox limited beta first; interoperable Chrome MV3 build and eventual Chrome store release.

## Reading order

1. `docs/00_PRODUCT_CHARTER.md` — non-negotiables, scope, user stories and exit criteria.
2. `docs/01_FUNCTIONAL_REQUIREMENTS.md` — numbered behaviors and edge cases.
3. `docs/02_UX_FLOWS.md` / `docs/10_DESIGN_I18N_A11Y.md` — user journeys, UI states, visual quality.
4. `docs/03_ARCHITECTURE.md` / `docs/04_DATA_MODEL.md` / `docs/05_BROWSER_COMPATIBILITY.md` — implementation interfaces and platform gates.
5. `docs/06_TIME_AND_NOTIFICATIONS.md`, `docs/07_PLUGIN_SYSTEM.md`, `docs/08_BACKUP_RESTORE.md`, `docs/09_SECURITY_THREAT_MODEL.md` — critical engines.
6. `docs/11_NONFUNCTIONAL.md`, `docs/12_QA_ACCEPTANCE.md`, `docs/13_RELEASE_PLAN.md` — gates.
7. `agent/AGENT_MASTER_PROMPT.md`, `agent/DECISION_LOG_TEMPLATE.md`, `phases/`, `qa/` — execution.

## Priority hierarchy

Safety/store compliance > zero silent data loss > cross-browser architecture > approved user functionality > accessibility/performance > visual embellishments. Do not make up browser capabilities. Read official documentation, spike uncertain APIs, record evidence, then implement approved fallbacks.

## Scope constraints

- New Tab dashboard and Home target wherever permitted; never claim a universal runtime Home toggle.
- English/Persian, RTL/LTR, Gregorian/Jalali dates, rich recurrence semantics, and timezone-aware notifications.
- Shared content with independent *layout/appearance* profiles; last-used profile opens next.
- Local-first IndexedDB + extension local settings; no hosted backend, account, telemetry, payment or forced internet.
- User-initiated full, selective, portable Export/Import with safe preview/merge/replace; no automatic backup reminders.
- Safe no-code plugin builder: seven fixed blocks, declarative manifest, no remotely sourced execution.
- Firefox limited beta -> fixing issues -> public Firefox; Chrome compatibility maintained during each phase.

## Delivery artifacts expected from an implementation agent

Working repository; source and reproducible lockfile; tests; generated target manifests; Firefox beta extension artifact; reproducible Chrome MV3 build; architecture decisions; permissions rationale; privacy policy draft; changelog; release checklist; documented platform divergences and known limitations.

## Definition of done

A task is DONE only with code, unit/integration tests, i18n/a11y coverage where applicable, user-visible errors, persisted state tests, a security check, and updated traceability. Do not equate implementation with proven pass; provide test commands/results and build artifacts. Every unresolved platform gate must be reported before shipping.

**No code is included in this PRD ZIP beyond sample interface/schema contracts.** It is not itself a built extension.
