# P00 implementation and feasibility report

Historical report: current remediation results are in P00_REMEDIATION_REPORT.md and evidence/P00/remediation. The entries below retain their original execution scope and must not be interpreted as results for the modified source.

Updated 2026-10-09 after continuation verification. **P00 remains INCOMPLETE: code/build foundation is verified, but browser lifecycle and security exit gates are open. P01 has not started.** No commit, push, signing or store publication occurred.

## Current results

| Check | Actual result | Evidence |
|---|---|---|
| Lint, strict typecheck, formatting | PASS | evidence/P00/final-*.log |
| Unit tests | PASS: 11 tests | final-unit.log |
| DB/scheduler integration tests | PASS: 6 tests | final-test-integration.log |
| Explicit Firefox MV3 build | PASS | final-build-firefox.log |
| Explicit Chrome MV3 build | PASS | final-build-chrome.log |
| Generated manifest audit | PASS | generated-manifests.json, final-inspect-manifests.log |
| Limited source security checks | PASS | final-test-security.log |
| Fresh isolated npm ci / prepare / typecheck / both builds | PASS | repro-results.json, repro-1..5.log |
| Firefox New Tab and Home | Owner-reported manual PASS in development session | Conversation: New Tab works; Home initially blank, subsequently owner confirmed OK |
| Automated Firefox smoke | PASS: Firefox 155.0.1, temporary developer install | final-test-smoke-firefox.log, firefox-smoke.json, firefox-newtab.png |
| Chrome-target installed-extension smoke | PASS: system Chromium 153.0.8010.52, isolated unpacked MV3 | final-test-smoke-chrome.log, chrome-smoke.json, chrome-newtab.png |
| Real permission/OS notification/restart/consent/conflict tests | NOT RUN | P00_BROWSER_CHECKLIST.md |
| Dependency security | OPEN: latest successful audit reports 9 affected packages | audit-current.json |
| Original PRD integrity | FAIL: 16 of 40 baseline checksums differ; no PRD files edited in this continuation | prd-checksums.log, checksum-analysis.json |

The fresh-install test used a separate temporary directory, exact package-lock.json and local npm cache with `npm ci --offline --ignore-scripts`. WXT prepare, strict TypeScript and both production builds then succeeded from that fresh installation. Dependency lifecycle scripts were not approved or tested. The offline npm output's “found 0 vulnerabilities” is **not** security evidence: the real online audit reports 9 findings.

## Tasks and traceability

| Phase task | Backlog IDs | Implemented | Remaining for DONE |
|---|---|---|---|
| T00.01 | T-001/002 | WXT/React/strict TS, exact lockfile, lint/formatter, Vitest/Playwright/Selenium, target scripts, README, LICENSE/THIRD_PARTY_NOTICES placeholders | Pending full phase gate; placeholders are not distribution clearance |
| T00.02 | T-003 | Explicit MV3 builds, generated manifests, manifest auditor, dual CI jobs, ADR-001 | Firefox policy/runtime coverage and ADR sign-off |
| T00.03 | T-004/005/006 | Shared bundled page, Firefox Home declaration, truthful browser guidance; owner New Tab/Home confirmation | Regular installation consent, precedence, browser controls, uninstall restoration; Chrome runtime/manual fallback |
| T00.04 | T-007 | Permission controls, confirmed synthetic bookmark CRUD, notification icon/callback, persistent alarm probe; real API smoke code | Real grant/revoke and OS/restart evidence |
| T00.05 | T-008/009 | Validated DB schema, ports/errors/events, injectable scheduler, atomic claim/recovery, bounded code/time diagnostic, synthetic fixtures | Dependency security review remains open |
| T00.06 | T-010 | Unified verify runner, browser setup with three retries, explicit prerequisite failures, CI build/smoke matrix | Actual CI execution and manual lifecycle checks |

No task is represented as fully DONE while its required evidence is missing. FR links: FR-001/002/006/041/061/096/102/103; supporting partial foundation for FR-003/042/044/047/048/062/100. AT-01 has owner development evidence; AT-02 has owner Home rendering evidence only. AT-03/04/16–18/24/26/27/39 remain partially or wholly pending. Original QA CSV statuses are preserved; mock/API-double tests are never substituted for real browser tests.

## Architecture and implemented behavior

- WXT + React + strict TypeScript, application services between UI and adapters; deterministic domain contracts.
- Shared extension-owned New Tab/options shell, bundled scripts/styles/icon; no remote runtime resources.
- Firefox candidate MV3 uses background scripts; Chrome MV3 uses a service worker. Explicit flags prevent default-version drift. Firefox Home references the verified bundled newtab.html path.
- Required storage/alarms; optional bookmarks/notifications requested by user click. No host permissions, content scripts, history access, remote execution, telemetry or automatic backups.
- Isolated Venus-p00 IndexedDB schema version 1 stores synthetic alarm probes. Durable state is persisted before alarm projection; reconstruction runs on install/startup/background load/permission changes/message.
- Atomic claim suppresses duplicate native attempts. Startup recovery also uses a transaction and cannot overwrite a concurrent completed claim with an obsolete snapshot.
- Permission denial/native API failure remains distinct from internal state. api_accepted means API success, never proof of visible OS delivery. No notification action buttons are claimed.
- Notification listeners register synchronously whenever the optional namespace is available; permission-added callbacks handle availability changes.
- Native bookmark probe operates on one confirmed synthetic item and cleans up its own ID even if edit fails. Tree data is not logged/exported.
- Diagnostics retain only an approved error code and time; no raw private text or paths. Fixtures contain no personal data.
- FA/EN text, direction, focus and permission/error guidance are present; full P01 locale/settings/design system is not implemented.

A process crash after the durable native claim but before the actual API call can lose a native attempt; full retry/reconciliation semantics and notification center belong to P03. This P00 probe does not claim production reminder reliability. No prior production schema exists, so no prior-version migration pass is claimed.

## Browser selection and limitations

Selected **development/build strategy**: explicit Firefox MV3 and Chrome MV3. Firefox executable version is 155.0.1; configured minimum 140.0 supports the no-transmission declaration but has not been runtime tested at that minimum. ESR is not certified. WXT 0.21.4 is installed and verified for preparation/builds. ADR-001/002 remain proposed until outstanding evidence and sign-off.

The owner ran web-ext temporary installation successfully, then confirmed Firefox New Tab and Home work. This does not prove regular-install consent, extension conflicts, settings precedence or uninstall restoration. Firefox exposes browser-controlled Home; no fake runtime toggle exists. Chrome declares no automatic Home override; manual guidance is conditional and unverified. Home remains an approved target, not a removed feature.

Firefox gecko.data_collection_permissions.required=[none] was added per official Mozilla guidance, and the WXT warning is removed. There is no runtime data transmission. System Chromium 153.0.8010.52 passed the installed-extension smoke. This does not certify Google Chrome stable, minimum Firefox 140, or ESR.

## Security audit and network attempts

Owner installation initially reported 32 affected packages. Upgrading WXT/web-ext/Playwright/ESLint/typescript-eslint and Vitest to the first-stage pins reduced the reported count to **9** (1 moderate, 3 high, 5 critical). These are tooling paths including Vitest/mocker/tinypool and web-ext/fx-runner/shell-quote/adbkit/node-forge. They are not bundled application dependencies, but still matter for safe development/distribution. No release security clearance is claimed.

The audit's suggested downgrade to web-ext 5.1.0 conflicts with WXT's peer requirement and was rejected. No force fix or blind transitive override was applied. Attempted Vitest 5.0.3 installation with two network retries and bounded timeouts failed EAI_AGAIN; see vitest-latest-attempt.log and vitest-update-retries.log. Latest node-forge metadata available here was 1.4.0, still affected by the audit range; no nonexistent fixed version was chosen. Remaining advisories require reviewed remediation or explicitly documented engineering risk disposition before the gate passes.

Playwright Chromium download failed DNS. Selenium Manager could not reach GitHub to discover/download geckodriver. `npm run setup:browsers` retried each three times; all six attempts failed and logs are retained as setup-chromium-1..3.log and setup-geckodriver-1..3.log. That historical absence is resolved: the latest geckodriver setup attempt succeeded and system Chromium is available. The latest Playwright download still failed HTTP 403 with a location-denial response; stale setup-chromium-2/3 logs are earlier attempts, not proof of a current retry. Setup as a whole has not passed. Earlier isolated Firefox launch exited 139; root cause was not established. No silent browser skips occur.

## Commands and artifacts

`npm run p00:verify` runs lint, typecheck, unit, test:integration, format:check, build:firefox, build:chrome, inspect:manifests, test:security, test:smoke:firefox, test:smoke:chrome sequentially, preserves each log and exits nonzero on any failure. Latest manifest artifacts are .output/firefox-mv3 and .output/chrome-mv3. Latest machine-readable summary: evidence/P00/final-results.json. `npm run setup:browsers` installs isolated browser prerequisites without system-wide changes; failed attempts remain failures.

Created/changed implementation files: package.json/package-lock.json; WXT/TS/Vitest/ESLint configs; root README/license placeholders/gitignore/npmrc; entrypoints/newtab/options/background; src/app/domain/application/infrastructure; tests/unit/integration/security; scripts/setup-browsers/verify-p00/browser-probes/manifest-audit/browser-smokes; public/icons/icon.png; .github/workflows/p00.yml; docs/implementation ADRs/report/checklist; evidence/P00 logs/JSON. Original PRD files were not modified. Current automated screenshots are evidence/P00/firefox-newtab.png and chrome-newtab.png. They show the P00 shell, not consent dialogs or native OS notifications; user observations remain labeled separately.

## Remaining exit criteria / next step

1. Restore package/download access and review remaining dependency advisories; install and regression-test a safe Vitest/tooling combination.
2. Resolve the Playwright download/CI provisioning failure without circumventing the location restriction; current system-browser smoke already passes. Certify CI and minimum supported targets separately.
3. Complete manual permission grant/deny/revoke, native bookmark changes, visible OS notification/icon/click, closed-tab alarm and browser-restart/missed recovery checklist.
4. Verify Firefox regular-install Home consent, browser-control/precedence/uninstall restoration; certify Chrome manual Home path or document unsupported behavior.
5. Review/sign off ADRs and capability matrix with the owner. Stop after P00; do not start P01 yet.

## Continuation commands, evidence and acceptance (2026-10-09)

The latest pre-continuation `p00:verify` summary at 13:38:07.980Z passed all 11 checks, contrary to the previous report. Latest setup outputs: setup-geckodriver-1.log reports success and geckodriver 0.37.1; setup-chromium-1.log reports HTTP 403 location denial. Browser setup was inspected, not rerun in this continuation.

| Exact command | Result / evidence |
|---|---|
| `npm run p00:verify` (filesystem sandbox) | Exit 1: nine non-browser checks pass; Firefox socket listen EPERM and Chromium setsockopt EPERM/SIGTRAP prevent browser launch. Environment failure, not app evidence. |
| `npm run p00:verify` (approved outside sandbox) | Exit 0, all 11 checks pass; final-results.json and final-*.log. Repeated after the harness security fix. No extension permissions/CSP checks disabled. |
| `npm run test:smoke:chrome > evidence/P00/chrome-sandbox-verification.log` (approved outside sandbox) | Exit 0 with explicit `chromiumSandbox: true`; removes Playwright default `--no-sandbox`. |
| `npm audit --json > evidence/P00/audit-current.json` | Initial sandbox DNS EAI_AGAIN; approved network retry completes with exit 1 because vulnerabilities exist: 9 affected packages. |
| `npm audit --omit=dev --json > evidence/P00/audit-production.json` | Approved network run exits 0: zero reported production dependency vulnerabilities. This is not full runtime security clearance. |
| `npm ls vitest @vitest/mocker tinypool web-ext fx-runner shell-quote node-forge @devicefarmer/adbkit wxt > evidence/P00/audit-dependency-paths.log` | Exit 0; exact installed dependency paths retained. |
| `sha256sum -c SHA256SUMS.txt > evidence/P00/prd-checksums.log` | Exit 1: 24 match, 16 differ. A Python SHA256 comparison also excludes simple CRLF/LF normalization as the explanation; checksum-analysis.json. Baseline not regenerated, source files not overwritten. |

The final verify logs overwrite the sandbox-run logs; the sandbox failure details above describe the observed run and are not misrepresented as retained separate files. Earlier successful evidence is superseded by the current timestamp in final-results.json. Unit: 11 passed; integration: 6 passed; security: 2 passed. The two security tests are limited static checks, not a full penetration test.

### Vulnerability classification and disposition

All nine findings are development/tooling paths, confirmed by production-only audit and dependency tree. Package totals include inherited severity and are not nine independent root advisories. Findings remain OPEN; no risk acceptance or release clearance is implied.

| Installed packages / severity | Exposure and disposition |
|---|---|
| @vitest/mocker 3.2.7 moderate; vitest 3.2.7 critical; tinypool 1.1.1 critical | Mock redirect arbitrary file read and worker option prototype-pollution/code-execution advisories. Current tests run trusted local code in run mode; this narrows exposure but does not establish non-exploitability. Audit proposes Vitest 5.0.3, a major migration. Review configuration/Node support and regression-test in a separate tooling change; no forced upgrade or cross-major tinypool override. |
| shell-quote 1.10.0 critical; fx-runner 1.6.0 critical; web-ext 10.7.0 critical | Command injection under crafted quote/comment tokens; inherited through Firefox launch tooling. Keep launch input trusted; do not run untrusted plugin code. Audit identifies shell-quote >=1.11.0 outside the affected range. Evaluate an allowed transitive update and launcher regressions before accepting it. Suggested web-ext 5.1.0 downgrade is incompatible with the selected toolchain and is rejected. |
| node-forge 1.4.0 high; @devicefarmer/adbkit 3.3.9 high | RSA signature verification advisory via Android tooling. Desktop smoke does not exercise Android certificate verification; this is scoped exposure, not proof of safety. Review an upstream fixed release when available; do not remove audit coverage or invent a fixed version. |
| wxt 0.21.4 high | Inherited web-ext exposure. Suggested 0.20.27 downgrade is a toolchain change requiring review, not an automatic safe fix. |

No dependency versions or lockfile changed. No `npm audit fix --force`, blind override, weakened tests, or security-check bypass occurred. Production-only zero findings do not close the tooling gate.

### Mandatory browser checks and acceptance

| Approved criterion / requested check | Status and evidence / remaining procedure |
|---|---|
| Fresh Firefox New Tab renders bundled app | PASS for Firefox 155.0.1 isolated temporary installation: registered AboutNewTab override points to bundled page, heading rendered, screenshot and JSON retained. Navigation uses Firefox privileged automation access, not evidence of normal install consent. Owner also previously reported development New Tab working. |
| Firefox Home attempted, consent/restoration/control | PARTIAL: generated manifest declares bundled Home and owner previously reported Home renders. Regular install accept/decline, settings control, competing override, disable/uninstall restoration NOT RUN. Temporary installation cannot prove regular signed-install prompts; use a disposable desktop profile and a permitted install package, record both consent paths and restored URL. No signed package/store approval exists here. |
| Chrome MV3 build and New Tab | PASS for Chromium 153.0.8010.52: unpacked installed extension, real chrome://newtab, heading and manifest 3, storage and alarms API smoke. Native Home manual path, worker termination recovery, Google Chrome distribution and other versions NOT RUN. |
| Bookmark permissions and denial | PARTIAL: both real browsers observe optional bookmarks ungranted; unit tests prove adapter refuses read/mutation on denial and cleans its own fixture on failure. Real user prompt denial, grant, synthetic CRUD, revoke, actionable UI denial and unrelated-bookmark preservation NOT RUN. Execute checklist step 4 in disposable profiles; never pregrant permissions to simulate consent. |
| Native notifications | UNVERIFIED: both real browsers observe optional permission ungranted. API-double tests cover blocked/failed/api_accepted distinctions. Actual permission prompt, OS popup/icon/click, OS blocked state, grant/revoke and delivery with dashboard closed NOT RUN. Requires an observable desktop notification service; headless screenshots cannot certify OS visibility. |
| Alarm recovery after browser restart | PARTIAL: real create/list/clear passes in both targets; six integration tests cover DB/restore/claim logic. Neither harness restarts a retained profile or waits for due delivery. Restart-before-due, closed-through-due missed recovery, duplicate delivery and Chrome worker cold-start NOT RUN. Follow checklist step 6; retain the same disposable profile across launches and compare persisted probe state/alarm ID. |
| Firefox version/manifest pinned and ADR | PARTIAL: explicit MV3, actual Firefox 155.0.1 recorded, minimum 140 configured, WXT 0.21.4 pinned. ADR-001/002 still proposed; owner sign-off and minimum-version evidence absent. |
| Core tests with actual results | PASS: lint/typecheck/format, 11 unit, 6 integration, 2 limited security tests, dual builds/manifest audit and two browser smoke checks. Actual hosted CI NOT RUN. |

Manual checks remain unverified because current harnesses use headless disposable sessions and temporary/unpacked installations; they do not implement consent UI, OS observation or retained-profile restart tests. This is a documented test-coverage limitation, not a claim that the underlying behavior failed or is impossible. P00_BROWSER_CHECKLIST.md supplies exact actions; no personal profiles touched.

### End-of-phase handoff

- Fully completed task IDs: none newly closed. T00.01–T00.06 / T-001–T-010 retain the task table scope; automated portions now pass, mandatory manual/policy/security/ADR evidence remains open.
- Changed in this continuation: scripts/smoke-chrome.mjs (enable Chromium sandbox), this report, P00_BROWSER_CHECKLIST.md, ADR-001.md, ADR-002.md; evidence/P00 audit-current.json, audit-production.json, audit-dependency-paths.log, checksum-analysis.json, prd-checksums.log, chrome-sandbox-verification.log, final-results.json/final-*.log, generated-manifests.json, both smoke JSON/screenshots and built .output artifacts. package.json/package-lock.json and approved PRD files unchanged.
- Blockers: manual browser lifecycle/consent/OS tests; tooling advisories; source-baseline checksum discrepancy; ADR sign-off, CI execution and minimum-browser certification. Checksum discrepancy predates this continuation; without a trusted original baseline or tracked history its origin cannot be established. Do not repair by rewriting the approved PRD or blessing new hashes.
- Recommendation: continue P00 evidence collection and reviewed compatible dependency remediation, reconcile the trusted document baseline, then request owner review only after mandatory gates pass. P00 is NOT ACCEPTED; P01 remains NOT STARTED. No commit or push.

## Official references

- https://wxt.dev/guide/essentials/target-different-browsers.html
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_settings_overrides
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms
- https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
- https://extensionworkshop.com/documentation/publish/add-on-policies/

Documentation review and successful builds are not runtime/store acceptance evidence.
