# Dashboard Equipment Attention Redirect Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `Thông tin chi tiết` -> equipment `Xem tất cả` redirect non-global users to `/equipment` with status preset (`Chờ sửa chữa`, `Chờ bảo trì`, `Chờ hiệu chuẩn/kiểm định`), while `admin`/`global`/`regional_leader` keep current unfiltered behavior.

**Architecture:** Keep this as a UI routing/filter preset only. Do not alter RPC payload shape, tenant IDs, or server-side enforcement. Reuse existing action-based deep-link flow in equipment route sync (`action=...`) and inject a new action that applies only a local status column filter for non-global users. Keep attention statuses in one shared source (`src/lib/equipment-attention-preset.ts`) and reuse that source in all redirect/filter logic.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Table, NextAuth session role checks, Vitest.

---

### Task 1: Add Shared Attention Redirect Preset Constants + Role-Aware Href Helper

**Files:**
- Create: `src/lib/equipment-attention-preset.ts`
- Create: `src/lib/__tests__/equipment-attention-preset.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/__tests__/equipment-attention-preset.test.ts
import { describe, expect, it } from "vitest"
import {
  EQUIPMENT_ATTENTION_ACTION,
  EQUIPMENT_ATTENTION_STATUSES,
  getEquipmentAttentionHrefForRole,
} from "../equipment-attention-preset"

describe("equipment attention preset", () => {
  it("returns unfiltered equipment path for global/admin/regional_leader", () => {
    expect(getEquipmentAttentionHrefForRole("global")).toBe("/equipment")
    expect(getEquipmentAttentionHrefForRole("admin")).toBe("/equipment")
    expect(getEquipmentAttentionHrefForRole("regional_leader")).toBe("/equipment")
  })

  it("returns action-based preset path for non-global roles", () => {
    expect(getEquipmentAttentionHrefForRole("to_qltb")).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
    expect(getEquipmentAttentionHrefForRole("qltb_khoa")).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
    expect(getEquipmentAttentionHrefForRole("technician")).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
    expect(getEquipmentAttentionHrefForRole("user")).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
    expect(getEquipmentAttentionHrefForRole(undefined)).toBe(`/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`)
  })

  it("exports exact vietnamese status values", () => {
    expect(EQUIPMENT_ATTENTION_STATUSES).toEqual([
      "Chờ sửa chữa",
      "Chờ bảo trì",
      "Chờ hiệu chuẩn/kiểm định",
    ])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/__tests__/equipment-attention-preset.test.ts`
Expected: FAIL (module/file does not exist yet).

**Step 3: Write minimal implementation**

```ts
// src/lib/equipment-attention-preset.ts
import { isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"
import type { ColumnFiltersState } from "@tanstack/react-table"

export const EQUIPMENT_ATTENTION_ACTION = "attention-status" as const

export const EQUIPMENT_ATTENTION_STATUSES = [
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
] as const

export function getEquipmentAttentionHrefForRole(role: string | null | undefined): string {
  if (isGlobalRole(role) || isRegionalLeaderRole(role)) return "/equipment"
  return `/equipment?action=${EQUIPMENT_ATTENTION_ACTION}`
}

export function applyAttentionStatusPresetFilters(prev: ColumnFiltersState): ColumnFiltersState {
  const withoutStatus = prev.filter((f) => f.id !== "tinh_trang_hien_tai")
  return [
    ...withoutStatus,
    { id: "tinh_trang_hien_tai", value: [...EQUIPMENT_ATTENTION_STATUSES] },
  ]
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/__tests__/equipment-attention-preset.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/equipment-attention-preset.ts src/lib/__tests__/equipment-attention-preset.test.ts
git commit -m "test+feat: add equipment attention redirect preset constants"
```

---

### Task 2: Wire Dashboard Equipment `Xem tất cả` to Role-Aware Redirect

**Files:**
- Modify: `src/components/dashboard/dashboard-tabs.tsx`

**Step 1: Run helper tests to verify role mapping contract**

Run: `npm run test:run -- src/lib/__tests__/equipment-attention-preset.test.ts`
Expected: PASS (acts as guard before wiring UI usage).

**Step 2: Implement dashboard usage**

Update `dashboard-tabs.tsx`:
- Import `useSession` from `next-auth/react`.
- Import `getEquipmentAttentionHrefForRole` from `@/lib/equipment-attention-preset`.
- Compute `const equipmentAttentionHref = getEquipmentAttentionHrefForRole(session?.user?.role)`.
- Replace equipment tab link `href="/equipment"` with `href={equipmentAttentionHref}`.
- Leave other `Xem tất cả` links (`/maintenance`) unchanged.

**Step 3: Run tests**

Run:
- `npm run test:run -- src/lib/__tests__/equipment-attention-preset.test.ts`
- `npm run typecheck`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/components/dashboard/dashboard-tabs.tsx src/lib/__tests__/equipment-attention-preset.test.ts
git commit -m "feat: make dashboard equipment link role-aware with attention action"
```

---

### Task 3: Extend Equipment Route Sync to Recognize Attention Action

**Files:**
- Modify: `src/app/(app)/equipment/_hooks/useEquipmentRouteSync.ts`
- Create: `src/app/(app)/equipment/__tests__/useEquipmentRouteSync.test.ts`

**Step 1: Write the failing test**

Test cases:
- `action=attention-status` creates pending action for preset and calls `router.replace(...)` with cleaned URL.
- Existing behaviors `action=add` and `highlight` still work.
- Non-transient params are preserved by URL cleaning.

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/app/(app)/equipment/__tests__/useEquipmentRouteSync.test.ts`
Expected: FAIL because new action type is not implemented.

**Step 3: Implement minimal route sync change**

In `useEquipmentRouteSync.ts`:
- Extend `RouteAction["type"]` with `"applyAttentionStatusPreset"`.
- Parse `actionParam === EQUIPMENT_ATTENTION_ACTION`.
- Set `pendingAction` to `{ type: "applyAttentionStatusPreset" }`.
- Keep current `router.replace(buildCleanUrl(...))` behavior so `action` is transient.
- Do not add or parse tenant parameters.

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/app/(app)/equipment/__tests__/useEquipmentRouteSync.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/(app)/equipment/_hooks/useEquipmentRouteSync.ts src/app/(app)/equipment/__tests__/useEquipmentRouteSync.test.ts
git commit -m "feat: support attention-status action in equipment route sync"
```

---

### Task 4: Apply Preset Status Filter in Equipment Page (Non-Global Only)

**Files:**
- Modify: `src/lib/equipment-attention-preset.ts`
- Modify: `src/lib/__tests__/equipment-attention-preset.test.ts`
- Modify: `src/app/(app)/equipment/_components/EquipmentPageClient.tsx`

**Step 1: Write the failing test**

Extend shared lib tests to cover helper `applyAttentionStatusPresetFilters`:
- Replaces existing `tinh_trang_hien_tai` filter with attention statuses.
- Preserves other filters unchanged.

```ts
expect(applyAttentionStatusPresetFilters([
  { id: "khoa_phong_quan_ly", value: ["Khoa A"] },
  { id: "tinh_trang_hien_tai", value: ["Hoạt động"] },
])).toEqual([
  { id: "khoa_phong_quan_ly", value: ["Khoa A"] },
  { id: "tinh_trang_hien_tai", value: ["Chờ sửa chữa", "Chờ bảo trì", "Chờ hiệu chuẩn/kiểm định"] },
])
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/__tests__/equipment-attention-preset.test.ts`
Expected: FAIL (helper test added before helper implementation).

**Step 3: Implement minimal application**

- Keep helper in `src/lib/equipment-attention-preset.ts` (single source of truth with shared status constants).
- In `EquipmentPageClient.tsx`, inside pending action effect:
  - Handle `pendingAction.type === "applyAttentionStatusPreset"`.
  - Apply preset only when `!isGlobal && !isRegionalLeader`.
  - Use `setColumnFilters((prev) => applyAttentionStatusPresetFilters(prev))` imported from `@/lib/equipment-attention-preset`.
  - Always `clearPendingAction()` after handling.

**Step 4: Run test to verify it passes**

Run:
- `npm run test:run -- src/lib/__tests__/equipment-attention-preset.test.ts`
- `npm run typecheck`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/equipment-attention-preset.ts src/lib/__tests__/equipment-attention-preset.test.ts src/app/(app)/equipment/_components/EquipmentPageClient.tsx
git commit -m "feat: apply attention status preset for non-global equipment redirects"
```

---

### Task 5: Tenant-Isolation and Regression Verification

**Files:**
- Modify (if needed): `src/app/(app)/equipment/__tests__/useEquipmentData.test.ts`

**Step 1: Add a security-focused regression test**

Add a test verifying status preset propagation is filter-only:
- `p_tinh_trang_array` carries the 3 statuses.
- No new client tenant logic is introduced by the preset helper.
- Existing role-based `p_don_vi` behavior in `useEquipmentData` remains unchanged.

**Step 2: Run targeted tests**

Run:
- `npm run test:run -- src/app/(app)/equipment/__tests__/useEquipmentData.test.ts`
- `npm run test:run -- src/app/api/rpc/__tests__/equipment-get-by-code-security.test.ts`

Expected: PASS.

**Step 3: Run full quality gates**

Run:
- `npm run typecheck`
- `npm run test:run`

Expected: PASS.

**Step 4: Manual verification checklist**

1. Login as `to_qltb` (or `user`) and click dashboard equipment `Xem tất cả` from `Thông tin chi tiết`: equipment page opens with 3-status filter active.
2. Login as `admin`/`global`: same button opens `/equipment` without auto status preset.
3. Login as `regional_leader`: same button opens `/equipment` without auto status preset.
4. Confirm network calls do not include user-controllable tenant escalation behavior; backend tenant enforcement remains in `src/app/api/rpc/[fn]/route.ts`.

**Step 5: Commit**

```bash
git add src/app/(app)/equipment/__tests__/useEquipmentData.test.ts
git commit -m "test: verify attention preset keeps tenant isolation behavior intact"
```

---

### Final Integration Steps (Session Landing)

1. `git pull --rebase`
2. `bd sync` (if available in environment)
3. `git push`
4. `git status` and confirm branch is up to date with origin
