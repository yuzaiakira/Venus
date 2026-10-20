# 04 — Canonical Data Model and Persistence Rules

## 4.1 Conventions

All top-level durable entities: `id: UUID/ULID`, `createdAt`, `updatedAt` ISO UTC, `revision: integer >=1`, `deletedAt?: ISO` if soft-deleted. Use indexes on major filters; never use Date objects or JSX/functions in stored data. Human text stored Unicode normalized when safe; do not normalize away meaningful Persian characters. Avoid HTML content except sanitized Rich Text transport.

## 4.2 Entities

| Entity | Fields / relationships | Index and invariants |
|---|---|---|
| UserPreferences | locale, numeralSystem, timeZone, weekStart, calendarDisplay, hourFormat, quietHours, module flags | one row per local installation; schemaVersion |
| LayoutProfile | id, title, isDefault, themeOverrides, wallpaperRef, widgetIds[], order | no private content; selectedProfileId stored separately |
| WidgetInstance | id, layoutProfileId, widgetType, pluginId?, gridX,Y,W,H, visible, settings | bounds validated, plugin type registered |
| Note | id, title, bodyJson, folderId?, tags[], pinned, archived, trashedAt?, revision | folder DAG cycle prevention, editor schema validation |
| Folder | id, scope=notes/localBookmarks, parentId?, name, sortIndex | parent same scope, no self/ancestor cycle |
| Task | id, title, details?, priority, status, dueDate?, eventId?, focusRank?, completedAt? | one source; invalid linked ID nonfatal |
| LocalBookmark | id, title, canonicalUrl, folderId?, iconRef?, sortOrder | validate protocol; duplicate allowed only intentional |
| BrowserBookmarkSnapshot | portablePath, title, url?, folderHierarchy, sourceBrowser, capturedAt | only in import/export staging, no persisted privileged internal ID as portable key |
| Event | id, title, description, calendarBasis, allDay, localDate/time, zoneId, recurrenceSpec?, exclusions[], overrides[] | canonical timezone; recurrence validated |
| ReminderRule | id, eventId/taskId?, offsetMinutes? or absoluteTime?, severity, quietHoursOverride | one owner, valid offset/window |
| NotificationOccurrence | idempotencyKey, ruleId, occurrenceKey, fireAtUTC, state, snoozedUntil?, nativeState, emittedAt? | unique composite idempotency key |
| TimerSession | id, mode, label, durationMs, startedAtUTC, endsAtUTC, elapsedBeforePauseMs, status, cycleStep | derive remaining from stored instants not tab interval |
| PluginPackage | pluginId, version, specVersion, manifest, packageHash, installedAt, enabled | unique stable plugin ID; no script artifacts |
| PluginInstanceData | pluginId, instanceId, schemaVersion, data, revision, updatedAt | namespace and quota enforced |
| Asset | id, kind, mime, size, sha256, bytes/blob, createdAt | approved MIME and pixel/size limits |
| Audit/Diagnostics | id, category, sanitizedDetails, at | retention capped, no notes content collected |

## 4.3 Event and recurrence representation

A recurring event stores **source calendar basis** (`gregorian|jalali`) and **source local date tuple** (Y,M,D), start time/hours, IANA timezone, duration, recurrence rule (freq, interval, byWeekday, nth, monthDay, until, count), exception occurrence IDs and per-occurrence overrides. Persist derived instant for next occurrence but do not treat it as authoritative series definition. Floating all-day events not shifted into neighboring dates by UTC rendering. Determine and test DST gap/fold policy (doc 06).

## 4.4 Persistence and concurrency

All mutating operations use repository-level validation. Increment `revision` per edit. Compare expected revision and reject/resolve conflicting save; notes editor offers compare or recover draft. Persist atomic multi-table operations via Dexie transaction. Avoid two contradictory settings sources; only one authoritative storage per field. Broadcast changed IDs/revisions to tabs and requery; broadcasts are hints, never sole source of truth.

## 4.5 Migrations and schema changes

DB versions monotonic (starting 1); migrations idempotent with tests from each previous supported schema version. Before irreversible migration, create recovery snapshot/staging. If migration fails, display recoverable diagnostic and preserve stored data; never reset database automatically.

## 4.6 Import identity/merge

Stable app-generated IDs travel across Firefox and Chrome. For each entity: identical id + same revision/hash -> skip; identical id + different content -> conflict preview with keep current / use import / duplicate; new id -> insert. Folders imported topologically; unresolved parent becomes recovery folder with warning. Imported plugin data cannot bypass plugin validation. Browser bookmarks from snapshots require separate user-approved materialization and no hardcoded source IDs.

## 4.7 Deletion/data retention

Notes trash retained until user purges, with optional configurable retention later (no automatic wipe MVP). Deleting a folder requires move-contents or recursive-delete explicit selection. Removing plugin supports keep or erase isolated data. Erase-all respects browser-controlled bookmarks: clearing Venus local data must **not** delete external browser bookmarks automatically.

## 4.8 Sample TypeScript contracts

See `contracts/domain-types.ts`, intended as an indicative compilable-ish interface reference, not an implementation library.
