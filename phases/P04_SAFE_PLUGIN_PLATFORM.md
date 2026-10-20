# P04 — Declarative Plugins and Visual Builder

**Depends:** P01 and P02. **FR:** 080–086. **Critical:** security-first, no arbitrary code.

## Work packages

**T04.01 — ZDPS schema.** Implement runtime validators from `contracts/plugin-manifest.schema.json`; reject unknown operations, unsafe URLs and unsupported capability/version. Pin package quotas.

**T04.02 — Seven fixed blocks.** Text/Image, Countdown, Counter, Checklist, Quick Links, two-operand Calculator, Progress. Shared typed form, renderer and data schema per block; no arbitrary expressions/HTML/CSS, timer block internal clock only.

**T04.03 — Plugin data host.** Per-plugin+instance namespace and quotas; reviewed built-in capabilities clock/read, own data read/write, safe navigation; no direct browser APIs/other entities.

**T04.04 — Builder UI.** Template gallery, per-block fields, localized names, live safe preview, size/theme, validation messages, save/package/export. Allow composing limited number of independent blocks, not condition/action graph.

**T04.05 — Manager & import.** Strict ZIP ingestion, package preview, install/update version validation, enable/disable, per plugin data keep/delete on uninstall, open/edit/export. No imported data migration executable scripts.

**T04.06 — Recovery.** Widget error boundary, crash quarantine, Safe Mode to disable imported widgets without deleting data, user re-enable workflow.

**T04.07 — Offensive security suite.** Path traversal, decompression bomb, prototype pollution, XSS, bad image, javascript URLs, JS/WASM payload, unknown capability, duplicate ID, package limit, plugin data read attempt.

## Tests and acceptance

[ ] All seven builder block examples configure, save, render, preserve state as expected.
[ ] Export package -> reimport on clean profile shows same defined widget without private live data.
[ ] Plugin install denied invalid package; failed import leaves zero partial installed state.
[ ] Imported packages cannot execute any JS, load external scripts or read Notes DB.
[ ] Safe Mode rescues crashing imported widget without wiping user data.
[ ] CSS/CSP inspection, extension store policy re-evaluation and Chrome MV3 build pass.
