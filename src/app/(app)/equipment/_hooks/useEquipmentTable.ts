"use client"

import * as React from "react"
import type {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  Table,
} from "@tanstack/react-table"
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  getEquipmentColumnVisibility,
  setEquipmentColumnVisibility,
} from "@/app/(app)/equipment/_utils/equipmentColumnVisibilityPrefs"
import { DEFAULT_COLUMN_VISIBILITY } from "@/app/(app)/equipment/_constants/equipmentColumnVisibility"
import type { Equipment } from "../types"

// Columns to hide on medium screens (768px-1800px)
const RESPONSIVE_HIDE_COLUMNS = ['serial', 'phan_loai_theo_nd98', 'so_luu_hanh'] as const

function restoreResponsivePreference(
  visibility: VisibilityState,
  responsiveSnapshot: VisibilityState | null
): VisibilityState {
  if (!responsiveSnapshot) return visibility

  const restored = { ...visibility }
  RESPONSIVE_HIDE_COLUMNS.forEach((columnId) => {
    restored[columnId] = responsiveSnapshot[columnId] ?? visibility[columnId]
  })
  return restored
}

function hideResponsiveColumns(visibility: VisibilityState): VisibilityState {
  return {
    ...visibility,
    serial: false,
    phan_loai_theo_nd98: false,
    so_luu_hanh: false,
  }
}

export interface UseEquipmentTableParams {
  data: Equipment[]
  total: number
  columns: ColumnDef<Equipment>[]
  sorting: SortingState
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>
  columnFilters: ColumnFiltersState
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>
  debouncedSearch: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  // Controlled pagination state (lifted to parent to avoid desync)
  pagination: { pageIndex: number; pageSize: number }
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  // For pagination reset on filter change
  selectedDonVi: number | null
  selectedFacilityId: number | null | undefined
  columnVisibilityUserId?: string
}

export interface UseEquipmentTableReturn {
  table: Table<Equipment>
  pagination: { pageIndex: number; pageSize: number }
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  pageCount: number
  columnVisibility: VisibilityState
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>
  isFiltered: boolean
  isMobile: boolean
  isCardView: boolean
  useTabletFilters: boolean
  // For state preservation after mutations
  preservePageState: { pageIndex: number; pageSize: number } | null
  setPreservePageState: React.Dispatch<
    React.SetStateAction<{ pageIndex: number; pageSize: number } | null>
  >
}

/** Builds the controlled equipment table state and column visibility preferences. */
export function useEquipmentTable(params: UseEquipmentTableParams): UseEquipmentTableReturn {
  const {
    data,
    total,
    columns,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    debouncedSearch,
    setSearchTerm,
    pagination,
    setPagination,
    selectedDonVi,
    selectedFacilityId,
    columnVisibilityUserId,
  } = params

  // Media queries
  const isMobile = useIsMobile()
  const useTabletFilters = useMediaQuery("(min-width: 768px) and (max-width: 1024px)")
  const isCardView = useMediaQuery("(max-width: 1279px)")
  const isMediumScreen = useMediaQuery("(min-width: 768px) and (max-width: 1800px)")

  // Column visibility state
  const [columnVisibility, setRuntimeColumnVisibility] = React.useState<VisibilityState>(() =>
    getEquipmentColumnVisibility(columnVisibilityUserId, DEFAULT_COLUMN_VISIBILITY)
  )

  // Track pre-responsive visibility to restore user preferences
  const preResponsiveVisibilityRef = React.useRef<VisibilityState | null>(null)
  const isMediumScreenRef = React.useRef(false)

  React.useEffect(() => {
    isMediumScreenRef.current = isMediumScreen
  }, [isMediumScreen])

  React.useEffect(() => {
    const nextVisibility = getEquipmentColumnVisibility(
      columnVisibilityUserId,
      DEFAULT_COLUMN_VISIBILITY
    )
    preResponsiveVisibilityRef.current = null
    if (isMediumScreenRef.current) {
      const snapshot: VisibilityState = {}
      RESPONSIVE_HIDE_COLUMNS.forEach((col) => {
        snapshot[col] = nextVisibility[col] ?? true
      })
      preResponsiveVisibilityRef.current = snapshot
      setRuntimeColumnVisibility(hideResponsiveColumns(nextVisibility))
      return
    }

    setRuntimeColumnVisibility(nextVisibility)
  }, [columnVisibilityUserId])

  const setColumnVisibility = React.useCallback<
    React.Dispatch<React.SetStateAction<VisibilityState>>
  >(
    (value) => {
      setRuntimeColumnVisibility((prev) => {
        const next = typeof value === "function" ? value(prev) : value
        setEquipmentColumnVisibility(
          columnVisibilityUserId,
          restoreResponsivePreference(next, preResponsiveVisibilityRef.current),
          DEFAULT_COLUMN_VISIBILITY
        )
        return next
      })
    },
    [columnVisibilityUserId]
  )

  // State preservation after mutations
  const [preservePageState, setPreservePageState] = React.useState<{
    pageIndex: number
    pageSize: number
  } | null>(null)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  // Pagination reset when filters change
  const filterKey = React.useMemo(
    () =>
      JSON.stringify({
        filters: columnFilters,
        search: debouncedSearch,
        facility: selectedFacilityId,
        tenant: selectedDonVi,
      }),
    [columnFilters, debouncedSearch, selectedFacilityId, selectedDonVi]
  )
  const [lastFilterKey, setLastFilterKey] = React.useState(filterKey)

  React.useEffect(() => {
    if (filterKey === lastFilterKey) return

    setRowSelection({})

    if (pagination.pageIndex > 0) {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }

    setLastFilterKey(filterKey)
  }, [filterKey, lastFilterKey, pagination.pageIndex, setPagination])

  const skipSelectionResetOnMountRef = React.useRef(true)
  React.useEffect(() => {
    if (skipSelectionResetOnMountRef.current) {
      skipSelectionResetOnMountRef.current = false
      return
    }

    setRowSelection({})
  }, [pagination.pageIndex, pagination.pageSize, sorting])

  // Page count calculation
  const pageCount = Math.max(0, Math.ceil((total || 0) / Math.max(pagination.pageSize, 1)))

  // Clamp page index when pageCount decreases (e.g., after deletions)
  React.useEffect(() => {
    if (pagination.pageIndex >= pageCount) {
      setPagination((prev) => ({ ...prev, pageIndex: Math.max(0, pageCount - 1) }))
    }
  }, [pageCount, pagination.pageIndex, setPagination])

  // Table instance
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => String(row.id),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    enableRowSelection: true,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: debouncedSearch,
      pagination,
      rowSelection,
    },
    manualPagination: true,
    manualFiltering: true,
    pageCount: pageCount,
  })

  // Use ref pattern for table to avoid effect dependency issues
  const tableRef = React.useRef(table)
  tableRef.current = table

  // Auto-hide columns on medium screens and restore on large screens
  React.useEffect(() => {
    if (isMediumScreen) {
      // Hide columns when entering medium screen
      setRuntimeColumnVisibility((prev) => {
        if (!preResponsiveVisibilityRef.current) {
          const snapshot: VisibilityState = {}
          RESPONSIVE_HIDE_COLUMNS.forEach((col) => {
            snapshot[col] = prev[col] ?? true
          })
          preResponsiveVisibilityRef.current = snapshot
        }

        return hideResponsiveColumns(prev)
      })
    } else if (preResponsiveVisibilityRef.current) {
      // Restore columns that were hidden by responsive logic when returning to large screen
      const snapshot = preResponsiveVisibilityRef.current

      setRuntimeColumnVisibility((prevVisibility) => {
        const updated = { ...prevVisibility }

        Object.entries(snapshot).forEach(([col, value]) => {
          updated[col] = value
        })
        return updated
      })

      preResponsiveVisibilityRef.current = null
    }
  }, [isMediumScreen])

  // Restore table state after data changes
  React.useEffect(() => {
    if (!preservePageState || data.length === 0) return

    const timer = setTimeout(() => {
      tableRef.current.setPageIndex(preservePageState.pageIndex)
      tableRef.current.setPageSize(preservePageState.pageSize)
      setPreservePageState(null)
    }, 150)

    return () => clearTimeout(timer)
  }, [preservePageState, data.length])

  const isFiltered = table.getState().columnFilters.length > 0

  // Note: useState setters (setPagination, setPreservePageState) are stable references
  // and intentionally excluded from the dependency array.
  return React.useMemo(
    () => ({
      table,
      pagination,
      setPagination,
      pageCount,
      columnVisibility,
      setColumnVisibility,
      isFiltered,
      isMobile,
      isCardView,
      useTabletFilters,
      preservePageState,
      setPreservePageState,
    }),
    [
      table,
      pagination,
      pageCount,
      columnVisibility,
      setColumnVisibility,
      isFiltered,
      isMobile,
      isCardView,
      useTabletFilters,
      preservePageState,
    ]
  )
}
