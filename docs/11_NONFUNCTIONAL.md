# 11 — Nonfunctional Requirements / Service Quality

## NFR-01 Performance

Target interactive dashboard <=1.0 s at p90 on recorded reference desktop profile with warm extension assets; record cold and warm separately and never declare pass without hardware/software/network test context. Initial JS ideally <=300KB gzip critical path (engineering budget to validate); deferred modules lazy-loaded; bundle analysis recorded. Main thread must remain responsive while 10 widgets render; avoid >50ms recurring long tasks on idle tab. Background CPU negligible when no due work; don't poll at second frequency with no visible UI.

## NFR-02 Data integrity

No lost persisted records across clean restart and normal upgrade. Mutations atomic at transaction boundary; app updates must not auto-delete data on migration failure. Multi-tab simultaneous edits require version control. Broken wallpaper/widget does not block access to Data & Backup. Automated seed + restart + verify cases mandatory.

## NFR-03 Offline capability

App shell, all personal data, calendar math, stopwatch/timer, notes, local bookmarks, plugins and backups work offline. Native bookmark APIs local; external search/URL navigation understandably fails without internet. No required remote assets or fonts.

## NFR-04 Reliability of notifications

No false guarantee of OS alert with closed browser; duplicate suppression; automatic reconciliation after restart; internal durable record. Time drift/power-save/API failure reflected in UI. No silent loss of reminders.

## NFR-05 Localization/a11y

Every first-party UI action and error in fa/en, full RTL/LTR support, keyboard and screen-reader tested, design accessible when blur effects disabled. Dates, week start and numeral preferences persist.

## NFR-06 Maintainability

TypeScript strict, module boundaries, modular domain services, lint, formatting, documented ADRs, reproducible installs and lockfile, CI test/build. New domain feature should not require browser-specific branch outside adapters. 80%+ unit coverage of critical recurrence/backup/plugin-validation code suggested; coverage alone not release evidence.

## NFR-07 Data limits

Start with documented limits in docs 07/08; expose friendly quota error. Define eviction only for disposable caches/thumbnails and bounded diagnostics; never evict notes/events/tasks. Monitor IndexedDB capability and private/incognito behavior by browser; if unsupported, show explicit ephemeral-data warning rather than false persistence claim.

## NFR-08 Security and policy

No external runtime code, no arbitrary plugin execution, restrictive CSP, schema-validated archives, least privilege, privacy notice; test platform/store acceptance constraints. Dependency/security scans and manual manifest review mandatory.

## NFR-09 Observability

No telemetry or server logs. Local-only recoverable diagnostics with redacted error codes and export initiated by user; logs never include full note text, private reminder details, or file paths unless explicitly needed and reviewed.

## NFR-10 Browser portability

Core repository builds target Firefox and Chrome MV3 continuously. Differences listed in capability matrix. Chrome public store release can come later, but Chrome build cannot be deferred to the end.
