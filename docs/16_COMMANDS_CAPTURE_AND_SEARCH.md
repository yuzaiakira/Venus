# 16 — Command Palette, Quick Capture and Search Contract

## 16.1 Command registry

Commands are first-party prebundled executable handlers with stable IDs (`note.create`, `task.create`, `calendar.event.create`, `timer.start`, `bookmark.open`, `profile.switch`, `settings.open`, `page.navigate`, `search.local`, `search.web`). This registry is NOT open to arbitrary third-party code/plugin command handlers in MVP. Each command has localized title, icon identifier, keywords, permission check, keyboard alias, handler and result/error code.

## 16.2 Palette

Dashboard shortcut Ctrl/Cmd+K unless reserved; persistent open button for discoverability; list results via lightweight local fuzzy search, arrows/Enter/Escape, no command execution on mere highlighting; accessible active descendant and dialog focus. When input is inside the note editor or a text input, shortcut should respect editing contexts or be explicitly overridable. Browser-global shortcut opt-in only if supported; shortcut conflict documented.

## 16.3 Quick Capture

Modal lets user choose Note / Task / Event. Each starts with minimal fields, optional expanded fields, auto-selects sensible defaults (current day/time but never auto-creates recurrence). On save create exactly one entity, show result, allow further editing. If data store unavailable, show explicit retry and retain local draft in memory until user closes or exports, without lying about persistence.

## 16.4 Search behavior

Distinct scopes: (a) local notes titles/body, tasks, local bookmarks, browser bookmarks if permitted, events, commands; (b) external web engine. Always label scope and external destination. External search builds URL only from allowlisted `https:` template with escaped query; no untrusted javascript URL. Local indexing after data mutation is incremental, no remote search transmission. Respect privacy by not persisting sensitive search query history unless user opts in (out of MVP).

## 16.5 Tests

Key combos in both locales, text editor interception, no result state, 10k local records search perf, revoked browser bookmark permission, Arabic/Persian Unicode variants, mixed RTL/LTR, XSS strings in result labels, URL scheme protection, no duplicate Quick Capture submissions on double-click.
