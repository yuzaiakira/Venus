# 01 — Functional Requirements (authoritative)

**Notation:** MUST mandatory MVP, SHOULD quality/feature where feasible without violating critical gates; G/W/T labels identify normal, warning and test outcomes. Every FR requires persistence/accessibility/i18n/error states where relevant.

## FR-01 — Browser landing and onboarding

- **FR-001** MUST override New Tab via locally bundled extension page. No remote New Tab redirection.
- **FR-002** MUST target Home in Firefox through supported settings override when feasible; in Chromium via verified compatible mechanism/manifest; browser control/consent supersedes app preferences. Provide manual-help fallback.
- **FR-003** MUST use same React dashboard shell from Home and New Tab. Deep links to Settings, Notes, Calendar and Plugin Builder supported.
- **FR-004** MUST first-run skippable wizard: welcome/privacy, locale/calendar/hour format, theme/background, starter layout, permissions guidance, finish.
- **FR-005** MUST ensure wizard rerun/reset from Settings without deleting user data; never block use on optional permission denial.
- **FR-006** MUST expose truthful Home/New Tab status, browser-specific setting controls, and restore instructions.

## FR-02 — Dashboard, widgets and profiles

- **FR-010** MUST load default usable dashboard: clock/date, search, bookmarks, upcoming events, today tasks, timer, notes quick access.
- **FR-011** MUST support edit mode: add/remove/show/hide, drag/drop grid positioning, supported widget sizes (minimum S/M/L = 1x1,2x1,2x2), accessible keyboard reorder alternative.
- **FR-012** MUST persist widget positions/sizes/settings across tabs and browser restarts; prevent overlaps and out-of-grid placements.
- **FR-013** MUST create/rename/duplicate/delete/switch multiple layout profiles; preserve last selected profile globally. Deleting current profile selects fallback.
- **FR-014** MUST share note/event/task/bookmark data across profiles. Layouts, wallpaper, widget instances, per-profile visual preferences are isolated.
- **FR-015** MUST offer minimal, productivity and personal initial layout presets and reset current layout with confirmation.
- **FR-016** MUST support tablet/narrow desktop without horizontal overflow and gracefully move grid items for smaller viewports.
- **FR-017** MUST guard dashboard from single-widget exceptions, show local error state and enable disable/reset broken widget.

## FR-03 — Appearance, localization and settings

- **FR-020** MUST support light/dark/system preference; in-system changes update dashboard without data loss.
- **FR-021** MUST ship bundled cosmic space scenes + user-uploaded local image + CSS gradients; sanitize/limit image files; missing file falls back to bundled scene.
- **FR-022** MUST allow adjustable glass blur/opacity, accent preset/custom color, animation off/reduced, density, font scale and widget radius/spacing.
- **FR-023** MUST localize visible UI and errors to fa/en, RTL/LTR layout; expose Persian or Latin numerals preference, timezone, week start, calendar and 12/24h.
- **FR-024** MUST provide search in Settings, module enable/disable, preview on appearance changes, module-scoped reset with confirmation; auto-save valid edits.
- **FR-025** MUST maintain keyboard and screen-reader access regardless of blur, contrast or background settings.
- **FR-026** MUST treat locale, calendar engine, time zone and numeral display as separate preferences.

## FR-04 — Clock, calendar and events

- **FR-030** MUST display clock, date (Jalali/Gregorian/both), localized weekday, selectable 12/24 h and adjustable visible modules.
- **FR-031** MUST offer monthly calendar and day agenda, upcoming widget, create/edit/delete all-day and timed events.
- **FR-032** MUST support calendar-native recurrence: once/daily/weekly/monthly/yearly; intervals, weekday selections, nth/last weekday, count/until, exceptions and per-occurrence overrides.
- **FR-033** MUST distinguish Gregorian RRULE recurrence from Jalali calendar-month/year semantics, preserving original intended wall-clock time and timezone.
- **FR-034** MUST allow multiple alerts per event, relative or absolute; distinguish event/time vs occurrence vs reminder notification.
- **FR-035** MUST show complete/stale/repeated event statuses safely; occurrence edit options THIS / THIS_AND_FOLLOWING only if implementation/test supports it, otherwise THIS vs ENTIRE_SERIES with clear semantics.
- **FR-036** MUST specify Jalali day validity, leap-day behavior and daylight-saving gap/fold behavior before implementation; see doc 06.

## FR-05 — Reminders, timers and notification center

- **FR-040** MUST record pending/fired/missed/dismissed/completed/snoozed notifications in IndexedDB; status transitions atomic and deduplicated.
- **FR-041** MUST use background alarms + native notification API where permissions exist; continue firing when New Tab is closed but browser running.
- **FR-042** MUST reconcile persisted reminder/timer schedule on install, startup, background reactivation, permission change and schedule edits; missed items appear in internal center.
- **FR-043** MUST provide center with upcoming, unread, past, Snooze, done, dismiss, history and filters. Quiet hours configurable with override flag for important events.
- **FR-044** MUST respect OS/browser notification denial; never claim a native notification displayed when API failed. In-app center remains functional.
- **FR-045** MUST provide countdown timer with pause/resume/reset, custom duration, optional label and persistent wall-clock end time.
- **FR-046** MUST offer Pomodoro work/break cycles and focused view; restoration after tab close/restart with accurate remaining time or overrun status.
- **FR-047** MUST avoid duplicate native alerts if background events are delivered more than once.
- **FR-048** MUST disclose unsupported while-browser-closed notification behavior and OS limitations in Settings.

## FR-06 — Notes, folders, tasks and capture

- **FR-050** MUST CRUD notes using limited rich-text feature set: bold, italic, headings, lists, checklist, links; sanitize HTML on ingestion or store safe editor JSON.
- **FR-051** MUST auto-save with visible saving/error status, debounce + flush on navigation; recover unsaved edits; multi-tab conflict resolution.
- **FR-052** MUST allow arbitrarily nested folders with cycle prevention, tags, search title/body, pin, archive and trash/restore/delete permanently.
- **FR-053** MUST support local note quick-capture and pinned preview widget. Attachment embedding and collaboration out of scope.
- **FR-054** MUST CRUD tasks: title, notes (plain), status, optional due date, priority, completion, today-focus flag/priority ranking, filtering.
- **FR-055** MUST support task/calendar association optionally by reference, avoiding duplicate source-of-truth; task reminders use shared notification engine.
- **FR-056** MUST provide quick-capture entry on dashboard and command palette (note/task/event creation) with keyboard focus management.

## FR-07 — Dual bookmark system and search

- **FR-060** MUST manage extension-local bookmarks with title/url/folder/order/icon; nested folder hierarchy and quick-access groups.
- **FR-061** MUST read browser bookmarks with browser Bookmarks API when granted and clearly identify source. Explain permissions and offer local-only fallback.
- **FR-062** MUST allow browser bookmark creation/edit/move/delete subject to API permission and explicit source indication; destructive actions confirmed, no opaque sync side effects.
- **FR-063** MUST show combined quick icon grid and folder panel with per-source filter and search; prevent unsafe URL schemes from being opened/injected.
- **FR-064** MUST export browser bookmark snapshots as portable title/URL/folder data, NOT browser IDs. Import creation into native browser bookmarks always opt-in separately.
- **FR-065** MUST provide search bar configurable external search provider from curated templates plus safe custom URL template validation; local-only search when offline.

## FR-08 — Command palette and shortcuts

- **FR-070** MUST invoke a dashboard-scoped command palette, default Ctrl/Cmd+K unless browser-reserved; accessible fallback button.
- **FR-071** MUST support commands: new note/task/event, start timer, navigate bookmarks, switch layout profile, open settings, open module pages, global search.
- **FR-072** MUST show filtered results, keyboard arrows/Enter/Escape and distinguish local search from web searches.
- **FR-073** MUST document Firefox/Chrome difference in browser-wide shortcut modification and safe fallback to in-dashboard shortcut.

## FR-09 — Safe plugins

- **FR-080** MUST support a declarative package with versioned manifest (ZDPS v1); install from local file and export package.
- **FR-081** MUST provide Builder for seven predefined blocks: text/image, countdown, counter, checklist, quick links, four-operation calculator, progress tracker.
- **FR-082** MUST disallow arbitrary code, scripts, WASM, external styles, remote execution, scripting URLs and unsafe HTML in imported plugin package.
- **FR-083** MUST implement Plugin Manager: list, preview, install, enable/disable, data/storage usage, permissions/capabilities, update, uninstall with keep/delete plugin data.
- **FR-084** MUST isolate logical plugin-specific data with explicit host capabilities; plugins cannot access notes/events/bookmarks/storage or network directly.
- **FR-085** MUST validate package schema, entry count, extension/mime types, size limits, duplicate IDs, supported block types and untrusted assets; Safe Mode disables imported plugins without deleting data.
- **FR-086** MUST include example packages, preview tests and migration of plugin data schemas with rollback.

## FR-10 — Backup, restore, privacy

- **FR-090** MUST support Full, Selective and Portable manually triggered backups: settings, layouts, local bookmarks, browser bookmark snapshot, notes/folders/tags, tasks, events/reminders, timers, plugins, plugin data, local images.
- **FR-091** MUST support import in PREVIEW -> VALIDATE -> CHOOSE MERGE/REPLACE -> CONFIRM -> APPLY -> VERIFY; no execution of imported contents.
- **FR-092** MUST detect duplicates/conflicts by stable IDs plus defined policies; preserve user choice, foreign browser bookmark snapshots do not alter native bookmarks implicitly.
- **FR-093** MUST support schema migrations, backwards-compatible version policy, transactional staging and rollback/recovery from interruption.
- **FR-094** MUST show estimated archive size and prominent notice that plaintext backups contain private data; never export secrets, auth tokens or browser session data.
- **FR-095** MUST NOT send periodic backup reminders or schedule automatic backup jobs; an obvious manual Export control exists.
- **FR-096** MUST have no registration, external server, advertising IDs, tracking or background transmission of notes/tasks/events.
- **FR-097** MUST offer erase local data and reset settings with two-step destructive confirmation.

## FR-11 — Release, diagnostics and policy

- **FR-100** MUST offer local-only diagnostics (extension version, browser, permission state, migration status, recent sanitized errors), optional user-initiated export.
- **FR-101** MUST ship Firefox beta package with version identifier, changelog, privacy statement, permission descriptions and known limitations.
- **FR-102** MUST produce a buildable Chrome MV3 artifact and pass compatibility smoke tests; public Chrome release later.
- **FR-103** MUST record store review blockers and remediation; do not ship externally loaded code or harmful permission scope.

## Required negative-path examples

N1 notes editor throws -> error boundary and draft not lost. N2 native bookmark permission revoked -> local bookmarks available. N3 reminder created during quiet hours -> internal record + suppressed native alert unless user override. N4 browser closed through end-time -> recovered missed status after restart. N5 file contains `javascript:` bookmark or `<script>` -> rejected/escaped appropriately. N6 corrupted backup -> zero live DB modifications. N7 expired plugin schema -> explanatory compatibility error. N8 two tabs edit one note -> conflict shown/defined latest safe merge, never silent overwrite. N9 image over storage limit -> clear error + default background preserved. N10 no native notification icon / OS denies -> internal fallback.
