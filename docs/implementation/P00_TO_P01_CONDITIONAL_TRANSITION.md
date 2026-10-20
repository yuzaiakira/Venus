# P00 to P01 conditional transition

Date: 2026-10-10.

Status: **P00 is NOT PASS.** ADR-001 and ADR-002 remain proposed and unsigned. This record is the owner's limited authorization to start P01. It does not accept P00, waive any P00 acceptance criterion, approve a security exception, or authorize Mozilla upload, signing, publication, commit, or push.

## Owner authorization

The project owner authorized Phase P01 under a documented exception to the original P00 completion gate. The stated reason is that core feasibility, browser builds, local tests, extension identity architecture, packaging, and MIT licensing are stable enough for controlled product work.

P00 stays open. Deferred external verification and release-readiness tasks stay visible until they are actually done.

## Completed P00 evidence (not phase acceptance)

Local work that may be treated as input to P01:

- WXT + React + TypeScript extension. Firefox and Chrome MV3 builds exist.
- Disposable Firefox ID `p00@Venus.invalid`. Beta and release ID `{935006c2-63b4-4e03-b842-11b88571da3b}`. These IDs are unchanged.
- IndexedDB name `Venus-p00`, schema version 1, `probes` store. P01 must migrate forward without deleting those rows.
- Required permissions `storage` and `alarms`. Optional `bookmarks` and `notifications`. No host permissions. CSP `script-src 'self'; object-src 'none'`.
- Firefox manifest points Home and New Tab at bundled `newtab.html`. Chrome has New Tab only and a manual Home path.
- Temporary-install Firefox smoke can render the bundled heading offline, including a Home command in that disposable session. That is not regular-install consent (F01).
- Chrome New Tab smoke has rendered the bundled heading.
- Alarm create/list/clear and durable probe recovery exist in code and local tests. API doubles are not native proof.
- WebDriver `driver.quit()` crash during offline Marionette shutdown was traced to Nimbus and addressed in the disposable smoke profile only. A failed quit still fails the command.
- MIT license for original Venus code, `Copyright (c) 2026 Akira Yuzai`, with third-party notices for React, React DOM, scheduler, Dexie, and Zod. Packaging tests check those texts.
- `data_collection_permissions.required` is `["none"]`.

Primary reports: `P00_REPORT.md`, `P00_REMEDIATION_REPORT.md`, `P00_INDEPENDENT_AUDIT.md`, `P00_BROWSER_CHECKLIST.md`, `P00_OWNER_VERIFICATION.md`, `P00_FIREFOX_WEBDRIVER_RESOLUTION.md`, `P00_FIREFOX_SIGNING_PREREQUISITES.md`, `P00_BETA_IDENTITY_IMPLEMENTATION_REPORT.md`, `P00_DEPENDENCY_REVIEW.md`, `P00_AMO_PRE_SUBMISSION_AUDIT.md`, `P00_AMO_MIT_LICENSE_REMEDIATION_REPORT.md`.

The pre-submission audit's NO-GO applied to archives from before the MIT remediation. The remediation report replaced license placeholders and regenerated local archives. That regeneration is not submission, not AMO ownership proof, and not P00 acceptance.

## Outstanding P00 acceptance requirements

These remain open. P01 must not mark them passed.

| Item                                                                                                                                           | State                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P00 phase acceptance and task closure for T00.01–T00.06                                                                                        | **NOT PASS**                                                                                                                                                                                                                                                                                                                                                                     |
| ADR-001 and ADR-002                                                                                                                            | **Proposed, unsigned**                                                                                                                                                                                                                                                                                                                                                           |
| Mozilla AMO signing, upload, and publication                                                                                                   | **Not authorized. Not done**                                                                                                                                                                                                                                                                                                                                                     |
| AMO account ownership of `{935006c2-63b4-4e03-b842-11b88571da3b}`                                                                              | **NOT VERIFIED**                                                                                                                                                                                                                                                                                                                                                                 |
| Regular-install Firefox lifecycle F01, F02, F04–F07 (consent, decline, user Home control, competing overrides, disable/uninstall, restoration) | **NOT VERIFIED**                                                                                                                                                                                                                                                                                                                                                                 |
| Minimum Firefox 140 runtime, ESR, and Android                                                                                                  | **NOT VERIFIED.** Declared minimum remains 140.0. Recorded execution is Firefox 155.0.1                                                                                                                                                                                                                                                                                          |
| Native bookmark and notification grant, deny, revoke, OS display, and click                                                                    | **NOT VERIFIED**                                                                                                                                                                                                                                                                                                                                                                 |
| Alarm due firing, worker suspension, restart, and closed-browser behavior as specified in the owner checklist                                  | **NOT VERIFIED** beyond local create/list/clear and recovery code                                                                                                                                                                                                                                                                                                                |
| Hosted CI run on the candidate revision                                                                                                        | **NOT VERIFIED**                                                                                                                                                                                                                                                                                                                                                                 |
| Residual `node-forge` risk through web-ext (GHSA-86w9-cpqp-85rv, no patched 1.4.0)                                                             | **Open. No exception approved**                                                                                                                                                                                                                                                                                                                                                  |
| Original PRD checksum provenance                                                                                                               | **Not independently established**                                                                                                                                                                                                                                                                                                                                                |
| Chrome manual Home-button path                                                                                                                 | **Split.** P00 owner observations CH-HOME-01, CH-HOME-02, and scoped CH-HOME-05 are **PASS (OWNER-REPORTED)** for the earlier P00 build in `P00_MANUAL_VERIFICATION_LOG.md`. They do not certify the P01 dashboard. CH-HOME-03 restart, CH-HOME-04 competing extensions, and offline Settings remain **NOT VERIFIED**. No P01 Chrome Home retest is recorded in this transition. |

## Chrome Home evidence reconciliation

The table row above previously said the Chrome manual Home path was **NOT VERIFIED**. That contradicted `P00_MANUAL_VERIFICATION_LOG.md`. The log stands. This section only separates what that log already recorded from later P01 work.

Owner-verified behavior of the earlier P00 build, recorded 2026-10-09 as **PASS (OWNER-REPORTED)**:

- CH-HOME-01: Home opened Venus offline in Chrome 154.0.8037.57 on Linux x86_64, using the owner's main profile, with Home set to the New Tab page. The loaded build identity, test timestamp, and method used to disable the network were not established.
- CH-HOME-02: In a separate disposable Chrome profile, on the same browser and architecture, Home set to the New Tab page opened Venus; Home changed to `https://example.com` opened that site; Ctrl+T still opened Venus.
- CH-HOME-05: scoped to those CH-HOME-02 custom-Home and fresh-tab observations only.

Those observations are not a certification of the current P01 dashboard. P00 remains **NOT PASS**.

Still **NOT VERIFIED** in that log, and not closed by P01: CH-HOME-03 restart, CH-HOME-04 competing extensions, and offline Settings. Firefox regular-install Home lifecycle F01 remains **NOT VERIFIED**.

## Dependencies and risks affecting P01

No P01 task is fully blocked. These constraints bind the implementation:

- Home and New Tab behavior stay on the P00 manifest split. The dashboard may replace the feasibility page, and the heading remains `Venus` so existing smoke checks still recognize the bundled shell. Copy must keep saying that regular-install consent and Chrome Home are not verified.
- Onboarding may request the existing optional permissions and must continue when the user denies them. A simulated denial does not close T00.04.
- Database changes are an additive Dexie version 2 on `Venus-p00`. The `probes` table stays. There is no rename and no automatic wipe.
- Bootstrap preferences live in `storage.local`. Layout profiles, widget instances, shared fixture rows, and local images live in Dexie. One field has one store.
- Extension IDs, permission lists, CSP, `strict_min_version`, and `data_collection_permissions` stay as they are. Manifest name and description stay as the P00 packaging checks require, including the beta sentence that full workspace features are not in this package. P01 is the dashboard shell, not the later modules.
- No new production dependency. Calendar display uses platform `Intl`. Drag and keyboard layout stay in-repo.
- Command palette starter actions are limited to dashboard actions that exist in P01. Creating notes, tasks, events, or timers is not implemented and must not report success.
- P00 probe controls remain on the options page.

## Deferred P00 checks before beta or public release

Complete these before any beta or public release. P01 does not replace them.

1. Owner review and explicit sign-off of ADR-001 and ADR-002, including the Firefox minimum, Home behavior, and Chrome fallback.
2. Regular Firefox install lifecycle F01–F07 on a signed or otherwise owner-accepted package. Temporary WebDriver install does not count.
3. Native permission grant, deny, and revoke for bookmarks and notifications on Firefox and Chrome, including OS notification display versus API acceptance.
4. Alarm restart, worker wake, and closed-browser recovery on the real target browsers.
5. Run the same required checks on Firefox 140.0, or change the declared minimum only through a signed ADR if 155.0.1 is the chosen floor.
6. Hosted CI for typecheck, lint, unit, both builds, and both smokes, with retained run URLs and artifacts.
7. Confirm AMO ownership of the permanent UUID in the owner's Mozilla account before any upload. Upload still needs a separate authorization.
8. Dispose of the node-forge advisory by an upstream fix or a recorded owner decision. Do not treat absence from the extension bundle as clearance.
9. Keep the MIT texts and third-party notices in any future archive, and re-hash archives after any manifest or bundle change. Do not submit the current hashes as if they were already approved.

## Explicit acknowledgement

P00 is **NOT PASS**. Its ADRs remain **pending**. Starting P01 does not close Mozilla signing, regular-install Firefox lifecycle, minimum Firefox compatibility, native permission and notification tests, hosted CI, residual dependency risk, or any other owner decision listed above.
