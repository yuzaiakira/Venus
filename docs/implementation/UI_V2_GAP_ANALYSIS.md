# Venus UI Concept v2 — Gap Analysis

Date: 2026-10-15.  
Status: **audit only**. No phase started. No schema or visual migration begun.  
Inputs: `Venus-UI-Source-v2.zip`, current `src/`, PRD `docs/01_FUNCTIONAL_REQUIREMENTS.md`, phase reports through P04.

## 1. Repository state (inspected)

| Area | State |
| --- | --- |
| Stack | WXT + React 19 + TypeScript + Dexie. Firefox-first MV3, Chrome MV3 build present. |
| Phases | P00–P04 **implemented**. P00 **NOT PASS**. P01–P03 **conditionally accepted**. P04 **implemented, not owner-accepted**. P05 **not started**. |
| DB | IndexedDB `Venus-p00`, schema version **5** (plugins). Migrations preserve prior data. |
| Design in extension today | Functional cosmic-ish tokens in `src/design/tokens.css`, but **not** a faithful port of Concept v2 (sidebar shell, hero planet, glass widgets, kanban board). |
| Concept v2 | Standalone HTML/CSS/JS preview under `venus-ui-concept-v2/` in the ZIP. Demo persistence via `localStorage` only. |

## 2. Source-of-truth conflicts

| Topic | Concept v2 / master prompt | Approved PRD / current code | Safe approach |
| --- | --- | --- | --- |
| Task board | Trello columns: todo / doing / done; drag across columns; checklists on cards | FR-054: status open/done; priority 1–3; `focusRank` top-three only; no kanban columns; no task checklist schema | **Owner decision required** before schema change. Prefer additive migration (new fields + map open→todo/doing, done→done) if approved. |
| Today's priorities | Unlimited multi-select + reorder | `focusRank` ∈ {1,2,3} only; fourth focus rejected | PRD “Top Three Focus” can remain; unlimited “today” flag would be a **scope expansion**. Concept README itself says design must not override the PRD. |
| Visual shell | Fixed sidebar + hero + glass widgets | Editable widget grid + functional chrome | Migrate CSS/components to match Concept v2 **without** removing grid edit mode, profiles, or modules. |
| Calendar in concept | Jalali preview only | Full Gregorian/Jalali + recurrence + reminders (P03) | Keep P03 engine; restyle calendar UI to Concept appearance. |
| Notes | Create/edit/delete/reorder | Rich-text, folders, tags, pin, archive, trash (P02) | Keep domain model; add reorder UX + Concept card chrome. |
| Plugins / backup | Absent from concept | P04 done; P05 pending | Do not regress. Continue phase gates. |

## 3. Visual gaps (Concept v2 vs current extension)

Missing or weakly matched relative to approved Concept:

- Sticky icon sidebar + bottom mobile nav
- Space nebula layer + star field matching Concept CSS variables
- Hero card with planet/orbits + live clock stack
- Glass widget cards for Today / Calendar / Notes / Quick links / Focus
- Floating add (FAB) + capture menu
- Profile switcher chrome matching Concept
- Kanban board page styling
- Notes gallery / bookmark gallery card language
- Settings cards matching Concept sections

Present in extension but not in concept (must be preserved):

- Widget grid edit mode, resize, keyboard reorder
- Profiles with independent layouts
- Command palette, notification center, plugin studio
- Full settings (modules, wallpaper upload, glass blur, backup entry points)
- Real browser adapters and offline productivity data

## 4. Functional gaps vs master prompt

### Already substantially implemented (domain + UI, style aside)

- New Tab extension shell (Firefox/Chrome builds)
- Dashboard widgets, profiles, appearance prefs
- Notes CRUD + rich-text + folders/tags/pin/archive/trash
- Tasks CRUD (open/done), due date, priority, top-three focus
- Local + optional browser bookmarks
- Calendar, recurrence, reminders, timers, notification center
- Safe plugin platform (seven blocks, ZIP, Safe Mode)
- FA/EN + RTL/LTR catalogs
- Local-first IndexedDB persistence and migrations

### Missing or incomplete relative to Concept v2 / master prompt

1. **Visual migration** of Concept v2 into React modular CSS (highest design risk).
2. **Kanban task board** UI + persistence model for three columns (scope conflict with FR-054).
3. **Task checklists** as first-class fields (not in `taskSchema`).
4. **Unlimited today's priorities** (conflicts with top-three `focusRank`).
5. **Note drag-reorder** with keyboard up/down (notes have sort via folders; dashboard reorder UX incomplete vs Concept).
6. **P05** backup/restore/security integration (next gated phase).
7. **P00** open gates (Home verification, native permission lifecycle, node-forge toolchain risk, unsigned ADRs).
8. Firefox **regular-install** restart / Chrome Home still **NOT VERIFIED** per prior reports.

### Explicitly out of scope for blind implementation

- Starting P05 without P04 owner acceptance
- Rewriting Dexie from scratch
- Remote plugins, telemetry, accounts, Next.js backend
- Claiming notification delivery when browser is closed

## 5. Recommended workstreams (choose one)

### A — UI Visual Migration (recommended next coding block)

Port Concept v2 appearance into `src/design/` + dashboard/library shells. Preserve all existing domain services. No task schema change. Exit: side-by-side visual check + existing unit/smoke still green.

### B — Task Model Expansion (requires owner scope approval)

Approve schema delta for:

- `status: "todo" | "doing" | "done"` (migrate `open`→`todo`, `done`→`done`)
- optional `sortIndex` per column
- optional `labels: string[]`, `checklist: { id, text, done }[]`
- optional `today: boolean` + `todayRank: number | null` **in addition to** top-three `focusRank`, **or** replace top-three (must choose)

Then implement kanban UI on Library tasks view + dashboard Today widget sync.

### C — P04 acceptance / P05 gate

Owner accepts or remediates P04; only then start P05 backup/security.

### D — P00 residual risk remediation

node-forge tooling path, ADR signatures, Home/permission verification evidence.

## 6. Agent constraints observed

Per `AGENTS.md` / `agent/AGENT_MASTER_PROMPT.md`:

- One phase at a time; no silent phase advance.
- No commit/push without approval.
- Do not weaken security or invent browser capabilities.
- Concept v2 README: preview must not override the PRD without owner decision.

## 7. Ask for owner

Please choose:

1. Approve **workstream A** (visual migration only)?
2. Approve **workstream B** schema expansion (and specify today-priorities vs top-three)?
3. Accept/reject **P04** and authorize **P05**?
4. Prioritize **P00** open gates first?

Until then: no production code changes beyond this audit document and leaving `Venus-UI-Source-v2.zip` as an untracked design input.

---

## 8. Workstream A status (2026-10-15)

**Owner approved A.** Visual migration applied without schema or phase-gate changes.

### Done
- Concept v2 palette in `themeTokens` + `src/design/tokens.css`
- App shell: space layer, sidebar, Venus topbar, hero + planet/clock, FAB
- Widget chrome (icons, titles, glass cards) for built-in widgets
- FA/EN hero and widget strings
- Existing domain services, task schema (`open`/`done` + top-three focus), and P04 plugin paths preserved

### Not in A
- Kanban / checklist / unlimited today (workstream B)
- P05 backup
- Pixel-perfect restyle of every library/settings/calendar control (secondary pages still functional under shared tokens)

### Verification
- `npm run typecheck` — pass
- `npx eslint` on touched app sources — pass
- `npx vitest run tests/unit` — pass
- `npm run build:firefox` — run after A land
