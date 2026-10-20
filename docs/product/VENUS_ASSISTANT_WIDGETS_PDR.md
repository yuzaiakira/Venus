# Venus Assistant Widgets — Product Design Requirements

**Status:** Active implementation plan  
**Owner:** Venus product team  
**Updated:** 2026-10-20

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

| Widget              | User need                           | Required capabilities                                                                              | Data and privacy                                                  | Status         |
| ------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------- |
| Daily Briefing      | Know what matters now               | Top Today tasks, next calendar event and focus action; direct task opening                         | Reads existing local tasks, events and timer only                 | ✅ Implemented |
| Quick Capture       | Save an idea in seconds             | Capture task, note or event; title-first entry; Today toggle; clear success/failure state          | Uses existing local capture services                              | ✅ Implemented |
| AI Inbox            | Triage incoming material            | Review queue, classify to task/note/event, confidence/explanation, edit before save, reject/undo   | Local rules first; no remote AI without explicit opt-in           | ⬜ Planned     |
| Habit Tracker       | Maintain routines                   | Daily/weekly habits, check-in, streak, schedule, missed state, history and reminder integration    | Local habit/check-in records                                      | ⬜ Planned     |
| Goals & Progress    | Connect work to outcomes            | Goals, time frame, measurable progress, linked tasks/habits, milestones, weekly review             | Local goal, milestone and relation records                        | ⬜ Planned     |
| Weather & Commute   | Prepare for the next commitment     | Location consent, forecast, event travel buffer, refresh time, graceful unavailable state          | Location/network are opt-in; cache minimally                      | ⬜ Planned     |
| Focus Coach         | Protect usable focus time           | Free-time suggestions, start timer, defer/snooze, explain conflicts, never auto-edit calendar      | Reads local tasks/events/timer; recommendations local first       | ⬜ Planned     |
| People & Follow-ups | Remember relationships and promises | People, next follow-up, notes, contact method, snooze/done, due reminders                          | Local people/follow-up records; no address-book access by default | ⬜ Planned     |
| Finance Snapshot    | See commitments and budget          | Manual accounts/categories, monthly budget, upcoming bills, totals, period selector, export/delete | Local financial records; no banking connection by default         | ⬜ Planned     |
| Knowledge Review    | Revisit useful information          | Spaced review queue, surface notes, rate recall, postpone, links to notes                          | Local note-review schedule only                                   | ⬜ Planned     |

## Delivery sequence

1. **Dashboard foundation** — singleton enforcement, discoverable widget names,
   persisted drag-and-drop, accessible fallback controls. ✅ Implemented
2. **Daily Briefing** — read-only synthesis of existing workspace data and
   direct actions. ✅ Implemented
3. **Quick Capture** — a dashboard capture card using existing creation flows. ✅ Implemented
4. **Habit Tracker** — new local schema, history and dashboard card. ⬜
5. **Goals & Progress** — goals/milestones and task/habit links. ⬜
6. **Knowledge Review** — review scheduling for existing notes. ⬜
7. **People & Follow-ups** — local CRM-style follow-up flow. ⬜
8. **Focus Coach** — explainable schedule-aware suggestions. ⬜
9. **AI Inbox** — local triage queue; remote provider only after an explicit
   product decision and consent design. ⬜
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

## Non-goals for this delivery

No hidden cloud sync, autonomous task/calendar changes, background data
collection, financial-account scraping, contact import, or unconsented AI
request is part of this PDR.
