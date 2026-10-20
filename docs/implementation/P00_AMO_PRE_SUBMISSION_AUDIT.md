# P00 AMO pre-submission audit

Date: 2026-10-10. Read-only inspection of the local Firefox beta archives. No upload, signing, publication, credential use, package edit, production-code change, commit, push, ADR acceptance, residual-risk approval, or P01 work was performed. P00 is not complete.

## Recommendation

**NO-GO** for requesting owner approval to upload these exact archives.

The extension archive matches the expected hash and is internally consistent with the beta build. The source archive matches its expected hash and the recorded reproduction. Those facts are not enough to ask for upload approval. Mozilla submission is distribution under the Add-on Policies and the Firefox Add-on Distribution Agreement. This project’s license is still a placeholder, required third-party notices are not in either archive, and AMO ownership of the permanent UUID has not been shown. Changing notices or the license file would produce new hashes, so these current files should not be treated as the approval candidate.

Wait for a separate owner decision on license text, notices, and the AMO account that will own `{935006c2-63b4-4e03-b842-11b88571da3b}`. Then regenerate, re-hash, and request approval of those new exact files. Do not upload in the meantime.

## Archives inspected

| Path | Bytes | SHA-256 computed this audit | Expected | Result |
|---|---:|---|---|---|
| `.output-beta/packages/venus-beta-0.0.1-unsigned.zip` | 157901 | `7dbf5fbd6615d2262420e09ee883e3317d8fefb0693a6feff376408dc00e7850` | same | **PASS** |
| `.output-beta/packages/venus-beta-0.0.1-source.zip` | 111431 | `ca9df52ba88df3a369ea7fbfee06410f5d7dcfc3401906fcaa75711a3db63b07` | same | **PASS** |

Hashes were computed with `sha256sum` and again with Python `hashlib.sha256` over the file bytes. They match each other and the expected values. ZIP entries use deflate, date `1980-01-01 00:00:00`, mode `100644`, and are not encrypted or symlinks.

These two ZIPs are the only files that would be submitted, after a later approval of whatever hashes exist at that time:

- Extension: `.output-beta/packages/venus-beta-0.0.1-unsigned.zip`
- Source: `.output-beta/packages/venus-beta-0.0.1-source.zip`

The inventory JSON is local evidence. It is not an AMO upload file.

## Policy sources reviewed

Current Mozilla documents checked for this audit, not a legal opinion:

- [Signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/) — unlisted/self-distributed add-ons still require AMO signing, automated validation, and remain subject to the Add-on Policies and the Distribution Agreement. Manual review can happen after signing.
- [Source code submission](https://extensionworkshop.com/documentation/publish/source-code-submission/) — minified or bundled code requires human-readable source, a lockfile, and build instructions. Obfuscation is not allowed. Source uploads are for review and are not redistributed by Mozilla.
- [Add-on Policies, source-code section](https://github.com/mozilla/extension-workshop/blob/master/src/content/documentation/publish/add-on-policies.md) — dependencies must be in the source package or fetched from official package managers during the build.
- [Data collection consent, 3 November 2025](https://blog.mozilla.org/addons/2025/10/23/data-collection-consent-changes-for-new-firefox-extensions/) and [built-in consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) — new extensions must declare `data_collection_permissions`. `required: ["none"]` is the explicit no-collection value and cannot be combined with other types.
- [browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings) and [chrome_settings_overrides](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_settings_overrides) — MV3 signing requires an ID; homepage may be a bundled relative URL.

## Audit results

| Requirement | Result | Evidence |
|---|---|---|
| Extension SHA-256 | **PASS** | Matches `7dbf5fbd…` |
| Source SHA-256 | **PASS** | Matches `ca9df52b…` |
| Permanent Firefox UUID | **PASS** in the manifest; **NOT VERIFIED** on AMO | Manifest `browser_specific_settings.gecko.id` is `{935006c2-63b4-4e03-b842-11b88571da3b}`. AMO uniqueness and account ownership are checked only at first submission |
| MV3 manifest | **PASS** | `manifest_version` 3, version `0.0.1`, background `scripts: ["background.js"]` |
| Home and New Tab | **PASS** for manifest references | `chrome_settings_overrides.homepage` and `chrome_url_overrides.newtab` are both the bundled `newtab.html`. Regular-install consent is still **NOT VERIFIED** |
| Permissions and CSP | **PASS** | Required `storage`, `alarms`. Optional `bookmarks`, `notifications`. No host permissions, content scripts, or `update_url`. CSP `script-src 'self'; object-src 'none'` |
| Technical-preview description | **PASS** | “Local-only P00 technical preview… no full workspace features. Firefox requests Home replacement.” |
| Icon dimensions | **PASS** | PNG signature valid. `icons/icon-48.png` is 48×48 (298 bytes). `icons/icon.png` is 96×96 (253 bytes). Both match `public/icons/` and the source ZIP |
| No development-only files in the extension | **PASS** | 10 allowlisted files. No `localhost`, Vite client, HMR, `eval(`, `new Function`, or remote `<script src>` |
| No credentials, tokens, private keys, or personal data | **PASS** for both ZIPs | Keyword hits are React’s input-type list (`password`), the packager’s private-key rejection regex, test names, CSP tokens, and the npm package `js-tokens`. No private-key block, cloud key, or personal profile |
| Extension ZIP matches the beta build | **PASS** | All 10 files match `.output-beta/firefox-mv3` byte for byte |
| Source ZIP matches the build inputs | **PASS** | 44 source files match the working tree. `README_AMO_BUILD.md` is generated inside the archive only |
| Reviewer build instructions | **PASS** with a documentation gap | `README_AMO_BUILD.md` records linux x64, Node v24.19.0, npm 11.17.0, WXT 0.21.4, Python 3.14.7, `npm ci --ignore-scripts`, `wxt prepare`, `build:firefox:beta`, and the package command. It does not link to Node, npm, or Python download pages |
| Dependencies required to build | **PASS** | `package-lock.json` is in the source ZIP. Production dependencies are Dexie 4.0.11, React 19.1.0, React DOM 19.1.0, and Zod 3.24.2, installed from the npm registry during the recorded build |
| Reproducibility in the recorded environment | **PASS** for the recorded run | `evidence/P00/webdriver-resolution/after/repro/` shows offline `npm ci`, WXT 0.21.4 production build, and packaging, all exit 0. `reproduction.json` records both ZIP hashes equal to the hashes computed in this audit. This audit did not rebuild again |
| Firefox lint | **PASS** as validation, warnings retained | `web-ext lint --source-dir .output-beta/firefox-mv3` exit 0: 0 errors, 0 notices, 3 warnings. See below |
| Third-party and project license | **FAIL** as distribution clearance | Project `LICENSE` is an explicit placeholder. `THIRD_PARTY_NOTICES` says it is not clearance. Neither file is in either ZIP. Bundled production licenses are MIT (React, React DOM, Zod) and Apache-2.0 (Dexie) |
| Desktop-only claim | **NOT VERIFIED** as an install block | `gecko_android` is absent, so no Android product is declared. The linter still evaluates Firefox for Android 140 against the data-collection key. Omission is not evidence that a self-distributed XPI cannot be installed on Android |
| Data-collection declaration | **PASS** for the inspected local behavior | `required: ["none"]`. Inspected extension and application source show local storage, alarms, optional permission probes, and bundled UI. No host permission or remote script. This is not a traffic capture |
| WebDriver fix scope | **PASS** | See the next section |
| Minimum Firefox 140 | **NOT VERIFIED** | Declared `strict_min_version` is `140.0`. Recorded execution is Firefox 155.0.1 |
| Regular Home consent / F01 | **NOT VERIFIED** | Temporary developer install only |

## Firefox lint warnings

Re-run on 2026-10-10 against `.output-beta/firefox-mv3`. Exit 0. The update-check message on stderr is a local web-ext config permission warning, not an add-on finding.

| Warning | Where | Explanation |
|---|---|---|
| `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` | `manifest.json` | `strict_min_version` 140 is older than Firefox for Android 142, which is when `data_collection_permissions` is supported. The manifest does not declare `gecko_android`. The warning is visible and was not suppressed |
| `UNSAFE_VAR_ASSIGNMENT` | `chunks/App-Bj8s9EPH.js:49` column 1807 | Minified React DOM assigns `element.innerHTML` from `dangerouslySetInnerHTML.__html` when that prop object is present |
| `UNSAFE_VAR_ASSIGNMENT` | same file, column 4676 | Second React DOM assignment on the same path for the custom-element branch |

Application source under `src/` and `entrypoints/` does not call `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function`. The string `dangerouslySetInnerHTML` appears only inside the React DOM bundle. The earlier browser check stored a hostile-looking probe payload and read it back as JSON text. That remains a scoped rendering check, not proof about every future caller. CSP does not remove the vendor sink. No vendor patch and no security-exception approval is implied.

## WebDriver fix

The shutdown fix lives only in `scripts/smoke-firefox.mjs`, which is source-package input and is not an extension file. For the disposable Selenium profile it writes `policies.json` and sets:

- `UserMessaging.FirefoxLabs: false`
- `DisableFirefoxStudies: true`
- `DisableRemoteImprovements: true`
- preferences `app.shield.optoutstudies.enabled`, `nimbus.rollouts.enabled`, and `datareporting.healthreport.uploadEnabled` set to false

`src/`, `entrypoints/`, and `wxt.config.ts` do not set those policies or preferences. The extension ZIP hash is unchanged from the pre-fix archive. CSP, permissions, ID, and storage code are unchanged. The policies reduce Nimbus and studies in the test browser only. They do not grant the extension extra permissions.

Recorded separation, from `evidence/P00/webdriver-resolution/after/`:

| Layer | Result |
|---|---|
| Product assertions | P00 fresh offline New Tab and temporary Home rendering passed. Identity isolation, retained P00 data, and text-boundary checks passed |
| Harness teardown | `firefox-teardown.json` records `restore-online` PASS and `driver.quit` PASS. Quit errors are still written and rethrown |
| Compatibility still open | Firefox 140 not executed. Regular-install Home consent, decline, conflict, disable, and uninstall not verified. Android not certified. Worker suspension and native permission prompts remain separate open items |

## Extension ZIP (10 files)

| Path | Bytes | SHA-256 |
|---|---:|---|
| `assets/App-OzzWFVdl.css` | 304 | `041ca156a46e473086089a902827fb6004ea2b72dca239f458dc67e171202a9c` |
| `background.js` | 158674 | `ef700f2b47c415de67d20ee25639b6a5652ea237efb3b3f18e06f9f09f373a5e` |
| `chunks/App-Bj8s9EPH.js` | 353401 | `ee26309aabe73f0f5979a232356e09136d33f38656aafc1dbfc72b0d8616b89f` |
| `chunks/newtab-CQoZP86l.js` | 187 | `fadffe8e99a33e49c50f4261156420f2826e58d7560805b8298265de3ca56772` |
| `chunks/options-CQoZP86l.js` | 187 | `fadffe8e99a33e49c50f4261156420f2826e58d7560805b8298265de3ca56772` |
| `icons/icon-48.png` | 298 | `3eb720562dc0e18bb6fba550175ec9f7c0a6648d4e864e085062dcd93ff06fd9` |
| `icons/icon.png` | 253 | `732633369916ac1b7e8bfb1e786276b0916634f18692e69c5fad65a7ba7e8a2e` |
| `manifest.json` | 863 | `69b69f198a9257df2d0c03935b11a6a7b6ba11c427c0d0775ca964de8f9d944a` |
| `newtab.html` | 456 | `79ff85126771e1fd8aa2a9ee21d261a4aa921ac42e079c487a06746a5492e6f7` |
| `options.html` | 457 | `f7a0b082a5e59165a562bd8dfab13098382c623dab7c1d74f48301773e579ef6` |

## What could block or delay AMO

These are not claimed as current validator errors. `web-ext lint` reported no errors.

- **License and notices (distribution blocker for this recommendation).** MIT and Apache-2.0 obligations apply to code bundled in `background.js` and `chunks/App-Bj8s9EPH.js`. The project license file grants nothing. Uploading before that is resolved would ask Mozilla to sign code whose distribution terms are still unset.
- **UUID availability.** AMO rejects a new add-on when the ID is already registered to another account. That check has not been run. No API credentials were used.
- **Reviewer questions, not local errors.** The three lint warnings need the explanations above in the submission notes. Missing Node/npm/Python download links can cause a reviewer to ask for clearer build steps. The source ZIP also contains the test harness, including the disposable Firefox policy workaround; that is build-repo material, not extension code, and should be described as such if a reviewer asks.
- **Offline `npm ci` printed “found 0 vulnerabilities”.** That installer line is not a new advisory review. The recorded network audit still leaves node-forge 1.4.0 open through web-ext’s Android adbkit path. It is not in the extension bundle or production dependencies. This audit does not accept that residual risk.

## Can stay open until P00 acceptance

- Firefox 140 execution and any minimum-version decision.
- Regular-install Home consent, decline, competing extensions, disable, and uninstall.
- Android behavior, if the owner keeps a desktop-only scope and says so in the reviewer notes.
- Native bookmark and notification consent, OS notification display, and Chrome worker suspension.
- Hosted CI.
- ADR-001 and ADR-002, which remain proposed.
- node-forge residual disposition.
- Optional stronger reviewer instructions (download links, an explicit “desktop notes” paragraph). Those edits belong in a later source archive, not a silent rewrite of this one.

## Recommended changes, not applied

1. Owner selects the project license and replaces the placeholder.
2. Generate third-party notices from the locked production dependencies and include the required MIT and Apache-2.0 texts in the source archive. Put a short notice in the extension package only if the chosen compliance approach requires it. Either choice needs new hashes.
3. Add reviewer-note text for the three lint warnings, desktop scope, and the fact that `scripts/smoke-firefox.mjs` policies affect only the disposable test profile.
4. Confirm, outside this audit, that the Mozilla account which will submit the add-on is the one that should own `{935006c2-63b4-4e03-b842-11b88571da3b}`.
5. After those decisions, rebuild only what changed, regenerate both ZIPs, and repeat the hash and reproduction check before any upload-approval request.

No package bytes were changed by this audit.
