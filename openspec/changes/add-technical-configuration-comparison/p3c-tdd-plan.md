# P3C TDD Plan - Bulk Text Entry

## Scope Boundary

Deliver only OpenSpec Phase P3C on top of PR #755 (`9f1d976b`):

- open bulk entry from the selected baseline group
- parse one candidate criterion per pasted line in a UI-independent helper
- preserve Vietnamese Unicode and trim surrounding whitespace on accepted text
- ignore blank lines before the first and after the last non-blank line
- keep blank lines between non-blank rows as row-level validation errors
- preview every retained source row before applying changes
- cancel without changing the editor draft
- accept only an error-free preview into local editor state
- keep persistence behind the existing explicit `Lưu` action

Excluded:

- autosave or persistence from the dialog or preview
- P4 versioning, lock, copy, or history behavior
- migrations, Supabase changes, and live DB writes
- Excel import or other P5B-P5D behavior
- parser rules not required by P3C, including bullets, numbering, or duplicate detection

## Assumptions And Design

1. Each retained source line maps to one criterion `requirementText`; `title` remains empty and the backend assigns the criterion code during explicit save.
2. The parser returns source line numbers, normalized text, and an optional validation error so the dialog does not duplicate parsing rules.
3. Leading and trailing blank lines are discarded. An internal blank line remains in preview with `Nội dung yêu cầu là bắt buộc.` and disables accept.
4. The dialog owns only transient paste/preview state. Closing or cancelling resets that state and never calls the editor callback.
5. Accept passes normalized valid texts to the editor and closes the dialog. The editor immutably appends local unsaved criteria to the selected group.
6. The existing hook, save workflow, query cache, RPC layer, and locked placeholder remain unchanged.

## Planned Files

- Create: `src/app/(app)/technical-configurations/bulk-entry-utils.ts`
- Create: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBulkEntryDialog.tsx`
- Create: `src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry-utils.test.ts`
- Create: `src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx`
- Modify: `src/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEditor.tsx`
- Modify: `src/app/(app)/technical-configurations/technical-configuration-baseline-editor-state.ts`
- Modify: `src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-editor-state.test.ts`
- Modify: `openspec/changes/add-technical-configuration-comparison/tasks.md`

## RED Tests

### Parser

- parses LF and CRLF input into ordered rows with original source line numbers
- trims non-blank text while preserving Vietnamese Unicode
- ignores blank rows only at the beginning and end
- retains internal blank rows with a row-level required-text error
- reports whether the preview can be accepted

### Local Editor State

- appends multiple unsaved criteria to only the selected group
- keeps the previous draft immutable
- writes normalized requirement text while leaving title/code/ID empty

### Dialog And Editor Integration

- opens bulk entry from the selected group
- previews valid and invalid source rows before applying
- disables accept while an internal blank row is invalid
- cancel leaves rendered draft values and dirty state unchanged
- accept appends criteria to the selected group only
- accepted bulk entry marks the editor dirty but calls no create/update/reorder RPC
- persistence starts only after the existing `Lưu` button is clicked

## TDD Sequence

1. Add parser and local-state tests. Run focused Vitest and confirm failures are caused by missing P3C exports.
2. Add dialog/editor integration tests. Run focused Vitest and confirm the bulk entry control is missing.
3. Implement the minimal parser and immutable local-state helper.
4. Implement the dialog with transient input/preview state and row validation.
5. Wire one thin dialog trigger into each group in the existing editor.
6. Refactor only if needed to keep source files below the 350-line extraction threshold.
7. Update P3C task checkboxes after all focused tests and regressions pass.

## Verification

Run in this order:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry-utils.test.ts' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-editor-state.test.ts' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-bulk-entry.test.tsx' \
  'src/app/(app)/technical-configurations/__tests__/technical-configuration-baseline-tab.test.tsx'
node scripts/npm-run.js run react-doctor
openspec validate add-technical-configuration-comparison --strict
```

Expected result:

- all commands exit `0`
- no explicit `any` or changed-file duplication findings
- focused Vitest proves parser, preview, cancel, selected-group accept, and no-autosave behavior
- React Doctor reports no new actionable issue in the changed React scope
- OpenSpec strict validation passes

## Delivery

- GitHub issue: `#756`
- Branch: `feat/issue-756-technical-config-p3c-bulk-entry`
- Open one PR limited to P3C and link `Closes #756`
- Do not apply migrations or write to the live database
