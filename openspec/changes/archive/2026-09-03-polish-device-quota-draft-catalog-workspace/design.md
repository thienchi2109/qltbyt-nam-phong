## Context

The draft catalog editor already uses the shared
`src/components/hierarchical-editor` primitives and has a dedicated client
composition boundary. The current composition is functionally usable but
optimizes for showing complete forms rather than scanning and editing a
repeated set of records.

The redesign is constrained to presentation and local interaction state. Draft
data remains unit-scoped, regulatory source fields remain read-only, ordinary
field edits remain staged until `Lưu`, and exclude/restore remain immediate
CAS-protected mutations with their existing handlers.

The approved target is desktop/tablet only. The application does not need a
mobile representation for this change.

## Goals

- Maximize usable editing area at `1024px`, `1280x720`, `1366x768`, and
  `1440x900`.
- Make repeated item rows scan-friendly and materially shorter.
- Make every expanded item use identical field column boundaries and vertical
  rhythm.
- Keep section navigation, source traceability, rule disclosure, validation,
  read-only mode, save state, exclude/restore, and conflict recovery intact.
- Keep the change route-scoped and compatible with the existing design system.

## Non-Goals

- Mobile layout or mobile testing.
- New data operations or server contracts.
- Search, filtering, sorting, publish workflow, or reset/cancel behavior.
- A broad redesign of the Device Quota navigation or unrelated routes.
- Replacing the existing draft model with an editable table abstraction.

## Decisions

### Decision: Keep compact records instead of introducing an editable table

Each item will have a compact summary representation. At most one item in the
workspace is expanded into its editable field grid at a time. The item header
and overflow/action affordances remain available in both states.

This preserves the existing semantic item structure, inline validation, rule
disclosure, exclusion/restoration, and read-only rendering while reducing
vertical repetition. A fully editable table is deferred because it would
change the interaction surface and could make the existing behavior harder to
preserve.

Section expansion remains independently controlled. Collapsing a section hides
its items without changing item data or staged edits.

### Decision: Use an explicit shared item grid

The expanded item editor will use one shared CSS Grid template for all items.
The implementation may choose the exact tokenized widths, but it must provide
stable columns for:

1. display name;
2. applied unit;
3. proposed quantity; and
4. notes.

Labels are short and object-independent. Label height and field alignment must
not depend on the item name or on browser flex wrapping. The compact summary
state uses the same column intent where fields are previewed.

### Decision: Use a collapsible structure panel and rail

The current implementation uses a fixed `220px` structure sidebar. The target
presentation uses an approximately `176px` expanded panel and a `48px`
collapsed rail. At constrained desktop/tablet widths from `1024px` through
`1199px`, the collapsed rail is the default space-saving state. Users can
manually toggle both modes, and the expanded structure panel overlays the
editor content using the existing shared primitive support without shrinking
the item grid or creating unintended horizontal overflow.

No mobile drawer or bottom sheet is introduced.

### Decision: Keep one top save toolbar

The existing top toolbar remains outside the item scroll region so the save
action stays available while records scroll. Its status is concise:
`Đã lưu`, `Chưa lưu`, or `Đang lưu...` as applicable. Snapshot identifiers,
revision numbers, internal mode labels, and raw technical draft status are not
rendered in the user-facing editor header.

No second bottom action bar and no reset/cancel operation are added.

### Decision: Preserve source traceability with progressive disclosure

The item summary keeps compact source information such as appendix, page, source
ordinal, and level. Full source references, parent information, and complete
multiline regulatory rules remain available through existing or equivalent
disclosure controls. The redesign changes visual density only; it does not
remove or reinterpret source data.

### Decision: Coordinate, but do not merge, issue `#982`

Issue `#982` owns the React complexity refactor for the draft hook and item-row.
This change may need to touch the same presentation component, so implementation
must record an explicit landing order and exact rebase point. Whichever change
lands second must rebase onto the first and preserve both scopes. Complexity
refactoring, hook restructuring, and unrelated maintainability cleanup are not
part of this change.

### Decision: Layer the polish on the parent draft-catalog baseline

This change is a presentation delta to
`openspec/changes/add-device-quota-draft-catalog/`, not an alternative
implementation of that change. Runtime implementation starts only from a
commit where the parent draft editor behavior and focused tests are present.
The baseline commit and the coordination state of issue `#982` are recorded
before presentation files change.

## Component Boundaries

- `DeviceQuotaDraftCatalogEditor` owns workspace-level expanded-item state,
  sidebar layout state, toolbar composition, and existing save-state wiring.
- `DeviceQuotaDraftCatalogSection` owns section disclosure and delegates item
  rendering without changing source order or section completeness semantics.
- `DeviceQuotaDraftCatalogItemRow` owns compact and expanded item presentation,
  stable field-grid markup, concise labels, source disclosure, and existing
  callbacks.
- Shared hierarchical-editor components provide workspace dimensions, scroll
  boundaries, toolbar semantics, and structure navigation. Any shared change
  must remain generic and preserve Technical Configurations behavior.

## Verification Strategy

- Preserve and update focused React Testing Library tests driven by
  `@testing-library/user-event` for all existing callbacks, validation,
  read-only fields, section navigation, source/rule disclosure, save
  disabling, exclude, restore, and pending-state locking. Any later automated
  UI interaction coverage in this change uses `user-event`, not a browser
  harness or Playwright.
- Add assertions that technical metadata is not user-visible and that compact
  labels/actions do not repeat the item name.
- Add structural assertions for the shared grid and sidebar expanded/collapsed
  states.
- Perform manual or equivalent visual QA at `1280x720`, `1366x768`, and
  `1440x900`; include `1024px` width coverage when a reviewable visual
  evidence path is available. This is not automated browser testing.
- Do not add mobile viewport implementation or tests for this change.

## Rollout And Recovery

The change is UI-only and has no migration or live database step. Rollback is a
source revert of the presentation change. Existing draft persistence and
mutation contracts remain usable in either presentation version.

## Open Questions

None at the product or domain level. Exact Tailwind grid token values,
component extraction boundaries, and manual visual-evidence mechanics are
implementation details to be resolved while executing the approved scope.
