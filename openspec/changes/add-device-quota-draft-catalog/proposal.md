## Why

The current Device Quota flow creates individual `nhom_thiet_bi` categories and
manages quota decisions separately. It does not let a unit start from the
Thông tư 10/2026 appendix, adjust unit-specific values in one structured
catalog, and save the result as a reviewable draft.

## What Changes

- Add an MVP draft-catalog workflow in the Device Quota workspace.
- Initialize a draft with all 37 equipment items and the five structural
  section rows from the Thông tư 10/2026 appendix, preserving source order and
  source-declared parent relationships.
- Keep regulatory names, units, rules, and source references read-only.
- Allow unit-specific display-name, applied-unit, applied-quantity, notes, and
  exclusion/restore edits.
- Scope the draft to the current unit from the signed-in user's authenticated
  session. A multi-facility organization is represented as separate units in
  this MVP; the editor does not select a facility inside the draft.
- Allow one editable draft per unit to be saved, reopened, and viewed.
- Use one system-selected immutable Thông tư 10/2026 catalog snapshot, with
  reproducible source metadata and hash.
- Keep drafts isolated from active decisions, equipment mappings, compliance,
  and reports.
- Preserve the current Excel import flow, including its existing entry point,
  permissions, validation, data contract, and active-category behavior. This
  includes both category import and the separate quota-decision import flow.

## Non-Goals

- Publishing or activating a draft.
- Submit, review, approval, electronic signatures, or legal-authority workflow.
- Non-appendix equipment. A future change must model its separate legal basis,
  justification, source documents, competent authority, and approval semantics;
  it must not treat such items as ordinary draft rows.
- Automatic calculation from beds, rooms, tests, cases, or other rule inputs.
- Changing the current active quota decision or equipment classification.
- Changing or removing the current Excel import flow.
- Reusing or modifying the independent `#928` equipment-unlink initiative.

## Impact

- Affected capability: `device-quota-category-workspace`.
- Affected UI: the existing `/device-quota/categories` workspace and its
  category-management entry point.
- Affected data access: new draft-catalog read/write RPC contracts behind the
  existing RPC proxy.
- Affected database: new draft/regulatory source persistence and audit fields
  are required; no existing active decision/category data is repurposed as
  draft state.
- Existing active category, decision, assignment, compliance, and report
  contracts remain unchanged in this MVP. The existing Excel import contract
  and behavior also remain unchanged.

## Phase 4 Delivery Decomposition

The remaining compatibility and release-hardening work is split into four
independently reviewable sub-phases:

1. **Phase 4.1 — Page-level coexistence and manager gating:** prove that the
   current category-management controls and both Excel import entry points
   remain available with the separate draft entry point present.
2. **Phase 4.2 — Active-surface isolation and regression:** prove that draft
   reads and writes do not mutate or invalidate active category, decision,
   equipment-mapping, compliance, report, or Excel-import behavior.
3. **Phase 4.3 — Direct-RPC negative security contract:** exercise tenant,
   session-unit, role, revision, source-version, table-access, and malformed-
   payload guards directly against the existing draft RPCs.
4. **Phase 4.4 — Release verification and rollback readiness:** run the
   repository and database gates, report static and baseline-forward lanes
   separately for the exact commit, and verify additive deployment/rollback
   sequencing.

No sub-phase introduces publish, approval, activation, non-appendix equipment,
or changes to the existing active/import contracts.

## Wayfinder Traceability

- Map: [Tạo bản nháp danh mục định mức theo Thông tư 10/2026](https://github.com/thienchi2109/qltbyt-nam-phong/issues/978)
- Source decision: [Chốt contract tạo bản nháp danh mục định mức từ Thông tư 10/2026](https://github.com/thienchi2109/qltbyt-nam-phong/issues/979)
- Decision status: Resolved
- Promoted on: 2026-08-31
