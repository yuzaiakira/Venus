# 06 — Calendars, Recurrence, Alarms, Timers & Notifications

This document is safety/quality critical. Never use `setInterval` as source of truth for timer remaining time, nor Gregorian RRULE as a substitute for Jalali calendar recurrence.

## 6.1 Calendar abstraction

- Date-only (`CalendarLocalDate`): `{calendar: 'jalali'|'gregorian', year, month, day}`.
- Zoned local date-time (`ZonedDateTimeSource`): date tuple, wall-clock h:m:s, IANA zone, DST conflict policy.
- Instant: UTC epoch ms for schedule comparison; date-only all-day items interpreted by local calendar date in event zone, not midnight UTC.
- Display preference and recurrence basis independent: user changing UI from FA/Jalali to EN/Gregorian must not alter event's recurrence rule.
- Use a tested/pinned Jalali arithmetic library; write golden tests across leap years/month ends and conversions for 1900–2100 if library supports it. Never hardcode 365-day assumptions.

## 6.2 Recurrence model

`RecurrenceSpec`: `{basis, freq: 'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY', interval >= 1, byWeekdays?:[], ordinalWeekday?:{ordinal:-1|1..4,weekday}, monthDay?:number, startDate, count?, untilLocalDate?, invalidDayPolicy:'skip'|'last_day', exclusions: occurrenceKey[]}`. Count and until mutually exclusive for user-generated rules (simplifies deterministic semantics). No implicit endless generation into DB. User specifies recurrence basis in event editor.

**Gregorian:** internally use standards-compliant RFC 5545 RRULE for cases expressible by library, with serialized original and timezone. Test ordinal weekdays, BYDAY, UNTIL, COUNT, DST.

**Jalali:** implement interval/week/month/year arithmetic against Jalali dates; e.g. 1 Farvardin each year, 1st each Jalali month, last Thursday of Jalali month, every 2 weeks Saturdays, with correct week start. A Gregorian RRULE only for *converted occurrence instants* is insufficient. `invalidDayPolicy`: skip nonexistent day or move to last valid day, user-selectable; default SKIP, clearly shown. Leap-day yearly recurrence MUST follow chosen policy.

Per-occurrence modifications: source event ID + stable occurrence key generated from recurrence local date/time + original timezone. Support `THIS` and `ENTIRE_SERIES` in MVP; only add `THIS_AND_FOLLOWING` if dedicated semantics and tests exist. When series updated, reconcile future alarms and retain historical notification records.

## 6.3 Time zones and DST

Store IANA timezone on event (default user-configured timezone). App timezone changes must not silently shift events in their defined zone. Timed recurring events track intended local clock time and resolve actual instants with a documented strategy: nonexistent local time during spring-forward -> move to next valid local time (show adjusted indicator); ambiguous fall-back -> choose earlier offset by default; tests and UI disclosure required. User can override event timezone. For plain task due dates/all-day events, avoid forcing instant where not needed.

## 6.4 Reminder scheduling

1. Commit event and rules durably.
2. Generate upcoming occurrences in bounded horizon (e.g. 60 days / max 200 candidate occurrences per series per batch).
3. Expand reminder offsets (e.g. 24h before, 15m before). Compute deterministic `idempotencyKey=ownerId:ruleId:occurrenceKey:scheduledInstant`.
4. Store pending notification occurrences in DB transaction before browser alarm scheduling.
5. Reconcile desired scheduled alarms with platform `alarms.getAll()` and create/cancel idempotently; avoid unbounded number of browser alarms (use next-due sweep alarm if necessary).
6. On onAlarm: acquire durable claim/state transition; persist `fired`/`missed` internally; only show native when available, outside quiet hours or override; mark native result separately.
7. On browser restart/install/background wake: reconcile DB and alarms, identify past-due item, mark `missed`, show nonspam internal summary. If native alert due close to restart, avoid duplicate native flood.

**A fully closed browser cannot guarantee timely OS notifications.** If OS/browser is asleep, delivery may lag; do not advertise precise wake-up behavior.

## 6.5 Quiet hours

Preferences: `enabled`, `startLocalHHmm`, `endLocalHHmm`, `timeZone`, `exceptionsAllowed`, notification-level flag `allowDuringQuietHours`. Wrap midnight correctly. Quiet hours suppress native audio/popups (where supported) but do not remove internal records, due states or task/event data. If OS notification API lacks controllable sound/action, explain actual behavior honestly. On resume, internal center shows suppressed alerts. Do not create a native alert burst for quiet-hours backlog.

## 6.6 Notification center state machine

```
PENDING -> DUE -> (NATIVE_SHOWN | NATIVE_DENIED | QUIET_SUPPRESSED)
             -> VISIBLE_IN_CENTER -> READ -> DISMISSED / COMPLETED
                              \-> SNOOZED -> PENDING(new due)
PENDING -> MISSED (browser down/delivery unavailable) -> VISIBLE_IN_CENTER
```

Lifecycle statuses and UI states must be orthogonal where appropriate: a notification can be due and unread; don't use one overloaded state. History retention defaults to 90 days / max 2,000 entries (engineering proposal, user-configurable retention optional). `done` action on Task marks task complete, whereas `done` on Event reminder acknowledges without deleting the Event. Snooze 5/10/30 minutes or custom valid time; re-use unique occurrence+attempt suffix to deduplicate.

Notification icon and callback capability depends on browser/OS; prefer always-open center controls. Click OS notification should navigate to source item when permitted, without injecting content into websites.

## 6.7 Countdown & Pomodoro

Timer state: `idle`, `running`, `paused`, `finished`, `cancelled`. Store `durationMs`, `startedAtUTC`, `endsAtUTC`, `elapsedBeforePauseMs`, `pauseAtUTC`, `cycleMode`, `cycleIndex`. Running remaining = `max(0, endsAtUTC - now)` after accounting for clock adjustment policy; persisted records authoritative. Pause computes elapsed; resume sets new endAt; restarting browser restores/marks overdue. Avoid more than one active timer by default unless design explicitly handles multi-timer alarms; MVP allows one active timer with clear existing-timer prompt.

Pomodoro default 25m focus/5m break, optional long break 15m every fourth round, all configurable. After timer cycle complete, alert + offer next phase; don't auto-start another cycle unless user opts in. Focus mode only changes visible UI, never mutates stored profile layout.

## 6.8 Mandatory tests

| ID | Scenario | Expected result |
|---|---|---|
| CAL-01 | Jalali Esfand 29/30 across leap and common years | nonexistent day handled by configured policy |
| CAL-02 | Last Thursday of Jalali month | correct local weekday/month boundary |
| CAL-03 | Every 2 Jalali weeks, Saturdays | stable 14-day interval and weekday |
| CAL-04 | Yearly Farvardin 1 viewed in Gregorian UI | recurrence remains Jalali |
| CAL-05 | 02:30 in DST spring-forward gap | documented forward adjustment |
| CAL-06 | Fall-back repeated 01:30 | documented earlier-offset policy |
| CAL-07 | Edit one occurrence | only chosen instance changes |
| CAL-08 | Delete series | future alarms cancelled, history retained |
| NOT-01 | Two tabs/background competing due alert | one internal item, at most one native alert |
| NOT-02 | Browser fully closed at due date | missed internal item after restart |
| NOT-03 | Quiet hours wrap midnight | correctly suppressed native, center preserved |
| NOT-04 | Notifications API denied | internal alert still present |
| TIM-01 | Start 25-minute timer then close tab | progress continues using clock time |
| TIM-02 | Restart 10 minutes after timer due | finished/missed state displayed accurately |
| TIM-03 | Pause/resume multiple times | correct remaining without drift |
| TIM-04 | Shift OS clock | detect abnormal shift or recompute with warning; no negative time |
