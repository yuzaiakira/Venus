# P02 independent acceptance audit

Date: 2026-10-10.

This audit does **not** grant owner acceptance. P00 remains **NOT PASS**. P01 remains **CONDITIONAL OWNER ACCEPTANCE**. P03 was not started. ADR-001 and ADR-002 were not approved. The node-forge residual risk was not approved. Nothing was uploaded, signed, submitted, or published. No commit or push was made. Extension ids were not changed.

Recommendation: **NO-GO** for requesting conditional owner acceptance of P02, and **NO-GO** for starting P03.

## Environment

| Item | Value |
| --- | --- |
| Node | v24.19.0 |
| Firefox | 155.0.1 |
| geckodriver | 0.37.1 (`300705c65d1b`, 2026-07-17) |
| selenium-webdriver | 4.31.0 |
| Chromium | 153.0.8010.52 |
| Disposable Chromium | headless, offline, fresh profile, extension loaded from `.output/chrome-mv3` |

Browser evidence: `evidence/P02/results.json` and `evidence/P02/audit-browser.out`. Regression log: `evidence/P02/audit/regression.log`.

## Editor requirement

Tiptap itself is **not** mandatory under the approved functional requirement.

FR-050 says notes must support bold, italic, headings, lists, checklist, and links, and must **either** sanitize HTML on ingestion **or** store safe editor JSON. The architecture note lists Tiptap among the intended libraries and says a substitution needs an ADR. `phases/P02_PRODUCTIVITY_MODULES.md` names a “Tiptap restricted document schema” in T02.01. No ADR records a substitution.

The implementation stores a restricted JSON document (`doc`, paragraph, heading, lists, checklist, bold, italic, and http/https/mailto link marks). It does not ship the Tiptap package. That JSON shape meets the FR-050 storage alternative. It does not meet a requirement to run Tiptap, because FR-050 does not contain that requirement. Adding Tiptap was not done in this audit.

The editor still fails the links part of FR-050 and T02.02: the screen has bold, italic, heading, list, and checklist controls, and no control that creates a link. A link mark already stored in JSON is rendered only when `safeLink` accepts it.

## Task results

| Task | Result | Why |
| --- | --- | --- |
| T02.01 Notes domain | **PARTIAL** | Revisions, pin, archive, tags, and cycle checks exist. Trash from the open editor did not persist. There is no Tiptap runtime. There is no maximum folder depth; FR-052 asks for arbitrary nesting, and the phase criterion is a tested depth rather than a cap. |
| T02.02 Notes UI | **PARTIAL** | Create, reload, rich blocks, tags, pin widget, archive, two-tab conflict, and “Keep my draft” passed. “Use stored note” and the next edit after Pin did not. Links cannot be created. Nested folders were only partly exercised in the browser. |
| T02.03 Tasks | **PARTIAL** | Create, due date, focus ranks 1–3, completion, and reload passed. An existing task has no priority editor and no editor for its title or details. Priority is stored as 2. |
| T02.04 Bookmarks | **PARTIAL** | Local create/delete, `javascript:` and `file:` rejection, inactive browser list without a denial sentence, and Persian RTL passed. Bookmark folders, bookmark edit, and native grant/deny/revoke/CRUD did not. |
| T02.05 Quick capture | **PASS** | Dashboard and palette capture saved a note and a task. Event capture stayed in the dialog and was not saved. |
| T02.06 Search and commands | **PARTIAL** | Local search, offline web search, and palette arrow/Enter/Escape passed. There is no screen for choosing a search provider or a custom HTTPS template. Validation exists only in domain code. |

## Real browser notes

Disposable Chromium 153.0.8010.52, offline. Runner: `node scripts/p02-acceptance.mjs` (exit **1**).

| Check | Result |
| --- | --- |
| English direction | **PASS.** `documentElement.dir` is `ltr`. |
| Create and reload | **PASS.** “Orbit note” was revision 2 before reload and visible after reload. |
| Bold, italic, heading, checklist, tags | **PASS.** Stored body had a level-2 heading with an italic mark, a checklist item, and tags `alpha` and `beta`. |
| Link control | **FAIL.** No link button. |
| HTML paste | **PASS** for safety. The block editor stored `<script>` and `onerror` as characters inside a JSON text node. `window.__venusXss` stayed 0 and the notes region contained no `<script>` element. Quick Capture strips tags before save. |
| Unsafe link | **PASS.** A stored `javascript:` mark produced no `javascript:` anchor. An `https://example.com/note` mark rendered as one anchor. |
| Two tabs | **PASS.** Tab B was open on “Shared note” before tab A saved “From tab A” at revision 3. Tab B’s draft “From tab B” showed “Nothing was overwritten.” The stored title stayed “From tab A”. |
| Keep my draft | **PASS.** The stored title became “From tab B” at revision 4. |
| Use stored note | **FAIL.** The field showed “Stored side” and the database stayed “Stored side” at revision 5, so the draft did not overwrite storage. About 700ms later the status was `conflict` again. The button sets the status to saved and leaves the editor dirty, so autosave runs with the old expected revision. |
| Autosave failure | **PASS.** A simulated `notes` store failure left the stored title “Before failure” and left the field on “Should not replace”, with the error status. This was a page-level IndexedDB failure, not a fake repository. |
| Pin, then edit | **FAIL.** Pin stuck (`pinned: true`, revision 8). The next title edit returned `conflict` and the stored title stayed “Pinned orbit”. Pin saves with the editor’s expected revision and does not store the new revision, so the next save looks stale. |
| Pinned widget | **PASS.** After a notes widget was added to the minimal layout, the dashboard showed “Pinned orbit”. |
| Archive, trash, restore | **FAIL.** Archive persisted (`archived: true`), the note left the active list, and it appeared in the archive list. Trash did not set `trashedAt`. Restore never appeared. The second action in the same editor uses the revision from before archive. |
| Folders | **PARTIAL.** The page showed nested folders, rename fields, and “Move to top”. The run stopped when two folders were still named “Folder”. Depth 8 was not completed in the browser. The UI cannot choose another folder as a parent, so a cycle cannot be attempted there. |
| Persian bookmarks | **PASS.** `dir` is `rtl`. The local bookmark “خانه” and the Venus source label were visible. |

## Tasks, bookmarks, and capture

| Check | Result |
| --- | --- |
| Task create, due date, invalid event id, reload | **PASS.** Due date `2026-10-12`. Event id stored as null. |
| Top three focus ranks | **PASS.** Ranks were 1, 2, and 3. A fourth task given rank 1 stayed `focusRank: null`. |
| Task completion | **PASS.** Status `done`, focus cleared, `completedAt` set, still done after reload. |
| Priority and existing title/details | **FAIL.** No priority control. Displayed priority was 2. |
| Local bookmark URL checks | **PASS.** `javascript:alert(1)` showed “That address was not saved.” A `file:` URL was not stored. An https bookmark could be removed. |
| Missing bookmarks permission | **PASS.** “Browser bookmarks are inactive” was shown. The copy was not the denial sentence. Create was not available. |
| Browser bookmark confirmation | **PASS** only as an inactive-state check. The confirmation control is absent while permission is missing. |
| Permission request click | **INFO.** The status text was empty. This is not a native grant, denial, or revoke. |
| Native bookmark CRUD | **NOT VERIFIED.** |
| Bookmark folders and edit | **FAIL.** The bookmarks screen has no New folder control. New local bookmarks are quick links with no folder and no edit field. |
| Portable snapshot | **NOT VERIFIED** in the browser. Export does nothing unless permission is granted. Unit test `snapshotFromTree` drops `javascript:` URLs and does not keep browser ids. That is a unit result, not a native export. |
| Quick capture note and task | **PASS.** Palette “New task” opened capture. Note and task were stored. Pasted script text in capture was not stored as a tag and did not run. |
| Event capture | **PASS.** The dialog said the event draft was not saved. |
| Local search and offline web search | **PASS.** “Captured note” appeared as a local note hit. Web search stayed closed and said offline. |
| Command palette | **PASS.** Ctrl+K did not open while the search field was focused. ArrowDown selected “New task”, Enter opened capture, and Escape closed it. |

Chrome smoke `evidence/P02/audit/smoke-chrome/chrome-smoke.json` still says bookmarks `DENIED_OBSERVED; GRANT_REVOKE_NOT_RUN`. That line is not native permission acceptance.

## Dexie migration

`tests/integration/migration.test.ts` passed. It opens a Dexie version 1 database, then a Dexie version 2 database, then the application database. After the version 3 open:

- the version 1 probe is still `pending`
- the version 2 profile keeps `themeMode: "dark"`, blur, and the nebula wallpaper
- the version 2 widget and shared item remain
- the version 3 stores are present
- the database is not deleted as part of the upgrade

The profile assertion in `tests/integration/workspace.test.ts` deletes an unselected profile and checks that `selectedProfileId` is still the id captured before the delete. It also checks that the deleted id is gone and the duplicated profile remains. It does not compare the selected id with “the first remaining row.” That assertion is not order-dependent.

`deleteProfile` still uses the first remaining row only when the deleted profile is the selected one. The settings screen deletes the profile that is open, which is the selected profile. This browser pass did not complete that screen: after the Persian switch, the English label “Create profile” was not on the page. Unselected delete in the real settings UI is **NOT VERIFIED**.

A live Chromium seed of IndexedDB version 2 failed. The background worker opens Dexie during install, so the database was already IndexedDB version 30 (Dexie schema 3) and the version 2 open returned `VersionError`. The live database did contain `notes`, `folders`, `tasks`, `localBookmarks`, and `bookmarkSnapshots` plus the older stores. That shows the stores exist. It does not show an upgrade from a pre-v3 file. In-browser pre-v3 migration is **NOT VERIFIED**. Notes created in the same disposable profile did survive reload, so that session was not reset.

## Security

- Pasted markup in the block editor did not execute.
- `javascript:` note links did not become anchors.
- `javascript:` and `file:` bookmarks were rejected.
- Capture stored note text without a script element.
- `npm run test:security` exit 0 (5 passed).
- `web-ext lint` on `.output/firefox-mv3` and `.output-beta/firefox-mv3`: 0 errors, 0 notices, 3 warnings. The warnings are `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` and two `UNSAFE_VAR_ASSIGNMENT` innerHTML warnings. They were not treated as a new executed-XSS finding.

Native bookmark permission remains **NOT VERIFIED**. The node-forge residual risk was not reviewed for approval and stays open.

## Regression

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0, after the acceptance-script globals fix |
| `npm run format:check` | 0 |
| `npm run unit` | 0 (26 passed) |
| `npm run test:integration` | 0 (15 passed) |
| `npm run test:security` | 0 (5 passed) |
| `npm run build:firefox` | 0 |
| `npm run build:chrome` | 0 |
| `npm run inspect:manifests` | 0 |
| `npm run build:firefox:beta` | 0 |
| `npm run build:firefox:release` | 0 |
| `npm run package:firefox:beta` | 0 |
| `VENUS_FIREFOX_CHANNEL=release node scripts/package-firefox-candidate.mjs` | 0 |
| `npm run test:packaging` | 0 (2 passed) |
| `npm run inspect:channels` | 0 |
| `npx web-ext lint` on dev and beta Firefox trees | 0, with the 3 warnings above |
| `P00_EVIDENCE_DIR=evidence/P02/audit/smoke-firefox npm run test:smoke:firefox` | **1** |
| `P00_EVIDENCE_DIR=evidence/P02/audit/smoke-chrome npm run test:smoke:chrome` | 0 |
| `P00_EVIDENCE_DIR=evidence/P02/audit/identity npm run test:smoke:identity` | **1** |
| `P00_WD_SCENARIOS=bare node scripts/diagnose-firefox-webdriver.mjs` | 0 |
| `VENUS_FIREFOX_CHANNEL=beta node scripts/reproduce-firefox-candidate.mjs` | 0, byte-for-byte |

`node scripts/p02-acceptance.mjs` exit **1**. Failed checks were not relabeled PASS.

Historical runners `scripts/p01-acceptance.mjs`, `scripts/p01-acceptance-followup.mjs`, and `scripts/p01-remediation-acceptance.mjs` now exit **3** unless `VENUS_RUN_HISTORICAL_P01=1`. They still expect “New note” to save nothing. They were not run in that mode, and `evidence/P01/` was not rewritten. Current browser acceptance is `scripts/p02-acceptance.mjs`.

Unsigned package hashes from this audit:

| File | SHA-256 |
| --- | --- |
| `.output-beta/packages/venus-beta-0.0.1-unsigned.zip` | `dc980827c3a182591fec3696ab8a5ec85241081a3e52a8fe5113a311f0d45ce1` |
| `.output-beta/packages/venus-beta-0.0.1-source.zip` | `a98ab848bf25bac114402de4e88821e351b08ce679bb2d7be1ba8a82c688324f` |
| `.output-release/packages/venus-release-0.0.1-unsigned.zip` | `04b532f55701d32fabc7c66d989adcd18bb00ebb5088b5a5840761c4b38c2771` |
| `.output-release/packages/venus-release-0.0.1-source.zip` | `0f864ca46f75215a86428fd7765b98188b9669fb1137911616b7d8fd1124c5dd` |

The unsigned extension hashes match the P02 implementation report. The source archives changed because acceptance scripts and the migration test changed. Those archives are not approved for Mozilla.

## Firefox teardown

Both Firefox commands printed the application success line and then exited **1** in `driver.quit()`.

| Record | Application | Teardown |
| --- | --- | --- |
| `evidence/P02/audit/smoke-firefox/firefox-smoke.json` | New tab **PASS**. Temporary Home rendering **PASS**. Home consent **NOT VERIFIED**. | `firefox-teardown.json` **FAIL** at `driver.quit` |
| `evidence/P02/audit/identity/firefox-identity.json` | p00 id `p00@Venus.invalid`, beta id `{935006c2-63b4-4e03-b842-11b88571da3b}`, storage isolation, IndexedDB isolation, p00 retention, and unsafe HTML as text all **PASS** | `firefox-teardown.json` **FAIL** at `driver.quit` |
| `evidence/P02/audit/webdriver/summary.json` | Bare session, no Venus, **PASS** | quit **PASS** |

`evidence/P02/audit/smoke-firefox-geckodriver.log` shows `Marionette:Quit` with `eForceQuit`, then:

`RemoteSettingsExperimentLoader: disabling` (`resource://nimbus/lib/RemoteSettingsExperimentLoader.sys.mjs`, `enable`)

Firefox then reports `FATAL ERROR: AsyncShutdown timeout in quit-application` and “Causing a crash”. Geckodriver returns HTTP 500 `Failed to decode response from marionette`. The identity log fails the same way. Restore-online succeeded before the quit. The crash is after the product checks.

The bare session quit succeeded. The failure is still the offline Nimbus shutdown blocker described in `docs/implementation/P00_FIREFOX_WEBDRIVER_RESOLUTION.md`. The disposable policy file is still written by `scripts/smoke-firefox.mjs`, and on this run Nimbus still registered that blocker. The command was not forced to exit 0. The harness remains unstable for Firefox smoke and identity shutdown.

## Remaining P00 and P01 obligations

- P00 is **NOT PASS**.
- Firefox regular-install lifecycle and Firefox process restart are **NOT VERIFIED**.
- Native optional-permission grant, denial, and revoke are **NOT VERIFIED**.
- Chrome Home for this build is **NOT VERIFIED**.
- Firefox smoke and identity commands exit **1** on Marionette shutdown.
- ADR-001 and ADR-002 are unsigned.
- The node-forge residual risk is not approved.
- Mozilla upload and publication are not authorized.
- P01 conditional acceptance is unchanged. Historical P01 evidence was not rewritten.

## Recommendation

**NO-GO** for requesting conditional owner acceptance of P02.

The phase is not only missing native bookmark proof. In disposable Chromium, “Use stored note” falls back into a conflict, Pin blocks the next edit, and Trash does not persist from that editor. Links, task priority editing, and local bookmark folders are missing from the UI.

**NO-GO** for starting P03.

Wait for an explicit owner decision. This report is not that decision.
