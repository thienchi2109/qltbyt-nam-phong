# Equipment Bulk Delete Label Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the equipment bulk selection action to use a shared label constant reading "Xóa các TB đã chọn" so UI and tests stay consistent.

**Architecture:** Introduce an equipment-specific constants module that exports the destructive action label, have both the component and its tests import that constant, and ensure TDD by updating tests first to enforce the new copy before adjusting implementation.

**Tech Stack:** Next.js 15, React 18, TypeScript, React Testing Library + Jest, Radix UI.

---

### Task 1: Add shared label constant & update failing expectation

**Files:**
- Create: `src/app/(app)/equipment/_constants/equipmentBulkActions.ts`
- Modify: `src/app/(app)/equipment/__tests__/EquipmentBulkDeleteBar.test.tsx:150-200`
- Test: `src/app/(app)/equipment/__tests__/EquipmentBulkDeleteBar.test.tsx`

**Step 1: Define constant and update tests**

```ts
// src/app/(app)/equipment/_constants/equipmentBulkActions.ts
export const EQUIPMENT_BULK_DELETE_LABEL = "Xóa các TB đã chọn"
```

```ts
// src/app/(app)/equipment/__tests__/EquipmentBulkDeleteBar.test.tsx
import { EQUIPMENT_BULK_DELETE_LABEL } from "@/app/(app)/equipment/_constants/equipmentBulkActions"

fireEvent.click(
  screen.getByRole("button", { name: EQUIPMENT_BULK_DELETE_LABEL })
)
expect(
  screen.getByRole("button", { name: EQUIPMENT_BULK_DELETE_LABEL })
).toBeDisabled()
```

**Step 2: Run test to verify it fails**

Run: `node scripts/npm-run.js run test src/app/(app)/equipment/__tests__/EquipmentBulkDeleteBar.test.tsx`

Expected: FAIL with message showing the button text "Xóa đã chọn" not found.

**Step 3: Commit failing test**

```bash
git add src/app/(app)/equipment/_constants/equipmentBulkActions.ts \
        "src/app/(app)/equipment/__tests__/EquipmentBulkDeleteBar.test.tsx"
git commit -m "test: enforce bulk delete label copy"
```

---

### Task 2: Use constant in EquipmentBulkDeleteBar and make tests pass

**Files:**
- Modify: `src/app/(app)/equipment/_components/EquipmentBulkDeleteBar.tsx:72-108`
- Test: `src/app/(app)/equipment/__tests__/EquipmentBulkDeleteBar.test.tsx`

**Step 1: Import and use constant**

```tsx
import { EQUIPMENT_BULK_DELETE_LABEL } from "@/app/(app)/equipment/_constants/equipmentBulkActions"

<Button ...>
  {EQUIPMENT_BULK_DELETE_LABEL}
</Button>
```

**Step 2: Run targeted test to verify it passes**

Run: `node scripts/npm-run.js run test src/app/(app)/equipment/__tests__/EquipmentBulkDeleteBar.test.tsx`

Expected: PASS with all suites green.

**Step 3: Commit implementation**

```bash
git add "src/app/(app)/equipment/_components/EquipmentBulkDeleteBar.tsx"
git commit -m "feat: share equipment bulk delete label"
```

**Step 4: Run broader regression if needed**

Run: `node scripts/npm-run.js run test EquipmentBulkDeleteBar`

Expected: PASS; ensures no collateral regressions.

---

Plan complete and saved to `docs/plans/2026-02-23-equipment-bulk-delete-label-plan.md`. Two execution options:

1. **Subagent-Driven (this session)** – I dispatch a fresh subagent per task with reviews between steps for fast iteration.
2. **Parallel Session (separate)** – Open a new session in the worktree using superpowers:executing-plans for batch execution with checkpoints.

Which approach would you like to use?