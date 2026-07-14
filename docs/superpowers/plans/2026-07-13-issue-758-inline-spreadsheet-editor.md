# Issue #758 Inline Spreadsheet Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the technical-configuration bulk-entry dialog with a desktop-only spreadsheet-lite editor that supports row editing, inline multiline entry, read-only all-group review, per-group transient buffers, and the existing explicit-save contract.

**Architecture:** `TechnicalConfigurationBaselineTab` becomes the integration owner for baseline data state, transient bulk sessions, view/mode selection, combined unsafe-navigation state, and save/reload gating. Focused controlled components render the group navigator, selected-group spreadsheet, inline bulk workbench, and all-groups overview while reusing the existing parser, immutable editor-state helpers, validation, and save flow.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Radix-backed shadcn Tabs and controls, TanStack Query, Vitest, Testing Library `user-event`, Tailwind CSS, React Doctor, Stitch references, Vercel `agent-browser`.

**Design spec:** `docs/superpowers/specs/2026-07-13-issue-758-inline-spreadsheet-editor-design.md`

**Branch strategy:** Keep this as a stacked branch based on `feat/issue-756-technical-config-p3c-bulk-entry` while PR #757 is open. Any PR opened before #757 merges must target that feature branch. Rebase and retarget to `main` only after #757 merges.

---

## Pre-implementation prerequisites

Before Task 1:

1. Invoke `next-best-practices`.
2. Invoke `react-best-practices`.
3. Invoke the `code-deduplication` skill and search unchanged code for existing:
   - transient per-key editor session hooks;
   - horizontal entity navigators with counts/errors;
   - controlled spreadsheet row editors;
   - read-only grouped overview/filter components;
   - focusable `aria-disabled` destructive controls.

Reuse an existing equivalent when semantics match. Document why a new local
component remains appropriate when no equivalent exists.

---

## Chunk 1: Transient State And Unsafe-Leave Contracts

### Task 1: Centralize meaningful bulk-input detection

**Files:**

- Modify: `src/app/(app)/technical-configurations/bulk-entry-utils.ts`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry-utils.test.ts`

- [ ] **Step 1: Add failing helper tests**

Add focused cases:

```ts
describe("hasTechnicalConfigurationBulkEntryInput", () => {
  it.each([
    ["", false],
    ["   \n\t", false],
    ["\u200B\u2060", false],
    ["Yêu cầu kỹ thuật", true],
  ])("classifies parser-meaningful input %#", (input, expected) => {
    expect(hasTechnicalConfigurationBulkEntryInput(input)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry-utils.test.ts"
```

Expected: FAIL because `hasTechnicalConfigurationBulkEntryInput` is not exported.

- [ ] **Step 3: Add the minimal helper**

Implement:

```ts
export function hasTechnicalConfigurationBulkEntryInput(input: string): boolean {
  return normalizeTechnicalConfigurationBulkEntryText(input).length > 0
}
```

Use the helper inside `parseTechnicalConfigurationBulkEntry` where it improves
clarity without changing source-line or blank-row semantics.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 1 command again.

Expected: all parser/helper tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add \
  "src/app/(app)/technical-configurations/bulk-entry-utils.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry-utils.test.ts"
git commit -m "refactor(technical-configurations): centralize bulk input availability"
```

### Task 2: Add group-keyed transient interaction state

**Files:**

- Create: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/use-technical-configuration-bulk-entry-sessions.test.ts`

- [ ] **Step 1: Write failing hook tests**

Cover:

- independent buffers for two group keys;
- preview invalidation on input change;
- clear selected session on cancel/accept;
- orphan cleanup after group deletion;
- `hasPendingInput` based on Task 1 helper;
- zero-width-only input does not block;
- recent accepted key replacement;
- accept-driven mode change does not clear highlights;
- manual group/mode/overview lifecycle clears highlights;
- `clearAll()` for approved server reload.

Use a public contract shaped like:

```ts
type BulkEntrySession = {
  input: string
  preview: TechnicalConfigurationBulkEntryPreview | null
}

type BulkEntrySessionsApi = {
  getSession: (groupKey: string) => BulkEntrySession
  setInput: (groupKey: string, input: string) => void
  setPreview: (groupKey: string, preview: TechnicalConfigurationBulkEntryPreview | null) => void
  clearSession: (groupKey: string) => void
  syncGroupKeys: (groupKeys: readonly string[]) => void
  setRecentlyAccepted: (criterionKeys: readonly string[]) => void
  clearRecentHighlights: () => void
  clearAll: () => void
  hasPendingInput: boolean
  recentlyAcceptedCriterionKeys: ReadonlySet<string>
}
```

- [ ] **Step 2: Run the hook test and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-bulk-entry-sessions.test.ts"
```

Expected: FAIL because the hook module does not exist.

- [ ] **Step 3: Implement the smallest reducer-backed hook**

Requirements:

- immutable reducer transitions;
- one empty-session constant returned safely without shared mutation;
- stale preview becomes `null` whenever input changes;
- `syncGroupKeys` removes only missing group keys;
- `hasPendingInput` is derived, not separately stored;
- highlight keys are a new `Set` per transition;
- no localStorage, sessionStorage, query cache, or backend writes.

- [ ] **Step 4: Run the hook test and verify GREEN**

Run the Task 2 command again.

Expected: all transient-state tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add \
  "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBulkEntrySessions.ts" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-bulk-entry-sessions.test.ts"
git commit -m "feat(technical-configurations): add transient bulk entry sessions"
```

### Task 3: Move combined dirty and replacement ownership to the baseline tab

**Files:**

- Modify: `src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor.ts`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx`

- [ ] **Step 1: Add failing ownership and guard tests**

Add tests proving:

- `TechnicalConfigurationBaselineTab` reports `true` when the draft is dirty;
- it also reports `true` when the draft is clean but bulk input is meaningful;
- zero-width-only bulk input remains safe;
- `beforeunload` is registered for either unsafe state and removed when safe;
- automatic query data does not replace the editor draft while bulk input is
  pending;
- workspace `Danh sách hồ sơ` confirms on the combined unsafe state;
- internal mode/group changes do not invoke `window.confirm`.

Use a minimal temporary test harness for the bulk-session API if the visual
workbench is not yet present.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx"
```

Expected: at least the clean-draft/pending-buffer and query-replacement cases
fail under current ownership.

- [ ] **Step 3: Refactor the data hook contract**

Change `useTechnicalConfigurationBaselineEditor` to:

- stop owning `onDirtyChange`;
- stop registering `beforeunload`;
- accept an `isExternalDraftReplacementBlocked` boolean;
- skip query-driven base/editor replacement while either `isDirty` or the
  external blocker is true;
- keep queries, mutations, save validation, conflict state, and persistence
  behavior unchanged.

- [ ] **Step 4: Make the tab the integration owner**

In `TechnicalConfigurationBaselineTab`:

```ts
const bulkSessions = useTechnicalConfigurationBulkEntrySessions()
const baseline = useTechnicalConfigurationBaselineEditor({
  dossier,
  isExternalDraftReplacementBlocked: bulkSessions.hasPendingInput,
})
const isUnsafeToLeave = baseline.isDirty || bulkSessions.hasPendingInput
```

Add the combined `onDirtyChange` and `beforeunload` effects in the tab. Pass
the transient state down through explicit props until the final editor
composition task.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 3 command again.

Expected: all baseline tab/workspace tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add \
  "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaselineEditor.ts" \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx"
git commit -m "refactor(technical-configurations): combine draft and buffer guards"
```

## Chunk 2: Spreadsheet And Inline Workbench Components

### Task 4: Extract the selected-group spreadsheet

**Files:**

- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationCriteriaSpreadsheet.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/technical-configuration-criteria-spreadsheet.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx`

- [ ] **Step 1: Add failing spreadsheet component tests**

Render one group and verify:

- only the selected group's criteria appear;
- columns are order, code, optional title, required requirement text, status,
  and row actions;
- title and multiline requirement callbacks receive the correct keys;
- `Mới` renders for `criterion.id === null`;
- save-attempt validation text renders beside the requirement field;
- move/delete callbacks remain exact;
- `Thêm tiêu chí` callback fires once;
- `focusCriterionKey` focuses the exact requirement textarea;
- `recentlyAcceptedCriterionKeys` adds a stable
  `data-recently-accepted="true"` marker.

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/technical-configurations/__tests__/technical-configuration-criteria-spreadsheet.test.tsx"
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the controlled spreadsheet**

Use current shadcn inputs/textareas and icon controls. Keep explicit sizing:

```text
order: 3rem
code: 7rem
title: minmax(12rem, 0.8fr)
requirement: minmax(24rem, 2fr)
status: 9rem
actions: 7rem
```

Wrap the table/grid in `overflow-x-auto` with an explicit minimum width.
Implement focus via a ref map keyed by criterion key; use
`scrollIntoView({ block: "nearest" })` only when `focusCriterionKey` changes.

- [ ] **Step 4: Replace the existing criterion JSX with the component**

Keep group orchestration temporarily in
`TechnicalConfigurationBaselineEditor`. Do not add bulk-mode behavior yet.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-criteria-spreadsheet.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx"
```

Expected: new spreadsheet tests and existing editor regressions pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationCriteriaSpreadsheet.tsx" \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-criteria-spreadsheet.test.tsx"
git commit -m "refactor(technical-configurations): extract criteria spreadsheet"
```

### Task 5: Add group navigation and read-only all-groups overview

**Files:**

- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationGroupNavigator.tsx`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationAllGroupsOverview.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/technical-configuration-group-navigation.test.tsx`

- [ ] **Step 1: Add failing navigator and overview tests**

Cover:

- first group selected initially;
- blank names render `Nhóm {index}`;
- criterion and live-validation error counts render;
- group tabs support arrow/home/end keyboard behavior;
- `Xem tất cả nhóm` activates the overview;
- overview heading receives focus;
- filters `Tất cả`, `Có lỗi`, and `Mới thêm`;
- `Mới thêm` uses `criterion.id === null`;
- overview has no editable textbox/textarea;
- activating a criterion reports group and criterion keys.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/technical-configurations/__tests__/technical-configuration-group-navigation.test.tsx"
```

Expected: FAIL because both components do not exist.

- [ ] **Step 3: Implement the controlled navigator**

Use the existing Radix-backed Tabs primitive. Keep group activation automatic
and preserve focus on the activated group tab. Include `Xem tất cả nhóm` as the
final tab.

- [ ] **Step 4: Implement the read-only overview**

Derive rows directly from the current editor draft and live pure validation.
Do not create duplicate editor data. Give the overview heading `tabIndex={-1}`
for deterministic focus.

- [ ] **Step 5: Run the test and verify GREEN**

Run the Task 5 command again.

Expected: navigator and overview tests pass.

- [ ] **Step 6: Commit Task 5**

```bash
git add \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationGroupNavigator.tsx" \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationAllGroupsOverview.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-group-navigation.test.tsx"
git commit -m "feat(technical-configurations): add group review navigation"
```

### Task 6: Replace the dialog with an inline bulk-entry workbench

**Files:**

- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryWorkbench.tsx`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx`
- Delete after integration: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryDialog.tsx`

- [ ] **Step 1: Rewrite dialog expectations as failing inline expectations**

Preserve all P3C behaviors and add:

- no `dialog` role or overlay content;
- textarea and preview visible in the selected-group work surface;
- preview table columns `Dòng`, `Nội dung yêu cầu`, `Trạng thái`;
- persistent live summary;
- stale-preview invalidation;
- invalid preview blocks accept;
- `Hủy nhập` callback;
- pending save disables editing, preview, cancel, and accept;
- entering bulk mode focuses the textarea;
- `Escape` does not cancel.

- [ ] **Step 2: Run the bulk-entry test and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- "src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx"
```

Expected: rewritten tests fail because the current implementation is a dialog.

- [ ] **Step 3: Implement the controlled inline workbench**

Props must contain only data and commands:

```ts
type TechnicalConfigurationBulkEntryWorkbenchProps = Readonly<{
  groupName: string
  existingCriterionCount: number
  session: BulkEntrySession
  disabled: boolean
  onInputChange: (input: string) => void
  onPreview: () => void
  onCancel: () => void
  onAccept: () => void
}>
```

Keep parser invocation outside or inside through one explicit callback owner;
do not duplicate parsing in parent and child. The component never mutates the
editor draft directly.

- [ ] **Step 4: Run the bulk-entry test and verify GREEN**

Run the Task 6 command again.

Expected: all P3C semantics pass in inline form.

- [ ] **Step 5: Commit Task 6**

Do not delete the old dialog until Task 7 removes the final import.

```bash
git add \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryWorkbench.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx"
git commit -m "feat(technical-configurations): add inline bulk entry workbench"
```

## Chunk 3: Editor Integration, Cleanup, And Verification

### Task 7: Compose the approved two-mode editor

**Files:**

- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx`
- Delete: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryDialog.tsx`

- [ ] **Step 1: Add failing integration tests for the transition table**

Cover:

- first group and row mode initialize;
- mode Tabs use `activationMode="manual"` semantics;
- arrows move mode-tab focus without activating;
- Enter/Space activates bulk mode and focuses textarea;
- group switch preserves independent buffers and current mode;
- manual bulk-to-row switch preserves the buffer and keeps Save blocked;
- `Hủy nhập` clears only selected session, enters row mode, and focuses the
  bulk-mode trigger;
- accept appends requirement text only, clears the session, enters row mode,
  focuses the first appended textarea, and preserves highlight keys;
- later manual group/mode/overview transitions clear highlights;
- group delete with pending input exposes focusable `aria-disabled`, references
  the pending-input explanation, and does not invoke delete;
- deterministic group/criterion deletion focus fallbacks;
- add group and add criterion focus contracts;
- all-groups row jump enters row mode and focuses the criterion;
- final group removal focuses `Thêm nhóm`.

- [ ] **Step 2: Run focused integration tests and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-group-navigation.test.tsx"
```

Expected: transition-table cases fail before composition.

- [ ] **Step 3: Add controlled view/mode state in the tab**

Use:

```ts
type ActiveView = { kind: "group"; groupKey: string | null } | { kind: "all-groups" }

type EntryMode = "row" | "bulk"
```

Keep transitions as named callbacks. Avoid a single large callback that handles
unrelated events.

- [ ] **Step 4: Recompose the baseline editor**

The editor renders:

1. existing header/save controls;
2. group navigator;
3. selected-group toolbar and manual-activation mode Tabs;
4. exactly one work surface:
   - spreadsheet;
   - inline bulk workbench; or
   - all-groups overview.

Save-button state:

```ts
const saveDisabled =
  !baseline.isDirty || baseline.isSaving || baseline.isConflict || bulkSessions.hasPendingInput
```

Render exact pending-buffer status before generic dirty/saved status.

- [ ] **Step 5: Wire accept through the existing immutable append helper**

Use `appendTechnicalConfigurationBaselineEditorCriteria`. Capture the returned
new criterion keys from the updated selected group, then set recent highlights
before the accept-driven row-mode transition.

- [ ] **Step 6: Remove the final dialog import and file**

Search for `TechnicalConfigurationBulkEntryDialog`. Delete the component only
after there are no source/test consumers.

- [ ] **Step 7: Run focused integration tests and verify GREEN**

Run the Task 7 command again, plus:

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-editor-state.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-save.test.ts"
```

Expected: transition, editor state, and explicit-save regressions pass.

- [ ] **Step 8: Commit Task 7**

```bash
git add -A \
  "src/app/(app)/technical-configurations/_components" \
  "src/app/(app)/technical-configurations/_hooks" \
  "src/app/(app)/technical-configurations/__tests__"
git commit -m "feat(technical-configurations): add inline spreadsheet workflow"
```

### Task 8: Lock conflict reload, save gating, and zero-mutation boundaries

**Files:**

- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-save.test.ts`

- [ ] **Step 1: Add failing boundary tests**

Cover:

- pending buffer makes `Lưu` natively disabled with exact explanation;
- preview, cancel, mode switch, group switch, accept, and overview call no RPC;
- accepted rows appear in save payload only after explicit `Lưu`;
- conflict reload with pending input is focusable `aria-disabled`, references the
  explanation, and does not reload;
- approved reload after buffers clear resets transient sessions/highlights and
  selects first group in row mode;
- save failure preserves accepted draft edits;
- save pending blocks row and bulk edits.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-save.test.ts"
```

- [ ] **Step 3: Implement minimal gating and reload wrappers**

Use focusable `aria-disabled` controls for pending-buffer delete/reload
restrictions. Use native `disabled` for the page-level `Lưu` button and
save-pending edit controls.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 8 command again.

- [ ] **Step 5: Commit Task 8**

```bash
git add \
  "src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-save.test.ts"
git commit -m "test(technical-configurations): lock inline editor boundaries"
```

### Task 9: Quality gates, browser verification, and stacked PR

**Files:**

- Modify if needed: `openspec/changes/add-technical-configuration-comparison/tasks.md`
- Keep: `docs/superpowers/specs/2026-07-13-issue-758-inline-spreadsheet-editor-design.md`
- Keep: `docs/superpowers/plans/2026-07-13-issue-758-inline-spreadsheet-editor.md`

- [ ] **Step 1: Run all required verification in one context-mode batch**

Run in repository order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry-utils.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/use-technical-configuration-bulk-entry-sessions.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-criteria-spreadsheet.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-group-navigation.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-editor-state.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-save.test.ts" \
  "src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-workspace.test.tsx"
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison --strict
```

Expected:

- formatting clean;
- no explicit `any`;
- diff-only dedupe clean;
- typecheck clean;
- all focused tests pass;
- React Doctor 100/100 or no new actionable diagnostics;
- OpenSpec strict validation passes.

- [ ] **Step 2: Start the dev server and run browser verification**

Start the repository dev server on an available port. Use Vercel
`agent-browser`/`agent-browser-verify` at:

- 1280x800
- 1440x900
- 1920x1080

Capture:

- row mode;
- bulk mode;
- invalid preview;
- `Xem tất cả nhóm`.

Assert:

```js
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

Also verify:

- group/mode switches preserve outer scroll position;
- spreadsheet header remains sticky inside its scroll container;
- focus targets after accept and overview jump are visible;
- pending-buffer delete/reload controls are keyboard-focusable and announced as
  unavailable;
- disabled-save explanation and validation text do not overlap.

- [ ] **Step 3: Run change-impact review**

Run Code Review Graph `detect_changes_tool` against
`feat/issue-756-technical-config-p3c-bulk-entry`, then GitNexus
`detect_changes`/`impact` on the highest-risk changed symbols. Resolve genuine
missing tests or regressions.

- [ ] **Step 4: Update OpenSpec task tracking**

Mark only the #758/P3C UX refinement tasks that are genuinely complete. Do not
mark P4 or later phases.

- [ ] **Step 5: Commit verification/docs changes**

```bash
git add \
  openspec/changes/add-technical-configuration-comparison/tasks.md \
  docs/superpowers/specs/2026-07-13-issue-758-inline-spreadsheet-editor-design.md \
  docs/superpowers/plans/2026-07-13-issue-758-inline-spreadsheet-editor.md
git commit -m "docs(technical-configurations): finalize issue 758 workflow"
```

- [ ] **Step 6: Push and open/update the stacked PR**

```bash
git pull --rebase
git push -u origin feat/issue-758-inline-spreadsheet-editor
git status
```

While PR #757 remains open, create #758 with base
`feat/issue-756-technical-config-p3c-bulk-entry`. Include:

- summary of spreadsheet, bulk mode, and overview;
- zero backend/migration/live-DB changes;
- test and browser evidence;
- Stitch screen IDs;
- `Closes #758`.

After #757 merges:

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

Retarget #758 to `main`, rerun Task 9 verification, then merge only when checks
and review are clean.
