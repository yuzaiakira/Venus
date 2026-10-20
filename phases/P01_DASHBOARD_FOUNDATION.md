# P01 — Dashboard, Appearance, Profiles, Localization, Settings

**Depends:** P00. **FR:** 001–006, 010–026, 070–073 (palette shell).  
**Goal:** daily-usable New Tab/Home shell with persistence and bilingual glass design.

## Work packages

**T01.01 — Design system.** Semantic theme tokens, premium glass card, inputs, dialogs, menus, buttons, toasts, icons, contrast floors, animations/reduced motion, cosmic wallpaper assets cleared for use, light/dark/system.

**T01.02 — i18n.** FA/EN catalogs, direction switching, numeral styles, time zone/week start/calendar display settings, number/time formatting; root dir + bidi isolation and keyboard focus. Never translate hardcoded UI manually in components.

**T01.03 — Local settings + schema migrations.** IndexedDB Dexie init and preferences in storage.local; app bootstrap with minimal FOUC; standard repository interface/revision; cross-tab change events.

**T01.04 — Layout engine.** Widget Registry (prebundled core widgets), grid placements, 1x1/2x1/2x2 sizes, drag/drop with keyboard alternative, visible edit mode, on-the-fly preview and atomic persist. Widget error boundary.

**T01.05 — Profiles.** Create/duplicate/rename/delete/switch. Last active profile persists globally; only layout and visual settings vary, all business data shared. Default presets Minimal/Productivity/Personal.

**T01.06 — Main dashboard shell.** Header, central clock/date, empty/upcoming/today placeholders that become real later, search, quick capture button, notification bell, profile switcher, Settings access, responsive grid.

**T01.07 — Settings.** Dedicated searchable sections, enable/disable core modules, local wallpaper upload with pixel/mime limits, gradient creator, adjustable blur/transparency, safe reset with confirmation; preview before save or auto-save with error handling.

**T01.08 — Onboarding.** Short skippable setup including permissions explanation, theme/calendar/profile; re-run in Settings. Home status help. Palette basic UI Ctrl/Cmd+K with starter commands.

## Tests and acceptance

[ ] Load first run fully offline without external assets; pick Persian/Jalali -> correct RTL/time.
[ ] Switch EN and dark/light/system, change wallpaper and glass; survives restart.
[ ] Create 3 profiles, switch/delete one; data mock repositories shared, layouts isolated.
[ ] Drag/resize and keyboard reorder persist after reopening browser. On responsive screen no overlap.
[ ] User-rejected bookmark/notification permissions don't block onboarding.
[ ] Single broken widget does not crash page; error boundary offers recovery.
[ ] Command palette accessible and safe in Tiptap/input contexts when added later.
[ ] Benchmark cold/warm New Tab loads and document initial p90.
[ ] Firefox and Chrome smoke pass; manifest unchanged unexpectedly.
