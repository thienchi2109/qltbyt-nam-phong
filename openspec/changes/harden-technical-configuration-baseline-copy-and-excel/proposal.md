## Why

The baseline workflow currently has two separate usability gaps. A workbook produced
by `Tải cấu hình hiện tại` can be rejected when uploaded back to the same draft
because client-side identity validation runs against the selected in-memory hierarchy
before the authoritative server preview, and one rejected structural row produces
misleading cascading child-row errors. Separately, reusing a configuration in another
dossier requires a server-side copy workflow because the XLSX contract is intentionally
bound to one baseline version and revision.

The current locked-baseline copy operation only creates a draft inside the source
dossier. Users need a target-side action that can copy a locked baseline from another
dossier without weakening workbook ownership checks or introducing a cross-dossier
Excel import contract.

## What Changes

- Add an additive backend contract for listing eligible locked source versions,
  previewing a cross-dossier copy, and atomically applying the copy to the selected
  target dossier.
- Keep the existing same-dossier `Sao chép thành bản nháp` behavior unchanged.
- Require the source baseline to be locked and owned by another dossier.
- Explain the locked-source restriction when the user opens the copy workflow:
  `Chỉ có thể sao chép phiên bản cấu hình đã khóa. Phiên bản đang ở trạng thái bản
nháp không thể sao chép.`
- Create a target draft when none exists. When a target draft already exists, require
  an authoritative preview and explicit full-replacement confirmation.
- For existing-draft replacement, preserve dossier-scoped suppliers, options, option
  documents, and comparison-set roots, but explicitly count and delete
  criterion-scoped option responses, option citations, and manual assessments that
  cannot remain attached to replaced criterion UUIDs.
- Copy the complete baseline-owned aggregate using new target UUIDs while preserving
  hierarchy, criterion codes, display content, canonical order, and source lineage.
  Supplier options, comparison sets, option responses, and manual assessments remain
  outside the copied aggregate.
- Keep baseline XLSX import bound to the exact target dossier, baseline version, and
  revision. Cross-dossier Excel import is explicitly not introduced.
- Fix same-draft serialized XLSX round-trip behavior and report the root identity or
  metadata error without cascading dependent hierarchy errors.
- Rename generated workbooks so users can identify the device type, dossier, and
  version without opening the file:
  - current configuration:
    `{Loai_Thiet_Bi}_{Ten_Ho_So}_Phien_Ban_{N}.xlsx`;
  - empty template:
    `Mau_{Loai_Thiet_Bi}_{Ten_Ho_So}_Phien_Ban_{N}.xlsx`.
- Normalize filename components to ASCII-safe segments, replace invalid separators
  with `_`, collapse repeated separators, and deterministically cap the final filename
  to a filesystem-safe length.
- Deliver the change in exactly two dependency-ordered phases, each mapping to one PR:
  - Phase 1 / PR 1: additive backend contracts, migration, allowlist, and server tests;
  - Phase 2 / PR 2: target-side UI, Excel fix, filenames, and browser-facing tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `technical-configuration-comparison`: extend locked baseline reuse across dossiers
  and harden the baseline XLSX round-trip workflow.

## Dependency And Scope Boundary

- This change depends on `add-technical-configuration-comparison` and the archived
  `revise-technical-configuration-baseline-hierarchy` change as the current contract
  baseline.
- Phase 2 starts from main after Phase 1 is merged and its RPC migration is deployed
  to the target environment.
- Phase 1 contains no user-visible copy control. It must remain safe to deploy while
  unused by the frontend.
- This change does not allow importing one dossier's workbook into another dossier.
- This change does not copy suppliers, supplier options, option responses, comparison
  sets, manual assessments, or dossier metadata.
- This change does not alter baseline lock semantics, criterion scoring, or supplier
  option Excel contracts.

## Impact

- Affected specs:
  - `technical-configuration-comparison`
- Expected database impact:
  - one additive source-list RPC;
  - one additive preview RPC;
  - one additive apply RPC;
  - lineage constraints updated to support an immutable locked source in another
    dossier without changing existing same-dossier copies.
- Expected application impact:
  - frozen request/response/error contracts in `contracts.md`;
  - RPC proxy allowlist and contract tests;
  - baseline source selection, preview, confirmation, and apply UI;
  - baseline XLSX parser/error presentation;
  - workbook filename generation;
  - focused unit/integration tests and one real browser download-upload round trip.
- Deployment:
  - Phase 1 may run candidate-commit gates before review, but must rerun SQL `static`
    and `baseline-forward` for the exact landed main commit before live apply;
  - live migration apply requires separate explicit user authorization through
    Supabase MCP;
  - Phase 2 must not merge or deploy until the Phase 1 RPCs are confirmed available.
- Compatibility:
  - existing same-dossier copy calls remain valid;
  - existing XLSX ownership and revision metadata remain authoritative;
  - no existing UI calls a missing RPC after Phase 1 or before Phase 2.
