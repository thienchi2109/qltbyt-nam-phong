# Fix: KPI Cards Show "0" for Privileged Users on Initial Page Load

## Context

**Problem:** For `global`/`admin`/`regional_leader` users, KPI summary cards on the Repair Requests page show "0" on initial load when no tenant is selected — even though repair requests exist in the database. Cards only show correct values after the user explicitly selects a tenant.

**Root Cause:** Client-side gating issue. Both the KPI status counts query AND the table list query share the same `enabled: !!user && shouldFetchData` condition. `shouldFetchData` is `false` when `selectedFacilityId === undefined` (no prior selection in sessionStorage). No queries fire → KPI cards default to "0".

**Backend verified safe via Supabase MCP:**
- SQL `repair_request_status_counts` correctly handles `p_don_vi = NULL` for global users (returns all-tenant counts)
- `allowed_don_vi_for_session()` correctly scopes `regional_leader` to their `dia_ban_id` region
- RPC proxy does not override `p_don_vi` for global/regional_leader users

**Security reviewed: PASS** — Server-side enforcement unaffected by this client-side change.

**Why NOT a global auto-default:** Auto-defaulting `selectedFacilityId` to `null` in `TenantSelectionContext` was rejected because Transfers Kanban has a deliberate performance guard requiring a SPECIFIC facility, and global cross-tenant queries are a performance risk.

## Implementation: Page-Level KPI-Only Fix

**Approach:** Decouple the KPI status counts query from `shouldFetchData` on the Repair Requests page. KPIs always fire for authenticated users. The table/list query stays gated. No changes to `TenantSelectionContext`.

### Step 1: Decouple KPI query from `shouldFetchData`

**File:** `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx`

**A. Change the status counts query** (lines 222-246):
- Change `enabled` from `!!user && shouldFetchData` to `!!user`
- Coalesce `selectedFacilityId` from `undefined` to `null` in args

```typescript
const { data: statusCounts, isLoading: statusCountsLoading } = useQuery<Record<Status, number>>({
  queryKey: ['repair_request_status_counts', {
    tenant: effectiveTenantKey,
    role: user?.role,
    diaBan: user?.dia_ban_id,
    facilityId: selectedFacilityId ?? null,  // undefined → null for aggregate
    search: debouncedSearch,
    dateFrom: uiFilters.dateRange?.from || null,
    dateTo: uiFilters.dateRange?.to || null,
  }],
  queryFn: async () => {
    const res = await callRpc<Record<Status, number>>({
      fn: 'repair_request_status_counts',
      args: {
        p_q: debouncedSearch || null,
        p_don_vi: selectedFacilityId ?? null,  // undefined → null
        p_date_from: uiFilters.dateRange?.from || null,
        p_date_to: uiFilters.dateRange?.to || null,
      },
    })
    return res as Record<Status, number>
  },
  staleTime: 30_000,
  enabled: !!user,  // Always fetch — KPI should always show data
})
```

**B. Keep the table/list query gated** (line 200 — NO change):
```typescript
enabled: !!user && shouldFetchData,
```

**C. Fix "Tổng" KPI total source** (around lines 483-484):

Current: `totalRequests` comes from the list query (status-filter-aware, gated by `shouldFetchData`).
New: Use sum of `statusCounts` — always available, gives correct overall total.

**Semantic note:** This is actually a correction. Currently "Total" KPI changes when status filters are applied to the table (e.g., filtering by "Chờ xử lý" makes Total = that status only). Using `sum(statusCounts)` makes "Total" = sum of all statuses = **overall unfiltered total**, which is consistent with how KPI summary bars should behave.

```typescript
const kpiTotal = React.useMemo(() => {
  if (!statusCounts) return 0
  return Object.values(statusCounts).reduce((sum, v) => sum + (v || 0), 0)
}, [statusCounts])

const base: SummaryItem[] = [
  { key: 'total', label: 'Tổng', value: kpiTotal, ... },
]
```

**D. Add tenant selection placeholder** when `shouldFetchData` is false:

Currently no placeholder exists. Add one for the table area (reuse pattern from `src/components/transfers/TransfersTenantSelectionPlaceholder.tsx`):

```typescript
{shouldFetchData ? (
  // existing table/card content
) : (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <Building2 className="h-12 w-12 text-muted-foreground" />
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Chọn cơ sở y tế</h3>
        <p className="text-sm text-muted-foreground">
          Vui lòng chọn một cơ sở y tế từ bộ lọc phía trên để xem danh sách yêu cầu sửa chữa.
        </p>
      </div>
    </div>
  </div>
)}
```

### Step 2: No changes to other files

- **`TenantSelectionContext.tsx`** — NO changes
- **Transfers/Equipment/Reports** — NO changes
- **Existing tenant-selection tests** — NO changes

### Step 3: Add test coverage

**File:** `src/app/(app)/repair-requests/__tests__/RepairRequestsKpi.test.tsx` (new)

Tests:
1. KPI query fires without tenant selection (global user, `shouldFetchData = false`)
2. KPI total = sum of status counts (verify computation)
3. Table query stays gated by `shouldFetchData`
4. Placeholder shown when no tenant selected
5. KPI total stays consistent when status filter is applied to table

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx` | Decouple KPI query, fix total, add placeholder |
| `src/app/(app)/repair-requests/__tests__/RepairRequestsKpi.test.tsx` | New test file |

## Verification

1. Typecheck: `node scripts/npm-run.js run typecheck`
2. Run tests: `node scripts/npm-run.js run test:run`
3. Manual: Global user → Repair Requests → KPI cards show actual counts + table shows "Chọn cơ sở y tế"
4. Manual: Select tenant → KPIs update + table loads
5. Manual: Apply status filter → KPI "Total" stays as overall total
6. Manual: `to_qltb` user → behavior unchanged
