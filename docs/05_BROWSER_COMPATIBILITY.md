# 05 — Browser Compatibility, Manifest, Permissions & Home

## 5.1 Version strategy — mandatory gate

WXT documentation currently says Firefox defaults to **MV2** and Chrome to **MV3** when target flags omitted. Agent must decide Firefox production manifest version through `P00` compatibility spike against current Firefox stable/ESR (if supporting ESR), WXT version and AMO policy; prefer explicit Firefox MV3 if all requirements pass, otherwise ship Firefox-compatible MV2 and preserve a Chrome MV3 build. Version must never be assumed by shared build invocation. Required artifacts: generated manifest diff, API behavior tests and ADR-001.

## 5.2 Capability matrix

| Capability | Firefox beta | Chrome planned | Compatibility rule |
|---|---|---|---|
| New Tab override | bundled local page | bundled local page | `chrome_url_overrides.newtab` |
| Home override | investigate `chrome_settings_overrides.homepage`, browser takeover UI | investigate Chrome settings overrides and storefront policy | manifest/browser controlled, not arbitrary runtime preference |
| Notifications | browser.notifications, OS policy dependent | chrome.notifications, OS policy dependent | always store internal record |
| Alarms | ephemeral across browser sessions | ephemeral/service-worker realities | DB source + reconciliation |
| Bookmarks | optional permission | optional permission | read/edit only with consent |
| Browser shortcuts | availability/management API may differ | users often modify in Chrome shortcuts UI | use in-app palette fallback |
| IndexedDB | extension page DB | extension page DB | migration and transaction tests |
| Native notification actions | capability varies | capability varies | actions mirrored in internal UI |
| Wallpaper file | local indexed Blob/object URL | local indexed Blob/object URL | no externally hosted script |

## 5.3 Home details and guardrails

The **user-approved target** includes Home and New Tab for Firefox beta. Manifest-level Home override should be bundled/declared only after verifying platform/store behavior; if install-time override is unavoidable, make effect unmistakable in store listing/onboarding and offer a genuine browser control path. The app must NOT show a fake switch that cannot change manifest settings at runtime. User chooses Home if browser allows it, or follows in-product browser-specific guidance. If Home blocked by browser policy/other extension, New Tab remains functional and app shows nonfatal status. Chrome public Home implementation requires separate certification before release.

`homepage_url` in manifest points to extension's website listing/info and **is not** a home page replacement. Distinguish explicitly.

## 5.4 Permissions intent/minimization

| Permission | Why | Denied fallback |
|---|---|---|
| `storage` | persist bootstrap prefs | block saves with clear error if fundamentally absent |
| `alarms` | timers/reminders when UI closed | internal due-time reconciliation |
| `notifications` | OS alerts | in-app center |
| `bookmarks` | browser bookmark source and edits | local bookmarks only |
| `commands` manifest keys | extension scoped shortcuts | dashboard Ctrl/Cmd+K/button |

No `<all_urls>`, broad host permissions, browsing-history permission, clipboard permission, content scripts or tracking just for MVP. External search opens a validated URL in normal tab without host permissions. If API has no optional permission support, declare required with truthful explanation and re-evaluate least-privilege UX per target.

## 5.5 Package and store requirements

- Firefox AMO: self-contained extension, no remote executable code, no remote New Tab content; permission disclosures; stable/release libraries and reviewable source as required.
- Chrome MV3: no remotely hosted executable code; no general-purpose interpreter from imported packages; manifest and CSP minimal.
- No request for permissions unrelated to product. Store descriptions, privacy statements and screenshots accurately match behavior.
- Test installation/uninstallation, browser restart, other New Tab/Home extension precedence, bookmark permission revocation and OS notification blocking.

## 5.6 Browser-specific test vectors

1. Install clean Firefox -> New Tab dashboard appears; Home behavior documented and tested.
2. Disable Home override in browser -> New Tab still works, no false app claims.
3. Install another Home/New Tab override -> explain precedence, don't break.
4. Deny notifications -> internal center still logs.
5. Deny/revoke bookmarks -> native bookmark UI notices; local collection unaffected.
6. Restart browser with pending reminder -> missed/on-time reconciliation without duplicate.
7. Run Chrome MV3 service-worker cold start, recreate alarms, rehydrate state.

## 5.7 Official references

- WXT targets: https://wxt.dev/guide/essentials/target-different-browsers.html
- WXT entrypoints: https://wxt.dev/guide/essentials/entrypoints
- WXT manifest generation: https://wxt.dev/guide/essentials/config/manifest.html
- MDN Home: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_settings_overrides
- MDN New Tab: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/chrome_url_overrides
- MDN alarms: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/alarms
- Chrome MV3 policy: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Mozilla add-on policies: https://extensionworkshop.com/documentation/publish/add-on-policies/
