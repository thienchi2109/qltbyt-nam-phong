# Implementation Tasks

## Phase 0: Source And Change Coordination

- [ ] 0.1 Confirm the completed Phase 6 change is archived and its
      `Desktop draft catalog workspace presentation` requirement is present in
      `openspec/specs/device-quota-category-workspace/spec.md`.
- [ ] 0.2 Verify the frozen appendix artifact still declares the four source
      columns and 42 rows: five sections and 37 equipment items.
- [ ] 0.3 Confirm the implementation starts from the archived Phase 6
      baseline and does not touch issue `#982`, API/RPC, DB/migration,
      permissions, mobile, or business-rule scope.
- [ ] 0.4 Map the current editor, row, section, summary, source disclosure,
      rule disclosure, and test files before editing; decide whether any
      presentation-only component can be deleted without changing shared
      hierarchical-editor code.

## Phase 1: Table Contract Tests First

- [ ] 1.1 Add failing RTL coverage for the grouped header order:
      `TT`, `Chủng loại`, `Đơn vị tính`, `Số lượng định mức`, `ĐVT áp dụng`,
      `SL đề xuất`, `Ghi chú`.
- [ ] 1.2 Add failing coverage that renders five full-width section rows and
      all 37 item rows in frozen source order, including top-level items.
- [ ] 1.3 Add failing coverage that source cells contain no editable inputs and
      that only the three unit-draft columns expose ordinary inputs.
- [ ] 1.4 Add failing coverage that an absent `ĐVT áp dụng` shows the source
      unit as a suggestion without firing a patch, preserves an existing
      override, and keeps quantity validation.
- [ ] 1.5 Add failing coverage for source-rule disclosure, secondary
      `displayNameOverride` editing, excluded rows, read-only mode, and
      existing save/exclude/restore callbacks.
- [ ] 1.6 Use `@testing-library/user-event` for all interactions and keep
      browser/Playwright out of the test plan.
- [ ] 1.7 Add failing coverage that the permanent structure sidebar, compact
      item cards, and single-expanded-item interaction are absent.
- [ ] 1.8 Preserve coverage that technical metadata stays out of the header,
      save feedback remains concise, and stale-conflict version context
      remains available.

## Phase 2: Appendix Table Presentation

- [ ] 2.1 Replace the primary editor composition with a semantic table and
      grouped source/draft headers while retaining the existing editor state
      and save toolbar.
- [ ] 2.2 Render section rows as full-width hierarchy rows and item rows in
      mapper-provided source order without synthesizing parents.
- [ ] 2.3 Render legal source cells as read-only content, show complete
      multiline quota rules by default, and preserve source references.
- [ ] 2.4 Render inline `ĐVT áp dụng`, `SL đề xuất`, and `Ghi chú` controls
      through the existing patch callback and existing validation state.
- [ ] 2.5 Move display-name override and existing exclude/restore controls to
      an explicit row-action area inside `Chủng loại`, without mutating or
      hiding the regulatory name or adding a permanent action column.
- [ ] 2.6 Remove the obsolete primary structure sidebar, card-summary
      expansion dependency, and duplicated item-label composition only where
      the new table makes them unnecessary.
- [ ] 2.7 Keep excluded rows visible, preserve allowed actions, and retain
      read-only/pending/stale-conflict feedback.

## Phase 3: Layout And Accessibility

- [ ] 3.1 Add stable column widths, grouped-header styling, and clear visual
      distinction between legal and unit-draft columns.
- [ ] 3.2 Contain horizontal overflow inside the table viewport and keep `TT`
      and `Chủng loại` sticky at constrained desktop widths.
- [ ] 3.3 Keep the save toolbar outside the table scroll region and avoid
      page-level horizontal overflow.
- [ ] 3.4 Add semantic table caption, header associations, accessible names
      for all inputs and actions, and non-color status cues.
- [ ] 3.5 Keep implementation files below the repository's 450-line hard
      ceiling, extracting focused table/row helpers when necessary.

## Phase 4: Regression And Evidence

- [ ] 4.1 Update obsolete Phase 6 presentation assertions while preserving the
      Phase 5 behavior matrix for editing, saving, excluding/restoring,
      read-only, validation, pending, stale-conflict, sticky-save, and header
      metadata states.
- [ ] 4.2 Run `node scripts/npm-run.js run format:check`.
- [ ] 4.3 Run `node scripts/npm-run.js run verify:no-explicit-any`.
- [ ] 4.4 Run `node scripts/npm-run.js run verify:dedupe` and perform the
      required semantic reuse check before adding reusable table logic.
- [ ] 4.5 Run `node scripts/npm-run.js run typecheck`.
- [ ] 4.6 Run focused draft-catalog tests with user-event interactions.
- [ ] 4.7 Run `node scripts/npm-run.js run react-doctor`.
- [ ] 4.8 Capture equivalent visual evidence at `1024px`, `1280x720`,
      `1366x768`, and `1440x900`, including a long-list state and an editable
      row state; do not use browser or Playwright tests.
- [ ] 4.9 Run `openspec validate appendix-table-device-quota-draft-catalog --strict`.
- [ ] 4.10 Report evidence and any gaps, then stop at this follow-up without
      opening another phase or change.
