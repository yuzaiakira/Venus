# P00 — Feasibility, Browser Spikes & Repository Bootstrap

**Goal:** demonstrate platform feasibility before building business features.  
**Depends:** approved PRD.  
**Blocks:** P01+.

## Work packages

**T00.01 — Repo baseline.** Initialize WXT + React + strict TypeScript; pnpm (or documented npm) lockfile; lint/formatter, Vitest, Playwright harness, per-target build scripts. Bundle all UI scripts/assets. Add LICENSE/THIRD_PARTY_NOTICES placeholders and README for contributors.

**T00.02 — Firefox/Chrome manifest spike.** Build Firefox explicit MV3 and test AMO-relevant features; if impossible, choose supported MV2 for Firefox and record reason/ADR, maintain Chrome MV3. Inspect generated manifest. Add CI jobs for both.

**T00.03 — New Tab and Home feasibility.** Test local bundled New Tab; Home override using `chrome_settings_overrides.homepage` if platform/manifest permits, including actual install/uninstall conflict/consent behavior. Test changing browser Home settings, precedence and user control. Write platform capability matrix and truthful UI fallback; do not create fake runtime switch.

**T00.04 — Browser API spike.** Permission prompts and grant/revoke; alarms on browser restart; notification icon and callback support; bookmark tree read/write, service-worker/background startup; settings permissions on Chrome. Capture runtime screenshots/error logs and browser versions.

**T00.05 — Foundation contracts.** Create architecture ADRs, event/data model skeleton, browser ports/interfaces, schema baseline. Set up local diagnostics redaction and privacy defaults. Create fixture only (fake personal data).

**T00.06 — CI smoke.** `typecheck`, `lint`, `unit`, `build:firefox`, `build:chrome`, `test:smoke:firefox`, `test:smoke:chrome`; tasks should fail clearly if browser binary unavailable, not auto-mark pass.

## Exit deliverables

- Minimal extension showing 'Venus' local page as New Tab in Firefox and Chrome dev; Home proof or explicit platform workaround.
- Signed-off ADR-001 and ADR-002 with evidence; manifest diffs; permission plan and selected target browsers/versions.
- Reproducible dual-target builds and CI skeleton.
- No remote code or unnecessary host permissions.

## P00 acceptance

[ ] Fresh Firefox New Tab renders bundled app.
[ ] Home override attempted with browser-level evidence and fallback specified.
[ ] Chrome MV3 builds and New Tab renders.
[ ] Alarm/notifications/bookmarks behavior and permissions tested in real target browser.
[ ] Firefox version/manifest explicitly pinned and ADR exists.
[ ] Core tests run; report includes actual results.

**Stop condition:** If Home cannot be changed programmatically within store policy, implement documented manual path, do not promise the impossible, ask owner only if this materially conflicts with target.
