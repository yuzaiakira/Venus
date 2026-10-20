# VENUS — P00 INDEPENDENT AUDIT

Audit date: 2026-10-09. This file records the independent audit presented in chat. It is not a new validation run or an implementation change.

## 1. Executive Verdict

**FAIL — mandatory criteria missing or broken**

P00 has a working implementation foundation and specific evidence of successful builds and limited browser execution. It is **not fully complete**:

- Required Home consent, conflict, browser-control, and uninstall tests lack verifiable evidence.
- Real bookmark grant/revoke, native notification delivery/callback, and alarm restart tests remain unverified.
- ADR-001 and ADR-002 explicitly remain proposed and unsigned.
- Dependency security findings remain unresolved.
- Hosted CI execution is unverified.

This verdict means the **phase acceptance gate fails**; it does not mean every implemented feature is broken.

Audit context: Linux, Node `v24.19.0`, npm `11.17.0`, commit `3885dcfc644821eaa08688137ac80d8531b22826`. Git status was clean before and after inspection. No project files were modified, committed, or pushed during the audit. Commands that regenerate builds, caches, or browser evidence were not rerun because the requested authorization was not received. This report file was subsequently created at the owner's explicit request.

## 2. P00 Task Matrix

Statuses apply to the complete task, including required evidence. Repository paths below are relative to the repository root; line references identify the inspected locations.

| Task ID | Required deliverable | Actual evidence | Status | Findings |
|---|---|---|---|---|
| T00.01 | WXT, React, strict TS, documented package manager/lockfile, lint/formatter, test harnesses, target scripts, bundled assets, contributor README and license placeholders | `package.json:9`, `tsconfig.json:1`, Vitest configuration, browser harnesses, LICENSE and THIRD_PARTY_NOTICES; independently executed lint/typecheck/format checks | **PASS** | Exact direct dependency pins match lockfile and installed packages. Required placeholders exist. README contains stale results. |
| T00.02 | Explicit Firefox MV3 feasibility, Chrome MV3, generated manifest inspection, ADR and dual CI jobs | `wxt.config.ts:4`, target build logs, actual generated manifests, `.github/workflows/p00.yml:13`, `docs/implementation/ADR-001.md:4` | **NOT VERIFIED** | Builds and manifest structure verified. Full platform/policy feasibility remains open; ADR unsigned and minimum Firefox untested. |
| T00.03 | Real New Tab/Home tests, install/uninstall consent/conflicts, precedence, user control, capability matrix and truthful fallback | `scripts/smoke-firefox.mjs:45`, `scripts/smoke-chrome.mjs:35`, `src/app/App.tsx:45`, `docs/implementation/ADR-002.md:4` | **NOT VERIFIED** | Chrome-target New Tab has runtime evidence. Firefox automation verifies registered override plus direct page loading. Home lifecycle tests and Chrome manual fallback remain unverified. |
| T00.04 | Permission grant/revoke, restart alarms, notification icon/callback, native bookmark CRUD, background/worker startup and browser evidence | `src/infrastructure/browser.ts:9`, `entrypoints/background.ts:25`, browser smoke JSON and screenshots | **NOT VERIFIED** | Real storage and alarm create/list/clear executed previously. Optional permissions were ungranted, so bookmark and notification operations did not run. |
| T00.05 | ADRs, domain/event/schema skeleton, ports, redacted local diagnostics, privacy defaults and synthetic fixtures | `src/domain/foundation.ts:3`, `src/infrastructure/db.ts:3`, scheduler and fixture tests | **PASS** | P00 skeleton exists. Diagnostics store only code/time; fixtures are synthetic. Application-layer browser access deviates from the prescribed boundary. |
| T00.06 | Required validation/smoke scripts, clear missing-browser failure, CI smoke | `scripts/verify-p00.mjs:4`, browser prerequisite checks, final logs/results and CI workflow | **NOT VERIFIED** | Local command execution has specific recorded evidence. Missing prerequisites fail explicitly. No successful hosted CI run was supplied or independently verified. |

## 3. Browser Compatibility Matrix

“Runtime tested” refers to inspected historical execution evidence. **No browser was launched during this audit.**

| Capability | Actual implementation and evidence | Runtime tested | Limitations | Result |
|---|---|---|---|---|
| Firefox New Tab | Generated `chrome_url_overrides.newtab`; Firefox harness lines 57–75; Firefox screenshot and smoke JSON | **YES, limited** | Firefox `155.0.1`, temporary installation. Harness reads `AboutNewTab.newTabURL`, then directly loads it; no browser New Tab action or offline test | **NOT VERIFIED** for full criterion |
| Firefox Home | `homepage: "newtab.html"` in generated manifest; browser-control instructions | **NO independently verifiable Home test** | Owner observation appears only as a report claim. Consent, decline, settings changes, conflicts and restoration untested | **NOT VERIFIED** |
| Chrome New Tab | MV3 service worker, local override; harness opens `chrome://newtab/`; screenshot and smoke JSON | **YES** | Chromium `153.0.8010.52`, unpacked/headless. Branded Chrome and offline execution untested | **PASS**, Chromium development scope |
| Chrome Home | No manifest Home override; conditional manual custom-address guidance | **NO** | Manual extension-URL acceptance untested; no automatic parity established | **NOT VERIFIED** |
| Bookmarks | Optional permission; permission guard; synthetic tree/create/update/delete probe with cleanup | **NO CRUD** | Both smoke JSON files record `GRANT_REVOKE_NOT_RUN`; adapter tests use mocks | **NOT VERIFIED** |
| Notifications | Optional permission; bundled icon; API-result distinction; click listener opens options | **NO native execution** | OS popup, icon visibility, callback, blocking and revocation untested | **NOT VERIFIED** |
| Alarms/background | Durable probe DB; alarm projection and startup reconciliation | **YES, create/list/clear only** | No due firing, closed-tab delivery, browser restart or worker termination evidence | **NOT VERIFIED** for lifecycle |
| Permissions | Required `storage`, `alarms`; optional `bookmarks`, `notifications`; no host permissions | **YES, initial state only** | Actual prompt denial/grant/revoke paths untested | **PASS** for static minimization; **NOT VERIFIED** for lifecycle |

Firefox’s relative bundled Home declaration and most-recent-extension precedence are supported by [Mozilla documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_settings_overrides). Documentation does not establish this installation’s consent or restoration behavior.

Chrome’s settings override mechanism has platform and publishing constraints; official documentation describes Windows/Mac support and domain verification. The repository appropriately avoids claiming an automatic Chrome Home override, but its manual fallback still needs execution evidence. [Chrome settings documentation](https://developer.chrome.com/docs/extensions/reference/manifest/chrome-settings-override)

## 4. Tests Run

### Independently executed during this audit

| Exact command | Environment | Exit code | Result | Evidence |
|---|---|---:|---|---|
| `npm run lint` | Current workspace, Linux/Node 24 | 0 | **PASS** | ESLint completed successfully |
| `./node_modules/.bin/tsc --noEmit --incremental false` | Existing generated WXT types | 0 | **PASS** | Compiler completed without diagnostics |
| `npm run format:check` | Current workspace | 0 | **PASS** | All matched files passed Prettier |
| `npm run test:security` | Current workspace | 0 | **PASS**, limited static suite | Current output reports one passing test-file unit, zero failures |

The direct compiler command verifies the current source against existing WXT types. It does **not** independently verify fresh `wxt prepare`.

Additional read-only inspections passed explicit generated-manifest assertions for both targets. Inspection of seven JS/HTML/CSS files per target found no matches for `eval(...)`, `new Function(...)`, or remote script-source patterns. These checks are narrower than a complete security audit.

### Historical executions with inspected, specific evidence

These were **not rerun**. Exit codes below come from `evidence/P00/final-results.json`, corroborated by the corresponding logs.

| Exact command | Recorded environment | Exit code | Result | Evidence |
|---|---|---:|---|---|
| `npm run typecheck` | Linux, Node 24, WXT 0.21.4 | 0 | **PASS** | `evidence/P00/final-typecheck.log` |
| `npm run unit` | Vitest 3.2.7 | 0 | **PASS: 11 tests** | `evidence/P00/final-unit.log` |
| `npm run test:integration` | Vitest, fake IndexedDB and browser doubles | 0 | **PASS: 6 tests** | `evidence/P00/final-test-integration.log` |
| `npm run build:firefox` | WXT 0.21.4, explicit MV3 | 0 | **PASS: build** | `evidence/P00/final-build-firefox.log` |
| `npm run build:chrome` | WXT 0.21.4, explicit MV3 | 0 | **PASS: build** | `evidence/P00/final-build-chrome.log` |
| `npm run inspect:manifests` | Generated dual-target builds | 0 | **PASS: manifest assertions** | `evidence/P00/final-inspect-manifests.log`; actual manifests inspected |
| `npm run test:smoke:firefox` | Firefox 155.0.1, temporary install | 0 | **PASS: limited harness scope** | `evidence/P00/firefox-smoke.json`, screenshot and log |
| `npm run test:smoke:chrome` | Chromium 153.0.8010.52, sandbox enabled | 0 | **PASS: limited harness scope** | `evidence/P00/chrome-smoke.json`, screenshot and log |

Recorded isolated installation used:

`npm ci --offline --ignore-scripts --cache /home/akira/Projects/git-contribute/Venus/.npm-cache`

Its summary records exit 0, followed by successful preparation, compiler and dual builds. This verifies the documented **offline, lifecycle-scripts-disabled** procedure, not unrestricted ordinary `npm ci`.

The screenshots exist and were visually inspected. Neither demonstrates Home behavior. Historical evidence is not cryptographically bound to a source revision.

## 5. Security Findings

| Severity | File and location | Risk | Recommended fix |
|---|---|---|---|
| **Critical — dependency advisory severity** | `package-lock.json:6885`, `tinypool 1.1.1`; Vitest chain | Reported prototype-pollution-to-code-execution gadget in tooling. Application exploitability was not demonstrated | Review a compatible patched tooling upgrade; regression-test and repeat dependency audit |
| **Critical — dependency advisory severity** | `package-lock.json:6498`, `shell-quote 1.10.0`; fx-runner/web-ext chain | Reported command-injection vulnerability in development tooling | Remediate through a reviewed compatible dependency change; avoid blind force fixes |
| **High** | `package-lock.json:5531`, `node-forge 1.4.0` | Reported signature-verification weakness in tooling dependency chain | Assess reachable use and supported remediation; record disposition |
| **Medium** | `package-lock.json:2172`, `@vitest/mocker 3.2.7` | Reported arbitrary file-read/path-traversal issue | Upgrade compatible Vitest/mocker combination and retest |
| **Low** | `tests/security.test.mjs:4` | Source-string assertions can pass while unsafe behavior exists elsewhere or in generated artifacts | Expand artifact and behavioral checks; retain manual review |

The first two advisories were independently checked against the [shell-quote advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv) and [Tinypool advisory](https://github.com/advisories/GHSA-85c8-ppgw-ccpr). Listed patched versions require compatibility review before adoption.

The archived full audit reports **nine affected packages: five critical, three high, one moderate**. Some are transitive impact entries, not nine separate root vulnerabilities. The archived production-only audit reports zero findings; neither audit was refreshed during this turn.

Positive findings:

- Necessary permissions are limited and optional where appropriate.
- CSP restricts scripts to bundled resources and disallows objects.
- No remote executable-code loading, unsafe HTML injection, hardcoded credentials, telemetry, mandatory account or backend was found in inspected application source.
- Native bookmark mutation targets one synthetic item and requires UI confirmation.
- Notification API acceptance is correctly distinguished from visible OS delivery.
- Diagnostics retain code/time rather than raw errors or private content.

Runtime network silence was **not verified** through traffic observation.

## 6. Rename Findings

Active product naming is consistent: manifest name, headings, HTML titles, notification text, fixtures and DB name use **Venus**.

Remaining non-brand protocol references:

| Location | Reference | Classification |
|---|---|---|
| `docs/07_PLUGIN_SYSTEM.md`, `docs/08_BACKUP_RESTORE.md`, `docs/01_FUNCTIONAL_REQUIREMENTS.md` | `ZDPS`, `.zplugin` | Legacy specification/protocol terminology |
| `contracts/plugin-manifest.schema.json`, P04 phase and backlog | `ZDPS` | Compatibility-sensitive contract terminology |
| Historical evidence | Earlier paths/names | Preserve execution history |

**Integrity issue:** 16 files differ from `SHA256SUMS.txt`. Nine mismatches were explainable by historical name substitutions plus line-ending normalization. Seven were not explained by that simple transformation:

- `README_FA.md`
- Both manifest schemas
- `docs/00_PRODUCT_CHARTER.md`
- `docs/08_BACKUP_RESTORE.md`
- `docs/10_DESIGN_I18N_A11Y.md`
- `docs/14_ASSUMPTIONS_AND_DECISIONS.md`

This does not establish unauthorized scope changes. It establishes that preservation against the original baseline is unresolved.

Recommended controlled migration: obtain the original approved snapshot, review a rename-only diff, preserve historical specifications/checksums, document approved replacements, and define compatibility before renaming schema identifiers, package formats, extension IDs or databases. Changing those identifiers can affect existing data and installations.

## 7. Missing Work / Defects

These priorities describe phase closure urgency; they do not imply every item is a demonstrated application security exploit.

| Priority | Issue and affected files | Specific correction |
|---|---|---|
| **P0 blocking** | Mandatory browser evidence missing; both smoke harnesses and browser checklist | Execute Home lifecycle, permission lifecycle, native APIs and restart/worker tests; capture versions, actions, logs and screenshots |
| **P0 blocking** | Unsigned `docs/implementation/ADR-001.md:4` and `docs/implementation/ADR-002.md:4` | Complete evidence, select supported targets, obtain explicit sign-off |
| **P1 important** | Unresolved dependency findings; package/lockfile | Remediate or provide reviewed, specific reachability/risk disposition; rerun relevant checks |
| **P1 important** | Startup/alarm race risk; `entrypoints/background.ts:58`, `src/infrastructure/db.ts:23`, scheduler | Test an overdue alarm waking a suspended worker. Recovery can mark it `missed` before `claimProbe`, which only accepts `pending`. Distinguish cold wake from shutdown recovery and coordinate processing |
| **P1 important** | Firefox New Tab smoke overstates coverage; harness lines 53–75 | Open an actual fresh tab through browser behavior and verify rendering offline |
| **P1 important** | CI execution and browser provisioning unverified; workflow/setup script | Obtain a successful hosted run and artifacts. Provision targets independently so unrelated downloads do not block both jobs |
| **P1 important** | Minimum Firefox 140 is advertised but untested | Test that minimum or adopt an evidence-supported minimum through ADR review |
| **P1 important** | Specification baseline mismatch | Reconcile against original approved files and document rename provenance |
| **P2 improvement** | Direct browser dependency in `src/application/probes.ts:1` | Inject a messaging/background port to follow the architecture boundary |
| **P2 improvement** | Stale README and THIRD_PARTY_NOTICES text | Update documented counts, installation evidence and harness prerequisites when edits are authorized |

The scheduler issue is a **source-derived race risk**, not a runtime failure observed during this audit.

**Existing report accuracy:** its overall “P00 incomplete” conclusion is supported. Its Home “owner-reported PASS” cannot be independently accepted without original evidence. Its Firefox smoke should describe registration/direct-render coverage more precisely. Its checksum discrepancy is accurate but does not distinguish rename-explained changes. The README remains behind the report’s newer results.

## 8. Acceptance Criteria

Every acceptance criterion from `phases/P00_FEASIBILITY_AND_BOOTSTRAP.md:28`:

| Acceptance criterion | Status | Evidence |
|---|---|---|
| Fresh Firefox New Tab renders bundled app | **NOT VERIFIED** | Registered override and direct page rendering have evidence; actual fresh-tab/offline behavior lacks specific proof |
| Home override attempted with browser-level evidence and fallback specified | **NOT VERIFIED** | Manifest and fallback exist; inspectable Home runtime evidence absent |
| Chrome MV3 builds and New Tab renders | **PASS**, Chromium dev scope | Successful explicit MV3 build, actual manifest, `chrome://newtab/` harness, JSON and screenshot |
| Alarm/notifications/bookmarks behavior and permissions tested in real target browser | **NOT VERIFIED** | Alarm create/list/clear only; optional native APIs and lifecycle paths untested |
| Firefox version/manifest explicitly pinned and ADR exists | **PASS**, declaration scope | Explicit MV3, minimum 140.0, recorded tested 155.0.1 and ADR-001; minimum support/sign-off remain open |
| Core tests run; report includes actual results | **PASS** | Inspected logs show 11 unit and six integration tests; independent read-only checks also passed |

Required exit deliverables:

| Exit deliverable | Status |
|---|---|
| Venus local New Tab on both targets; Home proof or platform workaround | **NOT VERIFIED** |
| Signed-off ADRs, manifest differences, permission plan and selected versions | **FAIL** — ADRs explicitly unsigned; paired manifests exist |
| Reproducible dual builds and CI skeleton | **PASS** for recorded isolated procedure and skeleton; hosted execution unverified |
| No remote code or unnecessary host permissions | **PASS** for inspected source/artifacts; runtime traffic unverified |

## 9. Final Recommendation

**Is P00 truly complete? No.**

**Can the owner authorize P01 now? The evidence does not support passing the approved P00 gate. Keep P01 on hold.**

Before closure:

1. Complete the missing browser lifecycle tests and actual Firefox New Tab test.
2. Investigate the worker-wake/recovery race.
3. Resolve dependency findings through reviewed remediation or explicit risk disposition.
4. Verify hosted CI and the supported browser minimum.
5. Reconcile specification integrity and correct evidence descriptions.
6. Sign off both ADRs after those results are available.

The owner’s manual checks should use disposable profiles and cover:

- Firefox Home accept/decline, settings control, competing overrides, disable/uninstall restoration.
- Actual New Tab and Home rendering offline.
- Bookmark permission deny/grant/revoke and confirmed synthetic CRUD.
- Visible notification icon/popup, click routing, OS blocking and closed-dashboard delivery.
- Restart before due, shutdown through due, missed recovery and Chrome worker suspension/wake.
- Chrome’s manual Home fallback, recording unsupported behavior honestly.

No P01 implementation or project edits were performed during the audit. Only this report file was subsequently added at the owner's request.
