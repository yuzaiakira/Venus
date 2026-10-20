# P00 dependency compatibility and reachability review

Date: 2026-10-09. This is engineering analysis, not owner acceptance of residual risk.

## Proposed changes, analyzed before installation

- Vitest 3.2.7 → exact 4.1.11. This is a development-only major upgrade, justified by GHSA-82fw-gwwq-j7x9: the first patched stable mocker/Vitest line is 4.1.11. Registry metadata accepts Vite 6/7/8 and Node 20/22/24; the current workspace has Node 24.19.0 and Vite 6.4.4. No application dependencies change. Reviewed the official v4 migration guide: the repository has no removed poolOptions, custom pools, browser-mode projects, coverage configuration, class mocks, snapshot dependence on mock names, or vite-node APIs. Its explicit imports, hoisted module mock, fake-indexeddb setup, vi.fn mocks, and assertions require regression execution rather than a speculative rewrite. Vitest 4 removes tinypool entirely, avoiding an incompatible tinypool 1→2 override.
- Scoped override `fx-runner > shell-quote = 1.11.0`. fx-runner 1.6.0 pins 1.10.0; 1.11.0 fixes GHSA-pqg4-j6r4-53mv. This is a minor update in the same package major. Installed fx-runner uses `parse`, not the advisory's `quote` sink; preserve and exercise argument parsing plus Firefox startup. Scope the override to fx-runner, not all dependency trees. No downgrade of WXT/web-ext and no `npm audit fix --force`.
- Keep node-forge 1.4.0 pending upstream fix. Registry latest is 1.4.0 and GHSA-86w9-cpqp-85rv states no patched version. Do not invent a patch or use an incompatible web-ext downgrade. It is reached through web-ext's Android adbkit tooling, not the bundled extension. Inspect installed call sites and record residual use after the final audit. Absence from production dependencies is not a blanket development security clearance.

## Advisory context

| Package | Advisory / exposure | Disposition |
|---|---|---|
| tinypool 1.1.1 | GHSA-85c8-ppgw-ccpr and GHSA-5gmw-xhrv-c9v3, worker option prototype pollution/code execution gadget | Remove through reviewed Vitest 4 migration; verify final tree |
| @vitest/mocker 3.2.7 | GHSA-82fw-gwwq-j7x9, redirect mock arbitrary file read through exposed dev-server integration | Upgrade together with Vitest. Existing Node-mode test runner does not configure public mocker/interceptor server or browser mode |
| shell-quote 1.10.0 | GHSA-pqg4-j6r4-53mv, quote() command injection | Scoped minor upgrade; current fx-runner call site uses parse() |
| node-forge 1.4.0 | GHSA-86w9-cpqp-85rv, RSA signature verification | No patched registry version; residual risk remains open. No Android run/signing/distribution clearance claimed |

## Sources

- https://v4.vitest.dev/guide/migration.html
- https://github.com/advisories/GHSA-82fw-gwwq-j7x9
- https://github.com/advisories/GHSA-85c8-ppgw-ccpr
- https://github.com/advisories/GHSA-pqg4-j6r4-53mv
- https://github.com/advisories/GHSA-86w9-cpqp-85rv

Final installed versions, audit counts, command exits and residual disposition must be read from P00_REMEDIATION_REPORT.md and evidence/P00/remediation, not inferred from this pre-install analysis.

## Executed outcome and residual reachability

Installation succeeded with lifecycle scripts disabled. The final dependency tree contains Vitest/@vitest/mocker 4.1.11, shell-quote 1.11.0 scoped to fx-runner, and no tinypool. Current full audit: four high affected-package entries (node-forge, adbkit, web-ext, WXT), zero critical/moderate; production-only audit: zero reported vulnerabilities. The four entries share the remaining node-forge advisory rather than representing four independent root vulnerabilities. Unit/integration tests, shell argument parsing regression, dual builds and offline browser smokes were executed successfully. These results are not inferred from metadata alone.

Installed call sites confirm a real verification sink: `node_modules/@devicefarmer/adbkit/dist/src/adb/tcpusb/socket.js:182` and `:200` call `key.verify`; `dist/src/adb/auth.js` constructs a node-forge RSA public key. The sink is in Android ADB authentication, not Venus browser code. Desktop P00 build/smoke commands do not request an Android runner/TCPUSB bridge; no node-forge import occurs in application source or production dependencies. Loading a tooling module is not proof its sink is executed. Do not claim the library safe in all configurations: Android/TCPUSB use can reach verification, and no upstream patch is published. Residual disposition remains open for owner/security review; no signing, Android testing or distribution clearance is granted here.

The argument parsing test resolves shell-quote from fx-runner's own dependency scope and verifies both the patched version and quoted profile/argument behavior. The static artifact test requires nonempty built outputs and scans their JS/HTML/CSS for dynamic execution/remote script tags. Static checks do not prove all runtime network behavior or exploit reachability.
