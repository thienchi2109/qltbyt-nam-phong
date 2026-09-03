Status: Draft
Date: 2026-09-03
Owner: Codex Agent

# Render Draft Catalog As The Appendix Table

## Why

The Phase 6 presentation is functionally complete but the resulting card,
structure-navigation, and single-expanded-item composition makes the draft
catalog harder to understand than the source it represents. Users need to
compare the legal catalog row, its source quota, and the small amount of
unit-specific information they must provide in one scan.

The repository already contains the frozen Thông tư 10/2026 appendix snapshot.
Its source table has four columns:

1. `TT`
2. `Chủng loại`
3. `Đơn vị tính`
4. `Số lượng định mức`

The follow-up should make that table the primary visual model instead of
inventing a second card-oriented model.

## What Changes

- Replace the primary draft-catalog card/structure presentation with one
  appendix-aligned semantic table.
- Preserve all 42 source rows, including the five structural section rows, the
  37 equipment rows, source order, parent relationships, source pages, and
  source references.
- Render the four legal columns as read-only:
  `TT`, `Chủng loại`, `Đơn vị tính`, and `Số lượng định mức`.
- Add a visually distinct unit-draft column group containing only:
  `ĐVT áp dụng`, `SL đề xuất`, and `Ghi chú`.
- When `ĐVT áp dụng` is absent, show the regulatory unit as a visible
  suggestion/fallback without creating a staged patch or persisted value; keep
  the existing override semantics.
- Keep `SL đề xuất` as the unit-proposed non-negative integer and keep
  `Ghi chú` as optional draft context.
- Move `displayNameOverride` out of the permanent table surface and expose it
  only through an explicit row action or secondary edit affordance.
- Render section rows as full-width hierarchy rows and keep item rows directly
  underneath them; top-level source items remain in source order.
- Show the complete source quota rules directly in the
  `Số lượng định mức` cell. Keep source page/reference metadata secondary
  without turning the main table into nested cards or a second navigation
  surface.
- Keep the existing save toolbar, staged-save behavior, validation, pending
  states, read-only mode, exclude/restore behavior, and stale-revision
  recovery.
- At constrained desktop widths, contain horizontal scrolling inside the table
  viewport and keep `TT` and `Chủng loại` sticky on the left.

## Dependency And Landing Order

- This follow-up depends on the completed
  `polish-device-quota-draft-catalog-workspace` change.
- That completed change is archived first so its presentation requirement is
  part of the canonical `device-quota-category-workspace` specification.
- This change modifies that canonical presentation requirement; it does not
  reopen Phase 6 and does not create a Phase 7.
- Issue `#982` remains outside this change. Any complexity cleanup discovered
  while replacing the presentation must be filed separately.

## Non-Goals

- No API, RPC, database, migration, permission, or persistence-contract
  changes.
- No changes to regulatory source data, source extraction, source hashing, or
  business-rule interpretation.
- No automatic calculation, compliance certification, or validation against
  conditional regulatory quota text.
- No changes to active categories, quota decisions, equipment mapping,
  reporting, compliance, publication, or either Excel import flow.
- No search, filter, sort, pagination, or new bulk-edit workflow.
- No mobile layout, drawer, bottom sheet, or mobile-specific interaction.
- No new cancel/reset semantics.
- No absorption of issue `#982`.

## Impact

**Affected capability**

- `device-quota-category-workspace`

**Expected UI files**

- `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogEditor.tsx`
- `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogSection.tsx`
- `src/app/(app)/device-quota/categories/draft-catalog/_components/DeviceQuotaDraftCatalogItemRow.tsx`
- A focused table or row subcomponent may be extracted if needed to keep the
  file-size limits intact.

**Expected test files**

- Existing draft-catalog editor and item-row tests will be rewritten where
  they assert the obsolete sidebar/card/expansion composition.
- New focused table-contract tests will cover column order, section rows,
  source/read-only boundaries, inline inputs, and user-event interactions.

**Unchanged contracts**

- `device-quota-draft-catalog-types.ts`
- `device-quota-draft-catalog-mappers.ts`
- Existing draft callbacks, validation, authorization, CAS mutation semantics,
  and server data access.

## Success Criteria

- A user can read the table in the same left-to-right conceptual order as the
  official appendix.
- A user can identify which cells come from Thông tư 10/2026 and which cells
  require unit input without opening another panel.
- The main workflow requires entering only unit-specific values; legal source
  values are never editable.
- All existing draft behavior remains intact.
- Equivalent visual evidence covers `1024px`, `1280x720`, `1366x768`, and
  `1440x900`.
- Interaction tests use `@testing-library/user-event` only; no browser or
  Playwright test is added.
