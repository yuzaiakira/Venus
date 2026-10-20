# P01 to P02 conditional transition

Date: 2026-10-10.

Status: **P01 has CONDITIONAL OWNER ACCEPTANCE.** It is not an unconditional clean verification PASS. **P00 remains NOT PASS.** ADR-001 and ADR-002 remain proposed and unsigned. The node-forge residual security risk remains open and is not approved. This record authorizes Phase P02 only. It does not authorize Mozilla upload, signing, publication, commit, or push.

## Owner decision

The project owner reviewed `docs/implementation/P01_ACCEPTANCE_REMEDIATION_REPORT.md` and approved the completed P01 product functionality under this conditional acceptance. The owner explicitly authorized beginning Phase P02, subject to the restrictions in that request and in this file.

## What the conditional acceptance covers

The major P01 product gaps from the independent audit have been remediated. Supporting evidence is in `docs/implementation/P01_ACCEPTANCE_REMEDIATION_REPORT.md` and `evidence/P01/remediation/`.

- Per-profile theme, wallpaper, blur, glass opacity, and accent, with null fields inheriting bootstrap defaults.
- Persistence of those settings across a disposable Chromium process restart.
- Local wallpaper upload, including type and size rejection.
- Reduced motion.
- Layout isolation and widget-fault isolation without a pixel assertion.
- Onboarding permission copy for a controlled denial, without treating that adapter as native permission acceptance.
- Package and channel validation after rebuilding beta and release trees from the P01 source.

Historical audit failures stay historical. `evidence/P01/acceptance/` and the pre-P01 archive hashes under `evidence/P01/historical-pre-p01-packages/` were not rewritten.

## What this acceptance does not close

| Item                                               | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P00 phase acceptance                               | **NOT PASS**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Firefox identity smoke command                     | **Exit 1.** Application assertions in `evidence/P01/remediation/identity/firefox-identity.json` passed on the rerun (p00 id `p00@Venus.invalid`, beta id `{935006c2-63b4-4e03-b842-11b88571da3b}`, storage and IndexedDB isolation, p00 retention, unsafe HTML rendered as text). `evidence/P01/remediation/identity/firefox-teardown.json` records `driver.quit` **FAIL**: `WebDriverError: Failed to decode response from marionette`. The first regression run exited 1 earlier because the probe button was clicked on `newtab.html`. |
| Native optional-permission grant, deny, and revoke | **NOT VERIFIED**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Firefox regular-install lifecycle                  | **NOT VERIFIED**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Firefox process restart                            | **NOT VERIFIED**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Chrome Home for the P01 dashboard                  | **NOT VERIFIED** on this build. Earlier owner Home notes do not certify the P01 tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-001 and ADR-002                                | **Proposed, unsigned**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| node-forge residual risk                           | **Open, not approved**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Mozilla upload or publication                      | **Not authorized**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

The controlled permission adapter and smoke lines that say `DENIED_OBSERVED` do not satisfy native P00 permission acceptance.

## Unresolved test-harness issue

Track: Marionette / WebDriver shutdown failure.

The disposable Firefox identity command can finish the application checks and still exit 1 because `driver.quit()` fails while decoding the Marionette response. `evidence/P01/remediation/smoke-firefox/firefox-teardown.json` recorded `driver.quit` PASS on the separate P00 smoke. The identity rerun recorded `driver.quit` FAIL. Both records stand.

Rules for later verification:

- Keep successful application assertions separate from teardown.
- Do not change a failed command exit to PASS.
- Investigate this harness failure when it affects P02 browser verification.
- If a product assertion fails, stop that work and investigate before continuing.

## P02 boundary

P02 may implement the tasks in `phases/P02_PRODUCTIVITY_MODULES.md` only. P03 is not authorized. Optional bookmark and notification behavior must report missing, denied, dismissed, failed, and unsupported results honestly. A simulated permission result does not close the P00 permission lifecycle.
