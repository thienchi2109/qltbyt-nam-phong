# P3B TDD Plan - Manual Baseline Editor And Save Conflicts

**Issue:** #754
**Branch:** `feat/754-technical-configuration-p3b`
**Base:** current `main` at `f64256c`

## Scope Boundary

Deliver only OpenSpec Phase P3B:

- vertical two-level group/criterion editor
- editable suggested groups plus additional groups
- group/criterion create, edit, delete, and reorder
- multiline criterion requirements
- explicit `Lưu` with visible `Đang lưu...` pending state
- dirty navigation warning
- validation, persistence, and optimistic-conflict preservation
- integration into the `Cấu hình cơ sở` tab

Excluded:

- autosave
- schema builder or custom content columns
- P3C bulk text entry
- migrations or live database writes
- lock/version lifecycle beyond a read-only placeholder

## File Boundaries

- `technical-configuration-rpc.ts`: expose the existing module-local typed RPC adapter for baseline RPC reuse.
- `_hooks/useTechnicalConfigurationBaseline.ts`: route P2 wrappers through the module adapter.
- `technical-configuration-baseline-editor.ts`: editor data model, validation, ordered diff planning, revision chaining, and partial-progress save errors.
- `_hooks/useTechnicalConfigurationBaselineEditor.ts`: draft query/create/save state and dirty/conflict handling.
- `_components/TechnicalConfigurationBaselineTab.tsx`: loading, empty, error, locked placeholder, and editor composition.
- `_components/TechnicalConfigurationBaselineEditor.tsx`: group/criterion fields and controls only.
- `_components/TechnicalConfigurationWorkspaceShell.tsx`: thin dirty-leave guard and baseline tab integration.
- focused tests under `__tests__/`.

## Task 1 - Freeze Editor And RPC Contracts

- [x] Write failing tests proving baseline RPCs use the module-local metadata-preserving adapter.
- [x] Write failing pure tests for editor conversion, validation, reorder, and operation ordering.
- [x] Run focused tests and confirm RED for missing P3B modules/exports.
- [x] Implement the minimum types and pure helpers.
- [x] Run focused tests and confirm GREEN.

## Task 2 - Save Runner And Partial Failure

- [x] Write failing tests for revision chaining across create/update/delete/reorder operations.
- [x] Write a failing test where an early operation succeeds and a later persistence error occurs.
- [x] Assert the returned progress maps created server IDs and preserves all local form values for retry.
- [x] Write a failing stale-revision test that marks the result as conflict without discarding local input.
- [x] Implement the minimum save runner and typed progress error.
- [x] Run focused tests and confirm GREEN.

## Task 3 - Baseline Tab And Editor UI

- [x] Write failing React tests for the four server-provided groups, multiline text, add/delete, and arrow-button reorder.
- [x] Assert no mutation runs before explicit `Lưu`.
- [x] Assert the pending button label is exactly `Đang lưu...`.
- [x] Assert validation and persistence errors keep edited inputs.
- [x] Assert conflict keeps edited inputs and blocks another save until explicit reload.
- [x] Assert no-draft state creates only from an explicit action.
- [x] Implement the baseline tab, hook, and editor components.
- [x] Run focused tests and confirm GREEN.

## Task 4 - Workspace Integration And Leave Guard

- [x] Write a failing React test for dirty dossier-back confirmation.
- [x] Write a failing source-boundary test for thin client/shell and extracted baseline files.
- [x] Integrate the baseline tab without moving query or mutation logic into the shell.
- [x] Add `beforeunload` protection while dirty.
- [x] Run focused tests and confirm GREEN.

## Task 5 - Verification And Closeout

- [x] Run formatting, TypeScript gates, focused tests, and React Doctor in repository order.
- [x] Run Chromium component verification for long Vietnamese multiline content, reorder, save pending, conflict-state retention, and desktop/mobile layout; cover group add/edit and generic save errors in focused React tests.
- [x] Run Code Review Graph and GitNexus change-impact review.
- [x] Mark only P3B tasks complete in `tasks.md`.
- [ ] Commit, pull with rebase, push, update/close issue #754, and verify the branch is up to date.
