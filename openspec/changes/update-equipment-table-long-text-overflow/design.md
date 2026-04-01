## Context
The Equipments page already truncates generic cell text, but the desktop table still feels unstable on smaller desktop screens because the primary long-text columns do not have strong width contracts. The user-approved UX direction is:
- `Mã thiết bị`: never wrap; truncate + tooltip
- `Tên thiết bị`: allow up to two lines; clamp + tooltip
- hide `Serial` earlier on narrower desktop widths

## Goals / Non-Goals
- Goals:
  - Reduce unnecessary horizontal scrolling on smaller desktop screens.
  - Preserve quick scanability of the equipment list.
  - Keep full values accessible for pointer and keyboard users.
  - Keep the change localized to the Equipments desktop datatable path.
- Non-Goals:
  - Rebuild the entire table layout system.
  - Introduce card view changes.
  - Redesign unrelated equipment columns or mobile behaviors.

## Decisions
- Decision: Treat `ma_thiet_bi` and `ten_thiet_bi` as special-case columns instead of relying on the generic text-cell renderer.
  - Rationale: the UX requirements differ materially between one-line identifiers and two-line human-readable names.
- Decision: Favor bounded widths plus truncation/clamping over free wrapping.
  - Rationale: unlimited wrapping would reduce horizontal scrolling at the cost of very tall rows and poorer row-by-row scanning.
- Decision: Hide `serial` earlier on narrower desktop widths before further compressing the two primary columns.
  - Rationale: `serial` is lower-priority than the equipment code and name in routine browsing.
- Decision: Reuse or extend the shared truncated-text primitive where it helps, but avoid broad table-wide changes in shared UI that could affect unrelated screens.
  - Rationale: the issue is localized to Equipments and should stay low-risk.

## Risks / Trade-offs
- Shared table primitives can create unintended regressions if changed too broadly.
  - Mitigation: keep the width and overflow rules primarily in the Equipments column/render path.
- Two-line clamp increases row height compared with a one-line table.
  - Mitigation: limit it to `Tên thiết bị` only and keep the maximum at two lines.
- Responsive auto-hide can conflict with user column preferences.
  - Mitigation: preserve the existing snapshot/restore behavior in `useEquipmentTable`.

## Migration Plan
1. Update the proposal-backed implementation path only for the Equipments desktop datatable.
2. Validate responsive behavior around narrower desktop widths.
3. Keep column toggles and row actions unchanged.

## Open Questions
- Should future follow-up work introduce a second lower-priority column hide on very constrained desktop widths, or is earlier `serial` hiding sufficient for this iteration?
