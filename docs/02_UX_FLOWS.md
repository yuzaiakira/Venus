# 02 — UX/IA, Screens, Workflows and States

## 2.1 Navigation map

Top-level: Dashboard / Calendar / Notes / Tasks / Bookmarks / Plugin Center / Settings. Overlays: Quick Capture, Command Palette, notification center, widget settings, item edit dialogs. The global clock, active layout profile, search trigger, notifications and settings access must be discoverable. Use shared shell on Home/New Tab, responsive for widths >= 768px first; narrower desktop/tablet progressive adaptation.

## 2.2 First-run flow

Welcome (brand/privacy/offline) -> locale + calendar preference (FA/EN, Jalali/Gregorian/both, week start, timezone inferred but editable) -> light/dark/system & one bundled scene -> default layout preset -> optional permissions with clear benefits and skip -> done. Every step: Back/Next/Skip (where optional), focus heading on transition, store progress to allow resume. Avoid permission prompts until user action where possible. Initial install must not be held hostage by declined notifications/bookmarks. Home control must distinguish manifest/browser-managed setting and user choice; not pretend runtime settings change the manifest.

## 2.3 Dashboard layout

- Header: Venus mark, current profile switcher, quick search, notification bell with unread count, settings; avoid overly tall header.
- Hero: large clock/date with locale-aware numerals; optional greeting; adjustable show/hide.
- Main adaptive grid: Upcoming Events, Today Focus, bookmarks quick grid, Timer, pinned Notes, Plugin widgets.
- Edit mode: visible handles, discrete resize steps, grid placement highlight, add-widget drawer, done/cancel; Keyboard alternative: Move left/right/up/down buttons and size dropdown.
- Empty widgets should have useful CTA (e.g. "Add your first note"); errors include Retry/Disable and allow page to continue.
- Switching profile changes layout/theme/wallpaper, not underlying content. Cross-tab switch sync must be explicitly serialized.

## 2.4 Screen-level behavior matrix

| Screen | Primary CTA | Secondary actions | Empty / error |
|---|---|---|---|
| Dashboard | Quick Capture / Search | edit widgets, switch profile | default preset, repair widget |
| Calendar | New event | month/day toggle, agenda, recurrence edit | no events, calendar parse error |
| Notification center | open/done/snooze | read/dismiss/filter/clear | no alerts / permissions notice |
| Notes | New note | folders/tags/search/trash/pin | create note / storage failure |
| Tasks | Add task | today focus, filter, complete | create first task |
| Bookmarks | Add bookmark | native/local tabs, folders, import | permissions CTA / missing favicon |
| Timer | Start | pause/resume/reset/mode | no running timer |
| Plugin center | Create plugin | import, enable, inspect, export | examples gallery offline |
| Settings | search section | reset specific group, backup | no result / validation error |
| Backup | Export / Import | select components, preview diffs | unsupported version / corrupt file |

## 2.5 Core workflows (sequence / state)

**Capture note:** dashboard quick button or Ctrl/Cmd+K -> choose Note -> enter title/body -> draft stored on each supported save checkpoint -> optional folder/tags -> close; verify appears in Notes and pinned widgets if pinned. When storage fails, keep draft in memory and show explicit retry/Export draft (not claim saved).

**Schedule event:** calendar day -> New Event -> title / date mode and timezone / time-all-day -> recurrence mode (Gregorian vs Jalali) -> reminder offsets -> save -> generate upcoming occurrences + alarms -> visible in month, agenda, upcoming widget and notification center. Editing whole series vs single occurrence requires clear warning.

**Fire alert:** background alarm -> idempotent occurrence claiming -> notification record written -> evaluate quiet hours and OS permission -> native notification if allowed; clicking native notification opens related event/timer; Snooze sets new wake time; after browser restart reconcile missed alerts and show internal banner/count.

**Native bookmarks:** user chooses Browser tab -> on permission prompt allow/deny -> show source badge and folder tree -> editing native item confirms affected source; local tab works without permission. When removing native permission mid-session, show explanation not destructive fallback.

**Create widget:** plugin builder -> choose one of seven blocks -> labeled fields with defaults and constraints -> live *safe* preview -> save as local package -> optional add to active layout -> export self-contained package. Imported packages take Preview/Validate -> Install only after user confirmation.

**Backup:** Settings > Data -> Full or Selective -> summary + sensitive plain file warning -> Download file. Restore: choose file -> staging validation -> version warning, counts, diff, affected browser bookmarks separately -> Merge/Replace -> confirmation -> atomic commit -> verification report; interrupt must not corrupt live DB.

**Focus mode:** choose focus task / timer -> hide other widgets (visual view only) -> background end timestamp continues -> exit focus restores previous layout (not a separate destructive save).

## 2.6 Settings IA

Sections: Appearance; Dashboard & Profiles; Language/Date/Time; Calendar & Notifications; Timer & Focus; Notes; Bookmarks; Plugin Manager; Data & Backup; Privacy & Permissions; Shortcuts; About / Diagnostic. Each module must offer only supported toggles. A disabled widget remains configured and can be reenabled. Search settings returns section/field labels, not private note content.

## 2.7 Accessibility, error copy and feedback

Keyboard navigation including draggable widgets; visible focus; label every icon-only button; use dialogs with Escape, trap focus, return focus; use live announcements sparingly for saved/stopped timer; use contrast-compliant frosted text overlays; allow no-motion; screen-reader-friendly calendar grid; locale correct direction. Errors must be human-friendly and actionable in FA and EN, e.g. permission denied, backup corrupt, storage quota reached, unavailable native notification. No deceptive success toast.

## 2.8 Minimal responsive grid proposal

>=1280px: 12-column; 900–1279: 8-column; 768–899: 4-column; smaller widths collapse to a simple vertical stack where possible. Persist logical widget order/size rather than fragile absolute pixels. Edit mode must avoid overflow and prevent inaccessible off-screen widgets. Do not hardcode these breakpoints without UI testing; they're an initial engineering proposal.

## 2.9 Copy/localization examples

- FA: «این یادآوری زمانی که مرورگر کاملاً بسته باشد نمایش داده نمی‌شود؛ پس از اجرای دوباره در مرکز اعلان‌ها دیده خواهد شد.»
- EN: "Venus cannot notify you while the browser is fully closed. Missed reminders will appear after you reopen it."
- FA: «فایل پشتیبان شامل اطلاعات شخصی شماست. آن را در محل امن نگه دارید.»
- EN: "Your backup contains personal information. Store it securely."
