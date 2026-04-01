## Context
The Equipments page already truncates generic cell text, and the user wants to keep that simple single-line behavior rather than introduce wrapping or multi-line clamping. The approved scope is therefore a minimal UX improvement: preserve the current single-line truncation behavior for long `Mã thiết bị` and `Tên thiết bị` values, add explicit tooltip access on hover and keyboard focus so users can inspect the complete value when needed, and apply bounded widths so those two columns do not stretch the table disproportionately.

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
- Decision: Prefer equipment-local render helpers over shared table-primitive changes.
  - Rationale: Vercel React best-practice guidance favors minimizing shared-surface edits when a localized component-level change is sufficient, which reduces accidental regressions and unnecessary client churn.
- Decision: Keyboard access must use an explicit focusable trigger; passive hover-only behavior or a browser-native `title` attribute is insufficient.
  - Rationale: the spec requires equivalent access for pointer and keyboard users, and the current truncated-text primitive does not guarantee focusability for plain text wrappers.
- Decision: Leave current responsive auto-hide rules untouched.
  - Rationale: current column reduction on narrower desktops is already acceptable; the remaining concern is full-text inspection.
- Decision: Execute the implementation in strict TDD order.
  - Rationale: this change is small but UI-regression-prone; failing tests first are the cleanest way to pin the intended hover/focus and bounded-width behavior before touching render code.

## Risks / Trade-offs
- Shared text-overflow primitives can create unintended regressions if changed too broadly.
  - Mitigation: keep the behavior primarily in the Equipments column/render path and avoid `table.tsx` changes.
- Width contracts that are too aggressive could over-truncate common values.
  - Mitigation: choose moderate fixed/max widths that preserve normal readability while limiting outliers.

## Migration Plan
1. Update the proposal-backed implementation path only for the Equipments desktop datatable.
2. Validate that long name/code cells reveal full text on hover and keyboard focus through an explicit tooltip trigger.
3. Validate responsive visibility through `useEquipmentTable` and clickable-row behavior through `EquipmentContent`, while confirming the bounded widths do not alter column toggles, row clicks, sorting, or action-menu behavior.

## TDD Plan
1. RED:
   - add focused tests for `ma_thiet_bi` and `ten_thiet_bi` truncated rendering, explicit hover/focus tooltip access, and bounded-width expectations
   - add regression assertions in `useEquipmentTable` for unchanged responsive visibility
   - add regression assertions in `EquipmentContent` for existing row/sort/action interactions
2. VERIFY RED:
   - run the focused tests and confirm they fail for the intended missing behavior
3. GREEN:
   - implement the minimum rendering and width-bound changes needed to satisfy the tests
4. VERIFY GREEN:
   - rerun focused tests immediately after the minimum implementation
5. REFACTOR:
   - only after green, consolidate any duplicated renderer/tooltip logic while keeping tests green
6. FINAL VERIFICATION:
   - run `verify:no-explicit-any`, then `typecheck`, then focused tests, then `react-doctor`

## Open Questions
- If bounded single-line truncation still feels cramped in practice, should a later follow-up revisit selective two-line clamping for `Tên thiết bị`?
