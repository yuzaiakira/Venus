# P05 — Full/Selective/Portable Backup, Security and Integration

**Depends:** P01..P04 functional; **FR:** 090–097 and critical cross-cutting requirements.

## Work packages

**T05.01 — Backup schemas.** Define versioned manifest/dataset JSON serialization, asset directory, SHA-256 integrity, app-version policy, no credentials/tokens; use contracts and real importer/exporter fixtures.

**T05.02 — Export.** Full/Selective/Portable UI; component dependencies/counts, archive size estimate, plaintext sensitivity notice, verified downloads; no reminder system, no automatic jobs.

**T05.03 — Import and merge.** Bounded parser, validation, dry-run preview with conflicts, merge/replace, optional native browser bookmarks separate opt-in, stage+transaction+rollback+post-verify report. Safe migration of prior supported schemas.

**T05.04 — Data stress and migrations.** DB quota errors, schema upgrade, interrupted import, concurrent tab edits, missing assets, invalid parent folder, stale plugin schema; graceful errors and recovery.

**T05.05 — Privacy/security audit.** Permissions minimization, CSP, dependency audit, SBOM/licenses, no remote runtime code, no telemetry, sanitized diagnostics, plugin attack suite, rich-text XSS scan, backup parser adversarial tests.

**T05.06 — End-to-end integration.** All screens cross-linked, local-only use offline, FA/EN visual and interaction review, a11y+keyboard, performance optimizations, fallback for browser-specific Home/notification actions.

## Tests and acceptance

[ ] BAK-01..09 pass, incl. fresh Firefox restore and Firefox->Chrome portable data restore.
[ ] User-initiated exports only; no backup reminders.
[ ] Every failed import leaves live datasets unchanged; simulate injected failures mid-commit.
[ ] Native bookmark materialization cannot happen silently; privileges denied fallback.
[ ] Secrets and browser IDs excluded; restore validation rejects hostile archives.
[ ] All principal workflows function entirely offline except intentional external navigation.
[ ] No P0 security/data bugs; Chrome MV3 smoke remains green.
