# 14 — Confirmed Decisions vs Engineering Assumptions

## 14.1 Confirmed by owner

Firefox-first and Chrome-ready; Home and New Tab targeted; local no account; manual backups with full/selective/portable; shared content and independent layout profiles (last-used selected); FA/EN and Jalali/Gregorian; cosmic glass theming; OS and in-app notifications, advanced recurrence, snooze/done/history/quiet hours; countdown/Pomodoro; basic rich-text + nested folders/tags; dual native/local bookmarks; quick capture and command palette; safe no-code plugin builder with seven blocks and package import/export; limited Firefox beta then public; free first release; name Venus.

## 14.2 Engineering defaults to validate (not newly owner-approved business scope)

- Timezone default inferred from OS, editable; Gregorian/Jalali display and week start independent.
- Invalid Jalali month-day recurrence defaults to skip; user can choose last day.
- Ambiguous DST chooses earlier offset, gap shifts forward to first valid local instant.
- Single active countdown/Pomodoro timer at once; a second prompts replace.
- Note rich-text via JSON editor schema; no HTML archival canonical storage.
- Size classes 1x1/2x1/2x2; breakpoints 12/8/4 columns.
- Plugin packages `.zplugin` ZIP; backup `.Venus-backup` ZIP; limits until beta performance tests.
- Plugin capability schema never includes network in v1.
- Diagnostics local-only with capped retention; no telemetry.
- Home is target, but must obey manifest/runtime browser user control and store policy.

Engineering changes that improve implementation without reducing approved features may be documented in ADR. Changes affecting visible semantics, privacy or acceptance require owner confirmation.

## 14.3 Open external gates (do not invent answers)

1. **Brand check:** Venus/Venus Workspace trademark, domain, app-store naming conflict. Keep working title until cleared.
2. **Home & manifest gate:** Firefox MV3/MV2 policy and Home override behavior; Chrome Home override store requirements. Test and record rather than assume.
3. **Library versions:** verify actual WXT/React/dnd-kit/date library combinations and correct APIs at implementation start. The Tiptap substitution is closed by accepted ADR-010 (restricted JSON note editor, 2026-10-10). Jalali, RRULE, and zoned-time pins are accepted with conditions in ADR-004 and are not installed. Notification reconciliation is accepted with the amended delivery policy in ADR-008. The 60-day horizon, 200-candidate batch cap, and 90-day or 2,000-row history cap are approved configurable constants. P03 implementation is not authorized.
4. **OS notifications:** platform icon/button/sound limitations; fall back gracefully.
5. **Publishing:** AMO signing/accounts and Chrome store review are external owner actions.
6. **Visual assets:** licensed/original space imagery and fonts only.

## 14.4 Non-goals and anti-patterns

Do not add backend, AI assistant, online plugin scripts, analytics, auto backup reminders, notification-by-native-daemon, undocumented browser bookmark synchronization or external ad SDK. Do not pretend a Plugin Builder is a full programmable ecosystem. Do not hide unavailable permissions behind a nonfunctional switch. Do not silently reduce advanced Jalali recurrence to Gregorian approximation.
