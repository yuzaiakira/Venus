# 03 — Technical Architecture / Decisions / Boundaries

## 3.1 Technology proposal

WXT, React, TypeScript (strict), Tailwind CSS, Radix primitives/shadcn components, Zustand for ephemeral/client app state, IndexedDB with Dexie for persistent entities, `browser.storage.local` for lightweight preferences/bootstrap, dnd-kit, Zod, date-fns, a verified Jalali conversion/arithmetic library (pin exact version after tests), tested RRULE library for Gregorian series, Vitest and Playwright. Never use unmaintained library blindly; record ADR for substitution. The notes editor is the restricted JSON document accepted in `docs/implementation/ADR-010-editor-library.md` (owner decision, 2026-10-10). Tiptap is not a current dependency. A later editor replacement requires its own decision, a compatibility demonstration, and a tested non-destructive migration. Calendar library pins are accepted with conditions in `docs/implementation/ADR-004-calendar-recurrence.md` (`jalaali-js@2.0.1`, `rrule-temporal@2.2.8`, `temporal-polyfill@1.0.5`). They are not installed. date-fns remains deferred. Chrome MV3 required; Firefox target manifest version determined by explicit compatibility spike (WXT Firefox defaults MV2; verify Firefox MV3 for MVP and prefer if gate passes).

## 3.2 Layer diagram

```
Home / New Tab / Options / Plugin Builder (extension-owned React UIs)
    -> Application use-cases (services; no browser global direct use)
      -> Domain entities (calendar, recurrence, time, notes, backups, plugin specs)
      -> Ports (Bookmarks, Alarm, Notifications, Storage, Tabs, Clipboard)
         -> Firefox adapter / Chromium adapter (WXT build targets)
         -> IndexedDB repositories + storage.local settings
Background entrypoint: alarm listener, reconciliation, native notification callbacks
```

Domain logic must be injectable and deterministic for unit testing. No unreviewed new network permission or content script. New Tab and Home reuse one main app with route/context param; Settings options page separate entrypoint sharing design system.

## 3.3 Repository structure (proposed)

```
entrypoints/{newtab,options,homepage,background.ts}
src/{app,design-system,components,features,domain,application,infrastructure,locales,shared}
src/features/{dashboard,notes,tasks,bookmarks,calendar,reminders,timers,plugins,backup,settings,commands}
src/infrastructure/{db,browser,storage,migration}
tests/{unit,integration,e2e,fixtures,security}
assets/{scenes,icons}
```

Manifest output paths must be inspected instead of assuming all entrypoints are recognized by WXT. If homepage HTML is not a built-in type, configure generic HTML entrypoint in a supported way and reference bundled output path in target manifest. Confirm with generated manifests.

## 3.4 App initialization contract

Startup sequence: (1) bootstrap minimal theme/direction from small local settings to prevent flash; (2) validate/migrate DB schema; (3) load selected profile/layout; (4) render above-the-fold clock/bookmarks/search; (5) progressively hydrate notes/calendar/tasks/plugins; (6) reconcile pending alarms via background message (non-blocking to render); (7) track errors only locally. Migrations must be reversible via staging/backup, not run in every tab unsafely.

## 3.5 Data and state contracts

- **Dexie** holds content entities and structured plugin data. Atomic write transactions for multi-entity changes.
- **storage.local** holds low-volume bootstrap settings, locale/theme/selectedProfileId and schema/version keys; never assume sync across Chrome/Firefox. No `storage.sync` in MVP.
- **Zustand** for current UI panel, edit mode, pending toasts; persistence delegated to repositories.
- **Cross-tab:** use `BroadcastChannel` where extension context supports it, plus `storage.onChanged` / DB live-query + explicit refresh; implement optimistic concurrency (`revision`), no silent overwrites.
- **Background:** event listeners registered at module evaluation (especially MV3 service worker); no dependence on open tabs or React mount; background state reconstructible from persistence.

## 3.6 Browser adapter interfaces (non-authoritative code skeleton)

```ts
interface BookmarkPort {
  hasPermission(): Promise<boolean>;
  listTree(): Promise<BrowserBookmarkNode[]>;
  create(input: BrowserBookmarkCreate): Promise<string>;
  update(id: string, patch: BrowserBookmarkPatch): Promise<void>;
  remove(id: string): Promise<void>;
}
interface AlarmPort {
  schedule(alarmKey: string, atEpochMs: number): Promise<void>;
  remove(alarmKey: string): Promise<void>;
  list(): Promise<Array<{ name: string; scheduledTime: number }>>;
}
interface NotificationPort {
  available(): Promise<boolean>;
  show(id: string, title: string, message: string): Promise<'shown'|'blocked'|'failed'>;
  clear(id: string): Promise<void>;
}
interface LocalPreferencesPort { get<T>(key: string): Promise<T | undefined>; set<T>(key: string,value:T): Promise<void>; }
```

All errors are typed domain results (permissionDenied, platformUnavailable, invalidInput, storageError, unexpected). Never expose raw browser error text as HTML.

## 3.7 Time and recurrence boundaries

- Persist canonical instants as epoch milliseconds/ISO UTC + `TZID` + original local wall-clock tuple and calendar system.
- Separate `CalendarEngine` (local date arithmetic) from `RecurrenceEngine` (occurrence generation) and `ReminderScheduler` (alarm projection).
- Compute a limited horizon (e.g. next 30–90 days or N occurrences); refresh sliding window. Never precompute infinite recurrence or schedule unbounded alarms.
- Shared event bus publishes domain events after durable DB writes; repeated deliveries idempotent.

## 3.8 Plugin subsystem

Registry maps seven block IDs -> prebundled React renderers, Zod schemas and capability functions. Install only manifest JSON/assets processed as data. Preview uses same safe renderer in constrained host environment. Namespace per plugin and instance; limiting counts/sizes and forbidding arbitrary markup/styles/scripts. No general workflow interpreter or remote script code. See docs 07/09.

## 3.9 Backup subsystem

Export service snapshots versioned records/asset blobs into bounded ZIP; import service validates archive paths/sizes/types/schema with staged data and records dry-run preview. Single-writer migration lock; verified replacement and rollback. See doc 08.

## 3.10 Design for future Chrome

Avoid browser-specific modules inside domain. WXT target-specific manifest generator, no unsupported APIs in common path. CI runs Firefox target and Chrome MV3 build/test on each milestone; capability matrix keeps Home, notification actions and shortcuts flexible. No unsafe CSP relaxations.

## 3.11 Architectural Decision Records required

ADR-001 Firefox manifest strategy (proposed, unsigned); ADR-002 Home override consent/target (proposed, unsigned); ADR-003 storage/migrations; ADR-004 calendrical calculations (`docs/implementation/ADR-004-calendar-recurrence.md`, accepted with conditions on 2026-10-10); ADR-005 widget grid; ADR-006 plugin schema/sandbox; ADR-007 backup commit/rollback; ADR-008 notification reconciliation (`docs/implementation/ADR-008-notification-reconciliation.md`, accepted with the amended at-most-once delivery policy on 2026-10-10); ADR-010 notes editor (`docs/implementation/ADR-010-editor-library.md`, accepted 2026-10-10). Use `agent/DECISION_LOG_TEMPLATE.md`. The notification-port sketch in section 3.6 is non-authoritative. ADR-008 records that an accepted notifications API call is not verified operating-system display, and that an uncertain native attempt is not retried automatically.
