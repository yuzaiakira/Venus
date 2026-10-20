# Venus P00 — Guided manual verification log

This log records observed results incrementally. It is not a P00 closure approval. No ADR or residual risk is approved by the agent. Browser tests will proceed one instruction at a time, beginning with Chrome Home fallback, then Firefox F01–F07 and the remaining owner checklist.

## Build/source prerequisite

Status: **PASS — build/source correspondence only**, verified 2026-10-09.

- Current source revision: `ace184fa0b267c4af908aede62014b696db9ebf5`.
- All 32 recorded source hashes match `evidence/P00/remediation/final-results.json`. That historical run used the remediated, then-uncommitted source on base revision `3885dcf`; the current commit contains those same recorded source bytes.
- `npm run build:firefox > /tmp/venus-p00-manual-build-firefox.log 2>&1`: executed, exit 0.
- `npm run build:chrome > /tmp/venus-p00-manual-build-chrome.log 2>&1`: executed, exit 0.
- Compared the existing artifacts, snapshotted before rebuilding, with the new output: all nine files per target are byte-identical, with identical file sets.
- Both manifests match the recorded remediation manifests.
- Evidence: `evidence/P00/manual/BUILD_SOURCE_VERIFICATION.json`, `build-firefox.log`, `build-chrome.log`. The JSON records every output file's SHA-256 and the current revision.
- The first comparison script failed on sandbox subprocess EPERM while reading Git revision; an approved outside-sandbox retry completed with exit 0. That failure is not a build or browser test pass.

Build paths for these manual tests: `.output/chrome-mv3` and `.output/firefox-mv3`. Application source was not changed. Rebuilding generated artifacts does not verify manual browser behavior.

## Owner observations

| Test | Status | Evidence / next action |
|---|---|---|
| CH-HOME-01 — Actual Home button opens Venus offline | **PASS (OWNER-REPORTED)** | Google Chrome 154.0.8037.57 (Official Build), Linux x86_64; Home configured as New Tab page. Owner confirms actual Home button opened Venus with internet disabled. Specific observation only; see record below. |
| CH-HOME-02 — Home configuration and fresh New Tab in separate disposable profile | **PASS (OWNER-REPORTED)** | All three observations below passed; owner confirmed Linux x86_64, Google Chrome 154.0.8037.57 (Official Build), separate disposable testing profile. Historical use of this ID for offline Settings is retained below; offline Settings remains NOT VERIFIED. |
| Offline Settings access (historically labeled CH-HOME-02) | **NOT VERIFIED** | Owner has not confirmed testing Settings offline. |
| CH-HOME-03 — Home behavior after restart | **NOT VERIFIED** | Owner has not confirmed a restart test. |
| CH-HOME-04 — Competing override behavior | **NOT VERIFIED** | Owner has not confirmed testing a competing extension. |
| CH-HOME-05 — Changing Home configuration / user control | **PASS (OWNER-REPORTED), scoped** | Covered by the new CH-HOME-02 custom Home and fresh Ctrl+T observations only; no further browser-control scenarios verified. Previous record was NOT VERIFIED before this owner report. |
| Firefox F01–F07 | **NOT VERIFIED** | Not started in this guided session. Regular consent/install tests require a compatible signed/developer-compatible package; do not disable browser protections. |
| Permission lifecycle / native bookmark CRUD | **NOT VERIFIED** | Not started in this guided session. |
| Native notification display / callbacks | **NOT VERIFIED** | Not started in this guided session. |
| Alarm lifecycle / worker suspension | **NOT VERIFIED** | Not started in this guided session; prior scoped automated results remain in remediation evidence. |
| Hosted CI | **NOT VERIFIED** | Awaiting repository/run evidence after available browser checks. |
| Firefox minimum-version selection | **NOT VERIFIED** | Awaiting exact-version evidence and owner decision. |
| ADR and residual-risk review | **PENDING OWNER** | No agent approval; review after evidence collection. |

### CH-HOME-01 evidence record

- Recorded: **2026-10-09 15:48:59 UTC**. Actual execution date/time has not yet been supplied; this is the report-recording date, not an assumed test date.
- Environment clarification received: **2026-10-09**, through the owner's follow-up message; this does not establish the actual test date.
- Browser: **Google Chrome 154.0.8037.57 (Official Build)**, as reported by the owner. This is distinct from the earlier automated Chromium 153.0.8010.52 environment.
- Operating system / architecture: **Linux / x86_64**, as reported by the owner.
- Home setting: **New Tab page**, explicitly confirmed by the owner.
- Internet connection: **disabled during the test**, explicitly confirmed by the owner; the disabling method is not yet specified.
- Expected result: clicking Chrome's actual Home button opens the locally bundled Venus dashboard while internet access is disabled.
- Actual observation: owner reports that clicking Chrome's Home button successfully opened the Venus dashboard while the internet connection was disabled.
- Evidence source: **OWNER-REPORTED**, explicit owner statement in this conversation: “Clicking Chrome's Home button successfully opened the Venus dashboard while offline.”
- Status: **PASS (OWNER-REPORTED)** for this specific observed behavior. This is not an independent runtime reproduction or approval of the complete Home acceptance task.
- Screenshots/runtime logs: none supplied for this manual observation; none are invented or attributed from earlier automated runs.
- Metadata originally awaiting owner confirmation: actual test date, disposable-profile use, loaded build/source identity, starting page, and method used to disable internet access. Subsequent owner clarification establishes that CH-HOME-01 used the owner's **main Chrome profile**, distinct from CH-HOME-02's separate disposable profile. Other metadata remains unconfirmed. The earlier build/source verification does not establish which build the owner loaded.
- Not covered by this observation: offline Venus Settings, Chrome Settings behavior beyond the reported Home selection, restart, permission lifecycle, competing extensions, changing Home configuration/user control, subsequent New Tab behavior, or any Firefox test. Those checks remain **NOT VERIFIED** in this guided session.
- Historical next question was whether a disposable browser profile was used; the subsequent clarification above resolves it. No P01 work, ADR sign-off or residual-risk approval follows from this observation.

### CH-HOME-02 evidence record — subsequent owner report

The owner uses CH-HOME-02 for the following three observations. The earlier table used that ID for offline Settings access; that historical pending check remains separately **NOT VERIFIED** and is not satisfied by these results.

- Profile: **separate disposable Google Chrome testing profile**, explicitly owner-reported. CH-HOME-01 instead used the owner's main Chrome profile with internet disabled.
- Exact environment: **CONFIRMED (OWNER-REPORTED)** — Linux x86_64, Google Chrome 154.0.8037.57 (Official Build), separate disposable testing profile. This was initially awaiting confirmation; the owner's subsequent message explicitly confirmed the same environment for CH-HOME-02 and reaffirmed all three passes. No actual test timestamp was supplied.
- Home set to **New Tab page**; clicking the real Home button opened Venus: **PASS (OWNER-REPORTED)**.
- Home changed to **https://example.com**; clicking Home opened that website: **PASS (OWNER-REPORTED)**.
- With that custom Home still configured, a fresh tab opened using **Ctrl+T** displayed Venus: **PASS (OWNER-REPORTED)**.
- Evidence source: the owner's explicit three-result report in this conversation. No screenshots or browser logs supplied. No test timestamp, network state, loaded build identity or additional actions inferred.
- Chrome restart, competing extensions, offline Settings and all other unperformed scenarios remain **NOT VERIFIED**. Historical reports and automated evidence remain unchanged.

### Firefox F01 prerequisite inspection

- Inspected `.output/firefox-mv3/manifest.json`, `wxt.config.ts`, package scripts and repository installation artifacts. Current output is an unsigned build directory; no XPI or ZIP package was found in the repository (excluding dependencies and Git internals). No compatible Mozilla-signed regular-install package is available in the inspected workspace; owner-held packages have not been established.
- Manifest: MV3, version `0.0.1`, ID **`p00@Venus.invalid`**, provisional minimum **`140.0`**, Home `chrome_settings_overrides.homepage: newtab.html`, fresh New Tab `chrome_url_overrides.newtab: newtab.html`, Firefox `background.scripts`, required `storage`/`alarms`, optional `bookmarks`/`notifications`, data collection required `none`. Identifiers and production code were not changed.
- MV3 signing requires an explicit add-on ID, which is present. This does not establish AMO ownership/availability of the ID or successful validation/signing. Minimum-version runtime certification remains unverified.
- Official regular-release path: prepare the build archive with manifest at its root; use Mozilla AMO's **On your own** (unlisted/self-distribution) submission; provide matching source and reproducible build instructions for the bundled code as required; complete validation/review and download the Mozilla-signed XPI. Unlisted is not a public AMO listing, but submits the package/source to Mozilla and remains subject to Mozilla policies and distribution agreement. No submission has been made; explicit owner approval is required first. Website submission avoids any need to share API credentials in chat or reports.
- References: https://extensionworkshop.com/documentation/publish/submitting-an-add-on/ ; https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/ ; https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/ .
- **F01: NOT VERIFIED — regular-install prerequisite unavailable.** Installation prompts, Home consent, actual Home rendering, fresh New Tab rendering and browser control are each **NOT VERIFIED for F01**, independently of historical temporary-install results.
- F03 temporary-install offline testing can be offered separately in a disposable Firefox profile; it cannot complete F01. No personal Firefox profile or signature-enforcement setting was touched. P01, ADR approval and security-risk approval remain outside this work.

Final P00 closure report will be produced after the available checks and owner observations have been recorded.

### Firefox F01 signing readiness follow-up

- Owner requested an ID review before submission; no identifier change or submission authorized. Review and staged prerequisites are in `P00_FIREFOX_SIGNING_PREREQUISITES.md`.
- Executed `./node_modules/.bin/web-ext lint --source-dir .output/firefox-mv3 --output text`: exit 0, **0 errors, 0 notices, 4 warnings**. Warnings: Android minimum-version support for `data_collection_permissions`, icon declared at 48px using a 96px file, and two `UNSAFE_VAR_ASSIGNMENT`/`innerHTML` findings. Findings remain unresolved; no security disposition approved. Local lint does not prove AMO acceptance or signing.
- The command also reported an update-check failure accessing `/home/akira/.config`; the validator completed. No permission/configuration changes were made to resolve the advisory update check.
- Current ID, minimum, DB name/schema and application source remain unchanged. F01 and all its separate observations remain **NOT VERIFIED** pending a compatible signed package and owner-led browser test.

### Approved local beta identity implementation

Owner approved permanent beta/release UUID `{935006c2-63b4-4e03-b842-11b88571da3b}` and local build/security/packaging work only. P00 remains `p00@Venus.invalid`. New isolated outputs and unsigned beta/source archives are recorded in `P00_BETA_IDENTITY_IMPLEMENTATION_REPORT.md`. Local checks/reproduction pass; Firefox temporary-install storage isolation and hostile-text assertions pass, but the combined browser command fails during WebDriver shutdown (exit 1). Those scoped results do not complete F01. No Mozilla submission, signed artifact, personal-profile modification, ADR/risk approval, commit/push or P01 work occurred. CH-HOME owner records and all unperformed scenarios retain their prior scope/status.
