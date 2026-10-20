# 10 — Visual Design System, Localization and Accessibility

## 10.1 Brand tokens (starting proposals; validate contrast)

Brand **Venus Workspace** (Venus-inspired). Tagline *Your Space. Your Flow.* Default scene: atmospheric cosmic background, sophisticated not distracting. Dark palette: Space `#111827`, Nebula `#29264F`, Orbit `#8978D1`, Venus warm accent `#D9AC83`, Frost `#E8EAF4`. Light: pearl `#F6F6FB`, ice `#E8EFFA`, text `#1C2331`, accent adjusted for contrast. These are mood targets, not automatically compliant pairings; actual semantic design tokens tested for WCAG.

## 10.2 Token tiers

Primitive: colors, font sizes, spaces, radii, elevation, blur levels, opacity. Semantic: `background.canvas`, `surface.glass`, `surface.raised`, `text.primary`, `text.muted`, `border.subtle`, `focus.ring`, `status.error`, `status.success`. Component: button, input, widget, dialog, banner. CSS variables let theme changes apply immediately. `backdrop-filter` fallback uses opaque/semiopaque solid surface. Guard for `prefers-reduced-motion` and device performance.

## 10.3 Theme/settings

Modes light, dark, system; glass blur presets 0/4/8/16 px (user slider allowed with bounded values); alpha 0.65–0.95 with contrast floor; prebundled space scenes and user raster wallpaper; CSS gradient choice; custom accent validated for contrast, font size, card corner radius, density, ambient animations on/off. `system` theme reacts to OS. User-uploaded wallpaper never silently leaves device. Per-layout profile wallpaper/theme override supported; global default applies to profiles lacking override.

## 10.4 Locale requirements

- Complete `fa` and `en` message catalog: navigation, editor, errors, security dialogs, notifications, dates, plural rules, accessibility labels.
- Apply `lang=fa`/`en`, `dir=rtl`/`ltr` at page root, and `dir=auto` to mixed user input when appropriate. Icons that convey direction must mirror; media control icons should not blindly mirror.
- Date representation is configurable independently of UI language. Gregorian/Jalali/both. Locale-specific month and weekday names; Persian or Latin numerals selectable, 12/24 h.
- Week starts configurable (Saturday/Monday/Sunday) and local cultural expectations should be met. All relative time and recurrence labels render locale-aware.
- Bidi-safe URLs/email/IDs with isolate directional spans; text input cursor and ellipsis tested with mixed Farsi/English.
- Never use string concatenation for grammar: ICU-style pluralization/message formatting or equivalent; time zone labels translated where viable.

## 10.5 Accessibility (WCAG 2.2 AA target)

Keyboard navigable all workflows; focus indicator clearly visible on glass panels; calendar table/grid has ARIA semantics and navigable days; drag/drop has non-drag alternative; notification center uses polite live regions for due items but avoids repeated announcements; dark/light contrast ratio text 4.5:1 normal and UI nontext 3:1 where applicable; reduced motion and high contrast. Zoom 200% and 400% tested where practicable, responsive reflow. Focus trap and return focus for dialogs; Escape cancels. Timers cannot rely only on color/sound. Global shortcut must not interfere with text editor typed input.

## 10.6 Performance-friendly effects

No always-on WebGL in MVP. Bundle optimized static images, lazy-load images outside current selected scene, cap wallpaper resolution/file size (initial proposal <=8 MP and <=5MB; benchmark confirms). Use CSS transforms/opacity rather than expensive filters in animation; blur only on limited surfaces. Avoid layout shift on New Tab. Feature flag disabling expensive visuals on low-power device; test smooth dragging with 10+ widgets.

## 10.7 Screen inventory and minimum UI components

Screens: onboarding 5 steps, dashboard, calendar month/day + editor, Notes list/editor/trash, Tasks, Bookmarks (native/local), Focus/Timer, plugin Builder/Manager/Preview, Settings sections, Backup Import/Export, Safe Mode, notification center. Components: AppShell, GlassCard, WidgetFrame, AccessibleDialog, Toast/ErrorBanner, DateTimePicker Gregorian/Jalali, RecursiveFolderTree, NoteEditor, PermissionExplainer, ImportPreview, PluginBlockForm, LocalizedNumber, CalendarGrid, NotificationItem, ProfileSelector.

## 10.8 Acceptance visual criteria

Dark and light screenshot baselines at 1440x900, 1280x720, 900x768; FA and EN; high zoom, long text labels; default/empty/error states. Test background/blur configuration changes don't hide text or break focus rings. No remote image dependencies in first-run UI.
