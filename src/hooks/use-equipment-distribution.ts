"use client"

import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'

export interface EquipmentDistributionItem {
  name: string
  total: number
  hoat_dong: number
  cho_sua_chua: number
  cho_bao_tri: number
  cho_hieu_chuan: number
  ngung_su_dung: number
  chua_co_nhu_cau: number
  khac?: number
  [key: string]: string | number | undefined
}

export interface RawEquipmentItem {
  id: number
  ma_thiet_bi: string
  ten_thiet_bi: string
  khoa_phong_quan_ly: string | null
  vi_tri_lap_dat: string | null
  tinh_trang_hien_tai: string | null
}

export interface EquipmentDistributionData {
  byDepartment: EquipmentDistributionItem[]
  byLocation: EquipmentDistributionItem[]
  departments: string[]
  locations: string[]
  totalEquipment: number
  rawEquipment: RawEquipmentItem[]
}

interface EquipmentStatusDistributionRpc {
  total_equipment: number
  status_counts: Record<string, number>
  by_department: EquipmentDistributionItem[]
  by_location: EquipmentDistributionItem[]
  departments: string[]
  locations: string[]
}

// Query keys for caching
export const equipmentDistributionKeys = {
  all: ['equipment-distribution'] as const,
  data: (params: { filterDept?: string; filterLoc?: string; tenant?: string }) => (
    [...equipmentDistributionKeys.all, 'data', params.filterDept, params.filterLoc, params.tenant] as const
  ),
}

export function useEquipmentDistribution(
  filterDepartment?: string,
  filterLocation?: string,
  tenantFilter?: string,
  selectedDonVi?: number | null,
  effectiveTenantKey?: string
) {
  return useQuery({
    queryKey: equipmentDistributionKeys.data({
      filterDept: filterDepartment,
      filterLoc: filterLocation,
      tenant: effectiveTenantKey || 'auto',
    }),
    queryFn: async (): Promise<EquipmentDistributionData> => {
      const res = await callRpc<EquipmentStatusDistributionRpc>({
        fn: 'equipment_status_distribution',
        args: {
          p_q: null,
          p_don_vi: selectedDonVi || null,
          p_khoa_phong: filterDepartment && filterDepartment !== 'all' ? filterDepartment : null,
          p_vi_tri: filterLocation && filterLocation !== 'all' ? filterLocation : null,
        },
      })

      if (!res) {
        return {
          byDepartment: [],
          byLocation: [],
          departments: [],
          locations: [],
          totalEquipment: 0,
          rawEquipment: [],
        }
      }

      const data: EquipmentDistributionData = {
        byDepartment: (res.by_department || []).map((d) => ({ ...d })),
        byLocation: (res.by_location || []).map((l) => ({ ...l })),
        departments: res.departments || [],
        locations: res.locations || [],
        totalEquipment: res.total_equipment || 0,
        rawEquipment: [],
      }
      return data
    },
    enabled: (effectiveTenantKey ?? 'auto') !== 'unset',
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
  })
}

// Export status color mapping for consistency
export const STATUS_COLORS = {
  hoat_dong: '#22c55e',        // green-500
  cho_sua_chua: '#ef4444',     // red-500
  cho_bao_tri: '#f59e0b',      // amber-500
  cho_hieu_chuan: '#8b5cf6',   // violet-500
  ngung_su_dung: '#6b7280',    // gray-500
  chua_co_nhu_cau: '#9ca3af'   // gray-400
} as const

export const STATUS_LABELS = {
  hoat_dong: 'Hoạt động',
  cho_sua_chua: 'Chờ sửa chữa',
  cho_bao_tri: 'Chờ bảo trì',
  cho_hieu_chuan: 'Chờ HC/KĐ',
  ngung_su_dung: 'Ngừng sử dụng',
  chua_co_nhu_cau: 'Chưa có nhu cầu'
} as const 

