/**
 * Centralized types for Equipment module
 * @module equipment/types
 */

import type * as React from "react"
import type { Equipment, UsageLog, SessionUser } from "@/types/database"
import type { TenantBranding } from "@/hooks/use-tenant-branding"
import type { Table, ColumnDef, ColumnFiltersState, VisibilityState } from "@tanstack/react-table"
import type { useRouter } from "next/navigation"
import type { RouteAction } from "./_hooks/useEquipmentRouteSync"

// Re-export commonly used types
export type { Equipment, UsageLog, SessionUser }

/**
 * Consolidated dialog state for Equipment module
 * Used by EquipmentDialogContext to manage all dialog visibility
 */
export interface EquipmentDialogState {
  isAddOpen: boolean
  isImportOpen: boolean
  editingEquipment: Equipment | null
  detailEquipment: Equipment | null
  usageEquipment: Equipment | null
  endUsageEquipment: Equipment | null
}

/**
 * Filter bottom sheet data structure
 * Contains counts for each filter option group
 */
export interface FilterBottomSheetData {
  status: { id: string; label: string; count: number }[]
  department: { id: string; label: string; count: number }[]
  location: { id: string; label: string; count: number }[]
  user: { id: string; label: string; count: number }[]
  classification: { id: string; label: string; count: number }[]
}

/**
 * Facility option for regional/global user filtering
 */
export interface FacilityOption {
  id: number
  name: string
  count: number
}

/**
 * Equipment list response from equipment_list_enhanced RPC
 */
export interface EquipmentListResponse {
  data: Equipment[]
  total: number
  page: number
  pageSize: number
}

/**
 * Main hook return value interface
 * Dialog state is now managed by EquipmentDialogContext
 */
export interface UseEquipmentPageReturn {
  // Session/Auth
  user: SessionUser | null
  status: "loading" | "authenticated" | "unauthenticated"
  isGlobal: boolean
  isRegionalLeader: boolean
  effectiveTenantKey: string

  // Router & Route sync
  router: ReturnType<typeof useRouter>
  pendingAction: RouteAction | null
  clearPendingAction: () => void

  // Data
  data: Equipment[]
  total: number
  isLoading: boolean
  isFetching: boolean
  shouldFetchEquipment: boolean

  // Table
  table: Table<Equipment>
  columns: ColumnDef<Equipment>[]
  pagination: { pageIndex: number; pageSize: number }
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  pageCount: number
  columnVisibility: VisibilityState
  setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>

  // Filters
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  columnFilters: ColumnFiltersState
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>
  isFiltered: boolean

  // Filter options (from server)
  departments: string[]
  users: string[]
  statuses: string[]
  classifications: string[]
  filterData: FilterBottomSheetData

  // Facility filter
  showFacilityFilter: boolean
  facilities: FacilityOption[]
  selectedFacilityId: number | null | undefined
  setSelectedFacilityId: (id: number | null) => void
  activeFacility: FacilityOption | null
  hasFacilityFilter: boolean
  isFacilitiesLoading: boolean

  // Facility sheet
  isFacilitySheetOpen: boolean
  setIsFacilitySheetOpen: React.Dispatch<React.SetStateAction<boolean>>
  pendingFacilityId: number | null
  setPendingFacilityId: React.Dispatch<React.SetStateAction<number | null>>
  handleFacilityApply: () => void
  handleFacilityClear: () => void
  handleFacilityCancel: () => void

  // Filter sheet
  isFilterSheetOpen: boolean
  setIsFilterSheetOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Handlers
  handleDownloadTemplate: () => Promise<void>
  handleExportData: () => Promise<void>
  handleGenerateProfileSheet: (equipment: Equipment) => Promise<void>
  handleGenerateDeviceLabel: (equipment: Equipment) => Promise<void>
  onDataMutationSuccess: () => void
  onDataMutationSuccessWithStatePreservation: () => void

  // UI state
  isMobile: boolean
  isCardView: boolean
  useTabletFilters: boolean

  // Branding
  tenantBranding: TenantBranding | undefined
}
