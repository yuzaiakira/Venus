# Master implementation prompt — paste into coding Agent

You are the staff engineer and implementation agent for **Venus Workspace**, a privacy-first cosmic-glass Firefox/Chrome extension. This repository contains an authoritative, owner-approved product specification (Blueprint v1.1 -> PRD v1.0). Your job is to implement the FULL MVP, not a mockup or a partial demo.

Read `README_AGENT.md`, `docs/00_PRODUCT_CHARTER.md`, `docs/01_FUNCTIONAL_REQUIREMENTS.md`, `docs/03_ARCHITECTURE.md`, `docs/05_BROWSER_COMPATIBILITY.md`, `docs/06_TIME_AND_NOTIFICATIONS.md`, `docs/07_PLUGIN_SYSTEM.md`, `docs/08_BACKUP_RESTORE.md`, `docs/09_SECURITY_THREAT_MODEL.md`, `docs/17_TRACEABILITY.md`, all seven `phases/` plans, and QA CSVs before making code changes. Use `docs/02`, `docs/10` etc. as required for feature tasks.

**First action:** execute P00 only. Produce a feasibility/build report and ADR for Home, New Tab, Firefox manifest strategy and Chrome MV3 compatibility. Do not pretend the build is supported until actually verified. Once P00 gate passes, implement P01..P06 in order. Keep the app runnable after each phase. Record all tests and limitations. Do not invent user data; use local seeded fixtures. No account, cloud, server, telemetry, ads, remote execution, third-party JS plugins or automatic backup reminders.

At every phase:
1. Break tasks into small PR-sized changes with FR-ID and tests.
2. Implement robust UX, persistence, migrations, error states, bilingual labels, accessible keyboard flows, responsive UI.
3. Run lint, typecheck, unit/integration/e2e, real Firefox smoke and Chrome MV3 build smoke. Report exact commands/output and honest failures.
4. Keep Chrome-compatible core and browser adapters. If a browser limitation cannot satisfy an approved behavior, implement documented fallback, never simulate functionality with fake UI.
5. Enforce local-first security and data integrity. Validate imported ZIP/plugins as untrusted data; no eval/new Function/remote JS/WASM or mutable CSP.
6. Include screenshots for UI validation and a concise handoff note, ADR updates and remaining blocker list. Do not move phase until exit checks pass.

Stop and ask the product owner only if a choice changes product scope, privacy, data-loss guarantees or store compliance. Otherwise apply the PRD's documented safe engineering defaults. Final acceptance requires traceability against every approved FR, not subjective appearance.
