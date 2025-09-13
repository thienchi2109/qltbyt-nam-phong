"use client"

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface EquipmentDistributionItem {
  name: string
  total: number
  hoat_dong: number
  cho_sua_chua: number
  cho_bao_tri: number
  cho_hieu_chuan: number
  ngung_su_dung: number
  chua_co_nhu_cau: number
  [key: string]: string | number
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

// Query keys for caching
export const equipmentDistributionKeys = {
  all: ['equipment-distribution'] as const,
  data: (filterDept?: string, filterLoc?: string) => [...equipmentDistributionKeys.all, 'data', filterDept, filterLoc] as const,
}

export function useEquipmentDistribution(filterDepartment?: string, filterLocation?: string) {
  return useQuery({
    queryKey: equipmentDistributionKeys.data(filterDepartment, filterLocation),
    queryFn: async (): Promise<EquipmentDistributionData> => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      // Fetch all equipment with status information
      const { data: equipment, error } = await supabase
        .from('thiet_bi')
        .select(`
          id,
          ma_thiet_bi,
          ten_thiet_bi,
          khoa_phong_quan_ly,
          vi_tri_lap_dat,
          tinh_trang_hien_tai
        `)

      if (error) throw error

      if (!equipment || equipment.length === 0) {
        return {
          byDepartment: [],
          byLocation: [],
          departments: [],
          locations: [],
          totalEquipment: 0,
          rawEquipment: []
        }
      }

      // Apply filters if provided
      let filteredEquipment = equipment
      
      if (filterDepartment && filterDepartment !== 'all') {
        filteredEquipment = filteredEquipment.filter(item => 
          item.khoa_phong_quan_ly === filterDepartment
        )
      }
      
      if (filterLocation && filterLocation !== 'all') {
        filteredEquipment = filteredEquipment.filter(item => 
          item.vi_tri_lap_dat === filterLocation
        )
      }

      // Process data by department
      const deptMap = new Map<string, EquipmentDistributionItem>()
      
      filteredEquipment.forEach(item => {
        const dept = item.khoa_phong_quan_ly || 'Chưa phân loại'
        
        if (!deptMap.has(dept)) {
          deptMap.set(dept, {
            name: dept,
            total: 0,
            hoat_dong: 0,
            cho_sua_chua: 0,
            cho_bao_tri: 0,
            cho_hieu_chuan: 0,
            ngung_su_dung: 0,
            chua_co_nhu_cau: 0
          })
        }

        const deptData = deptMap.get(dept)!
        deptData.total += 1

        // Count by status
        switch (item.tinh_trang_hien_tai) {
          case 'Hoạt động':
            deptData.hoat_dong += 1
            break
          case 'Chờ sửa chữa':
            deptData.cho_sua_chua += 1
            break
          case 'Chờ bảo trì':
            deptData.cho_bao_tri += 1
            break
          case 'Chờ hiệu chuẩn/kiểm định':
            deptData.cho_hieu_chuan += 1
            break
          case 'Ngưng sử dụng':
            deptData.ngung_su_dung += 1
            break
          case 'Chưa có nhu cầu sử dụng':
            deptData.chua_co_nhu_cau += 1
            break
          default:
            // Handle null or unknown status as "active"
            deptData.hoat_dong += 1
            break
        }
      })

      // Process data by location
      const locationMap = new Map<string, EquipmentDistributionItem>()
      
      filteredEquipment.forEach(item => {
        const location = item.vi_tri_lap_dat || 'Chưa xác định'
        
        if (!locationMap.has(location)) {
          locationMap.set(location, {
            name: location,
            total: 0,
            hoat_dong: 0,
            cho_sua_chua: 0,
            cho_bao_tri: 0,
            cho_hieu_chuan: 0,
            ngung_su_dung: 0,
            chua_co_nhu_cau: 0
          })
        }

        const locationData = locationMap.get(location)!
        locationData.total += 1

        // Count by status
        switch (item.tinh_trang_hien_tai) {
          case 'Hoạt động':
            locationData.hoat_dong += 1
            break
          case 'Chờ sửa chữa':
            locationData.cho_sua_chua += 1
            break
          case 'Chờ bảo trì':
            locationData.cho_bao_tri += 1
            break
          case 'Chờ hiệu chuẩn/kiểm định':
            locationData.cho_hieu_chuan += 1
            break
          case 'Ngưng sử dụng':
            locationData.ngung_su_dung += 1
            break
          case 'Chưa có nhu cầu sử dụng':
            locationData.chua_co_nhu_cau += 1
            break
          default:
            locationData.hoat_dong += 1
            break
        }
      })

      // Convert maps to arrays and sort by total
      const byDepartment = Array.from(deptMap.values())
        .sort((a, b) => b.total - a.total)
      
      const byLocation = Array.from(locationMap.values())
        .sort((a, b) => b.total - a.total)

      // Get unique departments and locations for filters (from original unfiltered data)
      const departments = Array.from(new Set(
        equipment
          .map(item => item.khoa_phong_quan_ly)
          .filter(dept => dept && dept !== 'Chưa phân loại')
      )).sort()
      
      const locations = Array.from(new Set(
        equipment
          .map(item => item.vi_tri_lap_dat)
          .filter(loc => loc && loc !== 'Chưa xác định')
      )).sort()

      return {
        byDepartment,
        byLocation,
        departments,
        locations,
        totalEquipment: filteredEquipment.length,
        rawEquipment: filteredEquipment
      }
    },
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
  ngung_su_dung: 'Ngưng sử dụng',
  chua_co_nhu_cau: 'Chưa có nhu cầu'
} as const 