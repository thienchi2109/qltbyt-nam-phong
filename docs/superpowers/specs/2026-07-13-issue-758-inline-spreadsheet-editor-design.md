# Issue #758 - Inline spreadsheet editor for technical configuration drafts

- **Date**: 2026-07-13
- **Issue**: [#758](https://github.com/thienchi2109/qltbyt-nam-phong/issues/758)
- **Base branch**: `feat/issue-756-technical-config-p3c-bulk-entry`
- **Implementation branch**: `feat/issue-758-inline-spreadsheet-editor`
- **Status**: Approved for implementation

## Context

Issue #756 and PR #757 introduced Phase P3C bulk text entry on top of the
technical-configuration baseline editor:

- a UI-independent multiline parser;
- row-level preview and validation;
- local-only accept into the selected group;
- cancel without draft mutation;
- explicit persistence through the existing page-level `Lưu` action.

The current bulk-entry UI is a dialog. Issue #758 replaces that overlay-driven
workflow with an inline desktop workflow that preserves the dossier, selected
group, local draft, and working position.

The existing editor already supports:

- editable group names;
- ordered criteria with code, optional title, and required requirement text;
- group and criterion add, move, and delete actions;
- local dirty state, validation, save conflicts, and explicit save.

This design changes presentation and local interaction state only. It does not
change the parser, baseline data contract, persistence contract, database, or
OpenSpec phase boundaries.

## Approved decisions

1. Use a **spreadsheet-lite** layout rather than the hierarchy mockup.
2. Each selected group has two input modes:
   - `Chỉnh từng dòng`
   - `Nhập nhiều dòng`
3. Only one selected group is editable at a time.
4. Add a read-only `Xem tất cả nhóm` overview for cross-group review.
5. Bulk entry is inline. Do not open a dialog, sheet, drawer, or new route.
6. Bulk mode replaces the criteria spreadsheet in the same work surface. Do
   not render two data tables at the same time.
7. Bulk buffers live in React state keyed by group. Do not use `localStorage`
   or backend persistence.
8. Switching mode or group preserves that group's bulk buffer.
9. Reloading, closing the page, or using the workspace's `Danh sách hồ sơ`
   action may discard bulk buffers. The existing `beforeunload` and workspace
   back-button protections must use the combined unsafe state.
10. A non-empty unaccepted bulk buffer disables `Lưu` and shows an inline
    explanation.
11. `Hủy nhập` clears only the selected group's bulk buffer.
12. Successful accept appends rows to the selected local group, clears its
    buffer, returns to row mode, focuses the first appended row, and highlights
    the newly added rows.
13. The page-level `Lưu` action remains the only persistence action.
14. `Escape` does not cancel inline bulk entry. Cancellation requires the
    explicit `Hủy nhập` command.

## Goals

1. Make repeated desktop data entry faster and easier to scan.
2. Keep the selected group and persistence boundary visible throughout entry.
3. Reuse the P3C parser and editor-state helpers without changing their
   contracts unless a test proves a defect.
4. Preserve all existing explicit-save, validation, conflict, and pending-save
   behavior.
5. Keep source files below repository size limits by extracting focused
   components and state helpers.
6. Cover keyboard, focus, buffer preservation, save gating, and persistence
   boundaries with TDD regression tests.

## Non-goals

- A full spreadsheet engine with cell selection, multi-cell paste, column
  resize, formulas, or virtualization.
- New criterion fields such as type, unit, minimum, maximum, range, supplier,
  product, evidence, or AI output.
- Autosave or persistence of bulk-entry buffers.
- Mobile or responsive expansion. The module remains desktop-only.
- Baseline locking, version history, supplier options, comparison responses, or
  later OpenSpec phases.
- SQL migrations, Supabase changes, or live database writes.
- Using criterion or group display names as database keys.
- A global Next.js App Router blocker for sidebar links, browser history, or
  arbitrary programmatic navigation. The current module has no such shared
  infrastructure; #758 extends only the existing `beforeunload` and
  `Danh sách hồ sơ` protection surfaces.

## UX design

### Editor header

Keep the existing editor header and persistence controls:

- `Bản nháp cấu hình cơ sở`
- `Bản nháp` badge
- `Có thay đổi chưa lưu` / `Đã lưu` status
- `Thêm nhóm`
- page-level `Lưu`

The header remains visually separate from mode-specific actions. Do not add a
second save action inside the spreadsheet or bulk workbench.

### Group navigator

Render a compact horizontal navigator above the work surface:

- one item per group, using the editable group name;
- fallback label `Nhóm {index}` while a group name is blank;
- criterion count;
- validation-error indicator when relevant;
- selected state;
- final item labeled `Xem tất cả nhóm`.

Selecting a group changes only the active working context. It must not mutate
the draft, clear buffers, save, or reset scroll unnecessarily.

Use an accessible horizontal tab-list pattern. `ArrowLeft` and `ArrowRight`
move between items; `Home` and `End` move to the first and last item. Activating
`Xem tất cả nhóm` enters the overview without clearing the last selected group
or its mode.

Initial selection is the first group in draft order. Loading a draft with no
groups produces no selected group and focuses nothing automatically.

### Selected-group toolbar

For a selected group, show:

- group order;
- editable group-name input;
- move up, move down, and delete icon buttons;
- segmented mode control:
  - `Chỉnh từng dòng`
  - `Nhập nhiều dòng`

The selected group name remains visible in both modes.

### `Chỉnh từng dòng`

Render a spreadsheet-like table for the selected group only.

Columns are limited to the current data contract:

1. order;
2. `Mã`;
3. optional `Tiêu đề`;
4. required `Nội dung yêu cầu`;
5. validation status;
6. compact row actions.

Requirements:

- multiline requirement text wraps and remains directly editable;
- existing codes render as `TC-xxxx`; local unsaved criteria render `Mới`;
- validation errors render next to the affected editable field;
- row actions remain move up, move down, and delete;
- `Thêm tiêu chí` appears once below the table;
- newly accepted bulk rows receive a restrained temporary highlight;
- table dimensions and columns remain stable while editing and validating.

The `Mới` code badge and `Mới thêm` overview filter derive from the existing
`criterion.id === null` state. Temporary post-accept highlighting uses a
separate set of criterion keys and must not define persistence semantics.

### `Nhập nhiều dòng`

Bulk mode replaces the row spreadsheet inside the same selected-group work
surface.

Show:

- compact summary such as `67 tiêu chí hiện có trong bản nháp`;
- multiline textarea labeled `Nội dung nhập nhanh`;
- preview table labeled `Xem trước`;
- preview columns:
  - `Dòng`
  - `Nội dung yêu cầu`
  - `Trạng thái`
- persistent summary such as `8 dòng, 1 dòng có lỗi`;
- commands:
  - `Hủy nhập`
  - `Xem trước`
  - `Thêm vào bản nháp`

Parser semantics remain unchanged:

- preserve Vietnamese Unicode;
- normalize supported whitespace;
- ignore outer blank lines;
- report invalid internal blank rows with source line numbers;
- invalidate stale preview when input changes;
- block accept while any preview row is invalid.

Accept appends requirement text only. It does not infer or create titles,
units, ranges, types, or any other metadata.

### `Xem tất cả nhóm`

This is a read-only review view, not a third input mode.

Render all groups in order with:

- group headings;
- criterion count and validation-error count;
- columns `Mã`, `Tiêu đề`, `Nội dung yêu cầu`, and `Trạng thái`;
- filters:
  - `Tất cả`
  - `Có lỗi`
- `Mới thêm`

Clicking a criterion switches to its group in `Chỉnh từng dòng` and focuses
that row. Editing is not available directly in the overview.

Entering the overview focuses its heading or first filter without changing the
last selected group. Leaving through a criterion always enters row mode.

## Local state model

`TechnicalConfigurationBaselineTab` is the single integration owner. It calls
the existing baseline data/save hook, calls the new transient interaction-state
hook, computes the combined unsafe/save predicates, and passes presentation
state and callbacks into `TechnicalConfigurationBaselineEditor`.

Extracted visual components remain controlled and do not own cross-mode or
cross-group state.

Conceptual shape:

```ts
type BulkEntrySession = {
  input: string
  preview: TechnicalConfigurationBulkEntryPreview | null
}

type BaselineEditorViewState = {
  activeView: { kind: "group"; groupKey: string | null } | { kind: "all-groups" }
  activeMode: "row" | "bulk"
  bulkSessionsByGroup: Record<string, BulkEntrySession>
  recentlyAcceptedCriterionKeys: ReadonlySet<string>
}
```

Implementation may adjust the exact representation, but it must preserve these
contracts:

- buffers are keyed by stable local group key;
- mode and group switches do not clear buffers;
- input changes invalidate only that group's stale preview;
- cancel and successful accept clear only that group's session;
- removed groups also remove orphaned bulk sessions;
- overview navigation does not mutate editor data;
- recently accepted highlights are local UI state, not persisted data.

`activeMode` may remain global across groups. Switching groups while bulk mode
is active loads the target group's corresponding buffer.

`recentlyAcceptedCriterionKeys` is replaced by each successful bulk accept.
The accept-driven bulk-to-row transition is explicitly exempt from highlight
cleanup. The set is cleared only on a subsequent manual group change, manual
mode change, overview entry, successful save, server reload, draft replacement,
or deletion of an affected criterion/group. The `Mới thêm` overview filter does
not use this set; it uses `criterion.id === null`, so it naturally clears after
successful save returns persisted criterion IDs.

## Dirty state and save gating

There are two independent local states:

1. editor draft changes that are eligible for persistence;
2. unaccepted bulk input that is not eligible for persistence.

The page is considered unsafe to leave when either state exists.

Exact predicates:

```ts
const hasPendingBulkInput = Object.values(bulkSessionsByGroup).some(
  (session) => normalizeTechnicalConfigurationBulkEntryText(session.input).length > 0
)

const isUnsafeToLeave = baseline.isDirty || hasPendingBulkInput
```

Add and test a pure exported
`hasTechnicalConfigurationBulkEntryInput(input)` helper in
`bulk-entry-utils.ts`, implemented with
`normalizeTechnicalConfigurationBulkEntryText(input).length > 0`. Use that
helper for the predicate above, preview-button availability, save blocking, and
unsafe-navigation state. Empty, whitespace-only, and zero-width-only input do
not count as pending input.

Save behavior:

- no bulk buffer: preserve existing `isDirty`, conflict, and pending-save
  rules;
- any non-empty bulk buffer: disable `Lưu`;
- show:
  `Hãy thêm nội dung vào bản nháp hoặc hủy phần nhập nhiều dòng trước khi lưu.`
- accept or cancel recomputes save availability immediately;
- save failure does not clear the local draft or any unrelated group buffer;
- while save is pending, disable both row editing and bulk-entry actions.

Header status precedence:

1. pending bulk input:
   `Có nội dung nhập chưa thêm vào bản nháp`
2. accepted draft changes:
   `Có thay đổi chưa lưu`
3. no local changes:
   `Đã lưu`

`TechnicalConfigurationBaselineTab` reports `isUnsafeToLeave` through the
existing `onDirtyChange` callback. The workspace `Danh sách hồ sơ` action
therefore uses the combined state. The tab also registers `beforeunload` from
the combined state, covering reload, browser close, and full-document
navigation.

Do not add a generic capture-phase link interceptor, `popstate` workaround, or
global App Router blocker in this issue. Generic client-side navigation outside
the workspace's explicit back action remains an existing application-wide gap.

Internal group and mode switches do not show confirmation.

Navigator and overview error counts derive from the pure
`validateTechnicalConfigurationBaselineEditorDraft(editorDraft)` result on the
current local draft. Field-level error-message visibility retains the existing
save-attempt behavior so #758 does not introduce eager field errors while the
user is typing.

## State transition contract

| Event                                                   | Buffer behavior                                                                                        | Resulting view/mode                                                                          | Focus target                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Enter `Nhập nhiều dòng`                                 | Preserve selected-group session                                                                        | Selected group, bulk mode                                                                    | `Nội dung nhập nhanh` textarea                                                                                    |
| Manually switch to `Chỉnh từng dòng`                    | Preserve buffer and keep `Lưu` blocked                                                                 | Selected group, row mode                                                                     | First invalid requirement textarea, otherwise first requirement textarea, otherwise `Thêm tiêu chí`               |
| `Hủy nhập`                                              | Clear selected-group input and preview only                                                            | Selected group, row mode                                                                     | `Nhập nhiều dòng` mode trigger                                                                                    |
| Successful accept                                       | Append rows, clear selected-group session, replace recent-highlight keys                               | Selected group, row mode                                                                     | First appended requirement textarea                                                                               |
| Switch group                                            | Preserve every group session; load target session                                                      | Target group, current mode                                                                   | Activated group tab; entering bulk by keyboard then follows normal textarea focus                                 |
| Enter `Xem tất cả nhóm`                                 | Preserve all sessions and last selected group/mode                                                     | All-groups overview                                                                          | Overview `<h2 tabIndex={-1}>`                                                                                     |
| Activate overview criterion                             | Preserve all sessions                                                                                  | Criterion group, row mode                                                                    | Criterion requirement textarea                                                                                    |
| Add group                                               | Create no buffer                                                                                       | New group, row mode                                                                          | New group-name input                                                                                              |
| Delete group with pending buffer                        | Do not delete; control uses `aria-disabled="true"` and a blocked handler rather than native `disabled` | Unchanged                                                                                    | Delete button remains focusable and references the persistent pending-buffer explanation with `aria-describedby`  |
| Delete group without pending buffer                     | Remove group/session/highlight keys                                                                    | Group now occupying the deleted index, otherwise previous group, otherwise no selected group | Fallback group tab; if none, `Thêm nhóm`                                                                          |
| Add criterion                                           | No buffer change                                                                                       | Selected group, row mode                                                                     | New criterion requirement textarea                                                                                |
| Delete criterion                                        | Remove key from recent-highlight set                                                                   | Selected group, row mode                                                                     | Next requirement textarea at the same index, otherwise previous textarea, otherwise `Thêm tiêu chí`               |
| Save success                                            | Sessions are already empty because save is gated; clear recent highlights                              | Preserve selected group and mode                                                             | Existing `Lưu` button behavior                                                                                    |
| Automatic query refresh while any local state is unsafe | Do not replace base/editor draft                                                                       | Unchanged                                                                                    | Unchanged                                                                                                         |
| Conflict reload with any pending bulk input             | Do not reload; control uses `aria-disabled="true"` and a blocked handler rather than native `disabled` | Unchanged                                                                                    | Reload control remains focusable and references the persistent pending-buffer explanation with `aria-describedby` |
| Approved conflict/server reload                         | Clear transient sessions and highlights                                                                | First group in row mode, or empty state                                                      | First group tab, otherwise empty-state action                                                                     |

The delete/reload restrictions deliberately avoid introducing another dialog.
Dialogs remain reserved for the existing workspace-level confirmation when
leaving with unsafe local state.

## Component boundaries

`TechnicalConfigurationBaselineEditor.tsx` is already near the repository's
350-line extraction threshold. The inline workflow must not expand it into a
multi-responsibility file.

Proposed boundaries:

```text
_components/
  TechnicalConfigurationBaselineEditor.tsx
  TechnicalConfigurationGroupNavigator.tsx
  TechnicalConfigurationCriteriaSpreadsheet.tsx
  TechnicalConfigurationBulkEntryWorkbench.tsx
  TechnicalConfigurationAllGroupsOverview.tsx
  TechnicalConfigurationBaselineEditorControls.tsx

_hooks/
  useTechnicalConfigurationBaselineEditor.ts
  useTechnicalConfigurationBulkEntrySessions.ts
```

Responsibilities:

- `TechnicalConfigurationBaselineEditor`: presentation composition and editor
  callbacks only.
- `TechnicalConfigurationGroupNavigator`: group selection and overview entry.
- `TechnicalConfigurationCriteriaSpreadsheet`: row-mode presentation and row
  actions.
- `TechnicalConfigurationBulkEntryWorkbench`: buffer, preview, and accept/cancel
  presentation driven by passed state and callbacks.
- `TechnicalConfigurationAllGroupsOverview`: read-only flattening, filtering,
  and jump callbacks.
- `useTechnicalConfigurationBulkEntrySessions`: group-keyed transient state,
  stale-preview invalidation, save-blocking predicate, and cleanup.

`TechnicalConfigurationBaselineTab` owns:

- `activeView`, `activeMode`, and selection transitions;
- integration between editor draft and transient sessions;
- `isUnsafeToLeave`;
- reporting the combined state through `onDirtyChange`;
- the combined `beforeunload` listener;
- save and server-reload gating.

The data/save hook continues to own queries, draft/base draft, validation shown
after save attempts, mutations, conflicts, and persistence. Its current
draft-replacement and dirty-reporting effects must be adjusted so the tab is
the only combined-state owner.

Remove `TechnicalConfigurationBulkEntryDialog.tsx` after all consumers and
tests move to the inline workbench.

Before adding shared logic, run the repository's semantic duplicate check
workflow to confirm that no equivalent group navigator, transient editor
session hook, or spreadsheet row abstraction already exists.

## Data flow

### Row mode

```text
editable cell
  -> existing immutable editor-state helper
  -> local editor draft
  -> validation + dirty state
  -> explicit Lưu
  -> existing save hook/RPC flow
```

### Bulk mode

```text
textarea input
  -> group-keyed transient buffer
  -> existing parser on Xem trước
  -> preview rows + validation
  -> existing append helper on Thêm vào bản nháp
  -> local editor draft
  -> row mode + focus/highlight
  -> explicit Lưu
  -> existing save hook/RPC flow
```

Preview, cancel, mode changes, group changes, and overview navigation perform
zero backend mutations.

## Error handling

- Parser errors stay row-specific and block accept.
- Empty or zero-width-only input keeps `Xem trước` disabled, matching P3C.
- Editing input after preview invalidates the stale preview.
- Validation errors in row mode remain attached to their criterion.
- Save conflict handling remains owned by the existing baseline editor hook and
  tab.
- Save failure preserves all accepted draft edits.
- A group with pending bulk input cannot be deleted until that input is
  accepted or canceled.
- A removed selected group selects the group now occupying the deleted index;
  if none exists, it selects the previous group; if no groups remain, selection
  becomes null.
- Automatic query refresh cannot replace the editor draft while
  `isUnsafeToLeave` is true.
- Conflict/server reload is disabled while any bulk buffer is pending. An
  approved reload clears all transient interaction state and selects the first
  server group in row mode.
- If no groups remain, show the existing empty-editor action rather than an
  empty spreadsheet shell.

## Accessibility and keyboard behavior

- Group navigator uses the existing Radix-backed Tabs primitive as a horizontal
  tab list, including `ArrowLeft`, `ArrowRight`, `Home`, and `End` behavior.
- The mode control uses a separate Tabs instance as a two-item segmented
  single-selection control with `activationMode="manual"`. Arrow keys move tab
  focus; `Enter` or `Space` activates the mode and then applies the transition
  table's work-surface focus. It exposes the selected mode without relying on
  color.
- Entering bulk mode focuses `Nội dung nhập nhanh`.
- Preview status uses a persistent polite live region.
- The preview table/region is keyboard-scrollable.
- Accept is disabled and references the preview status while validation fails.
- Successful accept returns to row mode and focuses the first appended
  requirement textarea.
- Overview row activation focuses the destination requirement textarea.
- Entering `Xem tất cả nhóm` focuses an overview `<h2 tabIndex={-1}>`; it does
  not ambiguously choose between the heading and filters.
- Icon-only move/delete actions keep descriptive labels and tooltips.
- Pending-buffer delete/reload controls remain keyboard-focusable with
  `aria-disabled`, blocked handlers, and `aria-describedby`; do not apply native
  `disabled` or `pointer-events-none` to those controls.
- `Escape` does not cancel inline bulk mode.
- Focus order remains header actions, group navigator, selected-group toolbar,
  work surface, and work-surface actions.
- All remaining focus destinations follow the state-transition table.

## Layout and visual verification

- The module remains hidden from mobile navigation as established by P3C.
- At desktop widths of 1280px and above, the page shell must not create
  document-level horizontal overflow. The spreadsheet may use its own
  `overflow-x-auto` container with an explicit minimum table width.
- Spreadsheet columns use explicit grid/table sizing so validation messages,
  icon actions, and multiline text do not resize unrelated columns.
- The table header remains sticky inside the spreadsheet scroll container.
- Group/mode switches do not call `scrollTo` or reset outer-page scroll.
- Accept and overview jump may use `scrollIntoView({ block: "nearest" })` only
  for the exact focused requirement textarea.
- Recently accepted rows expose a stable data attribute for tests and use a
  restrained background/border treatment that clears according to the state
  lifecycle, not an untestable timer.
- Browser verification captures 1280x800, 1440x900, and 1920x1080 screenshots
  for row mode, bulk mode, validation error, and all-groups overview. Checks
  cover text overlap, table overflow, focus visibility, and disabled-save copy.

## TDD strategy

### Layer 1 - transient state hook

- adds `hasTechnicalConfigurationBulkEntryInput` unit coverage for normal,
  whitespace-only, and zero-width-only input;
- initializes row mode with empty per-group sessions;
- initializes selection to the first group, or null for an empty draft;
- preserves separate buffers across group switches;
- preserves buffer across row/bulk mode switches;
- invalidates only the edited group's stale preview;
- clears only the selected group on cancel or accept;
- removes orphaned sessions when a group is deleted;
- reports whether any parser-meaningful non-empty buffer blocks save/navigation;
- keeps zero-width-only input from blocking save;
- clears recent highlight state on every lifecycle event defined by the
  transition table.

### Layer 2 - spreadsheet component

- renders only the selected group's criteria;
- edits optional title and required multiline requirement text;
- exposes existing move/delete callbacks;
- renders `Mới` for local unsaved criteria;
- renders validation errors;
- renders and clears new-row highlight without changing data.

### Layer 3 - inline bulk workbench

- focuses textarea on entry;
- previews valid and invalid rows with source line numbers;
- disables preview for empty and zero-width-only input;
- invalidates stale preview after input changes;
- cancel clears only buffer and leaves draft unchanged;
- accept is blocked on invalid preview;
- accept appends requirement text only;
- controls are disabled while explicit save is pending;
- no dialog role or overlay primitive is rendered.

### Layer 4 - editor integration

- group navigator preserves selected group and local draft;
- switching modes preserves group buffer;
- switching groups preserves independent buffers;
- adding a group selects it and focuses its name;
- group deletion follows the deterministic fallback contract;
- group deletion and conflict reload are disabled while affected bulk buffers
  are pending;
- non-empty bulk buffer disables `Lưu` with exact inline explanation;
- accept returns to row mode, focuses the first new row, and highlights appended
  rows;
- `Xem tất cả nhóm` is read-only;
- overview filters work;
- overview row activation returns to the correct group and row;
- blank group names use the `Nhóm {index}` navigator fallback;
- removing the final group focuses `Thêm nhóm`;
- mode tabs use manual activation, so arrow navigation alone does not change
  mode or move focus into the work surface;
- pending-buffer delete/reload controls remain focusable, expose
  `aria-disabled`, and block destructive callbacks.

### Layer 5 - persistence and navigation regression

- preview, cancel, mode switch, group switch, and accept call no RPC;
- only explicit `Lưu` persists accepted draft changes;
- unaccepted bulk input is never included in save payloads;
- save pending blocks row and bulk editing;
- `beforeunload` and workspace `Danh sách hồ sơ` guard see accepted draft
  changes and parser-meaningful bulk buffers;
- internal mode/group switching does not show the guard.

### Existing regression coverage

Keep parser unit tests and baseline save/conflict tests intact. Update dialog-
specific tests to assert the inline workbench while preserving all P3C
semantics.

## Verification

For the TypeScript/React diff, run in repository order:

1. `node scripts/npm-run.js run format:check`
2. `node scripts/npm-run.js run verify:no-explicit-any`
3. `node scripts/npm-run.js run verify:dedupe`
4. `node scripts/npm-run.js run typecheck`
5. focused Vitest files for editor state, spreadsheet, bulk workbench, baseline
   tab, save, and navigation protection
6. `node scripts/npm-run.js run react-doctor`
7. `openspec validate add-technical-configuration-comparison --strict`
8. Start the local dev server and use the Vercel `agent-browser` verification
   workflow at 1280x800, 1440x900, and 1920x1080. Capture row mode, bulk mode,
   invalid preview, and all-groups overview. Assert:
   - `document.documentElement.scrollWidth === document.documentElement.clientWidth`
     at each viewport;
   - group/mode switches preserve outer scroll position;
   - the spreadsheet header remains sticky inside its scroll container;
   - accept/overview focus targets are visible;
   - pending-buffer delete/reload controls are focusable and announced as
     unavailable;
   - disabled-save explanation and validation text do not overlap controls.

Use the `code-deduplication` skill before commit because the change introduces
new reusable components and a transient-state hook. Use React Doctor through
the repository script so Node 22 remains isolated.

## Implementation order

0. Keep #758 as a stacked branch/PR based on
   `feat/issue-756-technical-config-p3c-bulk-entry` while PR #757 remains open.
   Target the stacked PR at that branch, not `main`. After #757 merges, fetch
   `main`, rebase #758 onto the merged commit, retarget the PR to `main`, and
   rerun every required verification gate before merge.
1. Add failing tests for transient per-group buffers and save-blocking state.
2. Add failing integration tests for spreadsheet mode, inline bulk mode, focus,
   overview, and persistence boundaries.
3. Extract the selected-group spreadsheet from the existing editor without
   changing behavior.
4. Replace the bulk-entry dialog with the inline workbench and transient state
   hook.
5. Add group navigator and read-only `Xem tất cả nhóm`.
6. Remove obsolete dialog code and update adoption/regression tests.
7. Run focused checks, full required gates, review the diff, commit, push, and
   update PR/issue status.

## Rollback

The change is frontend-only. Reverting the implementation commits restores the
dialog workflow. No database state, migrations, or persisted buffer data need
rollback.

## Stitch references

- Approved row-mode mockup:
  `Issue 758 - Spreadsheet-lite - Chỉnh từng dòng`
  (`08926ffc6ead4546bf5ad3c93861fbf4`)
- Approved inline bulk-mode mockup:
  `Issue 758 - Spreadsheet-lite - Nhập nhiều dòng`
  (`1b9a2e89b197419187c3195deae45b62`)
- Stitch project: `15308531586654760571`
- Design system: `assets/5915840001267045529`

The mockups are layout references. Existing code and this specification remain
the behavioral source of truth.

## Open questions

None. The workflow decisions required for implementation were approved during
brainstorming on 2026-07-13.
