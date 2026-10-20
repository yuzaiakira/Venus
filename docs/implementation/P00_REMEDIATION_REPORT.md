# VENUS — P00 REMEDIATION REPORT

Date: 2026-10-09. Base revision: `3885dcfc644821eaa08688137ac80d8531b22826`; remediation is uncommitted. Environment: Linux, Node 24.19.0, npm 11.17.0, WXT 0.21.4, Firefox 155.0.1, Chromium 153.0.8010.52. No commit, push, signing, publishing or P01 work was performed.

## Final recommendation

**FAIL — P00 acceptance remains open.** Verified implementation gaps were repaired and the final local verification runner passed all 11 checks. Required regular-install Home/permission/native-notification evidence, worker suspension, minimum Firefox certification, hosted CI, residual dependency disposition and owner ADR sign-off remain missing. Passing local checks does not close these gates.

The owner was asked for desktop evidence and the original approved snapshot/hosted CI location. No owner results were received during this remediation. Stop here at P00; do not begin P01.

## Audit issues and resolutions

| Audit issue / requested task | Resolution and specific evidence | Status |
|---|---|---|
| Firefox fresh New Tab and offline test (task 1) | `scripts/smoke-firefox.mjs` invokes Firefox's `BrowserCommands.openTab`, discovers a newly created content tab, and asserts Venus while the isolated Firefox profile is offline. No direct navigation to the extension URL substitutes for the fresh-tab action. `evidence/P00/remediation/firefox-smoke.json`, `firefox-newtab.png`, final smoke log | **PASS** on Firefox 155.0.1 temporary install |
| Firefox Home browser-level proof (task 1) | Harness first navigates away to about:blank, invokes `BrowserCommands.home`, then asserts Venus at the same bundled URL. `firefox-smoke.json` records Home rendering PASS; `firefox-home.png` exists. Offline state remains active through this check | **PASS** for temporary-install rendering only |
| Firefox Home consent/decline/conflict/disable/uninstall (task 1) | Developer temporary installation does not prove regular consent or restoration. Exact owner procedures are in P00_OWNER_VERIFICATION.md F01–F07; compatible regular-install package is a prerequisite | **NOT VERIFIED** |
| Chrome MV3 New Tab/offline (task 2) | Explicit Chrome MV3 build; isolated unpacked Chromium opens chrome://newtab offline and renders Venus. `chrome-smoke.json`, `chrome-newtab.png`, target manifest/build log | **PASS** on Chromium development target; branded Chrome/store not certified |
| Chrome Home fallback (task 2) | EN/FA guidance offers Settings → Appearance → Show Home button → New Tab page first; custom extension URL remains conditional. Browser-owned option is documented by Google; actual Home-button interaction still requires owner test | **NOT VERIFIED** at runtime |
| Optional permissions and native bookmark/notification APIs (task 3) | Real API smokes observe ungranted optional permissions; never silently grant them. Grant/deny/revoke, real CRUD cleanup and OS popup/icon/callback steps are specified for both browsers. Adapter negative-path unit tests remain separate | **NOT VERIFIED** for real consent/native operations |
| Chrome alarm after tab closure (task 3) | Real bundled UI schedules a 60-second probe; all extension pages close; reopening after due shows durable due/blocked. `chrome-lifecycle.json` and log | **PASS** with notification permission ungranted; not OS delivery proof |
| Chrome restart before due (task 3) | Same disposable profile restarted before deadline; DB probe remains pending and real browser alarm is present | **PASS** in lifecycle evidence |
| Chrome shutdown through due (task 3) | Entire disposable browser closed through deadline; same profile reopens with missed/not_attempted and no native attempt | **PASS** in lifecycle evidence |
| Chrome worker suspension (task 3) | Page-scoped stopAllWorkers and browser Target.closeTarget attempts retained. Browser returned success for closeTarget, but target still existed. Harness checks actual target state and records NOT VERIFIED; lifecycle command exits nonzero | **NOT VERIFIED**; owner stop/wake test required |
| Firefox persistent restart/background lifecycle (task 3) | Not substituted with temporary add-on restart, which cannot establish regular installed lifecycle. Owner instructions require the same compatible installed package/profile | **NOT VERIFIED** |
| Scheduler startup/wake race (task 4) | Before fix, new regression failed: wake restore consumed pending as missed, and notification attempt count was zero. Recovery now has explicit startup/wake reason; storage.session identifies browser session; event handlers await initialization. Same-session wake leaves pending claim available; fresh startup marks overdue missed. Existing IDB transaction claim still suppresses duplicates | **PASS** in regression/integration scope; real forced worker suspension remains unverified |
| tinypool and @vitest/mocker (task 5) | Compatibility analysis preceded Vitest 3.2.7→4.1.11 development-only upgrade. Patched mocker 4.1.11 installed; Vitest 4 removes tinypool, confirmed in final dependency tree. Unit and integration suites passed | **RESOLVED** in current tree |
| shell-quote (task 5) | Scoped fx-runner override 1.10.0→1.11.0, without WXT/web-ext downgrade. Regression resolves package from fx-runner scope and tests quoted argument parsing. Firefox startup succeeds | **RESOLVED** in current tree |
| node-forge (task 5) | Registry latest 1.4.0 remains affected; advisory has no patched version. Real verification sink found in adbkit Android TCPUSB authentication. No browser application import/production dependency, and desktop P00 does not select Android runner. Full audit retains this chain; residual disposition not self-approved | **OPEN — high severity** |
| Validation execution (task 6) | Final p00:verify exit 0: all 11 commanded checks pass. Source hashes and revision/dirty status recorded; hashes rechecked against working source with no mismatches. Earlier failures preserved separately | **PASS** for exact final local checks |
| Minimum Firefox (task 7) | Config remains provisional 140.0; executed browser is 155.0.1. ADR-001 proposes retaining 140 after exact-version testing, or owner-approved 155.0.1 initial minimum. No unilateral minimum change or ESR claim | **NOT VERIFIED** for 140; proposal prepared |
| Hosted CI (task 8) | No Git remote configured; GitHub CLI unavailable. Workflow now provisions browser prerequisites per target. Owner steps specify run URL/revision and checks/firefox/chrome jobs/artifacts | **NOT VERIFIED** |
| SHA256 mismatches (task 9) | Bounded reconstruction tries Venus/venus per name occurrence and LF/CRLF, requiring exact original hash. All 16 mismatches match baseline using only those transformations; 24 files already exact. JSON records per-file replacements. Specifications and baseline untouched | **PASS** for byte-level reconciliation to existing baseline; independent snapshot/provenance **NOT VERIFIED** |
| Reports/README/ADR drafts (task 10) | README and notices corrected, historical P00 report/checklist point to current evidence, ADR drafts updated with limitations and owner decisions, manual guide and this report prepared | **PASS** for preparation; ADR approval **PENDING OWNER** |
| Application/browser boundary | Moved runtime reconciliation messaging into infrastructure adapter; application no longer imports wxt/browser directly | **RESOLVED** |
| Manifest/security assertions | Exact CSP, target background strategy, paths/permissions and explicit target differences checked. Security suite scans actual nonempty bundles for dynamic execution/remote script tags | **PASS** for limited static scope; not full runtime traffic/security certification |

## Changed files

Application and contracts skeleton:

- `entrypoints/background.ts`
- `src/application/lifecycle.ts` (new)
- `src/application/scheduler.ts`, `src/application/probes.ts`
- `src/domain/foundation.ts`
- `src/infrastructure/db.ts`, `src/infrastructure/browser.ts`
- `src/app/App.tsx`

Tests/tooling/configuration:

- `tests/integration/scheduler.test.ts`, `tests/security.test.mjs`
- `package.json`, `package-lock.json`
- `scripts/smoke-firefox.mjs`, `scripts/smoke-chrome.mjs`
- `scripts/chrome-lifecycle.mjs` (new)
- `scripts/inspect-manifests.mjs`, `scripts/verify-p00.mjs`, `scripts/setup-browsers.mjs`
- `scripts/reconcile-prd.mjs`, `scripts/reproduce-install.mjs` (new)
- `.github/workflows/p00.yml`, `.gitignore`

Documentation/evidence:

- `README.md`, `THIRD_PARTY_NOTICES`
- `docs/implementation/ADR-001.md`, `ADR-002.md`
- `docs/implementation/P00_REPORT.md`, `P00_BROWSER_CHECKLIST.md` (historical scope retained)
- `docs/implementation/P00_DEPENDENCY_REVIEW.md`, `P00_OWNER_VERIFICATION.md`, `P00_REMEDIATION_REPORT.md` (new)
- New evidence under `evidence/P00/remediation/`, including retained failed attempts, fresh-install logs, audit JSON, screenshots, manifest differences, source hashes and execution summaries.

The independent audit file already existed untracked before remediation and was not edited. No approved docs outside implementation/, contracts, SHA256SUMS.txt, compatibility-sensitive schema/package identifiers, `p00@Venus.invalid`, or `Venus-p00` were changed. DB schema version remains 1; no migration, reset or wipe is introduced. Synthetic browser profiles are isolated and removed after their tests. No personal profile is used.

## Exact commands, exits and evidence

Paths in this section are relative to `evidence/P00/remediation/`. Commands were actually executed; results are not inferred from previous agent statements.

### Final local suite

Parent command:

`P00_EVIDENCE_DIR=evidence/P00/remediation npm run p00:verify > evidence/P00/remediation/verify.log 2>&1`

Executed outside the filesystem sandbox after EPERM failures; **exit 0**. Each child inherits P00_EVIDENCE_DIR. `final-results.json` records each exit, Node/platform, base revision, dirty working-tree status and source hashes. Current source hash verification found zero mismatches.

| Exact child command | Exit | Result | Log |
|---|---:|---|---|
| `npm run lint` | 0 | PASS | final-lint.log |
| `npm run typecheck` | 0 | PASS, WXT prepare plus strict compiler | final-typecheck.log |
| `npm run unit` | 0 | PASS, 11 tests on Vitest 4.1.11 | final-unit.log |
| `npm run test:integration` | 0 | PASS, 10 tests; fake IndexedDB and injected browser/session ports | final-test-integration.log |
| `npm run format:check` | 0 | PASS | final-format-check.log |
| `npm run build:firefox` | 0 | PASS, explicit MV3 build only | final-build-firefox.log |
| `npm run build:chrome` | 0 | PASS, explicit MV3 build only | final-build-chrome.log |
| `npm run inspect:manifests` | 0 | PASS, exact assertions and target differences | final-inspect-manifests.log; generated-manifests.json; manifest-differences.json |
| `npm run test:security` | 0 | PASS, four limited tests | final-test-security.log |
| `npm run test:smoke:firefox` | 0 | PASS, fresh offline tab and temporary Home rendering on 155.0.1 | final-test-smoke-firefox.log; firefox-smoke.json; screenshots |
| `npm run test:smoke:chrome` | 0 | PASS, offline New Tab on Chromium 153.0.8010.52 | final-test-smoke-chrome.log; chrome-smoke.json; screenshot |

### Regression, lifecycle, dependencies and failures

| Exact command | Exit | Result / evidence |
|---|---:|---|
| `npm run test:integration > evidence/P00/remediation/race-before.log 2>&1` | 1 | Expected reproduction: one failed new wake regression, six existing passes; notification attempt count zero |
| `npm run test:integration > evidence/P00/remediation/race-after.log 2>&1` | 0 | Ten passes after fix, before Vitest upgrade |
| `npm install --ignore-scripts --no-audit > evidence/P00/remediation/dependency-install.log 2>&1` | 1 | Sandbox DNS EAI_AGAIN; not an installation pass |
| `npm install --ignore-scripts --no-audit > evidence/P00/remediation/dependency-install-network.log 2>&1` | 0 | Approved network retry installed reviewed updates; lifecycle scripts disabled |
| `npm audit --json > evidence/P00/remediation/audit-current.json` | 1 | Sandbox DNS failure; advisory result unavailable |
| `npm audit --json > evidence/P00/remediation/audit-network.json` | 1 | Successful network audit reports four high affected packages, zero critical/moderate; nonzero is findings, not network failure |
| `npm audit --omit=dev --json > evidence/P00/remediation/audit-production-sandbox.json` | 1 | Sandbox DNS failure |
| `npm audit --omit=dev --json > evidence/P00/remediation/audit-production.json` | 0 | Successful network audit, zero production findings; not universal security clearance |
| `npm ls vitest @vitest/mocker tinypool web-ext fx-runner shell-quote node-forge @devicefarmer/adbkit vite --json > evidence/P00/remediation/dependency-before.json` | 0 | Pre-upgrade dependency paths |
| `npm ls vitest @vitest/mocker tinypool shell-quote node-forge web-ext fx-runner wxt --json > evidence/P00/remediation/dependency-after.json` | 0 | Patched versions and absent tinypool verified |
| `P00_EVIDENCE_DIR=evidence/P00/remediation P00_LIFECYCLE=1 npm run test:smoke:chrome > evidence/P00/remediation/chrome-lifecycle.log 2>&1` | 1 | Three real lifecycle subchecks PASS; worker suspension NOT VERIFIED. No OS/consent pass claimed; chrome-lifecycle.json |
| `node scripts/reconcile-prd.mjs > evidence/P00/remediation/prd-reconciliation.log 2>&1` | 0 | 24 exact + 16 checksum-matched rename/newline reconstructions; zero unresolved byte comparisons |
| `git remote -v > evidence/P00/remediation/ci-remotes.log` | 0 | Empty output: no remote, not a hosted CI pass |
| `command -v gh > evidence/P00/remediation/ci-gh.log` | 1 | GitHub CLI unavailable |
| `git diff --check` | 0 | No whitespace errors at final code inspection |

Metadata queries executed successfully before installation: `npm view vitest@4.1.11 version engines dependencies peerDependencies --json`, `npm view shell-quote@1.11.0 version engines --json`, `npm view tinypool@2.1.2 version engines --json`, `npm view node-forge version engines --json`, `npm view fx-runner@1.6.0 dependencies --json`, and `npm view @devicefarmer/adbkit dependencies --json`. No tinypool override was applied: its incompatible major was avoided by Vitest 4's removal of that dependency.

Earlier runner attempts are preserved in `first-checks/` and `second-checks/`. First attempt: lint failure from a browser-context navigator reference and fresh-tab handle-context timeout; both corrected. Second attempt: Firefox New Tab/Home assertions passed but WebDriver quit failed with a Marionette response decode error; isolated offline state is now restored before quit, and subsequent full runner passed. Do not describe those commands as successful. Standalone sandbox browser attempts failed socket/setsockopt EPERM; approved outside-sandbox retries are distinguished in logs. Worker-stop first/second failed attempts have separate logs/JSON. Tests are not silently skipped or auto-passed.

### Fresh lockfile reproduction

`node scripts/reproduce-install.mjs > evidence/P00/remediation/fresh.log 2>&1` executed outside sandbox, **exit 0**. It copies only the current source/config/test inputs into its own `/tmp/Venus-p00-repro-*` directory, runs the commands below, records results, and removes only that disposable directory. `fresh-results.json` retains its actual cwd/date and child exits. Initial sandbox attempt failed subprocess EPERM (null child exit), recorded in fresh-sandbox.log; no pass inferred.

| Exact command in the disposable checkout | Exit | Evidence |
|---|---:|---|
| `npm ci --offline --ignore-scripts --cache /home/akira/Projects/git-contribute/Venus/.npm-cache` | 0 | fresh-1.log |
| `npm run typecheck` | 0 | fresh-2.log |
| `npm run unit` | 0 | fresh-3.log |
| `npm run test:integration` | 0 | fresh-4.log |
| `npm run build:firefox` | 0 | fresh-5.log |
| `npm run build:chrome` | 0 | fresh-6.log |

This proves the offline cached, lifecycle-scripts-disabled procedure. Unrestricted online ordinary npm ci/dependency lifecycle scripts were not independently certified. No vulnerability clearance is inferred from the installer's offline summary.

## Scheduler fix and remaining reliability limits

The old `restore(now)` always marked overdue pending probes missed. Calling it on worker initialization could consume an alarm before onAlarm acquired its pending-only claim. The regression exercised that ordering against actual repository transactions in fake IndexedDB and failed before the fix.

The fix separates startup recovery from wake reconciliation and initializes a session marker in extension storage.session. Session storage survives worker suspension but clears with a new browser session. Every fire/reconcile handler waits for initialization, so fresh-start missed recovery cannot be overtaken by delivery, while same-session wakes preserve the pending claim. Tests cover cold startup with concurrent fire, same-session wake with duplicate fire, and initialization failure. Real Chromium restart/tab closure subchecks support the lifecycle behavior; forced suspension is not yet proven.

Existing at-most-once semantics remain: a process crash after claiming due but before the native call can lose that native attempt. P00 does not claim production reminder retry/reconciliation guarantees; those remain P03 work and are not implemented here. No stored schema/name change or data wipe is introduced.

## Dependency residual risk

See P00_DEPENDENCY_REVIEW.md for pre-install compatibility analysis and primary advisories. No force fix, incompatible WXT downgrade or blind major transitive override was used.

Full audit fell from nine affected packages (five critical, three high, one moderate) to four high entries: node-forge, adbkit, web-ext and WXT. They share the node-forge verification advisory. The production-only audit reports zero findings. Installed adbkit's TCPUSB authentication code actually calls node-forge key.verify, so the library is not declared unreachable in all tooling configurations. Desktop extension code/build paths do not request that Android bridge; no node-forge runtime bundle use was found. Upstream has no published patched version. Owner/security residual disposition remains pending; no Android/signing/distribution security clearance is claimed.

## Baseline, rename and data preservation

`prd-reconciliation.json` records the unchanged baseline hash and each file's exact-match or checksum-matched reconstruction. All 16 mismatches are explainable solely by selective Venus/venus replacements plus line endings; there is no unexplained scope/content difference relative to the existing checksum set. This is stronger evidence than the audit's initial uniform reverse substitution, which explained only nine.

The original approved snapshot was not supplied and Git contains only the initial repository commit, already renamed. Independent baseline provenance/owner authorization cannot be established from its checksum file alone. Owner snapshot/provenance confirmation remains required. No historical specification is rewritten, no checksum is refreshed to hide differences, and no compatibility-sensitive names/IDs are changed. Active product name remains Venus; legacy ZDPS/.zplugin and Persian historical references remain for controlled compatibility review.

## Updated T00.01–T00.06 matrix

| Task | Verified deliverables | Remaining mandatory evidence | Status |
|---|---|---|---|
| T00.01 | WXT/React/strict TS, documented npm lockfile, lint/formatter/Vitest/Playwright harness, bundled assets, README/license placeholders; fresh reproduction | Distribution/license clearance is outside placeholder completion | **PASS** for P00 baseline |
| T00.02 | Explicit dual MV3 builds, exact manifests/differences, CI jobs, ADR-001 draft, Firefox 155.0.1/Chromium execution | Full Home/native API policy/lifecycle feasibility, minimum certification, owner ADR decision | **NOT VERIFIED** as complete task |
| T00.03 | Fresh offline Firefox New Tab, temporary Home rendering, offline Chromium New Tab, truthful manual Home paths | Regular consent/decline, conflict, control, disable/uninstall; Chrome Home-button fallback | **NOT VERIFIED** |
| T00.04 | Real storage/alarm APIs; Chromium tab closure and both restart subchecks; startup/wake regression fix; browser ports | Real grant/deny/revoke and bookmark CRUD cleanup, native OS icon/click, forced worker stop/wake and Firefox persistent lifecycle | **NOT VERIFIED** |
| T00.05 | ADR drafts, domain/event/schema skeleton, browser/session ports, injectable scheduler, validated persisted probes, code/time diagnostics, synthetic fixtures; no direct browser import in application | Production feature/migration engines belong to later approved phases | **PASS** for P00 foundation skeleton |
| T00.06 | All 11 local checks exit 0, explicit missing-binary failures, source-hashed evidence, CI skeleton and separated prerequisite provisioning | Hosted CI run and artifacts | **NOT VERIFIED** for complete CI task |

No partially tested task is declared fully completed. Verified P00 deliverable groups: T00.01 and T00.05, plus the listed portions of other tasks.

## Updated acceptance criteria matrix

Every checkbox from phases/P00_FEASIBILITY_AND_BOOTSTRAP.md:

| Criterion | Status | Evidence / scope |
|---|---|---|
| Fresh Firefox New Tab renders bundled app | **PASS** | Real fresh tab via browser command, offline, 155.0.1 temporary developer install |
| Home override attempted with browser-level evidence and fallback specified | **PASS** for attempted/rendering criterion | Real Home command from about:blank renders same bundled shell; fallback documented. Full lifecycle task remains unverified |
| Chrome MV3 builds and New Tab renders | **PASS** | Explicit MV3 build and actual offline Chromium development New Tab; no branded Chrome/store claim |
| Alarm/notifications/bookmarks behavior and permissions tested in real target browser | **NOT VERIFIED** | Real alarm subchecks exist; grant/revoke/native bookmark/notification and some lifecycle paths remain missing |
| Firefox version/manifest explicitly pinned and ADR exists | **PASS** for declaration | Explicit MV3, provisional minimum 140.0, tested 155.0.1 recorded, ADR-001 exists. Minimum execution/sign-off remains open |
| Core tests run; report includes actual results | **PASS** | 11 unit, 10 integration and four security tests; command exits/logs retained |

Exit deliverables:

| Deliverable | Status |
|---|---|
| Minimal Venus local New Tab both targets and Home proof/workaround | **PASS** for temporary rendering/documented candidate; regular Home lifecycle still unverified |
| Signed-off ADR-001/002, manifest differences, permission plan and selected target versions | **FAIL** — differences/plan/drafts exist, owner signatures and final minimum decision missing |
| Reproducible dual builds and CI skeleton | **PASS** for exact fresh procedure/skeleton; hosted execution NOT VERIFIED |
| No remote executable code or unnecessary host permissions | **PASS** for executed manifest/artifact inspection; runtime network observation not certified |

These scoped checkbox passes do not waive the broader mandatory work packages or unsigned exit deliverables.

## Owner assistance, ADR review and stopping point

Detailed executable/manual steps: **P00_OWNER_VERIFICATION.md**. Please provide:

1. Firefox F01–F07 results with compatible regular-install package, browser/OS/version and sanitized consent/control/conflict/disable/uninstall evidence.
2. Chrome actual Home-button fallback result; optional permission deny/grant/revoke and synthetic bookmark cleanup on both browsers.
3. Visible native notification/icon/click result and OS-blocked case on both browsers, separately from API acceptance.
4. Actual Chrome worker-stop observation followed by due delivery, and Firefox same-profile installed restart/background lifecycle results.
5. Firefox 140 exact-version results or an explicit review of the proposed tested 155.0.1 minimum; ESR remains uncertified.
6. Hosted P00 run URL/revision and both target artifacts. No remote/CLI was available here; do not infer hosted success from YAML.
7. Original approved PRD snapshot or baseline-provenance confirmation.

ADRs requiring owner sign-off: **ADR-001** (manifest strategy, browser versions/minimum) and **ADR-002** (Home consent/control and Chrome fallback). Both remain proposed; no signature or approval was supplied on the owner's behalf. Residual node-forge risk disposition also remains open. Review signatures only after the required evidence is assembled.

P00 is not truly complete and P01 should not be authorized on these results alone. Independent authorized remediation is complete for the verified gaps described above; phase acceptance is stopped pending the specific owner evidence. No P01 work follows this report.
