## Why

The draft catalog editor at `/device-quota`, tab `Danh mục & phân loại`,
currently presents every draft item as a full-height form. Its technical
metadata row, repeated object names in labels, long source metadata, fixed
220px structure sidebar, and inconsistent field baselines consume usable
desktop space and make repeated data entry difficult to scan.

The existing draft workflow is already implemented and must remain behaviorally
unchanged. This change promotes the resolved Wayfinder UI decision into a
focused presentation-only change for the editor workspace.

## What Changes

- Redesign the draft catalog editor as a dense desktop/tablet data-management
  workspace from `1024px` upward.
- Replace fully expanded item forms with compact item records and allow at most
  one item to be expanded for editing at a time.
- Remove the user-facing technical metadata row containing snapshot, revision,
  draft status, save timestamp, and mode details.
- Keep only concise saved/unsaved feedback beside the existing save action.
- Use a shared field grid for every expanded item so labels, inputs, widths,
  heights, and baselines align across records.
- Shorten field labels and remove repeated item names from labels and actions.
- Reduce source metadata to a compact summary with progressive disclosure for
  secondary source and rule details.
- Replace the current fixed `220px` structure sidebar with a target
  approximately `176px` expanded panel and a `48px` collapsed rail, reusing the
  existing hierarchical-editor presentation primitives.
- Keep one sticky top workspace save toolbar visible outside the scrollable item
  region; do not add a second bottom action bar or new cancel/reset behavior.
- Add focused behavioral and visual-regression coverage for the new
  presentation states at desktop/tablet target sizes where the repository
  tooling supports it.

## Impact

- Affected capability: `device-quota-category-workspace`.
- Affected UI:
  - `DeviceQuotaDraftCatalogEditor`
  - `DeviceQuotaDraftCatalogItemRow`
  - `DeviceQuotaDraftCatalogSection`
  - shared hierarchical-editor workspace, toolbar, and structure-sidebar
    presentation as required by the implementation
- Existing draft query, mutation, validation, authorization, conflict,
  source-data, exclusion/restoration, read-only, and save contracts remain
  unchanged.
- Existing active category CRUD, category import, quota-decision import,
  mapping, reporting, compliance, and Phase 4 behavior remain unchanged.
- This presentation delta depends on the behavior delivered by the active
  `add-device-quota-draft-catalog` change. Implementation must start from a
  commit containing that baseline rather than recreating or replacing its
  contracts.
- Issue `#982` remains a separate complexity-refactor concern. Work touching
  the same item-row or draft-hook files must use an explicit landing order and
  rebase point. Whichever change lands second must rebase onto the first and
  preserve both scopes without absorbing `#982` acceptance criteria here.

## Wayfinder Traceability

- Map: [Polish workspace danh mục định mức dự thảo](https://github.com/thienchi2109/qltbyt-nam-phong/issues/983)
- Source decision: [Chốt scope polish workspace danh mục định mức dự thảo](https://github.com/thienchi2109/qltbyt-nam-phong/issues/984)
- Decision status: Resolved
- Promoted on: 2026-09-02

## Non-Goals

- No mobile responsive layout, drawer, bottom sheet, or mobile-specific
  interaction.
- No search, filter, or sort controls.
- No new cancel or reset semantics.
- No API, database, migration, permission, validation, or business-rule
  changes.
- No fully editable-table behavior when it changes the current accessibility
  or mutation semantics.
- No refactor of React complexity tracked by issue `#982`.
- No draft publish, submit, review, approval, activation, compliance, mapping,
  reporting, or Excel-import changes.
