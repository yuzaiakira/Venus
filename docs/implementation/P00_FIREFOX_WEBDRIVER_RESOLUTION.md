# P00 Firefox WebDriver shutdown resolution

Status: **FIREFOX SMOKE COMMANDS COMPLETE; P00 REMAINS OPEN.** The Marionette shutdown failure was reproduced, traced to a Firefox crash during `driver.quit()`, and fixed in the test harness. Application assertions and teardown are recorded separately. No Mozilla upload, signing, publication, commit, push, P01 work, ADR acceptance, or security-exception approval was done.

## Root cause

`driver.quit()` sends `DELETE /session`, and geckodriver sends Marionette `Marionette:Quit` with `eForceQuit`. On Firefox 155.0.1 that quit crashed the browser:

`AsyncShutdown timeout in quit-application`, condition `RemoteSettingsExperimentLoader: disabling` (`resource://nimbus/lib/RemoteSettingsExperimentLoader.sys.mjs`, `enable`, called from `ExperimentAPI` init).

The smoke test sets `Services.io.offline = true` and keeps the disposable profile offline for the New Tab, Home, and identity checks. Nimbus still starts a Remote Settings update. That update does not finish while offline. The loader's shutdown blocker waits on `finishedUpdating()`. Firefox then aborts the process ("Causing a crash to ensure that we do not leave the user with an unresponsive process"). Geckodriver reports `Failed to decode response from marionette` and HTTP 500. Selenium throws `WebDriverError` from `driver.quit()`.

This is after the application checks. The harness prints `Firefox New Tab smoke passed` and writes `firefox-smoke.json` before `quit()`. The command still exited 1 because the teardown exception was not caught.

It is not caused by Venus application code, storage isolation, or the beta add-on. A standalone WebDriver session that only opens `about:blank` and quits, with no extension and no offline mode, completed. The same quit failure occurred on the existing P00 smoke without the identity hook. The failing geckodriver trace shows `Marionette:Quit`, then the Nimbus shutdown crash, then `Exiting due to channel error`, then geckodriver `Failed to close browser connection`.

Firefox source in the installed `omni.ja` shows `RemoteSettingsExperimentLoader.enable()` returns immediately, and does not register that blocker, when `ExperimentAPI.enabled` is false. That flag is true if Firefox Labs, Nimbus rollouts, or studies are allowed. Studies and rollouts can be turned off with preferences. Firefox Labs is policy-only (`Services.policies.isAllowed("FirefoxLabs")`).

## Fix

`scripts/smoke-firefox.mjs` now writes a disposable `policies.json` and points the Selenium profile at it with `browser.policies.alternatePath`:

- `UserMessaging.FirefoxLabs: false`
- `DisableFirefoxStudies: true`
- `DisableRemoteImprovements: true`

Matching preferences are also set: `app.shield.optoutstudies.enabled`, `nimbus.rollouts.enabled`, and `datareporting.healthreport.uploadEnabled` are false. These apply only to the disposable WebDriver profile. They do not change extension identity, package security rules, or storage isolation.

`driver.quit()` exceptions are still thrown. Teardown is written to `firefox-teardown.json` before any failure is rethrown. A failed quit is not turned into a passing command.

`GECKODRIVER_LOG`, when set, appends geckodriver `-vv` output to that path. It is optional and is not required for a pass.

`scripts/diagnose-firefox-webdriver.mjs` is a standalone launcher. The `bare` scenario starts headless Firefox, opens `about:blank`, and quits without installing Venus. It records assertion and teardown results separately.

## Versions

| Component | Version |
|---|---|
| Firefox | 155.0.1 (`/usr/bin/firefox`) |
| geckodriver | 0.37.1 (`300705c65d1b`, 2026-07-17), `.browser-cache/selenium/geckodriver/linux64/0.37.1/geckodriver` |
| selenium-webdriver | 4.31.0 |
| Node | 24.19.0 |

## Reproduction commands

Historical failing commands, assertions already complete, exit 1 at `driver.quit()`:

- `P00_EVIDENCE_DIR=evidence/P00/beta-identity/browser npm run test:smoke:identity`
- `P00_EVIDENCE_DIR=evidence/P00/beta-identity/firefox-existing npm run test:smoke:firefox`

Logged reproduction of the same failure, before the policy fix:

`GECKODRIVER_LOG=evidence/P00/webdriver-resolution/sequential/run-1-geckodriver.log P00_EVIDENCE_DIR=evidence/P00/webdriver-resolution/sequential/run-1 node scripts/smoke-firefox-identity.mjs`

Exit 1. Trace: `evidence/P00/webdriver-resolution/sequential/run-1-geckodriver.log`. Node log: `sequential/run-1.out`.

Standalone session without Venus:

`P00_EVIDENCE_DIR=evidence/P00/webdriver-resolution/after/standalone P00_WD_SCENARIOS=bare node scripts/diagnose-firefox-webdriver.mjs`

## Logs and evidence

| Evidence | What it shows |
|---|---|
| `evidence/P00/beta-identity/browser/identity-retry-marionette-failure.log` | Prior identity command, assertions printed, quit `WebDriverError` |
| `evidence/P00/beta-identity/firefox-existing/command-failure.log` | Same quit error without the identity hook |
| `evidence/P00/webdriver-resolution/sequential/run-1-geckodriver.log` | Quit stage: `Marionette:Quit`, Nimbus AsyncShutdown crash, geckodriver 500 |
| `evidence/P00/webdriver-resolution/sequential/run-1.out` | Stack at `smoke-firefox.mjs` `driver.quit()` |
| `evidence/P00/webdriver-resolution/diagnose/summary.json` | Bare, chrome-context, offline-restore, and P00-addon sessions quit successfully when not left in the long offline Nimbus state |
| `evidence/P00/webdriver-resolution/after/identity-geckodriver.log` | After the fix: `Browser process stopped: exit status: 0`, `DELETE` session `200 OK` |
| `evidence/P00/webdriver-resolution/after/identity/firefox-teardown.json` | `restore-online` PASS, `driver.quit` PASS |
| `evidence/P00/webdriver-resolution/after/identity/firefox-identity.json` | P00/beta isolation and text-boundary assertions still PASS |
| `evidence/P00/webdriver-resolution/after/firefox/firefox-smoke.json` | P00 fresh offline New Tab and temporary Home still PASS |
| `evidence/P00/webdriver-resolution/after/hashes-before.txt` and `hashes-after.txt` | Package hashes before and after regenerating archives |
| `evidence/P00/webdriver-resolution/after/repro/reproduction.json` | New source archive reproduced byte-for-byte |

Overlapping stress loops were started against the same evidence directory and are not a clean reproduction. They were stopped. Their mixed exits are not used as the before/after result.

## Files changed

- `scripts/smoke-firefox.mjs` — disposable Nimbus policies; separate teardown record; quit errors still fail the command; optional `GECKODRIVER_LOG`
- `scripts/diagnose-firefox-webdriver.mjs` — standalone WebDriver launch/quit without Venus
- `docs/implementation/P00_FIREFOX_WEBDRIVER_RESOLUTION.md` — this report
- Evidence under `evidence/P00/webdriver-resolution/`
- Regenerated `.output-beta/packages/venus-beta-0.0.1-source.zip` and its inventory, because `scripts/` is a source-package input

No application, manifest, database, or extension-bundle source was changed. P00 id `p00@Venus.invalid` and beta UUID `{935006c2-63b4-4e03-b842-11b88571da3b}` are unchanged.

## Before / after

| Command | Before | After |
|---|---|---|
| `npm run test:smoke:firefox` | Assertions PASS, `driver.quit()` `WebDriverError`, exit 1 | Exit 0. Teardown JSON PASS. Repeated twice more, both exit 0 |
| `npm run test:smoke:identity` | Assertions PASS, same quit error, exit 1 | Exit 0. Isolation/HTML assertions PASS. Teardown JSON PASS. Repeated twice more, both exit 0 |
| Standalone bare WebDriver | Not previously recorded | Exit 0. No Venus install. No leftover profile |

After the clean repeats: no `geckodriver` process remained, and no user-owned `/tmp/Venus-firefox-*`, `/tmp/Venus-wd-diag-*`, or `/tmp/rust_mozprofile*` directory remained. The already-running personal Firefox process was not stopped.

## Package hashes

| Archive | Previous SHA-256 | Current SHA-256 | Still valid? |
|---|---|---|---|
| `venus-beta-0.0.1-unsigned.zip` | `7dbf5fbd6615d2262420e09ee883e3317d8fefb0693a6feff376408dc00e7850` | same | **Yes.** Extension bytes were not rebuilt or changed |
| `venus-beta-0.0.1-source.zip` | `d48c9b37799856aede0723891bba201af187ea534dfe372fe612745dc899b6aa` | `ca9df52ba88df3a369ea7fbfee06410f5d7dcfc3401906fcaa75711a3db63b07` | **No.** Harness scripts are source-package inputs |

`npm run test:packaging` exited 0. `VENUS_FIREFOX_CHANNEL=beta node scripts/reproduce-firefox-candidate.mjs` with `P00_EVIDENCE_DIR=evidence/P00/webdriver-resolution/after/repro` exited 0 and reproduced every build file and both ZIP hashes byte-for-byte, including the unchanged unsigned archive and the new source archive.

## Remaining failures and limitations

- Firefox smoke commands now finish successfully on this machine for the recorded sequential runs. That does not certify every future Firefox or geckodriver build. If Nimbus is enabled again in the test profile, the same offline quit crash can return.
- Regular-install Home consent, decline, conflict, disable, and uninstall remain **NOT VERIFIED**. Temporary add-ons are not F01.
- Minimum Firefox 140, hosted CI, ADR sign-off, and the node-forge residual risk are unchanged and not accepted here.
- P00 is not accepted. P01 was not started.

## Recommendation

Stay in P00. Do not upload or sign these archives without a new owner approval of the new source SHA-256. The unsigned extension SHA-256 is unchanged.
