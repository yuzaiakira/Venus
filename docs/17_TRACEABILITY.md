# 17 — Requirements Traceability Map

This is the index that connects user-approved scope -> engineering phase -> main QA suites. **No approved module may be omitted from execution**. Some requirements span phases (e.g. security runs across all phases).

| Requirements | Domain | Primary phase | Test suites |
|---|---|---|---|
| FR-001..006 | Home/NewTab/Onboarding | P00/P01/P06 | BRW, ONB |
| FR-010..017 | Dashboard/Profiles | P01 | DASH, DATA, A11Y |
| FR-020..026 | Appearance/i18n/Settings | P01 | UI, I18N, A11Y |
| FR-030..036 | Clock/Calendar/Events | P03 | CAL, DST |
| FR-040..048 | Reminder/Timer | P03 | NOT, TIM |
| FR-050..056 | Notes/Tasks/Capture | P02 | NOTE, TASK, DATA |
| FR-060..065 | Bookmarks/Search | P02 | BMK, CMD |
| FR-070..073 | Command Palette | P01/P02 | CMD, A11Y |
| FR-080..086 | Declarative plugins | P04 | PLG, SEC |
| FR-090..097 | Backups/Local-first | P05 | BAK, SEC |
| FR-100..103 | Diagnostics/Release | P06 | REL, BRW |
| NFR-01..10 | Speed/reliability/a11y/privacy | Every phase | PERF, SEC, DATA, I18N |

## Explicit no-scope-loss validation

1. Home **and** New Tab targeted in Firefox beta, Chrome architecture tested and Home platform difference documented.
2. Two locales, two calendars, 12/24h date/time and nuanced recurrence.
3. Multiple layout profiles with **shared content** and last-used selection.
4. Native + extension-local bookmarks; both quick icons and folder panel.
5. Rich Text notes with nested folders/tags, autosave, trash, pin.
6. Tasks/today focus, quick capture, search/command palette.
7. Countdown/Pomodoro, OS alerts + in-app center, snooze, history, quiet hours.
8. Seven safe plugin blocks, builder, manager, file share/restore and Safe Mode.
9. Full/selective/portable manual backup + migration/rollback; **no reminder**.
10. Glass/space visual customization including own image, gradients, dark/light/system and glass sliders.
11. Firefox limited beta before public, Chrome build from same codebase.

If any line above is incomplete, MVP is not functionally complete per approved Blueprint, even if all implemented screens look polished.
