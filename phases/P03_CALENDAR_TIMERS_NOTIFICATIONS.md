# P03 — Dual Calendar, Advanced Recurrence, Timers, Notifications

**Depends:** P01/P02. **FR:** 030–048; calendar event create from Quick Capture.

## Work packages

**T03.01 — Calendar core.** Canonical UTC/zoned/local date tuple, Jalali and Gregorian arithmetic, date formatters; explicit week start, numerals and timezone; unit golden tests around leap/DST.

**T03.02 — Recurrence engines.** Gregorian RRULE wrapper and separate Jalali arithmetic recurrence generator; daily/weekly/monthly/yearly intervals, BYDAY/nth weekday/last weekday, COUNT/UNTIL, exception occurrence modifications, invalid day policy.

**T03.03 — Event UI.** Month calendar/day agenda/upcoming widget; timed/all-day creation, edit/delete, recurring editor with source basis and timezone, multiple relative/absolute reminder rules and exceptions.

**T03.04 — Durable scheduler.** Reminder DB and occurrence keys, bounded horizon, alarms driver/worker listener with cold-start rebuild, deterministic reconciliation, idempotent claims and cancellation; handle browser shutdown/missed reminders.

**T03.05 — Notification center.** Native+in-app, upcoming, read, snooze, completed/dismissed, history, quiet-hours exceptions, OS permission denied fallback; native click routing when supported, customized but conservative style.

**T03.06 — Timer/Pomodoro.** Durable absolute end time, pause/resume/reset/overdue after restart; one active timer policy; configurable work/short break/long break, optional auto next round, Focus View.

**T03.07 — Failover tests.** Kill tab while timer runs, restart browser around due-time, duplicate onAlarm, OS native blocked, permission revoked, DST boundary, import recurrence later when P05.

## Tests and acceptance

[ ] CAL-01..08 and NOT-01..04, TIM-01..04 in docs 06 pass deterministically.
[ ] Changing UI calendar does not shift source recurrence.
[ ] 1st Farvardin annual and last Thursday Jalali monthly produce correct occurrences.
[ ] No duplicate notifications across multiple tabs/background wakes.
[ ] Alerts when tab closed/browser running; missed notification on reopen after full shutdown, with limitations disclosed.
[ ] Quiet hours suppress native but retain center record; Important override works as permitted by OS.
[ ] Timer resumes accurate on browser restart; stopwatch-like interval is only UI animation.
[ ] Firefox real-browser and Chrome service worker smoke pass.
