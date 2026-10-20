# 18 — Research References and Verification Notes

**Checked during PRD authoring:** 2026-10-08. These are primary documentation links, not substitutes for implementation-time version checks. Store rules and API support can change.

1. WXT browser targeting and default Manifest versions: https://wxt.dev/guide/essentials/target-different-browsers.html
2. WXT entrypoint types: https://wxt.dev/guide/essentials/entrypoints
3. WXT manifest config/target-generated output: https://wxt.dev/guide/essentials/config/manifest.html
4. MDN Firefox Home overrides: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_settings_overrides
5. MDN New Tab overrides: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_url_overrides
6. MDN alarms (not persisted across browser sessions): https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms
7. Chrome MV3 self-contained functionality/code policies: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
8. Mozilla add-on policies: https://extensionworkshop.com/documentation/publish/add-on-policies/
9. Chrome extension native notifications API: https://developer.chrome.com/docs/extensions/reference/api/notifications
10. Chrome Web Store quality FAQ on changing home/start/new tab settings: https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq
11. Chrome manifest CSP documentation: https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy

## Verified constraints that affect architecture

- WXT's documented default build target: MV2 for Firefox, MV3 for other browsers. **Explicit Firefox manifest compatibility spike mandatory**; don't promise universal MV3 implementation without proof.
- Home override and New Tab override have different manifest/settings semantics; Home change is subject to browser control and store policy, not a universal runtime toggle.
- Alarms are not durable across browser sessions; application records must drive rehydration/reconciliation. Browser fully closed cannot guarantee precise OS notifications.
- Both Firefox AMO and Chrome Web Store require self-contained and reviewable executable code; imported declarative packages cannot be used as a concealed general interpreter.

## Assumptions not externally verified for exact implementation

Exact available UI of native notification buttons, runtime Home toggling, custom optional permission behavior, all cross-browser shortcut management APIs, date library accuracy for every Jalali year, exact bundler/plugin versions. They must be tested by the coding agent and recorded in ADRs before shipping.
