# P00 owner verification — remaining real-world evidence

Use disposable desktop profiles, never a personal bookmark profile. Record OS, exact browser version, build source hash/commit, date, action, expected result, actual result, and sanitized screenshots/logs. A missing prerequisite is NOT VERIFIED, never PASS. This checklist does not authorize signing, publishing, commits, pushes, or ADR approval.

## Preparation

1. Use the current `.output/firefox-mv3` and `.output/chrome-mv3` builds after the remediation checks. Firefox temporary development: `npm run test:manual`. Chrome: open `chrome://extensions`, enable Developer mode in the disposable profile, Load unpacked → `.output/chrome-mv3`.
2. For regular Firefox consent/uninstall testing, obtain an owner-provided signed or otherwise developer-compatible installable package. A temporary Selenium/web-ext install is insufficient. If normal Firefox rejects an unsigned package, record that prerequisite; do not disable signing/security protections to make the test pass.
3. Identify the DB as `Venus-p00` and Firefox ID as `p00@Venus.invalid`. They have not changed. Export no real bookmarks or private data into evidence.

## Firefox Home / New Tab lifecycle (T00.02, T00.03)

| ID | Action | Expected evidence |
|---|---|---|
| F01 | Regular compatible install into a fresh profile; record installation and Home takeover UI; accept the supported Home choice | Exact consent text, chosen action, fresh Ctrl+T New Tab and Home button/Alt+Home both render Venus |
| F02 | Separate fresh profile: decline the Home choice wherever offered | Actual prompt/decline outcome; New Tab remains usable. If no decline prompt exists, record actual browser controls rather than inventing a flow |
| F03 | Work offline; open a fresh Ctrl+T tab and invoke Home | Bundled shell and Settings accessible with no remote redirect |
| F04 | Settings → Home → Homepage and new windows; change Home / remove extension control using the offered browser UI | User choice wins; New Tab still usable; app does not claim Home is enabled |
| F05 | Install an owner-known safe competing Home/New Tab override in the disposable profile | Record install order, actual precedence, browser conflict messages, and absence of misleading Venus claims |
| F06 | Disable Venus, then re-enable | Home/New Tab control changes as the browser documents; existing probe rows survive disable/re-enable |
| F07 | Record original Home; uninstall Venus | Original/browser-selected Home restored or exact divergence captured. Browser may erase extension-owned data on uninstall; do not demand unsupported uninstall data preservation |

Automated fresh-tab/offline success and temporary Home rendering do not replace F01/F02/F04–F07.

## Chrome Home fallback (T00.03)

In a disposable Chrome profile: Settings → Appearance → Show Home button → **New Tab page**. Click the actual Home button from an ordinary page; verify Venus renders offline. Then choose a different custom homepage and verify browser user control. Record competing override behavior. If a custom `chrome-extension://…/newtab.html` URL is tested, separately record acceptance/rejection and stability after restart. Do not assume that a successful New Tab test proves this Home-button path.

Source for the manual browser setting: https://support.google.com/chrome/answer/95314?hl=en. No automatic Chrome settings override is declared. Startup-page settings are different from Home.

## Optional permissions and native APIs (T00.04)

Run the following separately on Firefox and Chrome. Use the bundled Settings and platform tests page.

1. Inspect initial permissions: bookmarks and notifications should be false. Click Request bookmarks, deny via actual browser UI, then run the bookmark test and confirm a visible failure with no bookmark mutations.
2. Click Request bookmarks, grant, inspect true. Record the existing test-profile bookmark tree, accept the synthetic probe confirmation, run Test native bookmark read/write. It reads the tree, creates/updates one synthetic `example.invalid` bookmark, and removes only its own ID. Confirm no synthetic item remains and pre-existing test bookmarks are unchanged.
3. Revoke bookmarks through browser extension controls; retry and verify refusal. Also exercise the app Revoke button and inspect its result.
4. Request notifications; test actual deny, grant, and browser-level revoke. After denial/revocation, schedule a probe; the durable result must show blocked/failed rather than a false visible-delivery claim.
5. With notification permission granted and OS notifications enabled, schedule a 60-second probe, record its ID/deadline, and close all Venus tabs while keeping the browser running. Observe the actual popup/icon and click it. Expected routing: Venus options page. Record OS delivery separately from `api_accepted`.
6. Repeat with OS notification blocking. Record the actual API/native result and preserved internal due record; do not require browsers to detect OS blocking if their API does not expose it.
7. Do not label native notification action buttons tested: they are not implemented in P00.

## Alarms / restart / worker wake (T00.04)

1. Schedule the real 60-second probe and close the dashboard. After due time, reopen and read durable probe results. Confirm due and the correct native outcome.
2. Schedule another probe; restart the same browser/profile before the deadline. Confirm its ID/deadline persist and the alarm is present; allow it to fire and verify one attempt.
3. Schedule another probe; quit the entire browser through its deadline. Reopen that profile. Expected: missed/not_attempted, no burst of native popups.
4. Chrome: schedule a future probe, close extension inspection/devtools views (debugging can keep workers alive), use `chrome://serviceworker-internals` or an available browser worker-stop control to stop the extension worker, and record the actual stopped state. Keep the browser running through due time. Expected: worker wakes and durable due/native result appears once. A stop request returning success is not proof it stopped.
5. Firefox: repeat background wake/restart checks with the same installed compatible package; temporary extensions disappearing across restart are an unavailable prerequisite, not a pass.

## Minimum Firefox and hosted CI (T00.02, T00.06)

- Firefox 140.0 is still the configured provisional minimum. Run F01/F03 and all native API/session/restart checks on that exact version in isolation, or review ADR-001's proposal to use the actually tested 155.0.1 as the initial minimum. No minimum change or ESR certification has been made automatically.
- No Git remote or GitHub CLI was available in the remediation workspace. Provide the repository/run URL. After owner-authorized commit/push, GitHub → Actions → P00 → Run workflow on the candidate revision. Check `checks`, `browsers (firefox)`, and `browsers (chrome)` individually; download both evidence artifacts and retain run URL, revision, command exits and browser versions. Browser download/setup errors must remain failures. Do not equate workflow YAML with a successful hosted run.

## Baseline provenance and ADR sign-off

Provide the original approved PRD snapshot or confirm the provenance of SHA256SUMS.txt. The reconciliation script found 24 exact files and reconstructed all 16 mismatches by brand replacements/newlines with matching original SHA-256. It did not change specifications, checksum baseline, schema identifiers, package formats, extension ID or DB name. This proves byte equivalence to the existing baseline, not independent provenance of that baseline.

Review ADR-001 and ADR-002 after the missing results are attached. Both remain proposed and unsigned. Explicitly record approved browser targets/minimum, Firefox Home consent/control behavior, Chrome fallback limitations, and the residual node-forge security disposition. Do not authorize P01 merely because local checks pass.

Return a table with `ID | browser/OS | exact action | observed result | PASS/FAIL/NOT VERIFIED | evidence`. Mark each accept/decline/revoke path independently. No owner results are prefilled here.
