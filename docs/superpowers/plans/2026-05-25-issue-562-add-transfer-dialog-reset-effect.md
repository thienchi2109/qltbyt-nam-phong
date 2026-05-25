# Issue 562 AddTransferDialog Reset Effect TDD Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluate and, if safe, remove the `AddTransferDialog` reset-on-close `useEffect` flagged by React Doctor while preserving close/reset behavior.

**Architecture:** Keep the fix issue-scoped. The current production orchestrator already conditionally mounts `AddTransferDialog` only when `isAddDialogOpen` is true, so the smallest viable refactor is to prove close paths unmount/remount the dialog and then remove the child effect. Do not introduce shared dialog state or broaden transfer dialog abstractions.

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library, TanStack Query, React Doctor.

---

## Context

- Issue: #562, open.
- Warning: `react-doctor/no-event-handler` at `src/components/add-transfer-dialog.tsx:61`.
- Current effect:

```tsx
React.useEffect(() => {
  if (!open) {
    dispatch({ type: "RESET" })
  }
}, [open])
```

- Current production parent already gates the component:

```tsx
{isAddDialogOpen && (
  <AddTransferDialog
    open={isAddDialogOpen}
    onOpenChange={onAddDialogOpenChange}
    onSuccess={onAddSuccess}
  />
)}
```

- GitNexus impact checked before planning:
  - `AddTransferDialog`: LOW, 0 upstream graph impacts.
  - `TransfersDialogs`: LOW, 0 upstream graph impacts.

## Scope

**Modify only if tests prove the behavior:**
- `src/components/add-transfer-dialog.tsx`
- `src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx`
- Maybe `src/app/(app)/transfers/__tests__/TransfersDialogs.test.tsx` if a parent conditional-render assertion is missing.

**Do not touch:**
- RPC payload builders or DB code.
- Transfer detail/edit dialogs.
- Shared `SideSheetShell` API.
- Broader React Doctor baseline findings.

## Required Skills During Execution

- Use `vercel-react-best-practices` before editing React/TSX.
- Use `superpowers:test-driven-development`; no production change before a failing proof.
- Use `karpathy-coding-heuristics` as the scope guard.
- `code-deduplication` is not required unless implementation adds new reusable helpers.

## Plan

### Task 1: Branch And Baseline

**Files:** none.

- [ ] Create branch from current `main`.

```bash
git checkout -b issue-562-add-transfer-reset-effect
```

- [ ] Confirm current warning still reproduces before touching code.

Run via `ctx_batch_execute`:

```bash
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected: reports `react-doctor/no-event-handler` for `src/components/add-transfer-dialog.tsx`.

### Task 2: RED - Characterize Reset On Parent/External Close

**Files:**
- Modify: `src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx`

- [ ] Add a focused harness in the side-sheet test file:

```tsx
function AddTransferDialogHarness() {
  const [open, setOpen] = React.useState(true)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        reopen add transfer
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        external close add transfer
      </button>
      {open ? (
        <AddTransferDialog
          open={open}
          onOpenChange={setOpen}
          onSuccess={vi.fn()}
        />
      ) : null}
    </>
  )
}
```

- [ ] Add test: fills a visible field, closes externally, reopens, and expects the field to be reset.

Preferred field: reason textarea labelled `Lý do luân chuyển *`, because it avoids equipment-search/network timing.

```tsx
it("resets draft state when the parent closes and remounts the add transfer sheet", async () => {
  const user = userEvent.setup()

  render(<AddTransferDialogHarness />, { wrapper: createWrapper() })

  await user.type(screen.getByLabelText("Lý do luân chuyển *"), "Draft reason")
  expect(screen.getByLabelText("Lý do luân chuyển *")).toHaveValue("Draft reason")

  await user.click(screen.getByRole("button", { name: "external close add transfer" }))
  await user.click(screen.getByRole("button", { name: "reopen add transfer" }))

  expect(screen.getByLabelText("Lý do luân chuyển *")).toHaveValue("")
})
```

- [ ] Prove the test can fail before changing production code by mutation-checking the test setup:
  - Temporarily remove the conditional mount in the harness and keep `<AddTransferDialog open={open} ... />` always mounted.
  - Temporarily remove or neutralize the reset effect locally.
  - Run the focused test and confirm it fails because the draft value remains.
  - Revert the temporary mutation before implementation.

Run:

```bash
node scripts/npm-run.js run test:run -- src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx -t "resets draft state"
```

Expected RED: fails with the textarea still containing `Draft reason` under the mutated no-reset path.

### Task 3: RED - Lock Footer Cancel And Sheet Close Path

**Files:**
- Modify: `src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx`

- [ ] Extend the local `SideSheetShell` mock to expose a close control that calls `onOpenChange(false)` if it does not already.

```tsx
<button type="button" onClick={() => onOpenChange(false)}>
  close add transfer sheet
</button>
```

- [ ] Add one parameterized test for close actions:

```tsx
it.each([
  ["footer cancel", "Hủy"],
  ["sheet close", "close add transfer sheet"],
])("resets draft state after %s closes the sheet", async (_label, buttonName) => {
  const user = userEvent.setup()

  render(<AddTransferDialogHarness />, { wrapper: createWrapper() })

  await user.type(screen.getByLabelText("Lý do luân chuyển *"), "Draft reason")
  await user.click(screen.getByRole("button", { name: buttonName }))
  await user.click(screen.getByRole("button", { name: "reopen add transfer" }))

  expect(screen.getByLabelText("Lý do luân chuyển *")).toHaveValue("")
})
```

- [ ] Run the same mutation proof as Task 2.

Expected RED: fails when the dialog stays mounted and no reset path exists.

### Task 4: GREEN - Remove The Effect If Parent Remount Covers Behavior

**Files:**
- Modify: `src/components/add-transfer-dialog.tsx`

- [ ] Remove only the reset `React.useEffect` block from `AddTransferDialog`.
- [ ] Keep `onOpenChange(false)` unchanged in footer cancel and submit success.
- [ ] Do not add a replacement local close wrapper unless a test proves it is needed.

Expected implementation:

```diff
-  React.useEffect(() => {
-    if (!open) {
-      dispatch({ type: "RESET" })
-    }
-  }, [open])
-
   const { departments, isLoadingDepartments } = useTransferDepartments({ open })
```

- [ ] Run focused tests:

```bash
node scripts/npm-run.js run test:run -- src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx
node scripts/npm-run.js run test:run -- src/components/__tests__/transfer-dialogs.payload.test.tsx
node scripts/npm-run.js run test:run -- src/components/__tests__/transfer-dialog.data-fetching.test.tsx
```

Expected GREEN: all pass.

### Task 5: React Doctor Decision Gate

**Files:** maybe none.

- [ ] Run React Doctor diff:

```bash
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

- [ ] If `AddTransferDialog` no longer reports `react-doctor/no-event-handler`, keep the refactor.
- [ ] If warning remains or a new warning appears in touched files, stop and reassess before adding code.
- [ ] If the effect proves necessary after tests, restore it, add a concise issue comment explaining why the effect is the simplest correct child-level safeguard, and close #562 without code changes.

### Task 6: Full Required Verification

Run in one `ctx_batch_execute`:

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx
node scripts/npm-run.js run test:run -- src/components/__tests__/transfer-dialogs.payload.test.tsx
node scripts/npm-run.js run test:run -- src/components/__tests__/transfer-dialog.data-fetching.test.tsx
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Expected: all pass, and React Doctor diff has no `react-doctor/no-event-handler` entry for `src/components/add-transfer-dialog.tsx`.

### Task 7: Commit, Push, Close

- [ ] Commit:

```bash
git add src/components/add-transfer-dialog.tsx src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx
git commit -m "fix: remove add transfer reset effect"
```

- [ ] Push and open PR:

```bash
git pull --rebase
git push -u origin issue-562-add-transfer-reset-effect
gh pr create --fill
```

- [ ] Link PR to #562.
- [ ] After merge, verify #562 is closed or close it with the verification summary.

## Stop Conditions

- Stop if the focused reset tests cannot be made to fail under mutation; the tests are not proving the behavior.
- Stop if removing the effect breaks direct product close/reset behavior through `TransfersDialogs`.
- Stop if the fix requires changing shared `SideSheetShell` or transfer payload code; file a separate follow-up instead.
