# Design: Appendix-Aligned Draft Catalog Table

## Context

The frozen source artifact is
`docs/device-quota/source-artifacts/thong-tu-10-2026/757_Thong-tu-10-2026-TT-BYT_88e68354fb.pdf`,
with the extracted table in
`docs/device-quota/source-artifacts/thong-tu-10-2026/thong-tu-10-2026-appendix.json`.
The extracted table declares the columns `TT`, `Chủng loại`, `Đơn vị tính`,
and `Số lượng định mức`, and contains 42 rows: five structural sections and
37 equipment items.

The current data model already separates immutable regulatory fields from
unit-specific draft fields. The redesign is therefore a presentation change:
it should make that separation visible instead of introducing a new model.

## Goals

- Make the official appendix structure the first thing users see.
- Put source values and editable draft values in one aligned scan path.
- Remove the need to understand a sidebar, card expansion state, or duplicated
  item labels before entering a value.
- Preserve the existing mutation and authorization boundaries.
- Keep the table usable at the required desktop widths without page-level
  horizontal overflow.

## Non-Goals

- Interpreting or normalizing conditional quota rules into formulas.
- Changing the 42-row regulatory snapshot.
- Changing any API, database, RPC, permission, or business rule.
- Designing a mobile representation.
- Refactoring issue `#982`.

## Decisions

### Decision: Use the official four-column source table as the base contract

The main table uses the source columns in this order:

| TT  | Chủng loại | Đơn vị tính | Số lượng định mức |
| --- | ---------- | ----------- | ----------------- |

The implementation must not rename `Số lượng định mức` to imply that it is a
unit proposal. The column displays the complete source rule text, including
multiple conditions, as read-only content.

### Decision: Add a separate draft-input column group

The table adds a visually distinct group after the legal columns:

| ĐVT áp dụng | SL đề xuất | Ghi chú |
| ----------- | ---------- | ------- |

`ĐVT áp dụng` shows the existing draft value when present. When no draft
override exists, the cell shows the regulatory unit as a visible suggestion or
fallback, but does not synthesize a staged patch or persisted value. It remains
editable because the existing draft contract supports a unit-specific applied
unit. `SL đề xuất` is the only field that represents the proposed quantity and
remains a non-negative integer. `Ghi chú` is optional.

The UI must use clear group labeling such as `Theo Thông tư 10/2026` and
`Thông tin dự thảo của đơn vị`, while the underlying accessible column names
remain explicit.

### Decision: Keep display-name override secondary

The regulatory `Chủng loại` cell is always read-only. `displayNameOverride`
is not shown as a permanently repeated input column. An explicit row action in
the `Chủng loại` cell may open a small secondary control for users who need a
local display name. Exclude/restore uses the same row-action area, so the table
does not need a permanent eighth action column. These actions must preserve the
existing callbacks and must not replace or mutate the regulatory name.

### Decision: Render hierarchy as table rows

Section rows render as full-width rows spanning the table and announce the
section name and source `TT`. They are not cards and do not contain editable
controls. Item rows render in source order beneath their source section.
Top-level items remain in their original position rather than being moved
into synthetic sections.

The table does not require a section-collapse interaction for the primary
workflow. If the existing section-collapse state is retained for long-list
navigation, it is secondary, preserves all staged values, and does not change
source order.

### Decision: Show the complete source rules in the table

The `Số lượng định mức` cell shows the complete multiline regulatory rule by
default, matching the source table's meaning. It must not collapse the rule
into an inferred number or require a separate page/card to read it. Source
page/reference metadata may use a compact inline disclosure when necessary.
That disclosure must have an accessible name and must not obscure neighboring
editable controls.

### Decision: Use one table scroll boundary

The save toolbar remains above the table and outside the table's vertical
scroll region. The table container owns horizontal overflow. At `1024px`,
`TT` and `Chủng loại` remain sticky while the remaining columns can scroll
intentionally inside that container. The page itself must not acquire
unintended horizontal overflow.

No mobile breakpoint, drawer, or bottom sheet is introduced by this change.

## Component Boundaries

- `DeviceQuotaDraftCatalogEditor`
  - owns the existing draft state, save toolbar, validation, mode, and
    callbacks;
  - renders the table shell and its column groups;
  - does not own source parsing or persistence.
- `DeviceQuotaDraftCatalogSection` or a replacement table-row helper
  - renders a source section row and its ordered item rows;
  - receives already-merged rows and callbacks.
- `DeviceQuotaDraftCatalogItemRow`
  - renders one item row, the legal read-only cells, draft inputs, status
    treatment, source disclosure, and row actions;
  - does not issue API calls directly.
- `DeviceQuotaDraftCatalogItemSummary` and the old structure-sidebar
  presentation
  - may be removed or reduced only when no longer needed by the new table;
  - no unrelated shared hierarchical-editor refactor is included.

If the editor or row exceeds the repository's 350-line extraction threshold,
extract table headers, cell renderers, or row action content into
`DeviceQuotaDraftCatalogTable*.tsx` files rather than growing a monolith.

## State And Data Flow

1. The existing mapper produces the same merged section/item rows.
2. The editor passes each row to the table renderer in source order.
3. Regulatory fields render from `regulatoryName`, `regulatoryUnit`,
   `regulatoryQuotaLines`, `regulatoryRules`, `sourceLabel`, and source
   references.
4. Editable cells call the existing patch callback with `appliedUnit`,
   `appliedQuantity`, `notes`, or the secondary `displayNameOverride` action.
   Rendering the regulatory unit as an absent-value suggestion does not call
   the patch callback.
5. Ordinary edits remain staged until the existing `onSave` callback runs.
6. Exclude/restore remains an immediate CAS-protected operation using the
   existing callbacks.
7. Read-only mode removes editing affordances without hiding source rows.

No new server payload, field, endpoint, or database object is introduced.

## Accessibility

- Use a semantic `<table>` with a caption or equivalent accessible label.
- Use grouped headers with `scope="colgroup"` where supported and explicit
  column headers for every input.
- Associate each input with its row's item name and field label; do not rely
  on placeholder text.
- Keep source cells and section rows distinguishable without color alone.
- Give disclosure, exclude/restore, and secondary-name actions stable,
  descriptive accessible names.
- Preserve keyboard order from left to right across the source columns and
  then the draft-input columns.

## Verification Strategy

- TDD: add failing RTL tests for the table contract before replacing the
  presentation.
- Use `@testing-library/user-event` for typing, disclosure, exclude/restore,
  read-only, and save interactions.
- Do not add browser or Playwright tests.
- Verify source order, five section rows, 37 item rows, four read-only source
  columns, three draft-input columns, sticky/contained overflow classes, and
  the absence of the obsolete primary sidebar/card expansion contract.
- Run the repository's required format, no-explicit-any, dedupe, typecheck,
  focused tests, and React Doctor gates for the changed React files.
- Capture equivalent visual evidence at `1024px`, `1280x720`, `1366x768`, and
  `1440x900`, including a long-list state and an editable row state.
- Run `openspec validate appendix-table-device-quota-draft-catalog --strict`.

## Risks And Mitigations

- **Risk:** Long quota text makes rows tall.
  **Mitigation:** Accept variable row height as a consequence of preserving the
  legal table, use readable line length and spacing, and never replace the
  source rule with an inferred number.
- **Risk:** Horizontal table scrolling hides editable fields.
  **Mitigation:** Sticky `TT` and `Chủng loại`, stable column widths, clear
  draft-column group styling, and viewport evidence at 1024px.
- **Risk:** The table appears editable in legal columns.
  **Mitigation:** Distinct read-only styling, no input elements in source
  columns, and explicit RTL assertions.
- **Risk:** Replacing the card composition drops an existing callback.
  **Mitigation:** Retain the merged-row contract and preserve the phase-5
  state matrix in focused regression tests.

## Rollout And Recovery

This is a client presentation-only change. Rollback is a revert of the UI
commit; no migration, API deployment, or data repair is required. The
completed Phase 6 change remains archived and its evidence remains available
as historical evidence, while this follow-up establishes a new presentation
baseline.
