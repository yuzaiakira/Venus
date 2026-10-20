# Detailed Acceptance Scenarios — Given / When / Then

These scripts are for implementation/testing agents; they are not evidence tests have run. Every scenario should become an automated test when feasible, otherwise a documented manual Firefox/Chrome test.

## Installation / browser pages

**AT-01** Given clean supported Firefox and signed/developer-compatible install, when user opens a New Tab, then bundled Venus dashboard appears offline, Settings accessible, no remote redirect.  
**AT-02** Given a supported Home override, when user chooses permitted browser Home behavior, then Home renders same shell and browser maintains user control; when blocked, truthful manual activation instructions appear.  
**AT-03** Given an existing New Tab/Home override by another add-on, when Venus installs, then conflict/precedence isn't misrepresented and no stored Venus data are lost.  
**AT-04** Given Chrome MV3 dev build, when opening Chrome New Tab, then same core workspace runs with adapter-specific APIs.

## Onboarding, theme and profiles

**AT-05** Given first run, when user skips optional onboarding steps and denies bookmark access, then default dashboard loads and local bookmarks work.  
**AT-06** Given user picks FA and Jalali with Persian numerals, when switching theme and resizing window, then RTL navigation/clock/calendar remain correct and focus visible.  
**AT-07** Given two named profiles with distinct wallpapers/widgets, when creating one Note in profile A then switching to B, then Note persists/shared but B's layout remains unchanged.  
**AT-08** Given edit mode and keyboard-only user, when moving and resizing widget through accessible controls then reloading, then persisted position/size match.  
**AT-09** Given uploaded unsafe image/oversized image, when selecting as background, then reject and retain previous background; provide localized error.

## Notes / folders / capture / tasks

**AT-10** Given note with bold/list/link and nested folder/tag, when reloading, then editor JSON and hierarchy roundtrip exactly, no script execution.  
**AT-11** Given two tabs open same note with revision R, when both edit and tab B saves stale revision after tab A, then B sees conflict and no silent overwrite.  
**AT-12** Given temporary storage failure, when autosave fails, then UI doesn't claim saved and user can retry or recover draft.  
**AT-13** Given note in trash, when restore then when permanently delete, then restore returns correct folder; permanent deletion warns user.  
**AT-14** Given new task in Quick Capture and note in palette, when double-clicking Save, then each creates exactly one record and can be edited.  
**AT-15** Given 5 tasks and 3 tagged focus, when changing profile, then today's focus records shared while widgets layouts independent.

## Bookmarks / command palette

**AT-16** Given native permission denied, when opening Bookmarks, then extension-local list editable and Browser tab shows explanatory request, not blank crash.  
**AT-17** Given native bookmark deletion, when clicking delete, then confirmation names Browser source and only selected browser bookmark changes.  
**AT-18** Given imported `javascript:alert(1)` as URL, when previewing/using, then navigation is disallowed and text rendered harmlessly.  
**AT-19** Given user presses Ctrl/Cmd+K while not editing, when typing a command, then arrow keys, Enter and Escape work; no web request occurs for local search.  
**AT-20** Given a custom web search provider, when configuring unsafe endpoint, then validation rejects non-HTTPS or script scheme.

## Calendar / reminders / timer

**AT-21** Given annual Jalali Farvardin 1 series, when UI language switches to EN and display calendar to Gregorian, then recurrence remains anchored to Farvardin 1 and future dates convert correctly.  
**AT-22** Given last Thursday of each Jalali month, when advancing 13 months across year change, then every occurrence is within matching Jalali month and final Thursday.  
**AT-23** Given DST gap local time, when recurrence expands, then chosen shift-forward policy applies with visible adjusted-time notation.  
**AT-24** Given two reminders for one event, when due, then each distinct alert is recorded once; duplicated background event doesn't duplicate native alert.  
**AT-25** Given quiet-hours 23:00–07:00 and normal priority reminder due at midnight, when due, then internal record exists while native alert suppressed; important override takes effect only as supported.  
**AT-26** Given timer running and no New Tab open, when browser remains active and time reaches end, then internal due item and native notification attempt occur.  
**AT-27** Given browser completely shut down during a due reminder, when reopened later, then reminder appears as missed internally and extension does not claim native on-time delivery.  
**AT-28** Given paused Pomodoro and browser restart, when UI reopens, then elapsed time remains stable until user resumes.

## Plugin and backup security

**AT-29** Given seven built-in block templates, when saving/exporting/reinstalling each, then schema valid and fixed renderer recreates without imported code.  
**AT-30** Given plugin with scripts/HTML handlers/WASM/expression evaluator, when importing, then install rejected; original profile untouched.  
**AT-31** Given plugin ZIP with `../`, symlink or huge decompressed payload, when importing, then parser rejects before writing any installed package.  
**AT-32** Given plugin renderer throws, when tab opens, then error boundary isolates failure; Safe Mode disables imported plugins but preserves user data.  
**AT-33** Given Full backup, when restored into clean Firefox profile, then normalized notes/events/tasks/layout/plugins/user images match.  
**AT-34** Given Firefox Portable backup, when imported to Chrome dev build, then Venus data restored; browser-private IDs/home/permissions not assumed restored.  
**AT-35** Given backup with corrupt checksum/unsupported version, when opening Import, then preview blocks applying and live DB remains identical.  
**AT-36** Given native bookmark snapshot in backup, when importing without explicit checkbox, then recipient browser's native bookmarks are unchanged.  
**AT-37** Given two overlapping records in Merge, when conflict preview chooses keep-current/duplicate, then choices honored and no silent overwrite.  
**AT-38** Given user never visits Data Settings, when using Venus for months, then no periodic backup reminder and no scheduled backup upload are generated.

## Release gate

**AT-39** Given Firefox beta candidate, when auditing dependency tree and target manifest, then no eval/remote scripts/no broad host permission without rationale.  
**AT-40** Given final phase report, when checking 106-row test matrix and implemented FR map, then each mandatory requirement has real pass evidence or an explicitly owner-approved issue; missing pass is not described as complete.
