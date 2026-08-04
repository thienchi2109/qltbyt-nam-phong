# Technical Configuration Hierarchical Baseline Editor Design

**Date:** 2026-08-04

**Status:** Approved for implementation planning

## Context

The current baseline editor separates two views:

- horizontal group tabs for editing one selected group;
- a read-only "Xem tat ca nhom" overview.

This makes users switch context while building a baseline even though the
baseline is naturally one ordered hierarchy of groups and criteria.

The approved direction is a single editable hierarchy that renders every group
in one scrollable workspace.

## Goals

1. Render every baseline group in one editable vertical hierarchy.
2. Expand all groups by default.
3. Allow each group to be collapsed or expanded independently.
4. Keep the toolbar and explicit Save action outside the vertical scroll area.
5. Keep single-row editing and per-group multiline entry.
6. Add groups and criteria inline without navigating to another view.
7. Preserve the current draft, validation, dirty-state, bulk-session, conflict,
   reload, and explicit-save contracts.

## Non-goals

- No database, migration, RPC, payload, or wire-type changes.
- No autosave.
- No persistence of collapsed state to local storage or the backend.
- No virtualization.
- No mobile-specific redesign.
- No dev-server or browser-based verification during implementation.

## Approved UX

### Workspace

`TechnicalConfigurationBaselineEditor` renders:

1. a non-scrolling toolbar with version status, pending-state text, and Save;
2. a definite-height editor workspace using
   `h-[70dvh] min-h-[28rem] max-h-[52rem]`;
3. a keyboard-focusable vertical scroll region that consumes the remaining
   workspace height;
4. all groups in baseline order;
5. an inline Add group action after the hierarchy.

There is no group tab strip and no separate read-only overview.

### Group section

Each group is a controlled collapsible section. Its header remains visible in
both states and contains:

- collapse/expand control;
- group ordinal and editable name;
- criterion count;
- validation error count;
- pending multiline-input status when applicable;
- move up/down controls;
- delete control;
- "Nhap nhieu dong" or "Chinh tung dong" mode action;
- Add criterion action.

All groups are expanded on first render. A user's collapsed choice survives
ordinary draft edits and re-renders.

New groups are expanded automatically. If a client-created group key is
replaced with a server ID after Save, the server key is treated as a new key and
therefore opens by default. The active interaction group and focus continue to
use the existing ordered-position reconciliation in the inline-editor hook.

### Group content

In row mode, reuse `TechnicalConfigurationCriteriaSpreadsheet`.

In multiline mode, reuse `TechnicalConfigurationBulkEntryWorkbench` inside the
same group section. Only the active interaction group displays the multiline
workbench at one time. Switching to another group preserves each group's
existing bulk buffer through the current group-keyed session store.

Move the existing Add criterion control from the spreadsheet footer to the
group header. Render exactly one Add criterion control per group. The group
section owns its ref so the existing `add-criterion` focus fallback still works
after adding or deleting criteria.

Collapsing a group hides its content but does not mutate draft data or clear its
bulk buffer.

### Inline creation and focus

- Add group appends a group, expands it, scrolls it into view, and focuses the
  group-name input.
- Add criterion expands its group, appends a criterion, scrolls it into view,
  and focuses the requirement field.
- Accepting multiline input returns that group to row mode and focuses or
  highlights the accepted criteria using the current behavior.
- Deleting a focused item moves focus using the current fallback rules.

Focus consumers call `scrollIntoView({ block: "nearest" })` before focusing a
new group name or criterion field.

## State Design

### Persistent domain state

Keep the existing owners unchanged:

- `useTechnicalConfigurationBaselineEditor` owns loaded versions, base/editor
  drafts, explicit Save, validation, conflict, reload, and cache reconciliation.
- `useTechnicalConfigurationBulkEntrySessions` owns per-group multiline
  buffers, previews, pending-input detection, and recently accepted keys.

### Interaction state

Keep `useTechnicalConfigurationInlineEditor` as the owner of the active
interaction group, row/bulk mode, and focus requests. Replace navigation-only
APIs with an atomic group-mode action so a group header can select a group and
change its mode in one transition.

Remove the all-groups sentinel and overview-activation path because the entire
editor is now the all-groups view.

Replace tab-specific focus targets:

- `group-tab` becomes `group-disclosure` and focuses the target group's
  collapse/expand button after group deletion or conflict reload;
- `mode-tab` becomes `group-mode-action` and focuses the target group's
  row/multiline action after multiline cancellation.

### Disclosure state

Add a small UI-only disclosure hook:

```ts
type TechnicalConfigurationGroupDisclosure = {
  expandedGroupKeys: ReadonlySet<string>
  isExpanded: (groupKey: string) => boolean
  setExpanded: (groupKey: string, expanded: boolean) => void
  expand: (groupKey: string) => void
}
```

The hook receives the ordered current group keys and reconciles them by:

1. preserving exact keys;
2. removing deleted keys;
3. expanding genuinely new keys;

This state is not included in dirty detection.

## Component Structure

### `TechnicalConfigurationBaselineEditor.tsx`

Keep this as the composition boundary. It renders the toolbar, scroll region,
empty state, ordered group sections, and Add group action. It should shrink
from its current size rather than absorb group-section details.

It receives `getBulkSession(groupKey)` from
`useTechnicalConfigurationBulkEntrySessions`, resolves every group's session
while mapping the hierarchy, and derives a per-group pending-input flag for
collapsed headers. The existing global `hasPendingBulkInput` remains the Save
and toolbar guard.

### `TechnicalConfigurationBaselineGroupSection.tsx`

New focused component responsible for one collapsible group header and its row
or multiline content. It remains controlled and receives draft actions through
props.

### Reused components

- `TechnicalConfigurationCriteriaSpreadsheet.tsx`, with its Add criterion
  control moved to the group header
- `TechnicalConfigurationBulkEntryWorkbench.tsx`
- `TechnicalConfigurationBaselineEditorControls.tsx`
- existing immutable draft helpers and validation

### Removed components

Delete these after the hierarchical editor has full coverage:

- `TechnicalConfigurationGroupNavigator.tsx`
- `TechnicalConfigurationAllGroupsOverview.tsx`
- `TechnicalConfigurationGroupNavigation.ts`

## Accessibility

- Use the existing Radix-backed `Collapsible` primitive.
- The collapse button exposes `aria-expanded` and names the group.
- The actual `overflow-y-auto` node owns the region label and keyboard focus,
  rather than placing region semantics on a non-scrolling wrapper.
- The editor wrapper owns a definite height so the inner overflow node can
  actually scroll while the toolbar remains visible.
- Collapsed headers continue to expose criterion count, error count, and
  pending multiline-input status.
- Group-name validation remains associated through `aria-describedby`.
- Icon controls retain explicit labels and tooltips.
- Focus targets remain tokenized so repeated actions can focus the same field.

## Validation and Save

- Validation summaries use the current draft validation.
- Field errors remain hidden until the existing Save validation contract makes
  them visible.
- Save stays disabled while any meaningful multiline buffer is pending.
- Collapse/expand changes never mark the baseline dirty.
- Conflict reload, partial-save progress, cache replacement, and locked-version
  behavior remain unchanged.

## Test Strategy

Use Testing Library `userEvent.setup()` for every user interaction, including
clicks, typing, keyboard navigation, collapse/expand, and mode changes. Do not
use `fireEvent` to simulate user behavior. Direct event dispatch remains
acceptable only for browser lifecycle events such as `beforeunload`.

Use RED-GREEN-REFACTOR cycles for:

1. disclosure initialization and key reconciliation;
2. atomic per-group row/bulk activation and focus;
3. group-section accessibility and controls;
4. all-groups default rendering and independent collapse;
5. inline add group/add criterion focus;
6. add-group/add-criterion `scrollIntoView` behavior;
7. per-group multiline buffer preservation and collapsed-header status;
8. replacement focus targets after delete, cancel, and conflict reload;
9. explicit Save, validation, conflict, and reload regressions.

Verification remains test-driven and non-browser-based per user direction.
