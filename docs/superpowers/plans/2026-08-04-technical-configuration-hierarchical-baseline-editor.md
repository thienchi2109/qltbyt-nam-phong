# Technical Configuration Hierarchical Baseline Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> (if subagents are available) or superpowers:executing-plans to implement this
> plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace group-tab editing and the read-only all-groups overview with
one vertically scrollable, inline-editable hierarchy whose groups are expanded
by default and independently collapsible.

**Architecture:** Keep baseline persistence, validation, explicit Save, conflict
handling, and group-keyed bulk sessions unchanged. Retain
`useTechnicalConfigurationInlineEditor` for active interaction group, row/bulk
mode, and focus requests; add a small disclosure hook for UI-only expanded
state; extract a controlled group-section component; make
`TechnicalConfigurationBaselineEditor` the thin composition boundary for the
fixed toolbar and scrollable hierarchy.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Radix-backed shadcn
Collapsible and controls, TanStack Query, Vitest, Testing Library
`user-event`, Tailwind CSS, React Doctor.

**Design spec:**
`docs/superpowers/specs/2026-08-04-technical-configuration-hierarchical-baseline-editor-design.md`

**Delivery:** One feature branch and one PR. UI-only. No database, migration,
RPC, payload, or wire-type changes.

**Execution constraint:** Do not start a dev server and do not add browser-based
verification. Use component/integration tests, TypeScript gates, and React
Doctor.

**Interaction-test constraint:** Use Testing Library `userEvent.setup()` for
all clicks, typing, keyboard navigation, collapse/expand, and mode changes. Do
not use `fireEvent` for user interactions. Direct event dispatch is allowed
only for browser lifecycle events such as `beforeunload`.

## Preserved Contracts

- Save remains explicit; no autosave.
- Pending multiline input continues to block Save and unsafe draft replacement.
- Per-group multiline buffers survive group/mode changes.
- Accepted rows keep their current focus/highlight behavior.
- Validation, conflict reload, partial-save cache progress, and locked-version
  behavior remain unchanged.
- Collapse state is transient UI state and never contributes to dirty state.
- Source files stay below the repo's 450-line ceiling; files approaching 350
  lines are split before adding behavior.

## Pre-implementation Prerequisites

Before Task 1:

1. Update from `origin/main` and create a feature branch.
2. Invoke `karpathy-coding-heuristics`.
3. Invoke `react-best-practices`.
4. Invoke `code-deduplication` and search unchanged code for:
   - controlled Radix Collapsible sections;
   - ordered-key disclosure state reconciliation;
   - keyboard-focusable vertical scroll regions;
   - group headers with count/error badges.
5. Use Code Review Graph first, then GitNexus impact for the exact symbols being
   changed.
6. Confirm the diff contains no database, migration, RPC, or wire-type files.

## Task 1: Lock UI-only Disclosure State

**Files:**

- Create:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationGroupDisclosure.ts`
- Create:
  `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-group-disclosure.test.ts`

- [ ] **Step 1: Write failing disclosure tests**

Cover:

- every initial group is expanded;
- toggling one group does not affect the others;
- a collapsed group stays collapsed across ordinary rerenders and criterion
  edits;
- a newly appended group starts expanded;
- a deleted group is removed from disclosure state;
- reordering existing keys preserves state by key;
- replacing a missing client key with a new server key treats the server key as
  new and expanded;
- deleting one group and inserting an unrelated group at the same position
  expands the unrelated group rather than inheriting disclosure state;
- an empty draft remains stable.

Use `userEvent.setup()` for disclosure toggles exposed through a test harness.

Target public contract:

```ts
type UseTechnicalConfigurationGroupDisclosureResult = {
  expandedGroupKeys: ReadonlySet<string>
  isExpanded: (groupKey: string) => boolean
  setExpanded: (groupKey: string, expanded: boolean) => void
  expand: (groupKey: string) => void
}

function useTechnicalConfigurationGroupDisclosure(
  groupKeys: readonly string[]
): UseTechnicalConfigurationGroupDisclosureResult
```

- [ ] **Step 2: Run the focused test and verify RED**

Run through context-mode:

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-group-disclosure.test.ts"
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the smallest disclosure hook**

Implementation requirements:

- initialize from all current keys;
- store a `Set<string>` and always replace it immutably;
- preserve exact matching keys;
- treat unmatched new keys as expanded;
- remove missing keys;
- expose stable callbacks with functional state updates;
- do not use local storage, query cache, URL state, or backend persistence.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 1 command again.

Expected: all disclosure tests pass.

- [ ] **Step 5: Refactor while green**

Keep reconciliation in one small pure helper inside the hook module if it makes
exact-key preservation independently readable. Do not add key-remapping
heuristics.

- [ ] **Step 6: Commit Task 1**

```bash
git add \
  "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationGroupDisclosure.ts" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-group-disclosure.test.ts"
git commit -m "feat(technical-configurations): add group disclosure state"
```

## Task 2: Make Group Mode Activation Atomic

**Files:**

- Modify:
  `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor.ts:20-298`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-inline-editor.test.ts:35-61`

- [ ] **Step 1: Add failing hook tests**

Add cases proving:

- opening multiline mode for a specified group atomically sets that group as
  active, selects `bulk`, and requests focus for its bulk input;
- returning a specified group to row mode focuses its first validation error,
  first criterion, or Add criterion fallback;
- moving from one group's multiline mode to another clears only recent
  highlights, not either group's bulk buffer;
- Save reconciliation from client key to server key preserves the active group
  by ordered position and clears stale focus;
- deleting a group emits a `group-disclosure` focus target for the next group,
  or Add group when no groups remain;
- cancelling multiline input emits a `group-mode-action` focus target for that
  group;
- conflict reload emits a `group-disclosure` focus target for the first
  reloaded group;
- there is no all-groups sentinel state or overview activation action.

Use `userEvent.setup()` in any rendered hook harness that exposes interactive
controls. Keep direct `act()` calls only for hook-only state transitions that
cannot be expressed as user behavior.

Target action:

```ts
setGroupMode(groupKey: string, mode: TechnicalConfigurationEntryMode): void
```

- [ ] **Step 2: Run the hook test and verify RED**

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-inline-editor.test.ts"
```

Expected: FAIL because mode changes still depend on the previously active tab
and the hook still carries all-groups navigation behavior.

- [ ] **Step 3: Implement the atomic transition**

In `useTechnicalConfigurationInlineEditor`:

- replace navigation-oriented `navigate` plus selected-group-only `changeMode`
  usage with `setGroupMode(groupKey, mode)`;
- derive row-mode focus from the specified group, not stale `activeValue`;
- preserve the existing `activeValue` and `entryMode` internal state so
  add/delete/save focus reconciliation stays surgical;
- remove `ALL_GROUPS_VALUE` branches;
- remove `activateOverviewCriterion`;
- replace the `group-tab` focus-target variant with
  `{ kind: "group-disclosure"; key; token }`;
- replace the `mode-tab` variant with
  `{ kind: "group-mode-action"; key; token }`;
- keep add group, add criterion, move, delete, bulk preview/accept/cancel, and
  recent-highlight behavior unchanged.

- [ ] **Step 4: Run the hook test and verify GREEN**

Run the Task 2 command again.

Expected: all inline-editor hook tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add \
  "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationInlineEditor.ts" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-inline-editor.test.ts"
git commit -m "refactor(technical-configurations): activate group modes atomically"
```

## Task 3: Build One Controlled Collapsible Group Section

**Files:**

- Create:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineGroupSection.tsx`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-group-section.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationCriteriaSpreadsheet.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-criteria-spreadsheet.test.tsx`
- Reuse:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryWorkbench.tsx`
- Reuse:
  `src/components/ui/collapsible.tsx`

- [ ] **Step 1: Write the failing group-section tests**

Use a controlled test harness and cover:

- the expanded header exposes group ordinal, editable name, criterion count,
  error count, an accessible group-specific collapse name, and
  `aria-expanded="true"`;
- collapse emits `onExpandedChange(false)` and hides row/bulk content while
  keeping counts and pending-input status visible;
- Enter and Space toggle the collapse control through `userEvent.setup()`;
- row mode renders the existing spreadsheet with the correct group index,
  validation, recent highlights, and add/move/delete callbacks;
- multiline mode renders the existing workbench for that group's session;
- "Nhap nhieu dong" calls `onModeChange(groupKey, "bulk")`;
- "Chinh tung dong" calls `onModeChange(groupKey, "row")`;
- Add criterion expands the group before issuing the add action;
- exactly one Add criterion control is rendered for the group;
- an `add-criterion` focus target focuses the header action;
- `group-disclosure` focuses the collapse/expand button;
- `group-mode-action` focuses the row/multiline action;
- move/delete and editable-name controls preserve current disabled and
  validation semantics;
- the group-name error remains associated through `aria-describedby`.

Create one `const user = userEvent.setup()` per test and use it for every
click, input edit, and keyboard action.

- [ ] **Step 2: Run the component test and verify RED**

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-group-section.test.tsx"
```

Expected: FAIL because the group-section component does not exist.

- [ ] **Step 3: Implement the controlled group section**

Use `Collapsible`, `CollapsibleTrigger`, and `CollapsibleContent`.

Keep the component focused:

```tsx
<Collapsible open={expanded} onOpenChange={onExpandedChange}>
  <GroupHeader />
  <CollapsibleContent>
    {mode === "bulk" ? <TechnicalConfigurationBulkEntryWorkbench /> : null}
    {mode === "row" ? <TechnicalConfigurationCriteriaSpreadsheet /> : null}
  </CollapsibleContent>
</Collapsible>
```

Implementation requirements:

- use a chevron icon button as the collapse trigger;
- keep visible header controls outside the trigger so editing a name or
  clicking actions does not toggle disclosure;
- show pending multiline status even when collapsed;
- label the disclosure control with the current group name or ordinal fallback;
- move the existing Add criterion button/ref out of
  `TechnicalConfigurationCriteriaSpreadsheet` and into the group header;
- let the group section consume `focusTarget.kind === "add-criterion"` while
  the spreadsheet continues to consume criterion field targets;
- do not copy spreadsheet or bulk parsing logic;
- do not add another nested card surface;
- keep the file below 350 lines.

- [ ] **Step 4: Run group-section and reused-component tests**

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-group-section.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-criteria-spreadsheet.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx"
```

Expected: all tests pass.

- [ ] **Step 5: Refactor while green**

If the header becomes large, extract only a local grep-friendly
`TechnicalConfigurationBaselineGroupHeader.tsx`. Do not create a generic
accordion abstraction.

- [ ] **Step 6: Commit Task 3**

```bash
git add \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineGroupSection.tsx" \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationCriteriaSpreadsheet.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-group-section.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-criteria-spreadsheet.test.tsx"
git commit -m "feat(technical-configurations): add collapsible baseline group section"
```

## Task 4: Compose the Scrollable Hierarchical Editor

**Files:**

- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx:29-335`
- Modify:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx:33-283`
- Create:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-hierarchical-editor.test.tsx`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx:127-301`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx:35-442`
- Modify:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-focus-transitions.test.tsx`
- Modify only if selectors require it:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab-fixtures.tsx`

- [ ] **Step 1: Write failing hierarchy tests**

Cover the approved workflow:

- all server groups and their editable criteria render at once;
- there are no group tabs and no "Xem tat ca nhom" view;
- all groups start expanded;
- collapsing one group leaves other groups expanded;
- expanding it restores its row or multiline content;
- the actual vertical overflow node is keyboard-focusable and owns the region
  label;
- the editor wrapper carries the definite sizing contract
  `h-[70dvh] min-h-[28rem] max-h-[52rem]`;
- the toolbar and Save action are outside the scrolling node;
- an empty draft exposes Add group without a fallback overview tab;
- adding a group expands it and focuses its name;
- adding a criterion expands its group and focuses the new requirement field;
- mocked `scrollIntoView` is called before focusing a newly added group or
  criterion;
- opening multiline entry affects only the requested group;
- switching multiline entry to another group preserves both group-keyed
  buffers;
- accepting multiline input returns the active group to row mode and keeps the
  current accepted-row focus/highlight behavior.
- deleting a selected group focuses the next group's disclosure control;
- cancelling multiline input focuses that group's mode action;
- conflict reload focuses the first server group's disclosure control.

Avoid assertions on decorative Tailwind classes. The definite-height classes
are behavioral and should be asserted together with the labeled, focusable
scroll region and toolbar/region DOM ownership.

Use `userEvent.setup()` for all hierarchy interactions. Do not carry forward
`fireEvent` calls from the removed group-navigation tests.

- [ ] **Step 2: Run focused hierarchy tests and verify RED**

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-hierarchical-editor.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-focus-transitions.test.tsx"
```

Expected: FAIL because the current editor renders one selected group behind a
tab navigator and uses a separate read-only overview.

- [ ] **Step 3: Replace editor composition**

In `TechnicalConfigurationBaselineEditor`:

- keep the existing status and Save toolbar;
- call `useTechnicalConfigurationGroupDisclosure` with ordered draft keys;
- render a flex-column editor with
  `h-[70dvh] min-h-[28rem] max-h-[52rem]`;
- put the actual hierarchy in a `min-h-0 flex-1 overflow-y-auto` node with an
  accessible label and `tabIndex={0}`;
- map every draft group to
  `TechnicalConfigurationBaselineGroupSection`;
- derive each group's mode as:

```ts
const mode = activeValue === group.key && entryMode === "bulk" ? "bulk" : "row"
```

- pass the current group-keyed bulk session to each section;
- accept `getBulkSession(groupKey)` as a prop, resolve every group's session,
  and derive each group's pending-input flag with
  `hasTechnicalConfigurationBulkEntryInput(session.input)`;
- make Add group remain available when the draft is empty;
- expand the target group before add-group/add-criterion focus runs;
- call `scrollIntoView({ block: "nearest" })` before focusing a newly added group
  name or criterion field;
- keep the toolbar outside the overflow node.

In `TechnicalConfigurationBaselineTab`:

- pass `inlineEditor.setGroupMode`;
- pass `bulkSessions.getSession`;
- remove `onOverviewCriterionActivate`;
- keep the baseline hook, bulk sessions, unsafe-leave calculation,
  beforeunload guard, reload preparation, and all persistence props unchanged.

- [ ] **Step 4: Run focused editor and integration tests and verify GREEN**

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-hierarchical-editor.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-group-section.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-group-disclosure.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-inline-editor.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-focus-transitions.test.tsx"
```

Expected: all hierarchy, section, disclosure, focus, integration, and
interaction-state tests pass.

- [ ] **Step 5: Commit Task 4**

```bash
git add \
  "src/app/(app)/technical-configurations/_components" \
  "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationGroupDisclosure.ts" \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-hierarchical-editor.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-focus-transitions.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab-fixtures.tsx"
git commit -m "feat(technical-configurations): unify baseline group editing"
```

## Task 5: Remove Obsolete Navigation and Refactor While Green

**Files:**

- Delete:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationGroupNavigator.tsx`
- Delete:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationAllGroupsOverview.tsx`
- Delete:
  `src/app/(app)/technical-configurations/_components/TechnicalConfigurationGroupNavigation.ts`
- Delete:
  `src/app/(app)/technical-configurations/__tests__/technical-configuration-group-navigation.test.tsx`

- [ ] **Step 1: Delete obsolete navigation files**

Remove the unused tab navigator, read-only overview, navigation
constants/helpers, and their dedicated test only after Task 4 is green.

- [ ] **Step 2: Verify dead navigation symbols are gone**

Run `rg` through context-mode and confirm there are no remaining references to:

```text
ALL_GROUPS_VALUE
GROUP_WORKSPACE_PANEL_ID
getTechnicalConfigurationGroupTabId
TechnicalConfigurationGroupNavigator
TechnicalConfigurationAllGroupsOverview
group-tab
mode-tab
activateOverviewCriterion
```

- [ ] **Step 3: Check file sizes and refactor while green**

Use context-mode to report line counts for changed source files.

Expected:

- no source file exceeds 450 lines;
- `TechnicalConfigurationBaselineEditor.tsx` is materially smaller than its
  current 337 lines;
- group header details are extracted only if the new group-section file
  approaches 350 lines.

- [ ] **Step 4: Run the full focused set after cleanup**

Run the Task 4 GREEN command again.

Expected: all focused tests remain green after dead-code deletion and refactor.

- [ ] **Step 5: Commit Task 5**

```bash
git add \
  "src/app/(app)/technical-configurations/_components" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-group-navigation.test.tsx"
git commit -m "refactor(technical-configurations): remove group navigation views"
```

## Task 6: Final Verification and PR Preparation

**Files:**

- Review all changed files.
- Do not start a dev server.

- [ ] **Step 1: Run semantic deduplication review**

Invoke `code-deduplication` and verify that the disclosure hook, group header,
scroll region, and focus helpers do not duplicate unchanged equivalents.

Document the reuse decisions:

- reuse `Collapsible`;
- reuse spreadsheet and bulk workbench;
- keep disclosure reconciliation local because its client-key replacement
  semantics are module-specific.

- [ ] **Step 2: Run required gates in repository order**

Run the following through one `ctx_batch_execute` call so output is indexed and
searchable:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-hierarchical-editor.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-group-section.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-group-disclosure.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-inline-editor.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-inline-workflow.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-focus-transitions.test.tsx"
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__"
node scripts/npm-run.js run react-doctor
```

Expected:

- formatting passes;
- no explicit `any`;
- diff-only duplicate gate passes;
- typecheck passes;
- focused tests pass;
- the full technical-configurations module suite passes;
- React Doctor reports no actionable regression from the diff.

- [ ] **Step 3: Inspect the final diff and blast radius**

Use context-mode for `git diff` and Code Review Graph/GitNexus for changed-file
impact.

Confirm:

- only UI, UI-state hook, tests, and documentation changed;
- no database, migration, RPC, or wire-type files changed;
- old navigation symbols are gone;
- no source file exceeds the line ceiling;
- no dev server was started.

- [ ] **Step 4: Request code review**

Invoke `superpowers:requesting-code-review`. Triage findings for correctness,
accessibility, focus reconciliation, pending-buffer preservation, and test
quality. Reject suggestions that expand scope into backend changes,
virtualization, or persisted disclosure state.

- [ ] **Step 5: Commit any review fixes and rerun affected gates**

Use focused RED-GREEN cycles for every accepted behavioral fix, then rerun the
required affected checks.

- [ ] **Step 6: Push and open one PR**

```bash
git pull --rebase
git push -u origin HEAD
git status
```

Open one PR describing:

- the unified editable hierarchy;
- default-expanded collapsible groups;
- fixed toolbar plus vertical scroll region;
- retained per-group multiline entry;
- unchanged explicit-save/backend contracts;
- tests and gates run;
- no dev server used.
