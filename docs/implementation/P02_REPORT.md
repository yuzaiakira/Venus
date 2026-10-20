# P02 report — notes, tasks, bookmarks, capture, and search

Date: 2026-10-10.

Phase: P02 only. P03 was not started. P00 remains **NOT PASS**. P01 remains **CONDITIONAL OWNER ACCEPTANCE**, not an unconditional clean PASS. ADR-001 and ADR-002 remain proposed and unsigned. The node-forge residual risk remains open and is not approved. Nothing was uploaded, signed, submitted, or published. No commit or push was made.

Owner authorization is recorded in `docs/implementation/P01_TO_P02_CONDITIONAL_TRANSITION.md`.

## 1. Task IDs

Source: `phases/P02_PRODUCTIVITY_MODULES.md`. Depends on P01. Functional requirements FR-050–056, FR-060–065, and FR-070–073.

| ID | Scope | Result |
| --- | --- | --- |
| T02.01 | Note, folder, and tag model, revisions, trash, archive, pin, folder cycle checks, restricted document schema | Implemented |
| T02.02 | Folder tree, tags, list/grid, block editor, search, pinned notes, autosave and conflict prompt | Implemented |
| T02.03 | Task CRUD, status, due date, priority, top-three focus, dashboard widget, optional event id with no second copy of the task | Implemented. Reminder firing is not implemented. That engine is P03. |
| T02.04 | Local folders and quick bookmarks, browser bookmark adapter, permission states, confirmations, source badges, URL checks, portable snapshot | Implemented. Letter icon fallback only. No remote favicon fetch. Native grant/revoke is **NOT VERIFIED**. |
| T02.05 | Dashboard and palette capture for note and task. Event stays a dialog draft because the calendar form is P03. | Implemented |
| T02.06 | Local search, command registry, existing HTTPS search templates, palette shortcut note | Implemented. Arrow, Enter, and Escape behavior from P01 remains. |

The editor stores a restricted JSON document: paragraph, heading, bullet list, ordered list, checklist, bold, italic, and http/https/mailto links. Pasted markup is reduced to text before it is stored. The Tiptap package was not added. It is not in the current dependency set, and adding it would change third-party notices and the built bundle. FR-050 allows safe editor JSON. A required Tiptap runtime is outstanding only if the owner wants that library itself.

## 2. Storage

Dexie schema version is now **3**. Version 1 `probes` and version 2 `profiles`, `widgets`, `sharedItems`, and `assets` stay. Version 3 adds `notes`, `folders`, `tasks`, `localBookmarks`, and `bookmarkSnapshots`. The upgrade does not clear existing stores. `tests/integration/migration.test.ts` opens a version 1 database and then a version 2 profile row and reads both after the version 3 open.

Null profile appearance fields still inherit bootstrap defaults. Language, calendar, numerals, hour format, week start, and time zone stay global. Bookmark snapshots store a portable path, title, URL, source label, and capture time. They do not store browser bookmark ids. `javascript:` URLs are omitted from snapshots and rejected for local bookmarks.

Deleting a profile that is not selected leaves the current selection in place. The integration assertion that compared the selected id with the first remaining row was order-dependent and failed after the version 3 index change. The test now checks that the deleted profile is gone, the copy remains, and the previously selected profile stays selected.

## 3. Permission behavior

Missing bookmarks permission leaves the browser list inactive and does not call create. The inactive sentence says a missing permission is not a recorded denial. A request uses the same grant, denial, dismissal, failure, and unsupported outcomes as onboarding. Revoke reports removed, failed, or unsupported. Browser bookmark create and delete require an explicit confirmation control. These adapter results do not close the P00 native permission lifecycle.

## 4. Files

Created:

- `src/domain/productivity.ts`
- `src/application/productivity.ts`
- `src/infrastructure/browser-bookmarks.ts`
- `src/app/library.tsx`
- `src/app/capture.tsx`
- `scripts/p02-acceptance.mjs`
- `tests/unit/productivity.test.ts`
- `tests/integration/productivity.test.ts`
- `docs/implementation/P01_TO_P02_CONDITIONAL_TRANSITION.md`

Changed:

- `src/infrastructure/db.ts`
- `src/infrastructure/browser-workspace.ts`
- `src/app/dashboard.tsx`
- `src/app/widgets.tsx`
- `src/locales/messages.ts`
- `src/design/tokens.css`
- `entrypoints/newtab/main.tsx`
- `tests/integration/migration.test.ts`
- `tests/integration/workspace.test.ts`

Extension ids, CSP, permissions, Home, and New Tab mappings were not changed. P00 id remains `p00@Venus.invalid`. Beta and release id remains `{935006c2-63b4-4e03-b842-11b88571da3b}`.

## 5. Tests

Environment: Node v24.19.0, Firefox 155.0.1, Chromium 153.0.8010.52. Log: `evidence/P02/regression.log`.

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run format:check` | 0 in the log, and 0 again after the integration assertion edit |
| `npm run unit` | 0 (26 passed) |
| `npm run test:integration` | **1** on the first run (14 passed, 1 failed). **0** on the rerun (15 passed) after the selection assertion was corrected |
| `npm run test:security` | 0 (5 passed) |
| `npm run build:firefox` | 0 |
| `npm run build:chrome` | 0 |
| `npm run inspect:manifests` | 0 |
| `npm run build:firefox:beta` | 0 |
| `npm run build:firefox:release` | 0 |
| beta `package-firefox-candidate.mjs` | 0 |
| release `package-firefox-candidate.mjs` | 0 |
| `npm run test:packaging` | 0 (2 passed) |
| `npm run inspect:channels` | 0 |
| Firefox P00 smoke | **1**. New tab PASS. Home rendering PASS for the temporary add-on. Home consent **NOT VERIFIED**. `driver.quit` **FAIL**: `WebDriverError: Failed to decode response from marionette`. `evidence/P02/smoke-firefox/firefox-teardown.json` status FAIL. |
| Chrome smoke | 0. New tab PASS. Bookmarks and notifications remain `DENIED_OBSERVED; GRANT_REVOKE_NOT_RUN`. |
| Firefox identity smoke | **1**. Application assertions PASS in `evidence/P02/identity/firefox-identity.json`. `driver.quit` **FAIL** with the same Marionette decode error. This is not a PASS. |
| `web-ext lint` on `.output/firefox-mv3` and `.output-beta/firefox-mv3` | 0 errors, 0 notices, 3 warnings (`KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` and two `UNSAFE_VAR_ASSIGNMENT` innerHTML warnings) |
| beta archive reproduction | 0, byte-for-byte |
| `node scripts/p02-acceptance.mjs` | 0 |

P02 browser checks in disposable headless Chromium 153.0.8010.52, offline, `evidence/P02/results.json`:

| Check | Status |
| --- | --- |
| note-before-reload | INFO. Title `Orbit note`, revision 2, before reload. |
| note-persists | PASS after reload |
| task-persists | PASS. Focus rank 1 survived reload. |
| bookmark-url-and-permission | PASS. `javascript:` rejected. Browser bookmarks inactive. The inactive copy is not the denial sentence. |
| event-draft-not-saved | PASS |
| fa-bookmarks | PASS. `documentElement.dir` is `rtl`. Local bookmark link and Venus source label are visible. |

The Marionette shutdown failure remains an unresolved harness issue. Successful application assertions are stored separately from the failed teardown. Neither Firefox command was relabeled PASS.

## 6. Acceptance criteria

Passed in unit, integration, or the Chromium script:

- Nested folders to depth 8. A cycle is rejected.
- Autosave persists a note title across reload after the debounce. A simulated storage failure throws `storageError` and leaves the previous title.
- A second save with the old revision throws `conflict` and does not overwrite. The editor offers “Keep my draft” and “Use stored note”.
- Pasted `<script>` and `onerror` markup are not stored as HTML. `javascript:` links and bookmarks are rejected.
- Three focus ranks. A fourth task cannot take a used rank. Completion clears focus and stores `completedAt`.
- An invalid event id is stored as null. The task remains the only copy of its title and details.
- Missing browser permission does not create a browser bookmark. Local bookmarks still save.
- Browser bookmark mutation requires confirmation in the UI.
- Portable export drops browser ids and unsafe URLs.
- Persian bookmark UI is RTL. English rejection copy is shown for a bad URL.
- Event capture stays in the dialog and says it was not saved.
- Chrome MV3 build and smoke pass.
- Firefox new-tab and identity application checks pass. Their commands do not pass, because quit failed.

Not passed:

- Two live browser tabs editing one note. The conflict rule is covered by the revision test, not by a second browser tab.
- Native bookmark grant, denial, and revoke.
- Real browser bookmark create, edit, and delete in Firefox or Chrome. The confirmation gate and the fake port are not that lifecycle.
- Firefox regular-install and Firefox process restart.
- A Tiptap runtime, if that library is required in addition to the restricted JSON document.
- P00, ADR-001, ADR-002, and the node-forge residual risk.

## 7. Evidence invalidated by this phase

P02 source changes the extension packages. The P01 remediation archive hashes are no longer the current build. Historical pre-P01 hashes under `evidence/P01/historical-pre-p01-packages/` were not overwritten.

Current local unsigned archives, **not** approved for Mozilla:

| File | SHA-256 |
| --- | --- |
| `.output-beta/packages/venus-beta-0.0.1-inventory.json` | `6d0b80e1e6cb6138a9cba4d34c4ddbb5eeb5bfe82d5b787018830f7d98fb736d` |
| `.output-beta/packages/venus-beta-0.0.1-source.zip` | `21f35693ffedbe9710d24ffe3c3a27fd2717248128bbba2cdb9db9c8e86e48c5` |
| `.output-beta/packages/venus-beta-0.0.1-unsigned.zip` | `dc980827c3a182591fec3696ab8a5ec85241081a3e52a8fe5113a311f0d45ce1` |
| `.output-release/packages/venus-release-0.0.1-inventory.json` | `c113c960fc777bba3dfc08b4641e5fc8be017c4bcc7da0983273bd29e21effce` |
| `.output-release/packages/venus-release-0.0.1-source.zip` | `cfd9474bbc3790c765ef5f2a7193f7e7b7ff5ccf631f7a4898181d7110a97ef3` |
| `.output-release/packages/venus-release-0.0.1-unsigned.zip` | `04b532f55701d32fabc7c66d989adcd18bb00ebb5088b5a5840761c4b38c2771` |

`scripts/p01-remediation-acceptance.mjs` still expects “New note” to show “Nothing was saved.” That assertion described the P01 placeholder. P02 saves a note. Re-running that script would fail that one check for that reason. Its stored `evidence/P01/remediation/results.json` was not rewritten.

## 8. Deferred P00 and P01 obligations

- P00 is **NOT PASS**.
- Firefox regular-install lifecycle and Firefox process restart are **NOT VERIFIED**.
- Native optional-permission grant, deny, and revoke are **NOT VERIFIED**.
- Chrome Home for this build is **NOT VERIFIED**.
- Firefox smoke and identity commands exit **1** because `driver.quit()` failed after the application checks. The harness issue stays open.
- ADR-001 and ADR-002 are unsigned.
- The node-forge residual risk is not approved.
- Mozilla upload and publication are not authorized.

## 9. Recommendation

**Ask the owner for conditional acceptance of P02. Do not treat this report as that acceptance.**

The P02 task list is implemented and covered by unit tests, IndexedDB tests, and a disposable Chromium pass for notes, tasks, local bookmarks, the event draft, and Persian RTL bookmarks. Firefox application smoke and identity checks passed, and both commands still exit 1 on Marionette shutdown. Native permissions, Firefox regular-install restart, and Chrome Home stay **NOT VERIFIED**.

Do not start P03 until the owner accepts P02.
