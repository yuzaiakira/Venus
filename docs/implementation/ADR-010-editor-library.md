# ADR-010 — Notes editor library

- **Date:** 2026-10-10
- **Title:** Restricted JSON note editor in place of Tiptap
- **Status:** accepted
- **Context/problem:** `docs/03_ARCHITECTURE.md` names Tiptap in the approved stack and says to record an ADR when substituting a named library. FR-050 requires bold, italic, headings, lists, checklists, and links, and it allows either sanitized HTML or safe editor JSON. It does not name Tiptap. P02 stores a restricted JSON document and renders it without `innerHTML`.
- **Browser targets + tested versions:** Firefox 155.0.1 and Chromium 153.0.8010.52 are the local targets already used for P02. This ADR does not change manifests, CSP, or extension IDs.
- **Options evaluated:**
  1. Add Tiptap and map its document to the existing restricted schema.
  2. Keep the restricted JSON document editor and the link create, edit, and remove behavior already in that editor.
- **Official references:** FR-050 in `docs/01_FUNCTIONAL_REQUIREMENTS.md`. Architecture stack paragraph in `docs/03_ARCHITECTURE.md`.
- **Decision:** The owner accepts option 2. Venus keeps the existing restricted JSON note editor. The editor accepts only the existing block and mark schema. Links must pass `safeLink` (`http`, `https`, or `mailto`). `javascript:`, `data:`, and `file:` are rejected. Pasted HTML is stored as text in the block editor. Note revision checks and conflict protection stay as they are. This decision does not authorize more advanced editing features.
- **Why:** FR-050 is satisfied by safe editor JSON. The current editor already supports the required formatting and safe links. Keeping it avoids a new dependency and a larger maintenance surface. Existing note revision and conflict-protection behavior remains intact.
- **Impact on owner-approved FR / privacy / security:** No new host permission, network call, or HTML execution path. Notes stay in IndexedDB `Venus-p00`. No extension ID, permission, CSP, or Home/New Tab mapping changes.
- **Fallback/mitigation:** A later editor replacement is a new decision. It has to demonstrate compatibility with the stored JSON schema, revision checks, and conflict protection, and it has to provide a tested migration that does not destroy existing notes. This ADR does not say that a move to another editor will happen by itself.
- **Evidence (tests, generated manifests, logs):** P02 remediation browser results and `tests/unit/productivity.test.ts`. Owner approval recorded on 2026-10-10.
- **Approval needed?** Decided by the owner on 2026-10-10. This acceptance covers ADR-010 only. ADR-001 and ADR-002 remain unsigned. This file does not approve the node-forge residual risk, does not accept P00, and does not authorize P03.
