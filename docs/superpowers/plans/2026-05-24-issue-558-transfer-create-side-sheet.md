# Issue 558 Transfer Create Side Sheet Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert transfer creation from Radix `Dialog` presentation to the shared right-side `SideSheetShell` while preserving create form behavior and RPC payload semantics.

**Architecture:** Keep `AddTransferDialog` as the owner of reducer state, data hooks, validation, submit, toast, reset, and close behavior. Replace only the presentation wrapper with `SideSheetShell`, following the `TransferDetailDialog` flex/overflow pattern so body content scrolls while footer actions stay visible. Do not change `transfer-dialog.form-sections.tsx`, backend APIs, RPC payload builders, or transfer page controller contracts unless a failing test proves a required gap.

**Tech Stack:** Next.js App Router client components, React Testing Library, Vitest, TanStack Query, existing shared `SideSheetShell`, transfer dialog reducer/data/form section modules.

---

## Context

- Issue: #558, "Phase 3 - Convert transfer create dialog to the shared side-sheet shell".
- Scope is presentation/layout only for `src/components/add-transfer-dialog.tsx`.
- Out of scope: API, backend, DB/schema/migration, RPC/payload contract, new shared form abstractions.
- AgentMemory recall:
  - Issue #556 extracted the shared side-sheet shell and related transfer dialog groundwork.
  - Issue #557 noted the important layout gotcha: side-sheet tab/content bodies need definite flex height such as `bodyClassName="flex flex-col overflow-hidden p-4"` and inner `min-h-0 flex-1` scroll containers.
- Code graph:
  - `AddTransferDialog` lives at `src/components/add-transfer-dialog.tsx`, about 271 lines, with `handleSearchChange`, `handleSelectEquipment`, and `handleSubmit`.
  - `SideSheetShell` lives at `src/components/shared/SideSheetShell.tsx` and supports `footer`, `contentClassName`, `bodyClassName`, and `footerClassName`.
  - `TransferDetailDialog` already uses `SideSheetShell` with `contentClassName="sm:max-w-xl md:max-w-2xl lg:max-w-4xl"` and `bodyClassName="flex flex-col overflow-hidden p-4"`.
  - GitNexus impact for `AddTransferDialog` upstream was LOW with no direct upstream symbols captured; still verify `TransfersDialogs` flow because it passes open/close state.

## File Map

- Modify: `src/components/add-transfer-dialog.tsx`
  - Replace `Dialog` imports/JSX with `SideSheetShell`.
  - Keep existing reducer, hooks, form sections, validation, submit payload, toast, `onSuccess`, `onOpenChange(false)`, and cancel behavior.
  - Move footer buttons into the `SideSheetShell.footer` prop.
- Modify: `src/components/__tests__/transfer-dialogs.payload.test.tsx`
  - Update presentation mocks so payload tests continue to exercise `AddTransferDialog` after it uses `SideSheetShell`.
  - Keep the existing payload assertion unchanged.
- Create or modify: `src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx`
  - Focused presentation/flow tests for side-sheet rendering, cancel close, and footer/body layout classes.
  - If the existing payload test setup is easier to reuse without duplication, add a new `describe("AddTransferDialog side sheet presentation", ...)` block to `transfer-dialogs.payload.test.tsx` instead.
- Optionally modify: `src/app/(app)/transfers/_components/__tests__/TransfersDialogs.test.tsx` or nearest existing transfer page dialog test
  - Only if current tests do not already cover `TransfersDialogs` passing `isAddDialogOpen`, `onAddDialogOpenChange`, and `onAddSuccess` to `AddTransferDialog`.

## Task 1: Lock Current Payload Contract

**Files:**
- Test: `src/components/__tests__/transfer-dialogs.payload.test.tsx`
- Production: none

- [ ] **Step 1: Run the existing AddTransferDialog payload test before editing**

Run:

```bash
node scripts/npm-run.js vitest run src/components/__tests__/transfer-dialogs.payload.test.tsx -t "AddTransferDialog payload shaping"
```

Expected: PASS. This proves the current payload fixture is usable as a no-regression guard.

- [ ] **Step 2: Note the payload assertion must not change**

Keep the existing `transfer_request_create` expectation intact:

```ts
expect(mocks.callRpc).toHaveBeenCalledWith({
  fn: "transfer_request_create",
  args: {
    p_data: expect.objectContaining({
      thiet_bi_id: 11,
      loai_hinh: "noi_bo",
      ly_do_luan_chuyen: "Điều phối",
      nguoi_yeu_cau_id: 42,
    }),
  },
})
```

## Task 2: RED - Side Sheet Presentation Test

**Files:**
- Test: `src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx` or `src/components/__tests__/transfer-dialogs.payload.test.tsx`
- Production: `src/components/add-transfer-dialog.tsx`

- [ ] **Step 1: Add a failing side-sheet rendering/layout test**

Mock `SideSheetShell` directly so the test validates `AddTransferDialog` passes the right shell contract without depending on Radix internals:

```tsx
vi.mock("@/components/shared/SideSheetShell", () => ({
  SideSheetShell: ({
    open,
    onOpenChange,
    title,
    description,
    contentClassName,
    bodyClassName,
    footerClassName,
    footer,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: React.ReactNode
    description?: React.ReactNode
    contentClassName?: string
    bodyClassName?: string
    footerClassName?: string
    footer?: React.ReactNode
    children: React.ReactNode
  }) =>
    open ? (
      <section
        aria-label="transfer-create-sheet"
        data-content-class={contentClassName}
        data-body-class={bodyClassName}
        data-footer-class={footerClassName}
      >
        <h2>{title}</h2>
        <p>{description}</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          shell-close
        </button>
        <div data-testid="sheet-body">{children}</div>
        <div data-testid="sheet-footer">{footer}</div>
      </section>
    ) : null,
}))
```

Then assert:

```tsx
render(<AddTransferDialog open onOpenChange={vi.fn()} onSuccess={vi.fn()} />, {
  wrapper: createWrapper(),
})

const sheet = screen.getByLabelText("transfer-create-sheet")
expect(sheet).toHaveAttribute("data-content-class", expect.stringContaining("sm:max-w"))
expect(sheet).toHaveAttribute("data-body-class", expect.stringContaining("overflow"))
expect(screen.getByRole("heading", { name: "Tạo yêu cầu luân chuyển mới" })).toBeInTheDocument()
expect(screen.getByTestId("sheet-footer")).toContainElement(
  screen.getByRole("button", { name: "Tạo yêu cầu" }),
)
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
node scripts/npm-run.js vitest run src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx
```

Expected: FAIL because `AddTransferDialog` still renders `Dialog`, not `SideSheetShell`.

## Task 3: GREEN - Convert AddTransferDialog Wrapper

**Files:**
- Modify: `src/components/add-transfer-dialog.tsx`

- [ ] **Step 1: Replace dialog imports with `SideSheetShell`**

Change imports from:

```ts
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
```

to:

```ts
import { SideSheetShell } from "@/components/shared/SideSheetShell"
```

- [ ] **Step 2: Wrap the existing form with `SideSheetShell`**

Use the current title/description text unchanged:

```tsx
return (
  <SideSheetShell
    open={open}
    onOpenChange={onOpenChange}
    title="Tạo yêu cầu luân chuyển mới"
    description="Tạo yêu cầu luân chuyển thiết bị giữa các bộ phận hoặc với đơn vị bên ngoài."
    contentClassName="sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
    bodyClassName="overflow-y-auto p-4"
    footerClassName="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
    footer={
      <>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
          Hủy
        </Button>
        <Button type="submit" form="add-transfer-form" disabled={isLoading || isRegionalLeader}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Tạo yêu cầu
        </Button>
      </>
    }
  >
    <form id="add-transfer-form" onSubmit={handleSubmit} className="space-y-4">
      {/* existing form sections unchanged */}
    </form>
  </SideSheetShell>
)
```

Implementation notes:

- Use a stable form id because footer buttons are outside the `<form>`.
- Preserve the existing cancel `onOpenChange(false)` behavior.
- Preserve the existing submit button disabled condition.
- Preserve all child form sections and props exactly unless TypeScript requires only class/layout changes.

- [ ] **Step 3: Run the side-sheet test and verify GREEN**

Run:

```bash
node scripts/npm-run.js vitest run src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx
```

Expected: PASS.

## Task 4: RED/GREEN - Cancel and Close Behavior

**Files:**
- Test: side-sheet test file chosen in Task 2
- Production: `src/components/add-transfer-dialog.tsx`

- [ ] **Step 1: Add a failing cancel test**

```tsx
it("closes through the existing onOpenChange callback when the footer cancel button is clicked", async () => {
  const user = userEvent.setup()
  const onOpenChange = vi.fn()

  render(<AddTransferDialog open onOpenChange={onOpenChange} onSuccess={vi.fn()} />, {
    wrapper: createWrapper(),
  })

  await user.click(screen.getByRole("button", { name: "Hủy" }))

  expect(onOpenChange).toHaveBeenCalledWith(false)
})
```

- [ ] **Step 2: Run and verify RED or PASS**

Run the focused side-sheet test. If this passes immediately after Task 3, record it as already covered by the minimal implementation; do not change production code.

- [ ] **Step 3: If RED, fix only cancel wiring**

Expected production code is still:

```tsx
<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
  Hủy
</Button>
```

## Task 5: Preserve Submit Payload and Reset/Close Semantics

**Files:**
- Modify: `src/components/__tests__/transfer-dialogs.payload.test.tsx` only if mocks need updating.
- Production: `src/components/add-transfer-dialog.tsx`

- [ ] **Step 1: Update payload test presentation mocks if needed**

If the existing payload test mocks `@/components/ui/dialog`, replace or supplement that mock with a `SideSheetShell` mock that renders `children` and `footer`.

```tsx
vi.mock("@/components/shared/SideSheetShell", () => ({
  SideSheetShell: ({ open, footer, children }: { open: boolean; footer?: React.ReactNode; children: React.ReactNode }) =>
    open ? (
      <div data-testid="side-sheet">
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}))
```

- [ ] **Step 2: Run the existing payload test**

Run:

```bash
node scripts/npm-run.js vitest run src/components/__tests__/transfer-dialogs.payload.test.tsx -t "AddTransferDialog payload shaping"
```

Expected: PASS with the same `transfer_request_create` payload and existing `onSuccess` / `onOpenChange(false)` assertions.

- [ ] **Step 3: If payload changes, revert production changes until the old payload expectation passes**

No RPC contract changes are allowed for this issue.

## Task 6: Verify TransfersDialogs Open/Close Wiring

**Files:**
- Test: nearest existing `TransfersDialogs` test, or create `src/app/(app)/transfers/_components/__tests__/TransfersDialogs.test.tsx` if none exists.
- Production: only if a failing test exposes broken wiring.

- [ ] **Step 1: Check whether a `TransfersDialogs` add-dialog wiring test already exists**

Run:

```bash
rg -n "TransfersDialogs|isAddDialogOpen|onAddDialogOpenChange|AddTransferDialog" src/app src/components --glob '*test.tsx'
```

- [ ] **Step 2: Add a failing wiring test only if coverage is missing**

Mock `AddTransferDialog` and assert `TransfersDialogs` passes through:

```tsx
expect(addTransferDialogProps).toMatchObject({
  open: true,
  onOpenChange: onAddDialogOpenChange,
  onSuccess: onAddSuccess,
})
```

- [ ] **Step 3: Run the focused wiring test**

Expected: PASS without production changes. If it fails, fix only prop threading in `TransfersDialogs`.

## Task 7: Verification Gates

**Files:**
- Verification only.

- [ ] **Step 1: Run repo-required TypeScript/React gates in order**

Use one `ctx_batch_execute` for these commands:

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js vitest run src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx
node scripts/npm-run.js vitest run src/components/__tests__/transfer-dialogs.payload.test.tsx -t "AddTransferDialog payload shaping"
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

- [ ] **Step 2: Commit after green verification**

```bash
git add src/components/add-transfer-dialog.tsx src/components/__tests__/transfer-dialogs.payload.test.tsx src/components/__tests__/add-transfer-dialog.side-sheet.test.tsx
git commit -m "feat: convert transfer create dialog to side sheet"
```

## Non-Goals

- Do not edit Supabase migrations.
- Do not apply database changes.
- Do not modify `buildCreateTransferPayload` unless the unchanged payload test proves a current bug unrelated to the side-sheet migration.
- Do not extract new shared form abstractions from `transfer-dialog.form-sections.tsx`.
- Do not refactor `EditTransferDialog` in this issue.

## Risk Notes

- Primary risk is moving submit buttons outside the `<form>`. Mitigate with a stable `form` id on the submit button and a focused submit payload test.
- Secondary risk is losing scroll behavior. Mitigate by using `SideSheetShell.footer` and a body class with overflow, matching the definite-height guidance from recent side-sheet work.
- `transfer-dialog.form-sections.tsx` is 344 lines, near the 350-line extraction threshold. This issue should not add code there; if implementation needs more form logic, file a follow-up instead.
