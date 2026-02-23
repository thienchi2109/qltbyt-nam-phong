# Toast Overlay Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure global toast notifications render above dialogs/sheets by adjusting the shared ToastViewport layer, updating docs, and adding regression tests.

**Architecture:** Update the shared toast primitive (`src/components/ui/toast.tsx`) to use a new high z-index tier defined in `docs/frontend/layering.md`, then verify with Vitest UI-layering tests. No feature-specific components change—everything routes through the global Toaster.

**Tech Stack:** Next.js App Router, React 18, Radix UI Toast/Dialog, Vitest + @testing-library/react, TypeScript, Tailwind utility classes.

---

### Task 1: Add failing regression test for toast layering

**Files:**
- Modify: `src/components/ui/__tests__/alert-dialog-z-index.test.tsx`

**Step 1: Write failing test**

```tsx
it("renders toast viewport above dialog layer", () => {
  render(
    <>
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Equipment details</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      <ToastProvider>
        <ToastViewport />
      </ToastProvider>
    </>
  )

  const dialogContent = screen.getByRole("dialog")
  const toastViewport = document.querySelector('[data-radix-toast-viewport]') as HTMLElement

  expect(dialogContent.className).toContain("z-[1000]")
  expect(toastViewport.className).toContain("z-[1300]")
})
```

**Step 2: Run test to verify failure**

Run: `node scripts/npm-run.js run test -- src/components/ui/__tests__/alert-dialog-z-index.test.tsx`

Expected: FAIL complaining toast viewport lacks `z-[1300]`.

### Task 2: Update ToastViewport styling to new tier

**Files:**
- Modify: `src/components/ui/toast.tsx:12-24`

**Step 1: Implement minimal change**

```tsx
className={cn(
  "fixed top-0 z-[1300] flex max-h-screen ...",
  className
)}
```

**Step 2: Re-run targeted test**

Command: `node scripts/npm-run.js run test -- src/components/ui/__tests__/alert-dialog-z-index.test.tsx`

Expected: PASS for all specs.

### Task 3: Update layering contract documentation

**Files:**
- Modify: `docs/frontend/layering.md`

**Step 1: Adjust table row**

```
| `ToastViewport` | n/a | `z-[1300]` | Toast stays visible above dialogs |
```

**Step 2: Note reason in rules section if needed.

### Task 4: Verify broader test coverage

**Files:**
- n/a (tests already written)

**Step 1: Run focused UI test suite (same command as Task 2 Step 2) and ensure PASS.**

**Step 2: Optionally run `node scripts/npm-run.js run lint` if required by repo workflow.**

### Task 5: Commit changes

**Files staged:**
- `src/components/ui/toast.tsx`
- `src/components/ui/__tests__/alert-dialog-z-index.test.tsx`
- `docs/frontend/layering.md`

**Step 1: Add files**

```bash
git add src/components/ui/toast.tsx src/components/ui/__tests__/alert-dialog-z-index.test.tsx docs/frontend/layering.md
```

**Step 2: Commit**

```bash
git commit -m "fix: ensure toast overlays dialogs"
```

---

Plan complete and saved to `docs/plans/2026-02-23-toast-layering-plan.md`. Two execution options:

1. **Subagent-Driven (this session)** – I dispatch a fresh subagent per task using superpowers:subagent-driven-development, review between steps, iterate quickly.
2. **Parallel Session (separate)** – Open a new session bound to this worktree, use superpowers:executing-plans to run tasks sequentially with checkpoints.

Which approach would you like me to take?"}