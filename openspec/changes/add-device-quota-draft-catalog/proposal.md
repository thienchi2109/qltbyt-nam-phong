## Why

The current Device Quota flow creates individual `nhom_thiet_bi` categories and
manages quota decisions separately. It does not let a unit start from the
Thông tư 10/2026 appendix, adjust unit-specific values in one structured
catalog, and save the result as a reviewable draft.

## What Changes

- Add an MVP draft-catalog workflow in the Device Quota workspace.
- Initialize a draft with all 37 equipment items under the five regulatory
  sections from the Thông tư 10/2026 appendix.
- Keep regulatory names, units, rules, and source references read-only.
- Allow unit-specific display-name, applied-unit, applied-quantity, notes, and
  exclusion/restore edits.
- Scope the draft to the current unit from the signed-in user's session.
- Allow one editable draft per unit to be saved, reopened, and viewed.
- Keep drafts isolated from active decisions, equipment mappings, compliance,
  and reports.

## Non-Goals

- Publishing or activating a draft.
- Submit, review, approval, electronic signatures, or legal-authority workflow.
- Custom equipment items outside the Thông tư 10/2026 appendix.
- Automatic calculation from beds, rooms, tests, cases, or other rule inputs.
- Changing the current active quota decision or equipment classification.
- Reusing or modifying the independent `#928` equipment-unlink initiative.

## Impact

- Affected capability: `device-quota-category-workspace`.
- Affected UI: the existing `/device-quota/categories` workspace and its
  category-management entry point.
- Affected data access: new draft-catalog read/write RPC contracts behind the
  existing RPC proxy.
- Affected database: new draft/regulatory source persistence and audit fields
  may be required; no existing active decision/category data is repurposed as
  draft state.
- Existing active category, decision, assignment, compliance, and report
  contracts remain unchanged in this MVP.

## Wayfinder Traceability

- Map: [Tạo bản nháp danh mục định mức theo Thông tư 10/2026](https://github.com/thienchi2109/qltbyt-nam-phong/issues/978)
- Source decision: [Chốt contract tạo bản nháp danh mục định mức từ Thông tư 10/2026](https://github.com/thienchi2109/qltbyt-nam-phong/issues/979)
- Decision status: Resolved
- Promoted on: 2026-08-31
