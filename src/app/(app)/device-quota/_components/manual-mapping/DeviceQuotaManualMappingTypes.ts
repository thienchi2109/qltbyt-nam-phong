import type { useUnassignedEquipmentFilters } from "../../_hooks/useUnassignedEquipmentFilters"

export interface UnassignedEquipmentRow {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model: string | null
  serial: string | null
  hang_san_xuat: string | null
  khoa_phong_quan_ly: string | null
  tinh_trang: string | null
  total_count: number
}

export interface UnassignedEquipment {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  model: string | null
  serial: string | null
  hang_san_xuat: string | null
  khoa_phong_quan_ly: string | null
  tinh_trang: string | null
}

export interface FilterOptions {
  departments: string[]
  users: string[]
  locations: string[]
  fundingSources: string[]
}

export interface ManualMappingPagination {
  pagination: {
    pageIndex: number
    pageSize: number
  }
  pageCount: number
  canPreviousPage: boolean
  canNextPage: boolean
  setPagination: React.Dispatch<
    React.SetStateAction<{
      pageIndex: number
      pageSize: number
    }>
  >
}

export interface DeviceQuotaManualMappingEquipmentListProps {
  unassignedEquipment: UnassignedEquipment[]
  totalEquipmentCount: number
  selectedEquipmentIds: Set<number>
  toggleEquipmentSelection: (id: number) => void
  selectAllEquipment: () => void
  deselectPageEquipment: () => void
  filters: ReturnType<typeof useUnassignedEquipmentFilters>
  filterOptions: FilterOptions
  pagination: ManualMappingPagination
  isLoading: boolean
  isFacilitySelected: boolean
}
