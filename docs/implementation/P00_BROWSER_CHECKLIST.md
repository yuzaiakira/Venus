# P00 real-browser evidence checklist

Current remediation evidence: see P00_REMEDIATION_REPORT.md and P00_OWNER_VERIFICATION.md. Firefox fresh New Tab and temporary-install Home rendering passed offline. Chromium New Tab, closed-tab due delivery (native blocked), restart before due, and shutdown-through-due recovery passed. Real grant/deny/revoke, native OS display/click, regular Home lifecycle, minimum Firefox and hosted CI remain NOT VERIFIED. Worker suspension remained NOT VERIFIED despite an accepted stop request. The continuation table below describes historical evidence, not current source acceptance.

Run in fresh disposable profiles; record browser/OS/version, generated manifest, screenshots, error codes and exact action/result. Temporary automation install is not regular install consent evidence. Do not mark any step passed without observing it.

1. Firefox: install developer-compatible package; capture install consent and Home takeover prompt; accept/decline paths. Open actual New Tab offline, then Home. Confirm same bundled shell.
2. Firefox: change Settings → Home, disable extension control, confirm New Tab remains usable. Install a known test override extension; capture precedence. Disable/uninstall Venus; verify restoration. Do not alter personal profiles.
3. Chrome: load MV3 unpacked build, open actual New Tab offline. Observe worker cold start. Check Home settings/manual fallback acceptance; record unsupported behavior without claiming parity.
4. Permissions: inspect initial denied optional permissions; request bookmarks via explicit click, deny then grant; run confirmed synthetic read/create/update/delete probe; revoke and verify clear failure without unrelated bookmark mutations.
5. Notifications: request/deny/revoke; schedule probe, close dashboard while browser stays open, observe icon and actual OS popup separately from API acceptance. Click popup and inspect options routing. Block OS notifications and record durable native result. Action buttons are not implemented; internal results remain available.
6. Alarms: schedule 60-second probe; restart before due and confirm rescheduling; shut down through due and confirm missed result on reopen. Trigger duplicate delivery and verify one durable claim. Chrome: terminate worker and verify reconstruction. Record potential at-most-once native attempt loss if process dies after claim; production retry semantics belong to P03.
7. Reopen local DB and permission state; check FA/EN, keyboard focus, actionable error messages. Capture screens and browser logs without private data.

## Evidence status — 2026-10-09 continuation

| Check | Observed status | Evidence / gap |
|---|---|---|
| Firefox 155.0.1 New Tab | PASS, isolated temporary developer install | firefox-smoke.json and firefox-newtab.png; registered override and bundled page render |
| Chromium 153.0.8010.52 MV3 New Tab | PASS, isolated unpacked install, Chromium sandbox enabled | chrome-smoke.json and chrome-newtab.png |
| Both targets: storage and alarm create/list/clear | PASS | apiEvidence in both smoke JSON files; no due delivery/restart exercised |
| Bookmarks / notifications permissions | PARTIAL: initially ungranted observed | No real prompt denial, grant/revoke or native operation evidence |
| Firefox Home | PARTIAL: owner development rendering observation | Regular install consent, conflicts, browser control and restoration NOT RUN |
| Native notifications | NOT RUN | OS popup, icon, click, OS blocking and closed-dashboard delivery require desktop observation |
| Browser restart / Chrome worker recovery | NOT RUN | Harnesses do not retain/restart profiles; same disposable profile must be used for step 6 |
| Chrome manual Home fallback | NOT RUN | Settings acceptance not demonstrated |

For each pending step record browser/OS/version, exact action, expected result, observed result, probe ID/time, screenshot or sanitized log, and pass/fail. Record accept and decline paths independently. Do not substitute API doubles, ungranted permission observation, temporary install or API acceptance for these checks. If regular installation needs a signed/developer-compatible package, record that prerequisite rather than weakening signing/security controls.

P00 remains NOT ACCEPTED. See P00_REPORT.md for exact commands, audit findings, source-checksum discrepancy and unresolved gates. P01 has not started.
