# 15 — Agent Execution Protocol and Task Acceptance

## Execution rules

1. Read charter, all mandatory specifications and relevant phase before touching code; surface platform blockers before broad implementation.
2. Start with a minimal extension skeleton and real Firefox/Chrome builds (P00); do not defer manifest/browser risk to final phase.
3. Work on exactly one scoped task group/branch at a time; keep runnable tests and state migration.
4. Every task cites FR-ID(s), design reference, database changes, risk, and test IDs. Review security consequences for permissions, import, editor, plugin, events.
5. Document each architectural decision and any deviation in ADR; ask owner when business scope must change. If a platform capability is unavailable, implement specified fallback and report gap.
6. No remote scripts, eval, unverified external image payloads, new telemetry/host permissions or arbitrary plugin interpreter.
7. No claims of implemented/tested feature without code and logs; include exact commands and environment.
8. After phase exit, generate handoff message: completed tasks, tests, known limitations, unresolved decisions, next phase, file paths.

## Phase status format

```
Phase: P0X
Implemented FR IDs: ...
Modified files: ...
DB migrations: ...
Permissions changed: ...
Tests command / pass-fail: ...
Firefox manual smoke: ...
Chrome MV3 build/manual smoke: ...
Security checks: ...
Open blockers and ADRs: ...
Next: ...
```

## Change approval thresholds

Agent may select exact libraries/style variables consistent with docs, add tests, refactor boundaries, change internal implementation for performance. Owner approval required to remove a functional requirement, loosen plugin/security protections, change local-first policy, introduce accounts/remote APIs, eliminate Home target, substantially change backup semantics or release order.

## Definition of Ready

Task traces to FR, UI behavior defined, error states known, API/browser capability established or spike named, test plan written, prerequisites completed.

## Definition of Done

Code lint/typecheck/unit/test; integration/e2e where relevant; stored-data migration covered; locale FA/EN; keyboard/a11y; negative tests; updated changelog and FR trace; Firefox target tested and Chrome built; no P0 security/data integrity regression.
