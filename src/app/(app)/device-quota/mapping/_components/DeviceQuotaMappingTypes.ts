import type { useServerPagination } from "@/hooks/useServerPagination"
import type { useUnassignedEquipmentFilters } from "../_hooks/useUnassignedEquipmentFilters"
import type { useLinkEquipmentMutation } from "./DeviceQuotaMappingMutations"

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

export interface Category {
  id: number
  parent_id: number | null
  ma_nhom: string
  ten_nhom: string
  phan_loai: string | null
  level: number
  so_luong_hien_co: number
}

export interface FilterOptions {
  departments: string[]
  users: string[]
  locations: string[]
  fundingSources: string[]
}

export interface AuthUser {
  id: string
  username: string
  full_name?: string | null
  role: string
  don_vi?: string | null
  dia_ban_id?: number | null
}

export interface DeviceQuotaMappingContextValue {
  user: AuthUser | null
  donViId: number | null
  isFacilitySelected: boolean
  unassignedEquipment: UnassignedEquipment[]
  totalEquipmentCount: number
  allCategories: Category[]
  categories: Category[]
  selectedEquipmentIds: Set<number>
  selectedCategoryId: number | null
  toggleEquipmentSelection: (id: number) => void
  selectAllEquipment: () => void
  deselectPageEquipment: () => void
  clearEquipmentSelection: () => void
  setSelectedCategory: (id: number | null) => void
  filters: ReturnType<typeof useUnassignedEquipmentFilters>
  filterOptions: FilterOptions
  pagination: ReturnType<typeof useServerPagination>
  categorySearchTerm: string
  setCategorySearchTerm: (term: string) => void
  linkEquipment: ReturnType<typeof useLinkEquipmentMutation>
  isLoading: boolean
  isLinking: boolean
  refetch: () => void
}
