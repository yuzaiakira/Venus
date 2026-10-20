# 13 — Delivery, Firefox Beta, Public Release, Chrome Readiness

## 13.1 Product delivery vs store deployment

The implementation agent prepares source, tests, packages and submission materials. Publishing in stores requires owner-controlled developer account, review, terms and possibly fees; the agent must not claim store publication until verified. Product launch sequence fixed: Firefox limited beta -> collect voluntary feedback -> fix P0/P1 -> public Firefox; Chrome release later after browser-specific acceptance.

## 13.2 Phase order

P00 feasibility & baseline; P01 platform UI foundation; P02 productivity; P03 scheduling; P04 plugin system; P05 export/security/integration; P06 beta/release. Full detail in `phases/`. Milestones measured by gates, not calendar date promises.

## 13.3 Firefox limited beta

Choose vetted testers, offer local signed/developer-compatible Firefox beta artifact as allowed by Mozilla distribution rules; provide install/rollback instructions, known limitations and privacy statement. Feedback form/manual contact without injecting third-party analytics. Tester checklist: install, New Tab, Home behavior, profiles, RTL/Jalali, notes, reminders, bookmarks, plugin imports, backup restore, performance.

## 13.4 Store assets and disclosures

Name Venus Workspace (brand clearance pending), localized descriptions, app icon/screenshot assets rights cleared, concise permissions rationale, privacy policy text explaining local data/optional external link clicks, data retention/removal, reminder browser-closed limitation, terms if needed. No misleading statement about Home universal control, timer OS wake-up, complete security or guaranteed cross-browser parity.

## 13.5 Rollout and rollback

Versioned upgrade and migration plan. If beta data migration introduces P0, distribute fixed package and recovery guide, never silently erase data. Reserve schema downgrade/backup instructions before public release. Track local-only compatibility version; old backups remain importable according to published version policy. Document Home override reset path and interference with other extensions.

## 13.6 Chrome readiness gate

Chrome MV3 generated manifest review; service worker lifecycle tests; home override user consent/policy tests; Chrome-specific permissions/notifications/commands; imported plugin policy review, bundle size and reviewability. Do not auto-publish Chrome because Firefox beta passed.

## 13.7 Post-beta decision criteria

Zero P0; P1 resolved or explicitly accepted by owner without compromising data/security; restored sample profile matches counts/content; measurable dashboard speed; tested accessibility and locale; no remote code; full manual backups; reproducible build. Publish a known-limitations document and simple support/bug workflow.
