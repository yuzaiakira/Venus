# Venus release-readiness record

**Updated:** 2026-10-23
**Candidate baseline:** `0aa082930f0238a4a84629e8084eef2431035cee` plus the stabilization changes in this review.

## Release decision

**NO-GO.** The local implementation, migration, security, and deterministic data checks are release-reviewable. A public release still requires manual extension acceptance in official Firefox and securely sandboxed Chromium, including narrow RTL layouts and extension-notification API checks. A visible operating-system notification is a separate manual observation.

GitHub Actions is temporarily disabled/deferred by the repository owner for financial reasons and is not part of the current validation workflow.

## Validation environment: ChatGPT Codex Cloud

The current workspace provides Node.js 24.19.0, npm 11.9.0, the checked-out repository, local npm dependencies, TypeScript, Vitest, WXT and the build tools. It does not provide an official Firefox binary. A system Chromium 154.0.8037.57 is present, but the exact Playwright Chromium executable required by the secure extension scripts is absent. The scripts deliberately refuse to fall back to that system binary because it could load Chrome's New Tab page instead of the unpacked Venus extension.

No browser download or sandbox workaround was attempted. Browser acceptance is therefore **NOT EXECUTED** in this environment. In particular, no `--no-sandbox` launch, AppArmor change, or synthetic native-notification claim was used.

| Gate                                             | Status                    | Local evidence                                                                                   |
| ------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------ |
| Lint and TypeScript                              | PASS                       | `npm run lint`, `npm run typecheck`                                                              |
| Unit data/domain tests                           | PASS — 14 files, 71 tests | `npm run unit`                                                                                   |
| IndexedDB integration and cross-widget workflows | PASS — 17 files, 84 tests | `npm run test:integration`                                                                       |
| Formatting, both builds and manifests            | PASS                       | `npm run format:check`, both WXT builds, `npm run inspect:manifests`                             |
| Bundle security regression tests                 | PASS — 10 tests            | `npm run test:security` after both builds                                                        |
| Official Firefox extension acceptance            | BLOCKED (not executed)     | Official Firefox is unavailable in Codex Cloud                                                   |
| Secure Playwright Chromium extension acceptance  | BLOCKED (not executed)     | Required Playwright Chromium executable is unavailable; `chromiumSandbox: true` remains required |
| Operating-system notification display            | NOT VERIFIED              | Requires an observer on the target desktop/OS                                                    |

The complete, reproducible local command order is in [Local validation commands](#local-validation-commands). The manual, browser-specific scenarios and evidence requirements are in [Manual browser acceptance](MANUAL_BROWSER_ACCEPTANCE.md).

## Stabilization review

- Finance monthly income, expenses, budgets and reversal adjustments use the selected transaction month; account balances remain lifetime totals. Opening balances accept zero or signed minor units, while transaction amounts remain strictly positive. CSV exports protect spreadsheet formula sigils after whitespace, control and Unicode-format prefixes.
- Dexie v15 remains additive. Migration fixtures retain historical profile, widget, note, task, calendar, habit, reminder, goal, review, people, focus, Inbox, Weather and commute records before Finance records are created and reopened.
- Habit reminder reconciliation now cancels every invalid future occurrence when a habit's frequency changes, including snoozed descendants. A normal reconciliation retains a still-valid snoozed child rather than cancelling it as an unscheduled duplicate. Habit status rendering receives the user's already-resolved local date so it does not switch state at UTC midnight.
- New cross-widget integration tests use real application services and Dexie: dashboard customization/reopen with captured task, note and event data; goal links, knowledge review and People history; Focus, Inbox undo, Weather consent and Finance persistence. They use deterministic local fixtures and no provider credential or network request.

## Data integrity and privacy review

- Finance, AI Inbox, People, Goals, reviews, Focus and Weather records are profile-scoped where their domain requires it. Finance deletion/export is constrained to the selected profile.
- Weather makes no provider request before explicit network consent. Device location and network consent are separate, cache/credential revocation clears local forecast material, and tests use a local provider double.
- Finance stays manual and local; it has no bank or brokerage connection.
- AI Inbox applies local classification and creates destinations through local services. It does not transmit captured text.
- Reminder completion is idempotent and stores a habit check-in for the occurrence's local date. Existing event/task/follow-up reminder records are retained by additive migrations.
- No additional extension permissions were introduced in this review.

## Widget acceptance matrix

Automated status below means deterministic unit/integration validation. It is not browser or native-notification evidence.

| Widget / flow                                                           | Implementation and automated data validation | Firefox      | Chromium     |
| ----------------------------------------------------------------------- | -------------------------------------------- | ------------ | ------------ |
| Dashboard foundation: opt-in, singleton, reorder/resize and persistence | PASS locally                               | BLOCKED | BLOCKED |
| Daily Briefing and Quick Capture                                        | PASS locally                               | BLOCKED | BLOCKED |
| Habit Tracker and reminder lifecycle                                    | PASS locally                               | BLOCKED | BLOCKED |
| Goals & Progress                                                        | PASS locally                               | BLOCKED | BLOCKED |
| Knowledge Review                                                        | PASS locally                               | BLOCKED | BLOCKED |
| People & Follow-ups                                                     | PASS locally                               | BLOCKED | BLOCKED |
| Focus Coach                                                             | PASS locally                               | BLOCKED | BLOCKED |
| AI Inbox                                                                | PASS locally                               | BLOCKED | BLOCKED |
| Weather & Commute                                                       | PASS locally                               | BLOCKED | BLOCKED |
| Finance Snapshot                                                        | PASS locally                               | BLOCKED | BLOCKED |

## Local validation commands

Dependencies are already present in Codex Cloud. On a fresh checkout, begin with `npm ci`; do not substitute a package-manager lockfile update. Then run:

```bash
npm run lint
npm run typecheck
npm run unit
npm run test:integration
npm run format:check
npm run build:firefox
npm run build:chrome
npm run inspect:manifests
npm run test:security
git diff --check
```

Both extension bundles must exist before the security suite. Test counts and command exit codes from the final local run are recorded in the commit report.

## Distribution prerequisites

This repository does not sign or submit an extension. Before beta or store distribution, complete the manual matrix on a supported desktop, Firefox signing/identity checks and the relevant store metadata, icon, permission and provider-license review. Firefox requirements remain in [P00_FIREFOX_SIGNING_PREREQUISITES.md](implementation/P00_FIREFOX_SIGNING_PREREQUISITES.md).
