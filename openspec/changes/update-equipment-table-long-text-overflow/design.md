## Context
The Equipments page already truncates generic cell text, and the user wants to keep that simple single-line behavior rather than introduce wrapping or multi-line clamping. The approved scope is therefore a minimal UX improvement: preserve the current single-line truncation behavior for long `Mã thiết bị` and `Tên thiết bị` values, add tooltip/focus affordances so users can inspect the complete value when needed, and apply bounded widths so those two columns do not stretch the table disproportionately.

## Goals / Non-Goals
- Goals:
  - Improve discoverability of full long-text values without changing the current table interaction model.
  - Reduce width domination from long `Mã thiết bị` and `Tên thiết bị` values.
  - Preserve quick scanability of the equipment list.
  - Keep full values accessible for pointer and keyboard users.
  - Keep the change localized to the Equipments desktop datatable path.
- Non-Goals:
  - Change breakpoint-based column visibility behavior.
  - Introduce wrapping or two-line clamping.
  - Redesign unrelated equipment columns or mobile behaviors.

## Decisions
- Decision: Keep `ma_thiet_bi` and `ten_thiet_bi` on the current single-line truncated presentation and add full-text affordances.
  - Rationale: this is the cleanest and lowest-risk change that matches the approved UX direction.
- Decision: Add bounded width contracts for `ma_thiet_bi` and `ten_thiet_bi` instead of introducing wrapping.
  - Rationale: fixed widths keep the table cleaner and prevent long values from pushing adjacent columns away while preserving scanability.
- Decision: Reuse or extend the shared truncated-text primitive where it helps, but avoid broad table-wide changes in shared UI that could affect unrelated screens.
  - Rationale: the issue is localized to Equipments and should stay low-risk.
- Decision: Leave current responsive auto-hide rules untouched.
  - Rationale: current column reduction on narrower desktops is already acceptable; the remaining concern is full-text inspection.

## Risks / Trade-offs
- Shared text-overflow primitives can create unintended regressions if changed too broadly.
  - Mitigation: keep the behavior primarily in the Equipments column/render path or make the shared primitive change strictly additive.
- Width contracts that are too aggressive could over-truncate common values.
  - Mitigation: choose moderate fixed/max widths that preserve normal readability while limiting outliers.

## Migration Plan
1. Update the proposal-backed implementation path only for the Equipments desktop datatable.
2. Validate that long name/code cells reveal full text on hover/focus.
3. Validate that the bounded widths reduce over-expansion without altering column toggles, responsive behavior, or row actions.

## Open Questions
- If bounded single-line truncation still feels cramped in practice, should a later follow-up revisit selective two-line clamping for `Tên thiết bị`?
