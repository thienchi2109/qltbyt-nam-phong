"use client"

import * as React from "react"
import type {
  ColumnDef,
  ColumnFiltersState,
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
import type { Equipment } from "../types"

// Default column visibility
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = {
  id: false,
  ma_thiet_bi: true,
  ten_thiet_bi: true,
  model: true,
  serial: true,
  cau_hinh_thiet_bi: false,
  phu_kien_kem_theo: false,
  hang_san_xuat: false,
  noi_san_xuat: false,
  nam_san_xuat: false,
  ngay_nhap: false,
  ngay_dua_vao_su_dung: false,
  nguon_kinh_phi: false,
  gia_goc: false,
  nam_tinh_hao_mon: false,
  ty_le_hao_mon: false,
  han_bao_hanh: false,
  vi_tri_lap_dat: true,
  nguoi_dang_truc_tiep_quan_ly: true,
  khoa_phong_quan_ly: true,
  tinh_trang_hien_tai: true,
  ghi_chu: false,
  chu_ky_bt_dinh_ky: false,
  ngay_bt_tiep_theo: false,
  chu_ky_hc_dinh_ky: false,
  ngay_hc_tiep_theo: false,
  chu_ky_kd_dinh_ky: false,
  ngay_kd_tiep_theo: false,
  phan_loai_theo_nd98: true,
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
  selectedFacilityId: number | null
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
  } = params

  // Column visibility state
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(DEFAULT_COLUMN_VISIBILITY)

  // State preservation after mutations
  const [preservePageState, setPreservePageState] = React.useState<{
    pageIndex: number
    pageSize: number
  } | null>(null)

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
    if (filterKey !== lastFilterKey && pagination.pageIndex > 0) {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
      setLastFilterKey(filterKey)
    } else if (filterKey !== lastFilterKey) {
      setLastFilterKey(filterKey)
    }
  }, [filterKey, lastFilterKey, pagination.pageIndex])

  // Media queries
  const isMobile = useIsMobile()
  const useTabletFilters = useMediaQuery("(min-width: 768px) and (max-width: 1024px)")
  const isCardView = useMediaQuery("(max-width: 1279px)")
  const isMediumScreen = useMediaQuery("(min-width: 768px) and (max-width: 1800px)")

  // Page count calculation
  const pageCount = Math.max(1, Math.ceil((total || 0) / Math.max(pagination.pageSize, 1)))

  // Clamp page index when pageCount decreases (e.g., after deletions)
  React.useEffect(() => {
    if (pagination.pageIndex >= pageCount && pageCount > 0) {
      setPagination((prev) => ({ ...prev, pageIndex: pageCount - 1 }))
    }
  }, [pageCount, pagination.pageIndex, setPagination])

  // Table instance
  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: debouncedSearch,
      pagination,
    },
    manualPagination: true,
    manualFiltering: true,
    pageCount: pageCount,
  })

  // Use ref pattern for table to avoid effect dependency issues
  const tableRef = React.useRef(table)
  tableRef.current = table

  // Auto-hide columns on medium screens
  React.useEffect(() => {
    if (isMediumScreen) {
      setColumnVisibility((prev) => ({
        ...prev,
        model: false,
        serial: false,
        phan_loai_theo_nd98: false,
      }))
    } else {
      setColumnVisibility((prev) => ({
        ...prev,
        model: true,
        serial: true,
        phan_loai_theo_nd98: true,
      }))
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

  // Note: useState setters (setPagination, setColumnVisibility, setPreservePageState)
  // are stable references and intentionally excluded from the dependency array.
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
      isFiltered,
      isMobile,
      isCardView,
      useTabletFilters,
      preservePageState,
    ]
  )
}
