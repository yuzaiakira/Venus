# P02 acceptance remediation

Date: 2026-10-10. This report records local fixes and a re-audit. It does not accept P02, does not start P03, and does not approve ADR-001, ADR-002, ADR-010, or the node-forge residual risk. Extension ids are unchanged: `p00@Venus.invalid` and `{935006c2-63b4-4e03-b842-11b88571da3b}`. Nothing was uploaded, signed, committed, or pushed.

## Recommendation

**GO** to request owner acceptance of P02.

The defects that made the independent audit NO-GO were reproduced and then fixed in disposable Chromium 153.0.8010.52. Notes no longer lose a revision after Pin, Archive, Trash, or “Use stored note.” Links, task editing, and local bookmark folders are in the UI. A live IndexedDB 20 to 30 upgrade kept the seeded P00 probe and P01 profile, widget, and shared item. Firefox 155.0.1 smoke and identity both exited 0, including `driver.quit()`.

**NO-GO** to start P03.

P03 still needs a separate explicit owner authorization. Native bookmark grant, denial, revoke, and browser-bookmark editing remain P00 work and were not treated as done. ADR-010 is proposed only.

## 1. Root cause and revision contract

`NoteEditor` stored `expected` from the first render. Pin, Archive, and Trash called `saveNote` and ignored the returned revision. The next save still sent the old revision, so IndexedDB rejected it as a conflict and the click looked like a failure. “Use stored note” copied the React prop, set the status to saved, and left `dirty` true. The 400ms autosave then wrote the draft again with the stale revision and the conflict returned.

The editor now keeps one expected revision in a ref. Saves run through a single queue. A successful mutation, including Pin, Unpin, Archive, Trash, and Restore, stores the revision returned by `saveNote`. Autosave does not run while the status is `conflict`. “Keep my draft” writes the current draft with the revision loaded from storage, so a newer write still conflicts instead of being overwritten. “Use stored note” loads the stored note, replaces the draft, clears `dirty`, and does not write. An open editor does not adopt another tab’s revision by itself. That keeps two open editors on the revision they started with, so the second save conflicts instead of replacing the first.

## 2. Changed files

- `src/app/library.tsx` — revision queue, link controls, task editor, local bookmark folders and edit, parent-folder select
- `src/app/settings.tsx` — web search provider and custom HTTPS template
- `src/domain/productivity.ts` — `applyBlockLink`
- `src/locales/messages.ts` — English and Persian strings for the new controls
- `scripts/p02-acceptance.mjs` — disposable Chromium regression, including a real version-20 seed
- `scripts/smoke-firefox.mjs` — disposable Firefox distribution policies
- `tests/unit/productivity.test.ts` — unsafe link marks
- `tests/integration/migration.test.ts` — version-2 profile, widget, and shared item survive (from the audit)
- `docs/implementation/ADR-010-editor-library.md` — proposed, not approved
- `docs/implementation/P02_ACCEPTANCE_REMEDIATION_REPORT.md` — this report

## 3. Task ids

T02.01, T02.02, T02.03, T02.04, T02.05, and T02.06 were exercised again. This report does not mark them owner-accepted.

## 4. Notes revision and autosave

Disposable Chromium, `node scripts/p02-acceptance.mjs`, exit 0. Evidence: `evidence/P02/results.json` and `evidence/P02/remediation/browser.out`. Browser: Chromium 153.0.8010.52. Profile: temporary directory under `/tmp`, removed after the run.

| Check | Result |
|---|---|
| Create, edit, autosave, reload | PASS (`note-persists`) |
| Pin, then edit, then autosave | PASS (`edit-after-pin`) |
| Archive, trash, restore | PASS (`archive-trash-restore`) |
| Conflict, Use stored note, status saved, stored title unchanged | PASS (`use-stored-note`) |
| Conflict, Keep my draft, stored title becomes the draft | PASS (`keep-my-draft`) |
| Two tabs | PASS (`two-tab-conflict`) |
| Simulated `IDBObjectStore.put` failure, draft kept, stored title unchanged | PASS (`autosave-failure`) |

## 5. Two-tab conflict

Tab B opened “Shared note.” Tab A saved “From tab A.” Tab B’s draft “From tab B” stayed in the field. The status was `conflict`, the stored title stayed “From tab A,” and the stored revision stayed at the revision from tab A. The conflict text says nothing was overwritten. “Keep my draft” then stored “From tab B” at the next revision. “Use stored note” on a later conflict showed “Stored side,” left that title in IndexedDB, and returned the status to saved.

## 6. Link editor

FR-050 allows safe editor JSON. Tiptap was not added. The block editor can set a link, and Remove link clears it. `javascript:alert(1)` shows the rejection string and is not stored. `https://example.com/orbit` is stored, then removed. Reload of an injected `javascript:` mark renders no `javascript:` anchor. An `https://example.com/note` mark still renders. HTML paste stays a JSON text node: `window.__venusXss` stayed 0 and no script element was created.

`docs/03_ARCHITECTURE.md` names Tiptap and says to record an ADR for a substitution. `docs/implementation/ADR-010-editor-library.md` proposes keeping the restricted JSON editor. Status: proposed. This report does not approve it.

## 7. Tasks

Create, edit title to “Focus alpha renamed,” edit details to “Bring the lens,” set priority to 1, set due date `2026-10-12`, reject a non-UUID event id (`eventId` stayed null), complete, reload, and reopen all passed. Focus ranks 1, 2, and 3 were unique. The fourth task stayed outside focus. No reminder firing or calendar UI was added.

## 8. Local bookmarks

`javascript:` and `file:` were rejected. A local folder was created. A bookmark was saved into that folder, renamed to “Docs renamed,” and removed only after “Confirm local bookmark removal.” After removal the local bookmark store was empty. Persian RTL showed direction `rtl`, source ونوس, and bookmark خانه. English LTR passed on the dashboard. Browser bookmark confirmation controls stay hidden while the optional permission is missing. The request button’s result is labeled controlled UI only. Native grant, denial, revoke, and browser-bookmark CRUD were not run.

## 9. Folders and search

FR-052 requires arbitrarily nested folders and cycle prevention. No maximum depth was added. The browser created eight nested note folders (`folder-depth` PASS, depth 8) and a ninth folder. L0’s parent list did not offer L7. Moving L2 to L0 was stored (`folder-cycle-ui` PASS). Cycle rejection for a parent that is a descendant remains in `folderCycle` and the parent list omits those ids.

T02.06 and FR-065 require a configurable search provider and a safe custom HTTPS template. Settings now has that control. `http://example.test/?q={query}` was rejected. `https://example.test/search?q={query}` was saved as the custom provider. Evidence: `search-provider` PASS.

## 10. Dexie migration

IndexedDB name remains `Venus-p00`. Dexie schema version 2 is IndexedDB version 20. Schema version 3 is version 30.

The migration browser profile uses a copy of the Chrome build whose background script does not open the database. The page seeds version 20 first, then the real Dexie open upgrades it to 30. This is not a fresh version-30 database.

`dexie-v3-migration` PASS: version 30, seed status `seeded`, probe `pending`, profile “Kept appearance,” widget `clock`, shared item “Shared survivor,” and the P02 stores are present. `tests/integration/migration.test.ts` also passed. Deleting an unselected profile in the integration test still compares the selected id captured before the delete.

The settings screen can create a second profile without changing the selection (`profile-switch-and-unselected-delete-ui` PARTIAL). It only deletes the profile that is open, so the browser pass did not delete an unselected profile.

## 11. Firefox WebDriver

Firefox 155.0.1, geckodriver from `.browser-cache`, selenium-webdriver 4.31.0, Node v24.19.0.

`browser.policies.alternatePath` is ignored on this release build unless `Cu.isInAutomation` is true. Setting `MOZ_AUTOMATION=1` made `Services.env.exists("MOZ_AUTOMATION")` true and left `Cu.isInAutomation` false. Firefox Labs therefore stayed allowed, Nimbus still registered `RemoteSettingsExperimentLoader: disabling`, and an offline `driver.quit()` crashed. Those failed attempts are in `evidence/P02/remediation/smoke-firefox-geckodriver.log`. Their teardowns were PASS only because the new policy assertion threw before the browser was taken offline.

The harness now builds a disposable application directory: a copy of the Firefox launcher, symlinks to the rest of `/usr/lib/firefox`, and `distribution/policies.json` with Firefox Labs off, studies off, and remote improvements off. The probed distribution path was `/tmp/Venus-firefox-…/app/distribution`. `labsAllowed` was false. `/usr/lib/firefox` and the user’s Firefox profile were not modified.

After that change:

| Command | Exit | Teardown |
|---|---|---|
| `P00_EVIDENCE_DIR=evidence/P02/remediation/smoke-firefox node scripts/smoke-firefox.mjs` | 0 | `driver.quit` PASS, browser exit status 0 |
| `P00_EVIDENCE_DIR=evidence/P02/remediation/identity node scripts/smoke-firefox-identity.mjs` | 0 | `driver.quit` PASS |

Identity: `p00@Venus.invalid`, beta `{935006c2-63b4-4e03-b842-11b88571da3b}`, storage and IndexedDB isolation PASS, HTML-as-text PASS. Quit errors are still thrown. The passing commands were not forced to exit 0.

A bare WebDriver session with no Venus extension also quit successfully: `P00_WD_SCENARIOS=bare node scripts/diagnose-firefox-webdriver.mjs`, exit 0, assertions PASS, teardown PASS.

## 12. Command exits

| Command | Exit |
|---|---|
| `npm run format:check` (before the last Prettier write of the unit test) | 1 |
| `npm run format:check` (after Prettier) | 0 |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm run unit` | 0 (26 tests) |
| `npm run test:integration` | 0 (15 tests) |
| `npm run test:security` | 0 (5 tests) |
| `npm run build:firefox` | 0 |
| `npm run build:chrome` | 0 |
| `npm run build:firefox:beta` | 0 |
| `npm run build:firefox:release` | 0 |
| `npm run inspect:manifests` | 0 |
| `npm run package:firefox:beta` | 0 |
| `VENUS_FIREFOX_CHANNEL=release node scripts/package-firefox-candidate.mjs` | 0 |
| `npm run test:packaging` | 0 (2 tests) |
| `npm run inspect:channels` | 0 |
| `npx web-ext lint --source-dir .output/firefox-mv3` | 0, 3 warnings |
| `node scripts/p02-acceptance.mjs` | 0 |
| Firefox smoke, evidence under `evidence/P02/remediation/smoke-firefox` | 0 |
| Firefox identity | 0 |
| `npm run test:smoke:chrome` | 0 |
| Bare WebDriver | 0 |
| `VENUS_FIREFOX_CHANNEL=beta node scripts/reproduce-firefox-candidate.mjs` | 0 |

`web-ext` warnings are unchanged: `strict_min_version` versus Android data-collection permissions, and two `UNSAFE_VAR_ASSIGNMENT` innerHTML warnings. Security tests still pass. Paste did not execute.

Final package hashes after the harness change:

| Archive | SHA-256 |
|---|---|
| `venus-beta-0.0.1-unsigned.zip` | `0a59686c018f9f4d947258ede077face81fcb8cf2b40afd96bb75ba091a062b0` |
| `venus-beta-0.0.1-source.zip` | `f32e62bb072df1b9b0313e21bc2899131bc5ca042d3f6b37441b782be9bf4d91` |
| `venus-release-0.0.1-unsigned.zip` | `943f76c68720525f54e7018947d3a2236a230d8ba32cd1ea9af2e1ddc6c39916` |
| `venus-release-0.0.1-source.zip` | `2b41b569c2e694da218b64695d30459af77f843795e07960b8a88ec51d5b150f` |

The beta source archive reproduced both zip hashes byte for byte. These archives are not approved for Mozilla.

## 13. Remaining product notes

- Settings cannot delete a profile that is not the open one. The repository path is covered by the integration test. The browser result stays PARTIAL.
- Native bookmark permission grant, denial, revoke, and browser-bookmark editing were not verified.
- ADR-010 is not signed.
- `web-ext` still reports the three warnings above.

## 14. Deferred P00 and P01

P00 remains NOT PASS. ADR-001 and ADR-002 remain unsigned. The node-forge residual risk is not approved. Regular-install Home consent, minimum Firefox 140, hosted CI, and native notification proof stay open. P01 remains conditional owner acceptance, not a clean PASS. Historical P01 runners were not rewritten and were not executed against the new notes UI.

## 15. Stop

No P03 work was started. Owner acceptance of P02 was not granted. Wait for an explicit owner decision before any further phase work.
