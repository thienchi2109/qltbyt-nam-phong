# Reports Tenant Status Donut Chart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add one donut chart in the `Phân bố trạng thái thiết bị` section (Xuất-Nhập-Tồn tab) to visualize status percentages for the currently selected facility only.

**Architecture:** Reuse existing tenant-scoped data from `useEquipmentDistribution` and render a donut with `DynamicPieChart` inside `EquipmentDistributionSummary`. Do not add new RPCs or migrations; keep tenant/security behavior in the current RPC path (`/api/rpc/[fn]` -> `equipment_status_distribution`). Implement with TDD: add failing tests for donut data and layout first, then write minimal UI code.

**Tech Stack:** Next.js (App Router), React 18, TypeScript, TanStack Query, Vitest + Testing Library, Recharts via `DynamicPieChart`.

---

## Pre-Implementation Constraints (Must Keep)

1. Facility scope must remain single-facility in this section:
- `InventoryReportTab` renders `EquipmentDistributionSummary` only when `tenantFilter !== 'all'`.
- `EquipmentDistributionSummary` must continue calling `useEquipmentDistribution(undefined, undefined, tenantFilter, selectedDonVi, effectiveTenantKey)`.

2. Security model must remain unchanged:
- RPC must remain allowlisted (`equipment_status_distribution`) in `src/app/api/rpc/[fn]/route.ts`.
- Non-global/non-regional users remain server-forced to their own `don_vi`; `regional_leader`/`global` can pass `p_don_vi`.

3. Database/migration impact:
- No schema changes.
- No new migration files.
- Reuse existing `public.equipment_status_distribution(TEXT, BIGINT, TEXT, TEXT)`.

---

## Discovery Snapshot (Dependencies + Security)

1. UI dependency chain (selected facility scope):
- `src/app/(app)/reports/page.tsx` maps facility state as:
  `undefined -> 'unset'`, `null -> 'all'`, `number -> String(number)`.
- `src/app/(app)/reports/components/inventory-report-tab.tsx` renders
  `EquipmentDistributionSummary` only when `tenantFilter !== 'all'`.
- `src/components/equipment-distribution-summary.tsx` pulls status data via
  `useEquipmentDistribution(undefined, undefined, tenantFilter, selectedDonVi, effectiveTenantKey)`.

2. Query/data dependency:
- `src/hooks/use-equipment-distribution.ts` calls `callRpc` with
  `fn: 'equipment_status_distribution'` and `args.p_don_vi = selectedDonVi || null`.
- Query is gated by `enabled: (effectiveTenantKey ?? 'auto') !== 'unset'`, so global/regional users do not query before selecting facility mode.

3. API proxy security dependency:
- `src/app/api/rpc/[fn]/route.ts` allowlists `equipment_status_distribution`.
- For non-`global` and non-`regional_leader`, proxy sanitizes `p_don_vi` to the session tenant before forwarding.
- JWT claims include `app_role`, `don_vi`, `dia_ban`, and are signed server-side only.

4. Database security dependency:
- Latest function body is in
  `supabase/migrations/20260219023900_fix_ilike_sanitization_equipment_status_distribution.sql`.
- Function is `SECURITY DEFINER`, reads role claims, resolves allowed facilities, and raises `42501` for unauthorized `p_don_vi`.
- Existing smoke test coverage confirms soft-delete behavior and facility scoping:
  `supabase/tests/equipment_soft_delete_reports_smoke.sql`.

5. Migration impact for this feature:
- Frontend-only change; no new SQL, no migration, no RLS/policy changes.
- Reusing existing RPC response shape avoids contract changes for exports/charts.

---

## Brainstorming Outcome (Placement + Scope)

1. Option A (recommended): Add donut inside the existing `Phân bố trạng thái thiết bị` card, left side, keep status tiles on right.
- Pros: Balanced layout, same data source, no extra fetch, clear visual hierarchy.
- Cons: Need responsive grid tuning to avoid crowding on smaller screens.

2. Option B: Add separate new card below status tiles.
- Pros: Minimal risk to existing card markup.
- Cons: Less balanced visually, more vertical space, weaker grouping.

3. Option C: Replace tiles with donut + legend only.
- Pros: Cleaner, chart-focused.
- Cons: Loses explicit per-status counts currently visible at a glance.

Chosen direction: Option A, with responsive fallback (donut stacked above tiles on narrow widths).

---

### Task 1: Add Donut Data Utility (TDD)

**Files:**
- Create: `src/components/equipment-distribution-summary.utils.ts`
- Create: `src/components/__tests__/equipment-distribution-summary.utils.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildStatusDonutData } from '@/components/equipment-distribution-summary.utils'

describe('buildStatusDonutData', () => {
  it('keeps only count > 0 and maps to donut shape', () => {
    const input = [
      { key: 'hoat_dong', label: 'Hoạt động', count: 8, percentage: 80, color: '#22c55e' },
      { key: 'cho_sua_chua', label: 'Chờ sửa chữa', count: 2, percentage: 20, color: '#ef4444' },
      { key: 'ngung_su_dung', label: 'Ngừng sử dụng', count: 0, percentage: 0, color: '#6b7280' },
    ]

    expect(buildStatusDonutData(input)).toEqual([
      { name: 'Hoạt động', value: 8, percent: 80, color: '#22c55e', key: 'hoat_dong' },
      { name: 'Chờ sửa chữa', value: 2, percent: 20, color: '#ef4444', key: 'cho_sua_chua' },
    ])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/__tests__/equipment-distribution-summary.utils.test.ts`
Expected: FAIL with module/function not found.

**Step 3: Write minimal implementation**

```ts
export type StatusPercentageItem = {
  key: string
  label: string
  count: number
  percentage: number
  color: string
}

export type DonutDatum = {
  key: string
  name: string
  value: number
  percent: number
  color: string
}

export function buildStatusDonutData(items: StatusPercentageItem[]): DonutDatum[] {
  return items
    .filter((item) => item.count > 0)
    .map((item) => ({
      key: item.key,
      name: item.label,
      value: item.count,
      percent: item.percentage,
      color: item.color,
    }))
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/__tests__/equipment-distribution-summary.utils.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/equipment-distribution-summary.utils.ts src/components/__tests__/equipment-distribution-summary.utils.test.ts
git commit -m "test: add donut data utility for equipment status summary"
```

---

### Task 2: Add Failing Component Test for Donut + Balanced Layout

**Files:**
- Create: `src/components/__tests__/equipment-distribution-summary.donut.test.tsx`
- Modify: `src/components/equipment-distribution-summary.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EquipmentDistributionSummary } from '@/components/equipment-distribution-summary'

const mockUseEquipmentDistribution = vi.fn()
const mockDynamicPieChart = vi.fn(({ data }) => <div data-testid="status-donut">{JSON.stringify(data)}</div>)

vi.mock('@/hooks/use-equipment-distribution', () => ({
  useEquipmentDistribution: (...args: unknown[]) => mockUseEquipmentDistribution(...args),
  STATUS_COLORS: {
    hoat_dong: '#22c55e',
    cho_sua_chua: '#ef4444',
    cho_bao_tri: '#f59e0b',
    cho_hieu_chuan: '#8b5cf6',
    ngung_su_dung: '#6b7280',
    chua_co_nhu_cau: '#9ca3af',
  },
  STATUS_LABELS: {
    hoat_dong: 'Hoạt động',
    cho_sua_chua: 'Chờ sửa chữa',
    cho_bao_tri: 'Chờ bảo trì',
    cho_hieu_chuan: 'Chờ HC/KĐ',
    ngung_su_dung: 'Ngừng sử dụng',
    chua_co_nhu_cau: 'Chưa có nhu cầu',
  },
}))

vi.mock('@/components/dynamic-chart', () => ({
  DynamicPieChart: (props: unknown) => mockDynamicPieChart(props),
}))

describe('EquipmentDistributionSummary donut', () => {
  it('renders donut chart for selected facility and includes balanced layout wrapper', () => {
    mockUseEquipmentDistribution.mockReturnValue({
      data: {
        totalEquipment: 10,
        byDepartment: [{
          name: 'Khoa A', total: 10,
          hoat_dong: 8, cho_sua_chua: 2, cho_bao_tri: 0,
          cho_hieu_chuan: 0, ngung_su_dung: 0, chua_co_nhu_cau: 0,
        }],
        byLocation: [], departments: ['Khoa A'], locations: [],
      },
      isLoading: false,
      error: null,
    })

    render(
      <EquipmentDistributionSummary tenantFilter="42" selectedDonVi={42} effectiveTenantKey="42" />
    )

    expect(screen.getByTestId('status-donut')).toBeInTheDocument()
    expect(mockUseEquipmentDistribution).toHaveBeenCalledWith(undefined, undefined, '42', 42, '42')
    expect(screen.getByTestId('status-distribution-layout')).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/__tests__/equipment-distribution-summary.donut.test.tsx`
Expected: FAIL because donut and layout test IDs are not present yet.

**Step 3: Write minimal implementation**

Modify `src/components/equipment-distribution-summary.tsx`:

```tsx
import { DynamicPieChart } from '@/components/dynamic-chart'
import { buildStatusDonutData } from '@/components/equipment-distribution-summary.utils'

const donutData = buildStatusDonutData(overallStats.statusPercentages)

<CardContent>
  <div
    data-testid="status-distribution-layout"
    className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]"
  >
    <div className="rounded-lg border p-4">
      <div className="mb-2 text-sm font-medium">Tỷ lệ trạng thái</div>
      <DynamicPieChart
        data={donutData}
        height={260}
        dataKey="value"
        nameKey="name"
        colors={donutData.map((d) => d.color)}
        innerRadius={70}
        outerRadius={105}
        showLabels={false}
      />
    </div>

    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {/* existing status cards */}
    </div>
  </div>
</CardContent>
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/__tests__/equipment-distribution-summary.donut.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/equipment-distribution-summary.tsx src/components/__tests__/equipment-distribution-summary.donut.test.tsx
git commit -m "feat: add tenant-scoped status donut chart in reports summary"
```

---

### Task 3: Add Empty-State Regression Test for Donut Block (TDD)

**Files:**
- Modify: `src/components/__tests__/equipment-distribution-summary.donut.test.tsx`
- Modify: `src/components/equipment-distribution-summary.tsx`

**Step 1: Write the failing test**

```tsx
it('shows empty-state message when all status counts are zero', () => {
  mockUseEquipmentDistribution.mockReturnValue({
    data: {
      totalEquipment: 0,
      byDepartment: [{
        name: 'Khoa A', total: 0,
        hoat_dong: 0, cho_sua_chua: 0, cho_bao_tri: 0,
        cho_hieu_chuan: 0, ngung_su_dung: 0, chua_co_nhu_cau: 0,
      }],
      byLocation: [], departments: ['Khoa A'], locations: [],
    },
    isLoading: false,
    error: null,
  })

  render(<EquipmentDistributionSummary tenantFilter="42" selectedDonVi={42} effectiveTenantKey="42" />)

  expect(screen.getByText('Không có dữ liệu trạng thái')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/__tests__/equipment-distribution-summary.donut.test.tsx`
Expected: FAIL (empty-state message not implemented).

**Step 3: Write minimal implementation**

```tsx
const hasDonutData = donutData.length > 0

{hasDonutData ? (
  <DynamicPieChart ... />
) : (
  <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
    Không có dữ liệu trạng thái
  </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/__tests__/equipment-distribution-summary.donut.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/equipment-distribution-summary.tsx src/components/__tests__/equipment-distribution-summary.donut.test.tsx
git commit -m "test: cover empty-state and tenant donut rendering"
```

---

### Task 4: Full Verification and Manual QA

**Files:**
- Modify: none
- Test: `src/components/__tests__/equipment-distribution-summary.utils.test.ts`
- Test: `src/components/__tests__/equipment-distribution-summary.donut.test.tsx`

**Step 1: Run focused unit/component tests**

Run:
`npm run test:run -- src/components/__tests__/equipment-distribution-summary.utils.test.ts src/components/__tests__/equipment-distribution-summary.donut.test.tsx`

Expected: PASS for all tests.

**Step 2: Run static checks**

Run: `npm run typecheck`
Expected: PASS.

**Step 3: Manual QA in Reports page**

Run: `npm run dev`

Manual checks:
1. Login as `global` or `regional_leader`.
2. Open `/reports` -> tab `Xuất-Nhập-Tồn`.
3. Select one facility (not `Tất cả cơ sở`).
4. Verify inside `Phân bố trạng thái thiết bị`:
- Donut appears on the left (desktop), status cards on the right.
- Donut values match card totals/percentages.
- On narrow viewport, donut stacks above status list.
5. Switch facility and verify donut updates for selected facility.
6. Select `Tất cả cơ sở` and confirm this section remains hidden (unchanged behavior).

**Step 4: Commit (if any QA tweak was needed)**

```bash
git add -A
git commit -m "chore: finalize QA polish for reports status donut"
```

---

## Notes for Implementer

- Do not add/modify Supabase migrations for this feature.
- Do not change RPC proxy security behavior in `src/app/api/rpc/[fn]/route.ts`.
- Keep this chart strictly scoped to currently selected facility in existing flow.
- Preserve existing KPI/status list behavior and loading/error handling.
