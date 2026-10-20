# P02 — Notes, Tasks, Bookmarks, Quick Capture, Search

**Depends:** P01. **FR:** 050–056, 060–065, 070–073.

## Work packages

**T02.01 — Notes domain/repositories.** Note/folder/tag model, IDs/revisions, trash/archive/pin, folder cycle checks, indexes. Tiptap restricted document schema, safe link handling, no arbitrary HTML.

**T02.02 — Notes UI.** Folder tree (nest/rename/move/delete with explicit choices), tag chips, list/grid views, rich editor bold/italic/headings/lists/checklists/links, search, sorted notes, pinned dashboard widget, autosave states and conflict prompt.

**T02.03 — Tasks.** CRUD/status/due/priority, day focus select top three, dashboard widget, task completion and optional event link with no duplicate truth. Persist and test.

**T02.04 — Dual Bookmarks.** Local nested folders/quick groups CRUD, browser bookmark adapter and clear source badge, permission request/revocation, browser bookmark modify confirmations, quick icons and organized folder panel, favicon fallback, safe URL validation.

**T02.05 — Quick Capture.** From dashboard and palette create Note/Task/Event placeholders; event creation may deep link to Calendar form completed P03. Preserve captured draft and show visible error on failed save.

**T02.06 — Search and commands.** Local title/body search for notes, tasks, bookmark URLs/titles, command registry, navigate via shortcuts. Web search provider selection with safe validated HTTPS search template. Polish accessible arrow/Enter/Esc interaction.

## Tests and acceptance

[ ] Nested folders up to tested depth, reorder and cycle rejected.
[ ] Autosave after text and navigation; simulated DB failure preserves editable draft and shows error.
[ ] Two tabs editing same note cannot silently overwrite data.
[ ] Rich-text pasted script attributes do not execute; links protocol validated.
[ ] 3 focus tasks visible; task completion persists.
[ ] Browser bookmark permission declined/revoked -> native view inactive, local works.
[ ] Creating/editing/deleting browser bookmark confirmed & source labeled.
[ ] Quick bookmark icons + folder tree both work in FA/EN.
[ ] Palette and Quick Capture work using keyboard and no internet.
[ ] Firefox smoke and Chrome MV3 build/smoke pass.
