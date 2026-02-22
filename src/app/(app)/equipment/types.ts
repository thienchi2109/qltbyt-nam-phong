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
import type { FacilityOption } from "@/types/tenant"

// Re-export commonly used types
export type { Equipment, UsageLog, SessionUser }

// Re-export FacilityOption from canonical location
export type { FacilityOption } from "@/types/tenant"

// ============================================================================
// Equipment Detail Dialog Types
// ============================================================================

/**
 * Attachment file linked to equipment
 * Maps to equipment_attachments table
 */
export type Attachment = {
  id: string
  ten_file: string
  duong_dan_luu_tru: string
  thiet_bi_id: number
}

/**
 * History event for equipment timeline
 * Returned by equipment_history_list RPC
 */
export type HistoryItem = {
  id: number
  ngay_thuc_hien: string
  loai_su_kien: string
  mo_ta: string
  chi_tiet: {
    mo_ta_su_co?: string
    hang_muc_sua_chua?: string
    nguoi_yeu_cau?: string
    cong_viec_id?: number
    thang?: number
    ten_ke_hoach?: string
    khoa_phong?: string
    nam?: number
    ma_yeu_cau?: string
    loai_hinh?: string
    khoa_phong_hien_tai?: string
    khoa_phong_nhan?: string
    don_vi_nhan?: string
  } | null
}

/**
 * Query keys for equipment detail dialog data fetching
 * Centralized to prevent cache key drift
 */
export const equipmentDetailQueryKeys = {
  attachments: (equipmentId: number | undefined) => ["attachments", equipmentId] as const,
  history: (equipmentId: number | undefined) => ["history", equipmentId] as const,
} as const

// ============================================================================
// Filter Types
// ============================================================================

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
  fundingSource: { id: string; label: string; count: number }[]
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
  locations: string[]
  statuses: string[]
  classifications: string[]
  fundingSources: string[]
  filterData: FilterBottomSheetData

  // Facility filter
  showFacilityFilter: boolean
  facilities: FacilityOption[]
  selectedFacilityId: number | null | undefined
  setSelectedFacilityId: (id: number | null) => void
  activeFacility: FacilityOption | null
  hasFacilityFilter: boolean
  isFacilitiesLoading: boolean
  handleFacilityClear: () => void

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
  canBulkSelect: boolean

  // Branding
  tenantBranding: TenantBranding | undefined
}
