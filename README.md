# Venus Workspace — P00

Original Venus Workspace code is under the MIT License, `Copyright (c) 2026 Akira Yuzai`. See `LICENSE`. Bundled libraries keep their own licenses; see `THIRD_PARTY_NOTICES.md` and `licenses/`. The Venus name and icons are not a registered trademark.

Local-only Firefox-first feasibility source, WXT + React + strict TypeScript. P00 acceptance remains open; P01 has not started. Read [P00 remediation report](docs/implementation/P00_REMEDIATION_REPORT.md) for current execution evidence and [owner verification](docs/implementation/P00_OWNER_VERIFICATION.md) for missing real-world checks. P00_REPORT.md and the independent audit retain historical results.

## Tooling

Node 24; npm is the documented fallback to pnpm. Direct dependencies are exact pins with a checked-in npm lockfile. Vitest 4.1.11 and a scoped shell-quote 1.11.0 override follow the compatibility analysis in docs/implementation/P00_DEPENDENCY_REVIEW.md. The refreshed full audit retains the node-forge high-severity tooling chain; no release security clearance is claimed.

For a fresh checkout use the exact lockfile. `npm ci --ignore-scripts` avoids dependency lifecycle execution; run `npm run typecheck` to explicitly prepare WXT types afterward. Ordinary `npm ci` also invokes the project's `postinstall` WXT preparation and dependency lifecycle scripts. See the remediation report for the exact fresh-install procedure actually executed. No audit result is inferred from an offline installer summary. Formatting: `npm run format:check`.

## Browser checks

Use disposable profiles. Firefox development build declares a browser-managed Home replacement: review consent and disable controls. `npm run test:manual` launches web-ext. Never use a personal profile for probes. Firefox smoke discovers a cached geckodriver or uses GECKODRIVER_BIN; FIREFOX_BIN overrides the executable. Chromium smoke discovers system/bundled Chromium or uses CHROME_BIN, runs headless by default, and keeps Chromium's security sandbox enabled. Set P00_HEADED=1 for a graphical session. Missing prerequisites fail explicitly.

`npm run dev` starts Firefox MV3 development. All target build scripts specify manifest version. The configured Firefox minimum 140.0 remains provisional; runtime evidence is for 155.0.1, not ESR or minimum-version certification. Chrome Home guidance now offers the browser's Home → New Tab page setting first; actual Home-button fallback remains an owner check. ADRs remain proposed and unsigned. No signing/store publication occurs.

## Completing the P00 evidence gate

`npm run setup:browsers -- firefox` downloads only geckodriver; `npm run setup:browsers -- chrome` downloads only Chromium. Omitting the argument downloads both. Downloads are isolated in `.browser-cache`, retry up to three times and fail honestly. CI provisions each target independently; hosted execution is still NOT VERIFIED without a run URL/artifacts.

`P00_EVIDENCE_DIR=evidence/P00/remediation npm run p00:verify` runs lint, typecheck, unit/integration tests, formatting, dual builds, manifest/security checks and both installed-extension smokes. It records exits, source hashes and Git revision/dirty status in final-results.json. The target manifest differences are captured explicitly. Leaving P00_EVIDENCE_DIR unset preserves the original default directory, so use a new evidence directory when retaining earlier runs.

`P00_EVIDENCE_DIR=evidence/P00/remediation P00_LIFECYCLE=1 npm run test:smoke:chrome` also tests real 60-second alarm/tab closure and same-profile restart recovery. It records worker-stop outcome separately and exits nonzero if suspension cannot be verified; consent and OS display remain owner checks. A Chromium result never certifies branded Chrome/store behavior.

Firefox smoke invokes the real browser New Tab command offline rather than directly navigating to the extension URL. It also attempts the browser Home command on a temporary install, recording Home separately. Chromium smoke opens its New Tab page offline. API probes inspect real storage/alarms and optional permission state. Native bookmark/notification paths execute only if granted; unexecuted paths remain unverified. Install consent, grant/deny/revoke, visible OS popups/callbacks, Home conflicts/restoration and unverified lifecycle cases require the owner checklist. Unit/integration API doubles are not browser evidence.

`node scripts/reconcile-prd.mjs` records byte-level comparison to SHA256SUMS.txt. It never rewrites specifications, baseline checksums or compatibility identifiers. The original approved snapshot/provenance still requires owner confirmation.
