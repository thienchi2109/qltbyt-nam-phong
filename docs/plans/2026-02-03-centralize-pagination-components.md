# Plan: Centralize Pagination Components

**Created:** 2026-02-03
**Updated:** 2026-02-03 (Post-Review)
**Status:** Ready for Implementation
**Estimated Lines Removed:** ~500+

---

## Summary

Audit found **9 separate pagination implementations** across Equipment, Repair Requests, Transfers, Maintenance, Users, Reports, and Dashboard pages with **~658+ lines of duplicated code**. This plan creates a **shared `DataTablePagination` component** and **`usePaginationState` hook** to centralize these implementations.

---

## Review Findings (2026-02-03)

Three specialized agents reviewed this plan. Key changes incorporated:

| Finding | Source | Resolution |
|---------|--------|------------|
| 3 missing implementations | Code Reviewer | Added Users, InventoryTable, Dashboard Tabs |
| Dual control mode ambiguity | Architect | Require `mode` when paginationMode is provided |
| `resetDependencies` fragility | Architect | Replace with `resetKey: string \| number` |
| `indexMode` unused | Architect | Removed from hook |
| Missing `React.memo` | Frontend | Added to sub-components |
| Inconsistent breakpoints | Frontend | Added granular `responsive` prop |
| Missing tests | Code Reviewer | Added testing strategy section |
| Edge case: `pageCount === 0` | Code Reviewer | Allow 0-page empty state |

---

## Current State Analysis

| Module | File | Lines | Issues |
|--------|------|-------|--------|
| Equipment | `src/components/equipment/equipment-pagination.tsx` | 152 | Module-specific type, hardcoded entity |
| RepairRequests | `src/app/(app)/repair-requests/_components/RepairRequestsPagination.tsx` | 111 | Already generic `<T>`, different display format |
| Transfers | `src/app/(app)/transfers/page.tsx` (lines 591-662) | ~70 | **Inline JSX**, no component |
| Maintenance Plans | `src/app/(app)/maintenance/_components/plans-table.tsx` (lines 118-190) | ~72 | **1-based page**, page sizes include 200, "(đã lọc)" suffix |
| Maintenance Tasks | `src/app/(app)/maintenance/_components/tasks-table.tsx` (lines 142-208) | ~66 | Selection count display, TanStack Table integration |
| **Users** | `src/app/(app)/users/page.tsx` (lines 479-549) | ~70 | Inline JSX, uses `lg` breakpoint |
| **InventoryTable** | `src/app/(app)/reports/components/inventory-table.tsx` (lines 311-358) | ~50 | No page size selector, simpler buttons |
| **Dashboard Tabs** | `src/components/dashboard/dashboard-tabs.tsx` (lines 257-280, 363-386) | ~50 | Custom 1-based, "Trước/Sau" only - **may keep separate** |
| Shared | `src/components/responsive-pagination-info.tsx` | 37 | Hardcoded "thiết bị" text |

### Common Patterns Identified

- Page state: `{ pageIndex: number; pageSize: number }` (0-based)
- Page sizes: `[10, 20, 50, 100]` (some add 200)
- Mobile: Hide first/last buttons, larger touch targets (`h-10 w-10 rounded-xl`)
- Filter reset logic in `useEquipmentTable.ts` (lines 125-159)
- Bounds checking after deletions

### Key Differences

| Feature | Equipment | RepairRequests | Transfers | Plans | Tasks | Users | Inventory |
|---------|-----------|----------------|-----------|-------|-------|-------|-----------|
| Display format | "X trên Y" | "X-Y trên Z" | Inline | "X trên Y" | Selection | "X trên Y" | "X trên Y" |
| Page indexing | 0-based | 0-based | 0-based | **1-based** | 0-based | 0-based | 0-based |
| Page sizes | `[10,20,50,100]` | `[10,20,50,100]` | `[10,20,50,100]` | `[10,20,50,100,200]` | `[10,20,50,100]` | `[10,20,50,100]` | None |
| Export button | Yes | No | No | No | No | No | No |
| Filtered indicator | No | No | No | Yes | No | No | No |
| Selection count | No | No | No | No | Yes | No | No |
| First/Last breakpoint | sm | lg | sm | lg | lg | lg | None |
| Size selector mobile | Hidden | Visible | Visible | Visible | Visible | Visible | None |

---

## Implementation Plan

### Step 1: Create Shared Types (Discriminated Unions)

**New file:** `src/components/shared/DataTablePagination/types.ts`

```typescript
import type { Table, RowData } from "@tanstack/react-table"

// ============================================================================
// Display Types
// ============================================================================

export type DisplayFormat =
  | "count-total"      // "X trên Y thiết bị"
  | "range-total"      // "X-Y trên tổng Z yêu cầu"
  | "selection-count"  // "Đã chọn X trên Y công việc"
  | "compact"          // "X / Y" (mobile)

export interface DisplayContext {
  startItem: number
  endItem: number
  totalCount: number
  currentPage: number
  totalPages: number
  selectedCount?: number
  entity: EntityLabels
}

export interface EntityLabels {
  singular: string      // "thiết bị", "yêu cầu", "kế hoạch", "công việc"
  plural?: string       // Optional, defaults to singular
}

// ============================================================================
// Pagination Mode Types (Discriminated Unions)
// ============================================================================

/** Mode 1: TanStack Table manages state internally (default when paginationMode is omitted) */
interface TanStackManagedMode {
  mode: "tanstack"
}

/** Mode 2: External controlled pagination (0-based) */
interface ControlledMode {
  mode: "controlled"
  pagination: { pageIndex: number; pageSize: number }
  onPaginationChange: (pagination: { pageIndex: number; pageSize: number }) => void
}

/** Mode 3: Server-side pagination (1-based) */
interface ServerMode {
  mode: "server"
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export type PaginationMode = TanStackManagedMode | ControlledMode | ServerMode

// ============================================================================
// Responsive Configuration
// ============================================================================

export interface ResponsiveConfig {
  /** Breakpoint to show first/last nav buttons (default: "sm") */
  showFirstLastAt?: "sm" | "md" | "lg"
  /** Breakpoint to show page size selector, null = always show (default: null) */
  showSizeSelectorAt?: "sm" | "md" | "lg" | null
  /** Breakpoint to stack layout vertically (default: "sm") */
  stackLayoutAt?: "sm" | "md" | "lg"
}

// ============================================================================
// Main Component Props
// ============================================================================

export interface DataTablePaginationProps<TData extends RowData> {
  // Required
  table: Table<TData>
  totalCount: number
  entity: EntityLabels

  // Pagination control (discriminated union)
  // Omit paginationMode to use TanStack internal state
  paginationMode?: PaginationMode

  // Display options
  displayFormat?: DisplayFormat | ((ctx: DisplayContext) => React.ReactNode)
  showFilteredIndicator?: boolean
  isFiltered?: boolean

  // Configuration
  pageSizeOptions?: number[]
  responsive?: ResponsiveConfig

  // State
  isLoading?: boolean
  disabled?: boolean
  enabled?: boolean

  // Extra content slots
  slots?: {
    beforeInfo?: React.ReactNode
    afterInfo?: React.ReactNode
    beforeNav?: React.ReactNode
    afterNav?: React.ReactNode
  }

  // Accessibility
  ariaLabels?: {
    firstPage?: string   // default: "Đến trang đầu"
    prevPage?: string    // default: "Trang trước"
    nextPage?: string    // default: "Trang tiếp"
    lastPage?: string    // default: "Đến trang cuối"
  }

  // Styling
  className?: string
}

// ============================================================================
// Hook Types
// ============================================================================

export interface UsePaginationStateOptions {
  initialPageSize?: number
  initialPageIndex?: number
  totalCount: number
  /** Simple key for reset - changes trigger reset to page 0 */
  resetKey?: string | number
}

export interface UsePaginationStateReturn {
  pagination: { pageIndex: number; pageSize: number }
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  pageCount: number
  /** 1-based page for display */
  displayPage: number
  resetToFirstPage: () => void
  setPageSize: (size: number) => void
  /** Navigate to 1-based page number */
  goToPage: (page: number) => void
  canPreviousPage: boolean
  canNextPage: boolean
}
```

### Step 2: Create usePaginationState Hook

**New file:** `src/hooks/usePaginationState.ts`

```typescript
import * as React from "react"
import type { UsePaginationStateOptions, UsePaginationStateReturn } from "@/components/shared/DataTablePagination/types"

export function usePaginationState({
  initialPageSize = 20,
  initialPageIndex = 0,
  totalCount,
  resetKey,
}: UsePaginationStateOptions): UsePaginationStateReturn {
  const [pagination, setPagination] = React.useState({
    pageIndex: initialPageIndex,
    pageSize: initialPageSize,
  })

  const pageCount = Math.max(0, Math.ceil(totalCount / pagination.pageSize))

  // Auto-reset to first page when resetKey changes
  const prevResetKey = React.useRef(resetKey)
  React.useEffect(() => {
    if (resetKey !== prevResetKey.current) {
      setPagination(prev => ({ ...prev, pageIndex: 0 }))
      prevResetKey.current = resetKey
    }
  }, [resetKey])

  // Bounds checking - ensure pageIndex doesn't exceed pageCount
  // Handles: deletion of last items on page, filter reducing results
  React.useEffect(() => {
    // Guard against pageCount === 0 (empty state)
    if (pageCount === 0) return
    if (pagination.pageIndex >= pageCount) {
      setPagination(prev => ({ ...prev, pageIndex: Math.max(0, pageCount - 1) }))
    }
  }, [pagination.pageIndex, pageCount])

  const resetToFirstPage = React.useCallback(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [])

  const setPageSize = React.useCallback((size: number) => {
    setPagination({ pageIndex: 0, pageSize: size })
  }, [])

  const goToPage = React.useCallback((page: number) => {
    // Accept 1-based page, convert to 0-based internally
    setPagination(prev => ({ ...prev, pageIndex: Math.max(0, page - 1) }))
  }, [])

  return {
    pagination,
    setPagination,
    pageCount,
    displayPage: pagination.pageIndex + 1,
    resetToFirstPage,
    setPageSize,
    goToPage,
    canPreviousPage: pagination.pageIndex > 0,
    canNextPage: pagination.pageIndex < pageCount - 1,
  }
}
```

### Step 3: Create Shared Components

**Directory structure:**
```
src/components/shared/DataTablePagination/
├── index.ts                              # Barrel export + compound component
├── types.ts                              # Shared types (~120 lines)
├── DataTablePagination.tsx               # Main component (~120 lines)
├── DataTablePaginationInfo.tsx           # Display info (~70 lines)
├── DataTablePaginationSizeSelector.tsx   # Page size select (~50 lines)
└── DataTablePaginationNavigation.tsx     # Nav buttons (~80 lines)
```

**Barrel export with compound component pattern:**
```typescript
// index.ts
import { DataTablePaginationMain } from "./DataTablePagination"
import { DataTablePaginationInfo } from "./DataTablePaginationInfo"
import { DataTablePaginationSizeSelector } from "./DataTablePaginationSizeSelector"
import { DataTablePaginationNavigation } from "./DataTablePaginationNavigation"

export const DataTablePagination = Object.assign(DataTablePaginationMain, {
  Info: DataTablePaginationInfo,
  SizeSelector: DataTablePaginationSizeSelector,
  Navigation: DataTablePaginationNavigation,
})

export type { DataTablePaginationProps, EntityLabels, DisplayFormat } from "./types"
```

**Sub-components with React.memo:**
```typescript
// DataTablePaginationInfo.tsx
export const DataTablePaginationInfo = React.memo(function DataTablePaginationInfo({
  displayCount,
  totalCount,
  entity,
  displayFormat,
  isFiltered,
  showFilteredIndicator,
}: DataTablePaginationInfoProps) {
  // Implementation
})
```

**Main component usage:**
```typescript
// Basic usage (TanStack Table managed - default mode)
<DataTablePagination
  table={table}
  totalCount={total}
  entity={{ singular: "thiết bị" }}
/>

// Controlled mode (0-based external state)
<DataTablePagination<Equipment>
  table={table}
  totalCount={total}
  paginationMode={{
    mode: "controlled",
    pagination: pagination,
    onPaginationChange: setPagination,
  }}
  entity={{ singular: "kế hoạch" }}
  displayFormat="count-total"
  showFilteredIndicator
  isFiltered={hasActiveFilters}
  pageSizeOptions={[10, 20, 50, 100, 200]}
  responsive={{ showFirstLastAt: "lg" }}
  isLoading={isLoading}
  enabled={shouldFetch}
  slots={{ beforeNav: <ExportButton /> }}
/>

// Server mode (1-based pagination)
<DataTablePagination
  table={table}
  totalCount={total}
  paginationMode={{
    mode: "server",
    currentPage: currentPage,
    totalPages: totalPages,
    pageSize: pageSize,
    onPageChange: setCurrentPage,
    onPageSizeChange: setPageSize,
  }}
  entity={{ singular: "kế hoạch" }}
/>
```

### Step 4: Migration Order (Incremental, Lowest Risk First)

| Order | Module | File | Complexity | Notes |
|-------|--------|------|------------|-------|
| 1 | Transfers | `page.tsx` | Low | Replace inline JSX with component |
| 2 | RepairRequests | `RepairRequestsPagination.tsx` | Low | Already generic, straightforward swap |
| 3 | InventoryTable | `inventory-table.tsx` | Low | Simple inline, no page size selector |
| 4 | Users | `users/page.tsx` | Medium | Inline JSX, uses lg breakpoint |
| 5 | Maintenance Tasks | `tasks-table.tsx` | Medium | Selection count display |
| 6 | Maintenance Plans | `plans-table.tsx` | Medium | 1-based pagination, page sizes with 200 |
| 7 | Equipment | `equipment-pagination.tsx` | High | Export button via slots, enabled prop |
| 8 | Dashboard Tabs | `dashboard-tabs.tsx` | Low | **Evaluate if shared component fits** |

**Note on Dashboard Tabs:** Uses simplified "Trước/Sau" (Previous/Next) buttons without first/last navigation. May be better to keep as-is for dashboard-specific design, or create a simplified variant.

### Step 5: Deprecate Old Components

After all migrations complete and verified:
1. Remove `src/components/responsive-pagination-info.tsx`
2. Remove module-specific pagination files
3. Update import paths across codebase

**Important:** Delete `responsive-pagination-info.tsx` only AFTER Equipment migration is verified working.

---

## Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/components/shared/DataTablePagination/index.ts` | Barrel export | 15 |
| `src/components/shared/DataTablePagination/types.ts` | Shared types | 120 |
| `src/components/shared/DataTablePagination/DataTablePagination.tsx` | Main component | 120 |
| `src/components/shared/DataTablePagination/DataTablePaginationInfo.tsx` | Display info | 70 |
| `src/components/shared/DataTablePagination/DataTablePaginationSizeSelector.tsx` | Page size select | 50 |
| `src/components/shared/DataTablePagination/DataTablePaginationNavigation.tsx` | Nav buttons | 80 |
| `src/hooks/usePaginationState.ts` | Pagination hook | 65 |

**Total new code:** ~520 lines

## Files to Migrate

| File | Lines to Remove | Migration Notes |
|------|-----------------|-----------------|
| `src/app/(app)/transfers/page.tsx` | ~70 | Replace inline JSX |
| `src/app/(app)/repair-requests/_components/RepairRequestsPagination.tsx` | ~100 | Replace with import |
| `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx` | ~5 | Update imports |
| `src/app/(app)/reports/components/inventory-table.tsx` | ~50 | Replace pagination section |
| `src/app/(app)/users/page.tsx` | ~70 | Replace inline JSX |
| `src/app/(app)/maintenance/_components/plans-table.tsx` | ~72 | Replace pagination section |
| `src/app/(app)/maintenance/_components/tasks-table.tsx` | ~66 | Replace pagination section |
| `src/components/equipment/equipment-pagination.tsx` | ~140 | Replace with shared component |
| `src/app/(app)/equipment/_components/EquipmentPageClient.tsx` | ~5 | Update imports |
| `src/components/dashboard/dashboard-tabs.tsx` | ~50 | **Optional** - evaluate fit |

**Total lines removed:** ~628 (excluding optional Dashboard)

## Files to Delete (After Migration)

- `src/components/responsive-pagination-info.tsx` (37 lines)

---

## Testing Strategy

### Unit Tests (`DataTablePagination.test.tsx`)

```typescript
describe('DataTablePagination', () => {
  // Rendering
  it('renders with minimal required props')
  it('renders nothing when enabled is false')
  it('shows correct page info for single page')
  it('shows correct page info for multiple pages')

  // Display formats
  it('renders "count-total" format: "X trên Y thiết bị"')
  it('renders "range-total" format: "X-Y trên tổng Z"')
  it('renders "selection-count" format: "Đã chọn X trên Y"')
  it('renders custom format via render prop')

  // Entity labels
  it('uses singular entity label')
  it('uses plural entity label when provided')

  // Responsive behavior
  it('hides first/last buttons below showFirstLastAt breakpoint')
  it('hides size selector below showSizeSelectorAt breakpoint')

  // Pagination modes
  it('works with tanstack mode (default)')
  it('works with controlled mode')
  it('works with server mode (1-based)')

  // Filter indicator
  it('shows "(đã lọc)" suffix when isFiltered is true')
  it('hides filter indicator when showFilteredIndicator is false')

  // Slots
  it('renders beforeNav slot content')
  it('renders afterInfo slot content')

  // Loading state
  it('disables buttons when isLoading is true')

  // Accessibility
  it('uses custom aria labels when provided')
  it('uses Vietnamese defaults for aria labels')
})
```

### Unit Tests (`usePaginationState.test.ts`)

```typescript
describe('usePaginationState', () => {
  // Initialization
  it('initializes with default values')
  it('initializes with custom values')

  // Bounds checking (CRITICAL)
  it('clamps pageIndex when totalCount decreases')
  it('resets to page 0 when pageCount becomes 1')
  it('handles totalCount of 0 without infinite loop (pageCount = 0)')
  it('handles negative totalCount gracefully')

  // Reset on key change
  it('resets to first page when resetKey changes')
  it('does not reset when resetKey is stable')

  // Page size changes
  it('resets to first page when page size changes')

  // Navigation
  it('goToPage accepts 1-based page number')
  it('canPreviousPage is false on first page')
  it('canNextPage is false on last page')
  it('displayPage is always 1-indexed')
})
```

### Integration Tests

```typescript
describe('DataTablePagination integration', () => {
  it('synchronizes with table.getCanPreviousPage()')
  it('synchronizes with table.getCanNextPage()')
  it('calls table.setPageIndex() on button click')
  it('calls table.setPageSize() on size change')
  it('selection count reflects table.getFilteredSelectedRowModel()')
})
```

---

## Verification Checklist

### Build & Types
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run build
node scripts/npm-run.js run test:run
```

### Manual Testing (Each Module)

- [ ] **Equipment page**
  - [ ] Navigate through pages
  - [ ] Change page size (resets to page 1)
  - [ ] Export button works
  - [ ] Mobile: first/last buttons hidden, touch targets 44x44
  - [ ] Filter changes reset pagination

- [ ] **Repair Requests page**
  - [ ] Navigate through pages
  - [ ] Display format shows range "X-Y trên tổng Z"
  - [ ] Mobile responsive

- [ ] **Transfers page**
  - [ ] Navigate through pages
  - [ ] Page size selector works

- [ ] **Users page**
  - [ ] Navigate through pages
  - [ ] Uses lg breakpoint for first/last buttons

- [ ] **Inventory Table (Reports)**
  - [ ] Navigate through pages
  - [ ] No page size selector (intentional)

- [ ] **Maintenance Plans**
  - [ ] Navigate through pages (1-based)
  - [ ] Page sizes include 200
  - [ ] "(đã lọc)" shows when filtered
  - [ ] Desktop: lg breakpoint for first/last buttons

- [ ] **Maintenance Tasks**
  - [ ] Navigate through pages
  - [ ] Selection count displays correctly
  - [ ] Desktop: lg breakpoint for first/last buttons

### Accessibility Testing

- [ ] Keyboard navigation works (Tab, Shift+Tab)
- [ ] Focus indicators visible on all interactive elements
- [ ] Screen reader announces page changes
- [ ] Touch targets meet 44x44px minimum on mobile
- [ ] Select dropdown keyboard navigable
- [ ] Disabled states properly communicated

### Performance Testing

- [ ] No unnecessary re-renders on page change (React DevTools Profiler)
- [ ] Entity prop uses stable reference (not inline object)
- [ ] Filter changes reset pagination without layout shift
- [ ] Large page sizes (200) don't cause jank

---

## Benefits

| Benefit | Impact |
|---------|--------|
| **~500+ lines removed** | Less code to maintain |
| **Consistent behavior** | Same UX across all tables |
| **Single source of truth** | Fix bugs in one place |
| **Better mobile UX** | Unified touch targets and responsive patterns |
| **Type-safe** | Discriminated unions prevent invalid prop combinations |
| **Flexible** | Props, slots, and render props cover all variations |
| **Testable** | Isolated components with clear interfaces |

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing pages | Medium | Incremental migration, test each page |
| Different layouts break | Low | Flexibility via responsive config and slots |
| Missing edge cases | Low | Comprehensive test suite |
| 1-based vs 0-based confusion | Low | Clear `mode: "server"` discriminant |
| Performance regression | Low | React.memo on sub-components |

---

## Implementation Notes

### Stable Entity Reference

To prevent unnecessary re-renders, define entity labels as constants:

```typescript
// WRONG - Creates new object on every render
<DataTablePagination entity={{ singular: "thiết bị" }} />

// CORRECT - Stable reference
const EQUIPMENT_LABEL = { singular: "thiết bị" } as const
<DataTablePagination entity={EQUIPMENT_LABEL} />
```

### Mobile Touch Targets

All navigation buttons use WCAG 2.1 AAA compliant touch targets:

```typescript
// 44x44 on mobile, 32x32 on desktop
className="h-11 w-11 rounded-xl sm:h-8 sm:w-8"
```

### Aria Labels (Vietnamese)

Default labels are in Vietnamese:

```typescript
const DEFAULT_ARIA_LABELS = {
  firstPage: "Đến trang đầu",
  prevPage: "Trang trước",
  nextPage: "Trang tiếp",
  lastPage: "Đến trang cuối",
}
```

---

## Technical Debt Flagged

**Users page security issue:** The Users page (`src/app/(app)/users/page.tsx`) directly accesses Supabase tables, violating the RPC-only architecture. This is outside the scope of pagination centralization but should be addressed in a future sprint.

```typescript
// VIOLATION - Direct table access
const { data } = await supabase.from("nhan_vien").select("*")

// SHOULD BE - RPC call
const { data } = await callRpc({ fn: 'user_list', args: { p_don_vi } })
```
