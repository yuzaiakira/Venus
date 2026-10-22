# Venus release-readiness record

**Updated:** 2026-10-22
**Candidate baseline:** `b3345e013714e2f1e6402c810ef9cfa882704dac` plus the
uncommitted verification fixes recorded in this change.

## Evidence status

| Gate                                                          | Status                                    | Evidence                                                                                                                                                    |
| ------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data validation, local persistence and service tests          | PASS locally                              | `npm run unit`, `npm run test:integration`                                                                                                                  |
| Historical Dexie upgrade through v15                          | PASS locally                              | `tests/integration/migration.test.ts`, `tests/integration/finance-migration.test.ts`                                                                        |
| Lint, types, formatting, builds, manifest and security checks | Pending this candidate's final validation | Run the commands in [Validation](#validation) after the Firefox and Chrome bundles are built.                                                               |
| Official Firefox extension acceptance                         | BLOCKED                                   | The latest reported run, `39846211068`, recorded zero job steps. It is not browser evidence for this candidate.                                             |
| Secure Chromium extension acceptance                          | BLOCKED                                   | The latest reported run, `39846211068`, recorded zero job steps. Chromium must start with `chromiumSandbox: true`; no `--no-sandbox` fallback is permitted. |
| Operating-system notification display                         | NOT VERIFIED                              | Browser automation may establish extension notification API state only. A visible native operating-system notification needs a separate observation.        |

## Widget acceptance matrix

All entries below use synthetic fixtures only. A build, unit test or IndexedDB
test does not count as browser acceptance.

| Widget / shared flow                                                    | Implementation & automated data tests | Firefox browser                                                     | Chromium browser                                                   |
| ----------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Dashboard foundation: opt-in, singleton, reorder/resize and persistence | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |
| Daily Briefing                                                          | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |
| Quick Capture                                                           | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |
| Habit Tracker and reminder lifecycle                                    | PASS                                  | BLOCKED for current candidate; re-run the official Firefox workflow | BLOCKED for current candidate; re-run the secure Chromium workflow |
| Goals & Progress                                                        | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |
| Knowledge Review                                                        | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |
| People & Follow-ups                                                     | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |
| Focus Coach                                                             | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |
| AI Inbox                                                                | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |
| Weather & Commute                                                       | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |
| Finance Snapshot                                                        | PASS                                  | BLOCKED                                                             | BLOCKED                                                            |

## Browser-runner requirements

The repository workflow at `.github/workflows/p00.yml` is the acceptance
entrypoint. It must first build the target extension, load the actual unpacked
extension into a disposable profile, open the browser's real New Tab URL and
then inspect persisted extension state after a reload/restart.

- **Firefox:** current official Firefox plus matching geckodriver, a disposable
  application copy with `distribution/policies.json`, and an Xvfb display. The
  test must use the real `BrowserCommands.openTab()` New Tab path. It must not
  treat a direct extension-page navigation as acceptance.
- **Chromium:** the executable installed for the repository's exact Playwright
  version, a disposable headed profile under Xvfb, and a verified setuid
  `chrome_sandbox` helper on a runner where the kernel namespace/seccomp
  policy permits Chromium's sandbox. The launch configuration requires
  `chromiumSandbox: true`.
- Both targets need screenshots, console/page errors, trace/log artifacts and
  IndexedDB assertions for persisted state. Screenshots and logs are uploaded
  as `p00-firefox-evidence` and `p00-chrome-evidence` artifacts.

The current browser scripts cover the actual New Tab override and Habit
Reminder persistence. `habit-reminder-firefox.mjs` selects a Settings control
only when it is visible, in the viewport and uncovered; the Chromium workflow
waits for the persisted completed occurrence and one check-in instead of a
locale-specific `completed` label.

## GitHub Actions admission blocker

The owner supplied evidence that run `39846211068` and preceding Finance runs
failed before any job step was recorded. That rules out repository test output
as the cause, but it does not identify a runner-admission cause on its own.
This workspace cannot inspect its check-run annotations: `gh auth status`
reports that its injected `GH_TOKEN` is invalid, and unauthenticated Actions
API access is unavailable here. No workflow YAML change can be justified from
that missing evidence.

**Required owner action:** in GitHub, open the failed run's job summary and
copy its runner-admission/usage message (or provide a scoped, read-only Actions
API credential through the environment, never the repository). Then verify:

1. repository **Settings → Actions → General** permits Actions for the
   repository;
2. the owner/organization **Billing and usage → Actions** has an available
   quota and no disabled payment/usage restriction; and
3. the selected hosted runner labels (`ubuntu-latest`, `ubuntu-24.04`,
   `ubuntu-22.04`) are admitted for the repository.

After that, run the workflow manually on the candidate and retain its job URLs
and artifacts. This separates an account-side admission issue from an
application failure without weakening the browser or security checks.

## Data safety and privacy review

- Dexie v15 is additive. The v14-to-v15 integration fixture retains profile,
  widget, note, task, calendar event/rule/occurrence, habit, goals/reviews,
  people/follow-up/interaction, Focus Coach, Inbox, Weather and commute IDs
  and revisions before creating and reopening a Finance account.
- Finance uses integer minor units, keeps currency summaries separate, has no
  banking/brokerage connection, exports only Finance records for the selected
  profile and requires a confirmation for finance-only deletion.
- CSV serializer prefixes spreadsheet-formula sigils after whitespace,
  control or Unicode-format prefixes. Exported account, category, transaction,
  bill and bill-payment fields use that serializer.
- Weather network, location and optional host permission use remain governed
  by explicit consent. Provider requirements and credential handling are in
  `docs/product/WEATHER_PROVIDER_AND_PRIVACY_DESIGN.md`.

## Distribution prerequisites

This repository does not sign or submit an extension. Before store/beta
distribution, complete Firefox signing/identity checks and the relevant store
metadata, icon, permission and provider-license reviews. The Firefox details
are tracked in `docs/implementation/P00_FIREFOX_SIGNING_PREREQUISITES.md`.

## Validation

Run these commands in order; build both bundles before the security test:

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

Then execute Firefox New Tab/Habit Reminder acceptance and Chromium New
Tab/Habit Reminder acceptance on the supported runner. Follow with the
cross-widget scenarios in the PDR matrix, including English/Persian,
narrow/desktop, keyboard, reduced-motion, profile isolation and persistence
after restart.

## Recommendation

**NO-GO.** The feature implementation and deterministic local data checks are
ready for review, but GitHub Actions has not admitted the current candidate and
the required real Firefox/secure-Chromium cross-widget acceptance has not run.
