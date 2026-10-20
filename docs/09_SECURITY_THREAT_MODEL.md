# 09 — Security and Privacy Threat Model

## 9.1 Trust zones

T0: extension-bundled signed code and fixed renderer definitions; T1: editable user settings/notes; T2: untrusted import ZIP/plugin package/image/url; T3: browser APIs (capability/permission dependent); T4: optional external search destinations; T5: OS notification system. Imported file contents never cross from T2 to executable T0.

## 9.2 Threat table

| Threat / abuse | Exposure | Defense | Mandatory test |
|---|---|---|---|
| XSS in Rich Text/notes | pasted HTML or JSON | editor JSON schema, sanitizer, no `dangerouslySetInnerHTML` with raw user content | `<img onerror>` not executed |
| Plugin remote-code injection | imported package | declarative strict schema, fixed code block registry, no eval/remote scripts/WASM, restrictive CSP | import JS payload rejected |
| Path traversal / ZIP bomb | restore and plugin ZIP | bounded safe archive reader, no symlinks/`../`, compressed/uncompressed caps | crafted archives rejected |
| Malicious bookmark URL | local/native bookmarks or import | allowlist `https`, `http` (possibly `mailto` only explicit; disallow `javascript`, `data`, `file`) | no script URL opened |
| Unauthorized note access by plugin | hostile manifest | narrow host capability map, plugin namespace, no direct DB/browsers APIs | cross-namespace attempt fails |
| Backup data disclosure | exported plaintext archive | visible sensitive-data warning, no credentials, user-chosen destination; future encryption option | no leaked secrets |
| Silent note overwrites | multi-tab concurrent edit | revision checks, draft recovery/merge dialog, transactions | collision test |
| Permission overreach | extension manifest | least-privilege manifest, optional where supported, no all_urls | manifest audit |
| Data corruption | migration/import interruption | staged transactions, rollback, integrity checks and restore tests | kill during commit |
| Memory/CPU exhaustion | asset or plugin rendering | quotas, bounded loops, capped schedule horizon, image dimension limits, error boundaries | stress test |
| Lost alerts / duplicate alerts | background lifecycle | DB idempotency + reconciliation | restart/double event test |
| Unsafe remote dependencies | CDN/third-party SDK | pin bundled dependencies, verify SBOM/licensing, no CDN scripts | static scan |

## 9.3 Permissions and browser isolation

Only request necessary `storage`, `alarms`, `notifications`, `bookmarks` and configured commands; optional permissions where practical. No broad host permissions in MVP; no content scripts just to inject UI into websites. Native bookmark mutations must be clearly indicated as changes to browser data. Browser bookmark IDs must remain internal. CSP should disallow unsafe eval and remote scripts; third-party packages never require CSP weakening.

## 9.4 ZIP/data defenses

Use allowlist of paths and MIME; maximum encoded & decoded sizes, JSON depth, array lengths, string lengths, image dimensions and asset count. Calculate checksum before committing. Parse JSON as data and validate every field with schema runtime validators. No prototype pollution via attacker-controlled dictionary keys; use ordinary typed object creation, deny `__proto__`, `constructor` and `prototype` as arbitrary keys. Prevent renderer from loading remote resources via plugin-specified URL.

## 9.5 Data privacy

No registration, backend sync, telemetry, analytics, tracking beacons or ads in MVP. Do not call external API for weather (not MVP). Internet access may happen **only** when user intentionally opens an external bookmark/search link. Bundled images/fonts/icons are preferred. Do not collect passwords, cookies, browsing history, clipboard, page content. Diagnostic export user-initiated and sanitized; default no private note bodies in logs.

## 9.6 Build and supply chain

Pin package-lock/pnpm lock file; run dependency audits and license checks; review transitive executable code. Scan artifacts for external script URLs, eval/new Function and unexpected permissions; inspect actual generated Firefox/Chrome manifests. Prefer tested stable versions. Audit all file parsing in a restricted fixture harness. Document licenses for background imagery/fonts, use original art or clearly licensed bundled assets; never assume image-search content is redistribution-safe.

## 9.7 Browser/OS notification caveats

System APIs may deny/block native alerts even with manifest permission, and closed browsers cannot guarantee timely alerts. Present truthfully. Never use OS notification as sole durable record. Avoid false “sent” toast. In the center, show internal status and OS delivery status separately.

## 9.8 Beta security gate

Block beta if any imported package can execute code, any unsupported URL scheme can execute, a failed import mutates live DB, native bookmarks can be erased without user confirmation, any private data is exfiltrated or entire dashboard becomes unusable from a single plugin. P0 vulnerabilities block release regardless of UI polish.
