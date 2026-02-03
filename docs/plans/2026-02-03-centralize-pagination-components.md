# Plan: Centralize Pagination Components

**Created:** 2026-02-03
**Status:** Ready for Implementation
**Estimated Lines Removed:** ~350+

---

## Summary

Audit found **6 separate pagination implementations** across Equipment, Repair Requests, Transfers, and Maintenance pages with **~508+ lines of duplicated code**. This plan creates a **shared `DataTablePagination` component** and **`usePaginationState` hook** to centralize these implementations.

---

## Current State Analysis

| Module | File | Lines | Issues |
|--------|------|-------|--------|
| Equipment | `src/components/equipment/equipment-pagination.tsx` | 152 | Module-specific type, hardcoded entity |
| RepairRequests | `src/app/(app)/repair-requests/_components/RepairRequestsPagination.tsx` | 111 | Already generic `<T>`, different display format |
| Transfers | `src/app/(app)/transfers/page.tsx` (lines 591-662) | ~70 | **Inline JSX**, no component |
| Maintenance Plans | `src/app/(app)/maintenance/_components/plans-table.tsx` (lines 118-190) | ~72 | **1-based page**, page sizes include 200, "(đã lọc)" suffix |
| Maintenance Tasks | `src/app/(app)/maintenance/_components/tasks-table.tsx` (lines 142-208) | ~66 | Selection count display, TanStack Table integration |
| Shared | `src/components/responsive-pagination-info.tsx` | 37 | Hardcoded "thiết bị" text |

### Common Patterns Identified

- Page state: `{ pageIndex: number; pageSize: number }` (0-based)
- Page sizes: `[10, 20, 50, 100]` (some add 200)
- Mobile: Hide first/last buttons, larger touch targets (`h-10 w-10 rounded-xl`)
- Filter reset logic in `useEquipmentTable.ts` (lines 125-159)
- Bounds checking after deletions

### Key Differences

| Feature | Equipment | RepairRequests | Transfers | Plans | Tasks |
|---------|-----------|----------------|-----------|-------|-------|
| Display format | "X trên Y thiết bị" | "X-Y trên tổng Z" | Inline | "X trên Y kế hoạch" | Selection count |
| Page indexing | 0-based | 0-based | 0-based | **1-based** | 0-based |
| Page sizes | `[10,20,50,100]` | `[10,20,50,100]` | `[10,20,50,100]` | `[10,20,50,100,200]` | `[10,20,50,100]` |
| Export button | Yes | No | No | No | No |
| Filtered indicator | No | No | No | Yes "(đã lọc)" | No |
| Selection count | No | No | No | No | Yes |
| Responsive breakpoint | sm | sm | sm | lg | lg |

---

## Implementation Plan

### Step 1: Create Shared Types

**New file:** `src/components/shared/DataTablePagination/types.ts`

```typescript
import type { Table, RowData } from "@tanstack/react-table"

export type PaginationIndexMode = "zero-based" | "one-based"

export type DisplayFormat =
  | "count-total"      // "X trên Y thiết bị"
  | "range-total"      // "X-Y trên tổng Z yêu cầu"
  | "selection-count"  // "Đã chọn X trên Y công việc"
  | "compact"          // "X / Y" (mobile)

export interface EntityLabels {
  singular: string      // "thiết bị", "yêu cầu", "kế hoạch", "công việc"
  plural?: string       // Optional, defaults to singular
}

export interface DataTablePaginationProps<TData extends RowData> {
  // Required
  table: Table<TData>
  totalCount: number

  // Pagination control (choose one mode)
  pagination?: { pageIndex: number; pageSize: number }  // For controlled 0-based
  serverPage?: number                                    // For 1-based server pagination
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  onPageChange?: (page: number) => void                  // For 1-based
  onPageSizeChange?: (size: number) => void

  // Display
  entity: EntityLabels
  displayFormat?: DisplayFormat
  showFilteredIndicator?: boolean
  isFiltered?: boolean

  // Options
  pageSizeOptions?: number[]
  responsiveBreakpoint?: "sm" | "md" | "lg"

  // State
  isLoading?: boolean
  enabled?: boolean

  // Extra content
  extraContent?: React.ReactNode
  extraContentPosition?: "before-info" | "after-info" | "before-nav" | "after-nav"
}

export interface UsePaginationStateOptions {
  initialPageSize?: number
  initialPageIndex?: number
  totalCount: number
  resetDependencies?: unknown[]
  indexMode?: PaginationIndexMode
}

export interface UsePaginationStateReturn {
  pagination: { pageIndex: number; pageSize: number }
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  pageCount: number
  currentPage: number      // 1-based for display
  rpcPage: number          // 1-based for RPC calls
  resetToFirstPage: () => void
  setPageSize: (size: number) => void
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
  resetDependencies = [],
  indexMode = "zero-based",
}: UsePaginationStateOptions): UsePaginationStateReturn {
  const [pagination, setPagination] = React.useState({
    pageIndex: initialPageIndex,
    pageSize: initialPageSize,
  })

  const pageCount = Math.max(1, Math.ceil(totalCount / pagination.pageSize))

  // Auto-reset to first page when dependencies change
  const depsRef = React.useRef(resetDependencies)
  React.useEffect(() => {
    const depsChanged = resetDependencies.some(
      (dep, i) => dep !== depsRef.current[i]
    )
    if (depsChanged) {
      setPagination(prev => ({ ...prev, pageIndex: 0 }))
      depsRef.current = resetDependencies
    }
  }, resetDependencies)

  // Bounds checking - ensure pageIndex doesn't exceed pageCount
  React.useEffect(() => {
    if (pagination.pageIndex >= pageCount && pageCount > 0) {
      setPagination(prev => ({ ...prev, pageIndex: pageCount - 1 }))
    }
  }, [pagination.pageIndex, pageCount])

  const resetToFirstPage = React.useCallback(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [])

  const setPageSize = React.useCallback((size: number) => {
    setPagination({ pageIndex: 0, pageSize: size })
  }, [])

  return {
    pagination,
    setPagination,
    pageCount,
    currentPage: pagination.pageIndex + 1,
    rpcPage: pagination.pageIndex + 1,
    resetToFirstPage,
    setPageSize,
    canPreviousPage: pagination.pageIndex > 0,
    canNextPage: pagination.pageIndex < pageCount - 1,
  }
}
```

### Step 3: Create Shared Components

**Directory structure:**
```
src/components/shared/DataTablePagination/
├── index.ts                              # Barrel export
├── types.ts                              # Shared types (~80 lines)
├── DataTablePagination.tsx               # Main component (~100 lines)
├── DataTablePaginationInfo.tsx           # Display info (~60 lines)
├── DataTablePaginationSizeSelector.tsx   # Page size select (~40 lines)
└── DataTablePaginationNavigation.tsx     # Nav buttons (~70 lines)
```

**Main component API:**
```typescript
// Basic usage (TanStack Table controlled)
<DataTablePagination
  table={table}
  totalCount={total}
  entity={{ singular: "thiết bị" }}
/>

// With all options
<DataTablePagination<Equipment>
  table={table}
  totalCount={total}
  pagination={pagination}
  onPaginationChange={setPagination}
  entity={{ singular: "kế hoạch" }}
  displayFormat="count-total"
  showFilteredIndicator
  isFiltered={hasActiveFilters}
  pageSizeOptions={[10, 20, 50, 100, 200]}
  responsiveBreakpoint="lg"
  isLoading={isLoading}
  enabled={shouldFetch}
  extraContent={<ExportButton />}
  extraContentPosition="before-nav"
/>

// Server-side 1-based pagination
<DataTablePagination
  table={table}
  totalCount={total}
  serverPage={currentPage}
  onPageChange={setCurrentPage}
  onPageSizeChange={setPageSize}
  entity={{ singular: "kế hoạch" }}
/>
```

### Step 4: Migration Order (Incremental, Lowest Risk First)

| Order | Module | File | Complexity | Notes |
|-------|--------|------|------------|-------|
| 1 | Transfers | `page.tsx` | Low | Replace inline JSX with component |
| 2 | RepairRequests | `RepairRequestsPagination.tsx` | Low | Already generic, straightforward swap |
| 3 | Maintenance Tasks | `tasks-table.tsx` | Medium | Add selection count via `displayFormat` |
| 4 | Maintenance Plans | `plans-table.tsx` | Medium | Handle 1-based pagination, page sizes with 200 |
| 5 | Equipment | `equipment-pagination.tsx` | High | Export button via `extraContent`, `enabled` prop |

### Step 5: Deprecate Old Components

After all migrations complete:
- Remove `src/components/responsive-pagination-info.tsx`
- Remove module-specific pagination files

---

## Files to Create

| File | Purpose | Est. Lines |
|------|---------|------------|
| `src/components/shared/DataTablePagination/index.ts` | Barrel export | 10 |
| `src/components/shared/DataTablePagination/types.ts` | Shared types | 80 |
| `src/components/shared/DataTablePagination/DataTablePagination.tsx` | Main component | 100 |
| `src/components/shared/DataTablePagination/DataTablePaginationInfo.tsx` | Display info | 60 |
| `src/components/shared/DataTablePagination/DataTablePaginationSizeSelector.tsx` | Page size select | 40 |
| `src/components/shared/DataTablePagination/DataTablePaginationNavigation.tsx` | Nav buttons | 70 |
| `src/hooks/usePaginationState.ts` | Pagination hook | 60 |

**Total new code:** ~420 lines

## Files to Migrate

| File | Lines to Remove | Migration Notes |
|------|-----------------|-----------------|
| `src/app/(app)/transfers/page.tsx` | ~70 | Replace inline JSX |
| `src/app/(app)/repair-requests/_components/RepairRequestsPagination.tsx` | ~100 | Replace with import |
| `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx` | ~5 | Update imports |
| `src/app/(app)/maintenance/_components/plans-table.tsx` | ~72 | Replace pagination section |
| `src/app/(app)/maintenance/_components/tasks-table.tsx` | ~66 | Replace pagination section |
| `src/components/equipment/equipment-pagination.tsx` | ~140 | Replace with shared component |
| `src/app/(app)/equipment/_components/EquipmentPageClient.tsx` | ~5 | Update imports |

**Total lines removed:** ~458

## Files to Delete (After Migration)

- `src/components/responsive-pagination-info.tsx` (37 lines)

---

## Verification Checklist

### Build & Types
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run build
```

### Manual Testing (Each Module)

- [ ] **Equipment page**
  - [ ] Navigate through pages
  - [ ] Change page size (resets to page 1)
  - [ ] Export button works
  - [ ] Mobile: first/last buttons hidden, touch targets 40x40
  - [ ] Filter changes reset pagination

- [ ] **Repair Requests page**
  - [ ] Navigate through pages
  - [ ] Display format shows range "X-Y trên tổng Z"
  - [ ] Mobile responsive

- [ ] **Transfers page**
  - [ ] Navigate through pages
  - [ ] Page size selector works

- [ ] **Maintenance Plans**
  - [ ] Navigate through pages (1-based)
  - [ ] Page sizes include 200
  - [ ] "(đã lọc)" shows when filtered
  - [ ] Desktop: lg breakpoint for first/last buttons

- [ ] **Maintenance Tasks**
  - [ ] Navigate through pages
  - [ ] Selection count displays correctly
  - [ ] Desktop: lg breakpoint for first/last buttons

---

## Benefits

| Benefit | Impact |
|---------|--------|
| **~350+ lines removed** | Less code to maintain |
| **Consistent behavior** | Same UX across all tables |
| **Single source of truth** | Fix bugs in one place |
| **Better mobile UX** | Unified touch targets and responsive patterns |
| **Type-safe** | Generic `<TData>` works with any table |
| **Flexible** | Props cover all current variations |

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing pages | Medium | Incremental migration, test each page |
| Different layouts break | Low | Flexibility via props (displayFormat, extraContent, breakpoint) |
| Missing edge cases | Low | Use existing patterns as reference |
| 1-based vs 0-based confusion | Medium | Clear `serverPage` prop for 1-based mode |

---

## Implementation Notes

### 1-Based Pagination Support

The Maintenance Plans table uses 1-based pagination (server-side). The component handles this via:

```typescript
// Props for 1-based mode
serverPage?: number
onPageChange?: (page: number) => void

// Internal conversion
const displayPage = serverPage ?? (pagination.pageIndex + 1)
const handlePageChange = (newPage: number) => {
  if (onPageChange) {
    onPageChange(newPage)  // 1-based
  } else if (onPaginationChange) {
    onPaginationChange({ ...pagination, pageIndex: newPage - 1 })
  }
}
```

### Selection Count Display

For tables with row selection (Maintenance Tasks):

```typescript
<DataTablePagination
  displayFormat="selection-count"
  // Component accesses table.getFilteredSelectedRowModel().rows.length
/>
```

### Export Button Slot

For Equipment page:

```typescript
<DataTablePagination
  extraContent={
    <button onClick={onExportData} disabled={isLoading}>
      Tải về file Excel
    </button>
  }
  extraContentPosition="before-nav"
/>
```
