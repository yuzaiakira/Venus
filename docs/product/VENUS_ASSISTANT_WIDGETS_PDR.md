# Venus Assistant Widgets — Product Design Requirements

**Status:** Active implementation plan  
**Owner:** Venus product team  
**Updated:** 2026-10-21

## Purpose

Venus will become a personal workspace that helps a person decide what to do
next, capture information quickly and follow through. The dashboard remains
personal: assistant widgets are optional and never appear merely because the
feature exists.

## Product rules

- A profile starts with its existing layout. Assistant widgets are added only
  by the person from **Customize → Add widget**.
- Standard widgets are singletons: one instance of each type per profile.
  Attempting to add it again selects its existing card and explains why it was
  not duplicated. Plugin widgets may opt into multiple instances under their
  existing quota.
- In Customize mode, a card can be dragged over another card to reorder the
  grid. Keyboard move/resize controls remain available. Layout changes are
  stored per profile and cannot overlap.
- Each widget has an empty state, a direct action, accessible labels and a
  compact one-column mobile layout. Widget data stays in the extension's
  existing local storage/IndexedDB unless a user explicitly connects a future
  service.
- No widget may silently send task, note, calendar, contact or financial data
  to a remote service. Any future AI or account connection needs a separate
  consent surface, data scope and disconnect/delete control.

## Shared interaction model

Every widget supplies: a title and purpose, current state, one primary action,
an overflow/settings action when needed, loading/error/offline states, and a
link to its full module. It must preserve RTL layout, Persian numerals and
reduced-motion preferences. User edits require revision-aware writes or an
equivalent transactional service operation.

## Widgets and acceptance requirements

| Widget              | User need                           | Required capabilities                                                                              | Data and privacy                                                  | Status                                                 |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Daily Briefing      | Know what matters now               | Top Today tasks, next calendar event and focus action; direct task opening                         | Reads existing local tasks, events and timer only                 | ✅ Implemented                                         |
| Quick Capture       | Save an idea in seconds             | Capture task, note or event; title-first entry; Today toggle; clear success/failure state          | Uses existing local capture services                              | ✅ Implemented                                         |
| AI Inbox            | Triage incoming material            | Review queue, classify to task/note/event, confidence/explanation, edit before save, reject/undo   | Local rules first; no remote AI without explicit opt-in           | 🟡 Implementation verified; browser acceptance pending |
| Habit Tracker       | Maintain routines                   | Daily/weekly habits, check-in, streak, schedule, missed state, history and reminder integration    | Local habit/check-in records                                      | 🟡 Implementation verified; browser acceptance pending |
| Goals & Progress    | Connect work to outcomes            | Goals, time frame, measurable progress, linked tasks/habits, milestones, weekly review             | Local goal, milestone and relation records                        | 🟡 Implementation verified; browser acceptance pending |
| Weather & Commute   | Prepare for the next commitment     | Location consent, forecast, event travel buffer, refresh time, graceful unavailable state          | Location/network are opt-in; cache minimally                      | ⬜ Planned                                             |
| Focus Coach         | Protect usable focus time           | Free-time suggestions, start timer, defer/snooze, explain conflicts, never auto-edit calendar      | Reads local tasks/events/timer; recommendations local first       | 🟡 Implementation verified; browser acceptance pending |
| People & Follow-ups | Remember relationships and promises | People, next follow-up, notes, contact method, snooze/done, due reminders                          | Local people/follow-up records; no address-book access by default | 🟡 Implementation verified; browser acceptance pending |
| Finance Snapshot    | See commitments and budget          | Manual accounts/categories, monthly budget, upcoming bills, totals, period selector, export/delete | Local financial records; no banking connection by default         | ⬜ Planned                                             |
| Knowledge Review    | Revisit useful information          | Spaced review queue, surface notes, rate recall, postpone, links to notes                          | Local note-review schedule only                                   | 🟡 Implementation verified; browser acceptance pending |

## Delivery sequence

1. **Dashboard foundation** — singleton enforcement, discoverable widget names,
   persisted drag-and-drop, accessible fallback controls. ✅ Implemented
2. **Daily Briefing** — read-only synthesis of existing workspace data and
   direct actions. ✅ Implemented
3. **Quick Capture** — a dashboard capture card using existing creation flows. ✅ Implemented
4. **Habit Tracker** — local schema, history, dashboard card and reminder workflow. 🟡 Implementation verified; browser acceptance pending.
5. **Goals & Progress** — goals/milestones and task/habit links. 🟡 Implementation verified; browser acceptance pending.
6. **Knowledge Review** — review scheduling for existing notes. 🟡 Implementation verified; browser acceptance pending.
7. **People & Follow-ups** — local CRM-style follow-up flow. 🟡 Implementation verified; browser acceptance pending.
8. **Focus Coach** — explainable schedule-aware suggestions. 🟡 Implementation
   verified; browser acceptance pending.
9. **AI Inbox** — local triage queue; remote provider only after an explicit
   product decision and consent design. 🟡 Implementation verified; browser acceptance pending.
10. **Weather & Commute** — only after a documented provider, location and
    network-consent design. ⬜
11. **Finance Snapshot** — manual-first ledger, budget and export/delete
    workflows.

## Definition of done for each widget

A widget moves to ✅ Implemented only when its data validation/migration and
conflict rules are implemented, empty/error/offline states are usable, it can
be added/removed/reordered without duplicate standard instances, its primary
actions work, unit and integration coverage is added where logic changes, and
the documented validation commands pass. Browser acceptance remains a separate
gate while this cloud environment cannot launch a supported browser.

## Habit Tracker verification status — 2026-10-20

- **Implementation and automated tests:** verified. The local Dexie v6 → v8
  migration tests preserve existing workspace records, event/task reminders and
  add habit-owned reminder indexing. Unit and integration tests cover habit
  scheduling, reminder materialization, notification completion and persisted
  check-ins.
- **PDR widget acceptance:** implementation requirements are covered by the
  automated validation suite; the widget stays marked 🟡 until browser
  acceptance is executed.
- **Real-browser acceptance:** blocked in this cloud environment. Firefox is
  not installed, and Chrome cannot start with its required sandbox because the
  system sandbox helper is not root-owned. The CI browser suite includes the
  corresponding Firefox and Chrome exercises and records evidence when a
  supported runner is available.
- **Release readiness:** blocked on successful Firefox and Chrome acceptance;
  native notification API acceptance and operating-system notification display
  are separately recorded and are never inferred from application tests.

## Goals & Progress verification status — 2026-10-21

- **Implementation and automated tests:** verified. Dexie v9 adds profile-owned
  goals, milestones, task/habit relations and weekly reviews without changing
  existing workspace records. Automated tests cover the v8 → v9 upgrade,
  explicit manual/task/habit progress semantics, CRUD, revisions, stale links,
  profile isolation, persistence, opt-in singleton registration and layout
  preservation.
- **PDR widget acceptance:** implemented. The widget is available through
  **Customize → Add widget**, remains absent from existing layouts, and links
  to the full local Goals module. Removing the widget does not remove goals.
- **Real-browser acceptance:** pending. The supported Firefox/Chrome flows have
  not yet exercised Goals & Progress. This is separate from the existing Habit
  Tracker browser evidence and is not inferred from builds or automated data
  tests.
- **Release readiness:** browser acceptance remains open. Focus Coach is
  separately implementation-verified and needs its own browser exercise.

## Knowledge Review verification status — 2026-10-21

- **Implementation and automated tests:** verified. Dexie v10 adds only
  profile-owned review schedules and local review-history records. A schedule
  keeps the original note untouched, starts due on enrollment, and records
  deterministic calendar-day transitions: Again resets to one day, Hard grows
  by 1.2×, Good by 2×, and Easy by 3×, all capped at 365 days. Postpone moves a
  due date one calendar day without recording a successful recall. Unit and
  integration coverage covers each transition, stale submission rejection,
  daily queue states, DST/month/year boundaries, pause/resume/remove,
  unavailable notes, profile isolation, widget singleton/layout persistence,
  reopen persistence, and v9 → v10 preservation of notes, goals, tasks and
  habits.
- **PDR widget acceptance:** implemented. Existing notes can be enrolled from
  Notes or the full Knowledge Review screen. The dashboard widget is opt-in in
  **Customize → Add widget**, stays out of saved layouts, summarizes due work,
  and opens the review flow. Removing it never removes schedules or notes.
  The module provides a due/overdue queue, original-note link, recall ratings,
  postponement, upcoming schedules, pause/resume/remove controls, and local
  history with Persian/English and RTL/LTR presentation.
- **Real-browser acceptance:** pending. The supported Firefox/Chrome flows
  have not yet exercised Knowledge Review. Existing Habit Tracker browser
  checks are not evidence for this module. A local supported browser is not
  available in this cloud environment.
- **Release readiness:** implementation is verified; release acceptance remains
  open until the extension is exercised in official Firefox and secure
  sandboxed Chromium, including responsive RTL review interactions. Operating
  system notification display is not part of this local review feature.

## People & Follow-ups verification status — 2026-10-21

- **Implementation and automated tests:** verified. Dexie v11 adds only local,
  profile-owned people, follow-ups and interaction history, plus an additive
  `followUpId` reminder-rule index. The v10 → v11 upgrade test preserves
  profiles, notes, goals, habits, review schedules and existing reminder rules
  before reopening and persisting People records. Person, follow-up and
  interaction mutations validate with Zod, isolate profiles and use
  revision-aware transactions. Deleting a person requires explicit confirmation
  and deletes only that person's follow-ups, interactions and pending reminder
  records.
- **PDR widget acceptance:** implemented. The responsive People module supports
  contact details, relationship notes, search, archive/restore, interaction
  history, follow-up creation/editing/completion/reopening/snoozing/deletion,
  due queues and filters. Due queues remain visible when notification permission
  is missing or denied. The opt-in singleton dashboard card is available through
  **Customize → Add widget**, summarizes due/overdue/next work, persists its
  placement and never deletes data when removed.
- **Reminder lifecycle:** implemented with the existing Calendar alarm and
  notification-occurrence lifecycle. Follow-up reminders resolve the saved IANA
  timezone and wall time, use revision-scoped idempotency keys, respect quiet
  hours and permission outcomes, recover through reconciliation, and cancel
  pending occurrences on edits, disablement, completion or deletion. Notification
  Center can open, snooze, dismiss and complete the intended follow-up. API
  acceptance remains separate from operating-system notification display.
- **Real-browser acceptance:** pending. The local cloud environment cannot
  launch a supported Firefox or securely sandboxed Chromium. Existing Habit
  browser checks are not evidence for People & Follow-ups, Goals & Progress or
  Knowledge Review.
- **Release readiness:** implementation is verified; browser acceptance remains
  open until the extension is exercised in official Firefox and secure sandboxed
  Chromium, including responsive RTL People interactions.

## Focus Coach verification status — 2026-10-21

- **Implementation and automated tests:** verified. Dexie v12 additively adds
  only profile-owned Focus Coach defer/snooze choices. The v11 → v12 migration
  test retains existing profiles, tasks and People records before persisting a
  Focus Coach choice through database close/reopen. Recommendation ordering,
  local calendar-day deferral, DST/year boundaries, stale concurrent choices,
  profile isolation and persisted state are covered by unit and integration
  tests.
- **PDR widget acceptance:** implemented. Focus Coach is an opt-in singleton
  in **Customize → Add widget**, preserves existing layouts and retains its
  local choices when removed. The full module proposes open work using the
  existing task, event and timer records, explains its due/focus rationale and
  shows the considered calendar conflicts and clear 25-minute windows. It can
  snooze or defer a recommendation and starts only the existing Pomodoro timer.
  The current event model has no end time, so timed events conservatively block
  one hour and all-day events block their local day; the UI states this rule.
  It never writes to or reschedules a calendar event.
- **Real-browser acceptance:** pending. Existing browser suites do not cover
  Focus Coach. A local supported Firefox or securely sandboxed Chromium is not
  available in this cloud environment, so build and automated-data checks are
  not treated as browser acceptance.
- **Release readiness:** implementation is verified; browser acceptance remains
  open until the extension is exercised in official Firefox and secure
  sandboxed Chromium, including responsive RTL focus interactions.

## AI Inbox verification status — 2026-10-21

- **Implementation and automated tests:** verified. Dexie v13 additively adds
  profile-owned Inbox records and the v12 → v13 migration preserves existing
  profile, task, note and widget identifiers before creating and reopening an
  accepted Inbox task. The local-only rule classifier identifies English and
  Persian action, date/time, informational and ambiguous text with a visible
  confidence label and reason. It never sends text to a remote provider.
- **PDR widget acceptance:** implemented. Explicit manual submissions create a
  local review record; users can change the suggested type and all destination
  fields before accepting it. Acceptance creates an idempotent task, note or
  event through the existing services. Reject, restore, explicit removal and
  revision-safe undo are supported. The opt-in singleton dashboard card is in
  **Customize → Add widget**, persists its placement and never removes Inbox
  records when removed. Quick Capture keeps its normal save action and exposes
  a separate explicit **Send to AI Inbox** action.
- **Real-browser acceptance:** pending. This cloud environment has no
  supported Firefox or securely sandboxed Chromium runtime, so the responsive
  RTL/LTR interface, Quick Capture affordance and destination links require
  official Firefox and secure Chromium extension exercises.
- **Release readiness:** implementation is verified; browser acceptance remains
  open. The next independent PDR delivery milestone is **Weather & Commute**,
  which requires a documented provider, location and network-consent design.

## Non-goals for this delivery

No hidden cloud sync, autonomous task/calendar changes, background data
collection, financial-account scraping, contact import, or unconsented AI
request is part of this PDR.
