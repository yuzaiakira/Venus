# P00 Firefox F01 — signing and regular-install prerequisites

Status: preparation and recommendation only. No AMO upload/submission, ID change, ADR approval, risk approval, commit, push or P01 authorization. F01 remains **NOT VERIFIED**.

## Inspected candidate

`.output/firefox-mv3` is an unsigned build directory, version `0.0.1`. No compatible signed XPI is established. Manifest uses fixed ID `p00@Venus.invalid`, provisional desktop minimum `140.0`, `background.scripts`, bundled `newtab.html` for both Home and New Tab, required storage/alarms and optional bookmarks/notifications. WXT configuration matches the ID. IndexedDB is `Venus-p00`, schema version 1. No production code or identifiers were changed during this review.

## Identity recommendation requiring owner decision

The existing ID is already explicit and stable if retained; its development-oriented name does not itself make it temporary. Mozilla requires an explicit ID for MV3 and checks uniqueness on submission. Local inspection cannot establish AMO availability or ownership. An email-style ID is an identifier, not an inbox requirement or proof of domain ownership.

Recommended for a package intended to become the beta/public update line: select a permanent identity **before first signing**. Prefer an owner-approved UUID in braces, generated once and recorded permanently, when there is no established owner-controlled domain. An email-style ID under an owner-controlled namespace is an alternative. No specific replacement has been generated, reserved or applied. Do not assume an invented Venus domain belongs to the owner.

If this remains a disposable P00 spike, retaining `p00@Venus.invalid` for a separately signed test add-on is reasonable, with the explicit understanding that the future product may be a different add-on. Do not advertise a migration or continuity promise between those identities. If the owner wants this P00 package to receive future beta updates directly, settle the permanent identity now.

### Update and data consequences

- Firefox and AMO use the ID to identify the add-on, its updates and associated data stores. Future updates must retain the selected identity, use higher versions and be submitted under the existing AMO add-on record. Changing the ID creates a different add-on rather than an update to existing installations.
- A new ID has separate extension storage and an extension origin. Existing `storage.local` settings and IndexedDB rows are not automatically transferred. Keeping the same database name `Venus-p00` does not bridge separate origins. Old data is not deleted merely by editing the ID in source, but it is unavailable to the new identity; uninstalling the old add-on can remove its data. Do not uninstall as a migration strategy.
- Same-ID updates are the continuity path, subject to compatible app schemas and actual persistence tests; the ID alone does not certify migration safety. Firefox's internal `moz-extension` UUID is distinct from the manifest ID, so never hard-code it.
- Current P00 implements synthetic probes, not the full approved backup/restore system. No supported cross-ID migration exists. Use only disposable profiles and synthetic data for F01. If meaningful development data exists, preserve the old installation and arrange an explicitly approved, validated export/migration before switching; no personal profile should be used.
- Installing two different-ID candidates can make them competing Home/New Tab overrides. F01 needs a fresh profile with a single candidate; this is separate from F05 conflict testing.
- Existing evidence remains evidence for the original ID/build only. An authorized ID change requires rebuilding, manifest inspection, checks and recording new artifact hashes; never rewrite historical evidence as though it tested the new identity. Keep the DB name/schema unchanged unless separately authorized.
- This Firefox ID change would not by itself change Chrome's extension identity. Review any future external integrations or ID-based references independently.

## Local readiness checks actually executed

`./node_modules/.bin/web-ext lint --source-dir .output/firefox-mv3 --output text` exited 0 with **0 errors, 0 notices and 4 warnings**:

| Finding | Disposition |
|---|---|
| Android minimum 140 predates Android support for `data_collection_permissions` at 142 | Unresolved. Desktop Firefox is the P00 target; no Android support or minimum change approved. Review submitted platform scope and manifest validation before upload. |
| 48px icon declaration references a 96px image | Unresolved. An asset/manifest fix requires explicit authorization. |
| Two unsafe dynamic `innerHTML` assignment findings in the built bundle | Unresolved. Inspect generated locations and trace to source/library usage before proposing a fix or disposition. Do not treat local lint exit 0 as security approval. |

The validator also printed an update-check configuration-access failure under `/home/akira/.config`; no configuration ownership or permissions were changed. No AMO validation was performed. Remaining prior dependency risk and unsigned ADRs remain open.

## Staged prerequisites before any submission

1. Owner chooses whether to keep a separate P00 test identity or authorize a permanent replacement. Any code change needs explicit approval; this document does not implement it.
2. Review the four lint warnings and outstanding distribution/license placeholders and dependency disposition. Present concrete necessary fixes for authorization; do not silently approve security risk or browser-target changes.
3. After identity/fixes are settled, prepare a local extension ZIP containing only the production build files with `manifest.json` at its root. Prepare a matching source ZIP containing `package.json`, `package-lock.json`, WXT/TS configuration, entrypoints, source and public assets, plus reviewer build instructions and any other build-required inputs. Exclude secrets, personal data, browser profiles, Git internals, dependencies and unrelated test evidence. Inspect archive contents before requesting upload approval.
4. Reviewer instructions must state exact environment/tool versions and commands, including a lockfile-based install, WXT preparation if install scripts are disabled, and `npm run build:firefox`. Verify in isolation that the submitted source recreates the packaged output; record hashes. Historical reproduction evidence supports the unchanged candidate only and is not certification of an unprepared source archive.
5. Owner reviews the exact package/source archives, hashes, ID, version, manifest, warnings and submission notes. **Ask for explicit approval to upload those exact files to Mozilla AMO's unlisted channel.** Local preparation or ID approval is not upload approval.

Archives are intentionally not finalized before the identity decision; no signed or submission-ready package is claimed.

## Official unlisted signing path, after explicit approval

Use the owner's Mozilla/AMO account through the website. Choose **On your own** (self-distribution/unlisted), upload the approved archive, review validator findings, supply matching source/build instructions, then complete the submission. Download Mozilla's signed XPI from the submitted version after signing. This does not create a public listing but does send files to Mozilla and is subject to its policies/agreement and possible review. Do not request API credentials, passwords, secrets or tokens in chat or reports. Do not upload any file before approval; the initial upload is already a submission of data to Mozilla.

The current manifest has no `update_url`. For this isolated F01 test, manual installation of the signed XPI suffices; no update service is required. Unlisted automatic updates would require a separately planned self-hosted update manifest/URL. Do not add a hosted update mechanism without owner authorization.

## Installation prerequisites and guided sequence

After obtaining and inspecting the signed XPI, establish the owner's exact Firefox release/version and OS, ensure it meets the declared minimum, and record that minimum 140 remains runtime-unverified. Use a separate fresh disposable profile with no sync, personal data or competing overrides; never modify the normal profile or signature enforcement. Create/launch it through an isolated profile workflow once the test is ready, guiding one action at a time and waiting for each observation.

Record the original Home/browser setting before regular installation. Guide installation through Firefox's normal add-on file-install flow. Record separately: initial installation text and chosen action; Home-change consent text/action if offered (or absence); actual Home button/Alt+Home rendering; fresh Ctrl+T rendering; browser-managed Home control. Do not infer active control from the manifest or predict exact prompt wording. Await each actual observation before advancing. F04 changes browser control separately; F02 decline needs a separate profile.

Until that package is available, **F01 is NOT VERIFIED**. F03 temporary-install offline testing is an optional separate path, never F01 completion or regular-install consent evidence.

## Official references

- [Add-on identity and signing prerequisites](https://extensionworkshop.com/documentation/develop/extensions-and-the-add-on-id/)
- [AMO submission and unlisted signed download](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Source and reproducible build requirements](https://extensionworkshop.com/documentation/publish/source-code-submission/)
- [Self-distribution and updates](https://extensionworkshop.com/documentation/publish/self-distribution/)
- [Extension local storage and uninstall](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/local)
- [IndexedDB same-origin storage](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## Approved local identity implementation follow-up

The owner subsequently approved `{935006c2-63b4-4e03-b842-11b88571da3b}` for both beta/release, while preserving `p00@Venus.invalid` exclusively for disposable P00 development. Separate local channels and unsigned beta/source archives are now implemented. This supersedes the earlier identity-choice pending state, not the historical evidence or outstanding signing/regular-install gate. See `P00_BETA_IDENTITY_IMPLEMENTATION_REPORT.md` for exact hashes, lint findings, reproduction and browser command failures. No upload/signing/distribution authorization exists. ADRs remain proposed; F01 remains NOT VERIFIED.
