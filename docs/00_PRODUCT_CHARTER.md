# 00 — Product Charter, Decisions and Scope

## 0.1 Vision

Venus Workspace replaces browser New Tab and, to the degree technically permitted, Home with a fast, beautiful, customizable private productivity workspace. Brand draws on Venus imagery. English tagline: *Your Space. Your Flow.* Brand name is working/approved for product design, **not yet cleared as trademark or domain**.

## 0.2 Personas and jobs-to-be-done

- **Everyday browser user:** navigate bookmarks instantly, check time/date/tasks and take a quick note.
- **Student/professional:** Pomodoro, today focus, recurring reminders, calendar, distinct study/work layouts.
- **Persian/English bilingual:** accurate Jalali/Gregorian calendar, week starts, numerals, RTL/LTR; international-first with strong Persian support.
- **No-code maker:** build and share safe widgets without programming skills.
- **Privacy-conscious user:** keep data on their own machine and export complete portable backups.

## 0.3 Confirmed decisions (fixed scope)

| ID | Decision |
|---|---|
| D01 | Firefox first, limited beta, then public; Chrome later, common codebase from day one. |
| D02 | Home and New Tab both in MVP target; platform/consent dependent Home fallback. |
| D03 | WXT + React + TypeScript architecture proposed; Chrome MV3, Firefox variant validated by gate. |
| D04 | Persian and English, RTL/LTR; Jalali and Gregorian configurable. |
| D05 | Space-inspired Glass UI; light/dark/system, bundled cosmic scenes, user-uploaded image, gradients, adjustable blur/transparency. |
| D06 | Responsive drag/drop/resizable widgets; multiple named layout profiles, shared notes/events/tasks/bookmarks; last-used profile global. |
| D07 | Clock date selection (12/24h), calendar, recurring events, reminders, always-visible upcoming widget. |
| D08 | Native OS notifications + in-app notification center, snooze, complete, history, quiet hours. |
| D09 | Countdown & Pomodoro, background lifecycle tolerant; notification at completion when browser can run. |
| D10 | Rich text notes, nested folders, tags, search, pin and recycle bin. |
| D11 | Native browser bookmarks AND extension-local bookmarks; quick icons + folder panel. |
| D12 | Tasks/today focus, quick capture, search and command palette MVP. |
| D13 | Declarative plugin builder + manager, seven safe blocks, file import/export, no arbitrary third-party code. |
| D14 | Local-only profile, no account or cloud sync; full/selective/portable manual Backup/Restore; no backup reminders. |
| D15 | Brief skippable onboarding, all settings configurable; initial release free, revenue later. |
| D16 | No AI, online marketplace, collaboration, payments or analytics in MVP. |

## 0.4 Product principles

1. **Fast by default:** the core layout and bookmarks must not wait for heavy art, notes editor or plugin payload.
2. **User owns data:** deterministic storage, backup, merge/replace safety and recovery.
3. **No silent dangerous behavior:** explicit disclosures and confirmation for browser bookmark edits, destructive imports and permissions.
4. **No arbitrary third-party execution:** plugin packages configure prebundled widgets only.
5. **True bilingual UX:** translated labels are insufficient unless date, numeral, direction, accessible names and truncation work.
6. **Portable by design:** no browser-internal bookmark IDs in archival contracts.

## 0.5 Out of scope for MVP

Login, remote database, multi-device sync, plugin marketplace server, paid plans, arbitrary JS/WASM plugins, web scraping, weather requiring remote APIs, AI, user tracking, collaboration, mobile app, native background daemon, OS notifications while entire browser is closed.

## 0.6 Success metrics (quality gates, not invented usage forecasts)

- Core load usable target <= 1.0 s on declared benchmark PC/profile; cold-load and warm-load both measured, 90th percentile recorded (performance is a goal, not a guarantee).
- 100% of P0 acceptance tests pass on target Firefox version; no P0/P1 unresolved data-loss/security bugs at beta handoff.
- Restore to fresh browser profile recreates functional content and layout; external browser bookmarks require separate permissions and confirmed import choices.
- Two supported locales complete, keyboard operation in all core workflows, light/dark passes contrast checks.
- Chrome MV3 builds from same repository at each release gate; Home-specific divergence documented.

## 0.7 Dependency/gate policy

Never reinterpret a store/platform limitation as a feature deletion. Implement approved degraded behavior with explicit UI: e.g. reminders when browser is closed -> missed-reminder recovery on restart; Home cannot be enabled programmatically -> guided manual activation; notifications denied -> in-app persistence. Owner approval required to downgrade scope in other circumstances.
