# 08 — Local Data Export, Import, Merge, Restore & Portability

## 8.1 User agreement

Only user-initiated backups; **no periodic nagging, background backups or cloud upload**. Full, Selective and Portable modes. Portable covers Venus's data across browsers and a *snapshot* of browser bookmarks; it does not automatically create/modify a recipient browser's bookmarks. Warn that backups may contain sensitive plaintext content; ask user to store securely.

## 8.2 Format proposal

`.Venus-backup` = ZIP (not password encrypted by default), with canonical UTF-8 JSON:

```
manifest.json  // schema version, app version, createdAt, type, includedSections[], checksums, optional totals
settings.json
profiles.json
widgets.json
notes.json
folders.json
tags.json
tasks.json
bookmarks-local.json
bookmarks-browser-snapshot.json
calendar-events.json
reminders.json
notifications.json
timers.json
plugins/installed.json
plugins/data.json
assets/<sha256>.<extension>
```

`manifest.json` must list files and SHA-256 digests; exporting partial backups omits unavailable sections, never writes misleading empty datasets. Validate checksums, actual file counts, decompressed size, JSON depth, file path names and schema. Archive is data-only: no HTML/JS execution, no scripts, no binary executables. Schema in `contracts/backup-manifest.schema.json`.

## 8.3 Export selection

Full: all Venus settings/layouts/data/plugins/locally stored assets including plugin data; optional native bookmark **snapshot** if permission granted (state explicitly included/excluded). Selective: checkbox modules with dependency auto-inclusion (e.g. Notes require folders/tags); export preview counts and estimated size. Portable: normal Full with portable IDs, no browser-specific internal IDs or credentials; include origin metadata for warnings only.

No credentials/tokens/browser cookies/history, no cloud secrets. For user images, include required local raster blobs after size validation. Exports can be large; stream/chunk where feasible; show accurate failures and free memory.

## 8.4 Import state machine

1. **Parse safely**: reject invalid ZIP/paths/symlinks, too many entries, total uncompressed size and nested JSON over depth limit.
2. **Verify**: archive schemaVersion, minimum host compatibility, manifest checksums, allowed sections, entity ID formats and referential integrity.
3. **Plan**: compute counts: insert/update/skip/conflicts/delete impact. Show destructive replacement scope, especially plugin data and assets.
4. **Choose**: MERGE or REPLACE with section selection. Native bookmark restoration from snapshot requires a **separate explicit checkbox + preview + permission**.
5. **Stage**: parse/migrate into separate staging store and snapshot current affected datasets for rollback.
6. **Commit**: exclusive transaction/lock; durable switch/commit, repair indexes; verify counts/invariants.
7. **Finish**: report imported/skipped/conflicting records and warnings; allow Save Report; if failure restore previous state.

Do not claim cross-browser portable backup recreates Firefox-specific Home override state, OS permissions, extension ID or browser's native bookmark IDs. Those are browser-owned, not user data.

## 8.5 Merge strategy

- Same `id`+hash/revision: skip duplicate.
- Same id but diverged: show conflict with keep current / replace import / duplicate with new ID. For bulk conflicts offer default and count, but never silently discard.
- Folders: topological ordered import and parent resolution. Merge use stable ID first, then content heuristics only for *suggestions*.
- Recurring events: preserve source calendar basis/timezone/rule IDs and exceptions; reconcile future alarms after import.
- Plugins: imported package must pass current ZDPS security checks; disable incompatible plugin while retaining data until user resolves.
- Native bookmark snapshot: importing into actual browser is independently opt-in, check URL uniqueness + hierarchy, disclose existing bookmark changes.
- REPLACE should affect selected Venus sections only. Never delete entire browser bookmark tree.

## 8.6 Rollback & capacity

Test failure during parsing, staging, between commits and after an asset write. Prefer DB-native atomic transactions for JSON entities and two-phase assets commit; if large assets cannot be transactionally copied in one step, use generation IDs/indirection and garbage collection only after verified completion. Show storage-quota problem before destructive write; do not promise atomicity without proving implementation.

Set initial policy ceilings (engineering proposal): max archive compressed 50 MB and decompressed 200 MB in beta, max 20,000 records per section, max JSON nesting 32; adjust by benchmark and memory safety; do not import arbitrary huge ZIP content into memory.

## 8.7 Test requirements

- BAK-01 Full backup -> fresh Firefox profile restores notes, assets, profiles, plugins, calendar and tasks.
- BAK-02 Selective Notes-only backup includes folder/tag dependencies, not unrelated tasks.
- BAK-03 Firefox export -> fresh Chrome dev profile reconstructs portable Venus data without browser-specific IDs.
- BAK-04 Merge handles duplicate IDs/changed content without silent loss.
- BAK-05 Replace confirmation and rollback work with injected failure.
- BAK-06 Corrupt ZIP, ZIP bomb, `../` path, wrong hash and invalid schema all fail before live changes.
- BAK-07 Browser bookmark snapshot import requires distinct explicit user approval and permission.
- BAK-08 Export contents omit tokens/secrets and never execute private plugin code.
- BAK-09 User action required; no scheduled reminders or cloud upload.
