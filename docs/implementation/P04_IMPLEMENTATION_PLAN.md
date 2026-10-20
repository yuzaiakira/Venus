# P04 implementation plan

Date: 2026-10-12.

Status: **planned, not authorized.** P03 has conditional owner acceptance as of 2026-10-12. That acceptance is not unconditional, and it is not permission to implement this plan. P00 remains NOT PASS. P01 and P02 retain conditional owner acceptance. ADR-004, ADR-008, and ADR-010 stay accepted on their recorded terms. ADR-001 and ADR-002 stay unsigned. The node-forge residual risk stays open. This plan does not add a dependency, change a manifest, change IndexedDB, or approve an architecture decision.

Source: `phases/P04_SAFE_PLUGIN_PLATFORM.md`, FR-080 through FR-086, `docs/07_PLUGIN_SYSTEM.md`, `contracts/plugin-manifest.schema.json`, `contracts/plugin-example.json`, `docs/04_DATA_MODEL.md`, `docs/09_SECURITY_THREAT_MODEL.md`, and `docs/02_UX_FLOWS.md`. Backup import of plugins belongs to P05 and FR-090, except that P04 must leave plugin records in a form a later backup can validate.

## 1. Task ids and scope

P04 depends on P01 layout profiles and P02 local data. It does not depend on P00 being accepted. It does not include backup/restore, store publication, or a programmable plugin language.

| Task | Scope | Requirement |
| --- | --- | --- |
| T04.01 | Runtime validator for ZDPS v1. Reject unknown fields, unknown block kinds, unknown capabilities, unsafe URLs, bad versions, and duplicate ids. Enforce the finite limits already in the contract. | FR-080, FR-085 |
| T04.02 | Seven host-owned blocks: `text-image`, `countdown`, `counter`, `checklist`, `quick-links`, `calculator`, and `progress`. Each block has a typed form, a typed renderer, and a typed data record. No HTML, CSS, script, or expression from the package. | FR-081, FR-082 |
| T04.03 | Per-plugin and per-instance storage namespace. The only capabilities are `clock.read`, `selfStorage.readWrite`, and `safeNavigation.open`. No `browser.*`, network, notes, events, bookmarks, or other plugin data. | FR-084 |
| T04.04 | Builder: offline template gallery, localized names, per-block fields, live preview through the same renderers, size and theme choice, validation messages, save, and export. Several independent blocks may be composed. There is no condition or action graph. | FR-081, FR-083 |
| T04.05 | Manager: strict ZIP ingestion, preview, install, version check, enable, disable, update, open, edit, export, and uninstall with an explicit keep-or-delete choice for that plugin’s data. A failed import leaves no installed package. | FR-080, FR-083, FR-085, FR-086 |
| T04.06 | Widget error boundary, crash count, quarantine, and Safe Mode. Safe Mode disables imported instances and does not delete their data. The user can re-enable one package at a time. | FR-085 |
| T04.07 | Hostile-package tests: path traversal, decompression bomb, prototype pollution, XSS, bad image, `javascript:` URL, script and WASM payload, unknown capability, duplicate id, package limit, and a plugin read of the notes store. | FR-082, FR-084, FR-085 |

The contract, not the phase number, defines the blocks. `contracts/plugin-manifest.schema.json` requires `specVersion` `"1.0"`, type `declarative-widget`, localized `en` and `fa` strings, at most 10 blocks, and at most the three capabilities above. Calculator operations are only `add`, `subtract`, `multiply`, and `divide` on two numbers. Quick links match `http://` or `https://` only. Image assets match `assets/<name>.png|jpg|jpeg|webp`. SVG is out of scope because the contract does not allow it and no SVG sanitizer is approved.

Example data already in the repository is `contracts/plugin-example.json`. Sharing a package exports the manifest, defaults, and allowed assets. It does not export live instance data. Live data belongs only in an explicit later profile backup.

## 2. Dependencies on previous phases

| Area | Dependency | What P04 must not do |
| --- | --- | --- |
| P00 | Open. Probes, extension ids, CSP, and Home/New Tab mappings already exist. | Do not mark T00.04 passed. Do not request new permissions. Do not weaken CSP. |
| P01 | Conditional. Profiles, widgets, appearance, and shared layout data exist. | A plugin widget is another widget instance. It does not replace profile appearance inheritance. |
| P02 | Conditional. Notes, folders, tasks, and bookmarks exist. | Plugin code and plugin data must not read or write those stores. |
| P03 | Conditional. Calendar, reminders, and timers exist. | A countdown block reads the host clock and renders remaining time. It must not create reminder rules, sweep alarms, or native notifications. |
| ADR-008 | Accepted at-most-once native attempt. | Unchanged. Plugins do not gain a delivery path. |
| ADR-004 and ADR-010 | Accepted calendar libraries and restricted note editor. | Unchanged. P04 does not add Tiptap and does not replace those libraries to shrink the Temporal chunk. |

P04 can be implemented while P00 is open because its phase dependency is P01 and P02, not P00 acceptance. It cannot treat that as permission to close P00, P02 bookmark permission lifecycle, or the open P03 browser obligations listed in `docs/implementation/P03_TO_P04_CONDITIONAL_TRANSITION.md`.

## 3. Proposed order

1. T04.01 pure validators and hostile JSON fixtures, with no file picker and no database write.
2. T04.02 block renderers and their state transitions, still without ZIP.
3. T04.03 namespace and quota checks against an injected store. Prove a notes-table read is rejected.
4. T04.05 archive allowlist and all-or-nothing install transaction. This step stops if it needs a new dependency or an unapproved quota.
5. T04.04 builder and preview using the same validators and renderers.
6. T04.06 error boundary, quarantine, and Safe Mode.
7. T04.07 security suite, disposable Firefox and Chromium checks, and the existing regression commands.

No step starts until the owner authorizes P04 implementation. Steps 4 and 7 also wait on the owner decisions in section 9 if those decisions are still open.

## 4. Data persistence and migration

`docs/04_DATA_MODEL.md` names `PluginPackage` and `PluginInstanceData`. The current database is Dexie version 4, name `Venus-p00`. It has no plugin stores.

When implementation is authorized, the expected migration is Dexie version 5. It must repeat every version 4 store and add only:

- `pluginPackages`: `id, enabled, installedAt`
- `pluginInstanceData`: `id, pluginId, instanceId, updatedAt`

Version 5 must keep probes, profiles, widgets, shared items, assets, notes, folders, tasks, bookmarks, events, reminder rules, notification occurrences, timer sessions, and quiet hours. Tests must open versions 1, 2, 3, and 4 and upgrade to 5 without deleting those rows. A failed migration must not delete user data.

Plugin instance keys are `plugin:<pluginId>:<instanceId>`. Package bytes or hashes are stored only after validation. Uninstall offers keep or delete for that plugin’s instance rows only. Safe Mode sets a host flag and disables imported instances; it does not remove rows.

Widget placement can point at a plugin id through the existing widget instance. The placement remains profile-owned. Plugin data does not become a second layout source.

The schema limits in the contract are normative. `docs/07_PLUGIN_SYSTEM.md` also proposes 64 KB of JSON per instance, 1 MB of raster assets per package, 20 instances per profile, 50 installed packages, and 5 MB of plugin assets overall. Those numbers are proposals, not an accepted ADR. Implementation must not invent different caps and must not treat the proposals as owner-approved until section 9 is decided.

FR-086 requires plugin data schema migration with rollback. The first stored data schema version should be explicit. A newer host that cannot read an instance shows a compatibility error, keeps the row, and does not run package-supplied migration code.

## 5. Browser and platform

Firefox remains first. Chrome MV3 must build with the same declarative behavior. Differences belong in the existing browser adapter, not in block renderers.

Opening a local package uses a user-initiated file input. Export uses a downloaded Blob. Neither needs a new manifest permission. `safeNavigation.open` may open only a validated `http` or `https` URL through the existing tab API, after the capability is present and the user activates the link. `http` URLs need the confirmation described in doc 07. `javascript:`, `data:`, and `file:` URLs are rejected.

Countdown display uses the host clock while the widget is visible. It must not poll in the background and must not call `browser.alarms` or `browser.notifications`.

Offline use is mandatory. Preview, installed widgets, and instance data must work with no network. Remote images and remote scripts are rejected.

Persian and English copy is required on the builder, manager, validation errors, and Safe Mode. Layout direction follows the active locale. Plugin-supplied text is rendered as text in both locales, not as HTML.

## 6. Security and permissions

No new permission and no CSP change is authorized. The current permissions remain `storage`, `alarms`, optional `notifications`, and `bookmarks`. CSP must continue to block `eval`, remote scripts, and inline event handlers.

Imported bytes are untrusted data. The host renderers are the only executable behavior. The validator allowlists fields. It does not rely on a denylist alone. JSON parsing must reject `__proto__`, `constructor`, and `prototype` as attacker-controlled keys. ZIP reading must reject `..`, absolute paths, symlinks, duplicate case-insensitive names, too many entries, and compressed or uncompressed sizes above the approved cap. Image bytes must be sniffed against PNG, JPEG, or WebP. A package that fails any check is not stored.

The notes, events, bookmarks, and other plugin namespaces are not passed into a renderer. T04.07 must attempt those reads and expect rejection. A crashed block stays inside an error boundary. Repeated crashes quarantine that package. The dashboard, notes, and calendar must still open.

`web-ext lint` already warns about dynamic `innerHTML` in the production bundle. P04 must not add plugin HTML assignment to silence or bypass that warning.

No dependency is approved by this plan. The production set does not include a ZIP library. If a correct bounded reader cannot be built without a new package, implementation of T04.05 stops and a proposed ADR is required. That ADR is not written or accepted here. node-forge is not an acceptable ZIP implementation and is not approved.

## 7. Acceptance criteria

Automated:

- Each of the seven blocks can be configured, saved, rendered, and reloaded with its own state.
- Calculator division by zero is an explicit finite-state error. No expression string is evaluated.
- Countdown remaining time changes from a injected clock and creates no notification row.
- Export followed by import on an empty plugin store reproduces the manifest and defaults, not the live instance values.
- An invalid package, a script payload, a WASM payload, a `javascript:` link, an unknown capability, a duplicate id, and a traversal path are rejected.
- A failed import leaves the plugin tables unchanged.
- A notes-store read from the plugin host API fails.
- Safe Mode hides imported instances, keeps instance rows, and allows a later re-enable.
- Version 1, 2, 3, and 4 databases upgrade without losing a probe, profile, note, event, or timer.

Disposable-browser, offline, not a personal profile:

- Build a counter in English LTR and Persian RTL, export it, disable it, and import it into a clean disposable profile.
- Reject one hostile package through the file picker and show the validation error.
- Crash one imported renderer and show that the dashboard heading still renders. Then enable Safe Mode and confirm the instance data is still present.
- Confirm the built Firefox and Chrome manifests still have the current permissions and CSP.

These checks do not verify OS notification display, notification permission lifecycle, or the open Firefox reminder-restart case.

## 8. Regression and compatibility

Before any P04 implementation is called complete, the existing suite still has to pass: typecheck, ESLint, formatting, unit, integration, security, packaging, Firefox and Chrome development builds, Firefox beta and release builds, manifest and channel inspection, Firefox smoke, Firefox identity smoke, Chrome smoke, and Firefox `web-ext lint`.

The following evidence becomes invalid and must be refreshed, not edited in place:

- Dexie migration tests, once version 5 exists.
- Packaging and license inventories, only if an approved dependency is added.
- Security scans for `eval`, remote scripts, and permissions.
- Bundle-size notes. A plugin chunk must be measured separately. The Temporal chunk is not reduced by swapping ADR-004 libraries.
- Firefox and Chrome smokes, because the New Tab dashboard will show new plugin entry points.

P03 calendar, notification, and timer tests must keep passing without changed delivery semantics. P00 probe alarm names stay separate from any plugin behavior.

## 9. Outstanding owner decisions

These are not decided by this plan.

1. Confirm or replace the proposed doc 07 storage quotas before implementation treats them as hard caps. The contract’s own array and string limits can be enforced without that confirmation.
2. Authorize either no new archive dependency, or a specific pinned ZIP reader with a fresh audit and license review. Until then, T04.05 must not add a package.
3. P04 implementation itself. This file is only a request.

No other ADR is proposed as accepted. ADR-001, ADR-002, and the node-forge finding stay unresolved.

## 10. Recommendation

**GO** to request a separate P04 implementation authorization that also answers the quota and archive-reader decisions.

**NO-GO** to start P04 from this plan.

**NO-GO** to treat P03 as unconditionally accepted, to accept P00, to sign ADR-001 or ADR-002, to approve node-forge, or to upload or sign a Mozilla build.

## Readiness summary

P04 is specified and bounded. The seven blocks, the ZDPS v1 contract, the capability allowlist, and the security tests are clear enough to implement after authorization. The database needs a non-destructive version 5 when that work starts. No manifest change is required. Two decisions block a safe start: the unapproved storage quotas in doc 07, and the absence of an accepted ZIP reader. P00 native-notification proof and the open P03 Firefox restart, permission lifecycle, OS display, occurrence-click, lint, and bundle items stay outside P04 and must remain visible.
