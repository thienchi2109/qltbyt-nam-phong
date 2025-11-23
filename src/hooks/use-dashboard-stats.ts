import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { useSession } from 'next-auth/react'

// Query keys for dashboard statistics
export const dashboardStatsKeys = {
  all: ['dashboard-stats'] as const,
  totalEquipment: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'total-equipment', userRole, diaBanId] as const,
  maintenanceCount: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'maintenance-count', userRole, diaBanId] as const,
  repairRequests: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'repair-requests', userRole, diaBanId] as const,
  maintenancePlans: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'maintenance-plans', userRole, diaBanId] as const,
  equipmentAttention: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'equipment-attention', userRole, diaBanId] as const,
  equipmentAttentionPaginated: (userRole?: string, diaBanId?: string | null, page?: number, pageSize?: number) => [...dashboardStatsKeys.all, 'equipment-attention', userRole, diaBanId, page, pageSize] as const,
}

// Hook to get total equipment count (tenant-filtered)
export function useTotalEquipment() {
  const { data: session } = useSession()
  const user = session?.user as any
  
  return useQuery({
    queryKey: dashboardStatsKeys.totalEquipment(user?.role, user?.dia_ban_id),
    queryFn: async (): Promise<number> => {
      const data = await callRpc<number>({ fn: 'dashboard_equipment_total' })
      return data ?? 0
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - equipment count changes less frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

// Hook to get equipment needing maintenance/calibration count (tenant-filtered)
export function useMaintenanceCount() {
  const { data: session } = useSession()
  const user = session?.user as any
  
  return useQuery({
    queryKey: dashboardStatsKeys.maintenanceCount(user?.role, user?.dia_ban_id),
    queryFn: async (): Promise<number> => {
      const data = await callRpc<number>({ fn: 'dashboard_maintenance_count' })
      return data ?? 0
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

// Interface for repair request statistics
export interface RepairRequestStats {
  total: number
  pending: number
  approved: number
  completed: number
}

// Hook to get repair request statistics (tenant-filtered)
export function useRepairRequestStats() {
  const { data: session } = useSession()
  const user = session?.user as any
  
  return useQuery({
    queryKey: dashboardStatsKeys.repairRequests(user?.role, user?.dia_ban_id),
    queryFn: async (): Promise<RepairRequestStats> => {
      const data = await callRpc<RepairRequestStats>({ fn: 'dashboard_repair_request_stats' })
      return data ?? {
        total: 0,
        pending: 0,
        approved: 0,
        completed: 0
      }
    },
    staleTime: 1 * 60 * 1000, // 1 minute - repair requests change more frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 3 * 60 * 1000, // Refetch every 3 minutes
  })
}

// Interface for maintenance plan statistics
export interface MaintenancePlanStats {
  total: number
  draft: number
  approved: number
  plans: Array<{
    id: number
    ten_ke_hoach: string
    nam: number
    khoa_phong: string | null
    loai_cong_viec: string
    trang_thai: string
    created_at: string
  }>
}

// Hook to get maintenance plan statistics (tenant-filtered)
export function useMaintenancePlanStats() {
  const { data: session } = useSession()
  const user = session?.user as any
  
  return useQuery({
    queryKey: dashboardStatsKeys.maintenancePlans(user?.role, user?.dia_ban_id),
    queryFn: async (): Promise<MaintenancePlanStats> => {
      const data = await callRpc<MaintenancePlanStats>({ fn: 'dashboard_maintenance_plan_stats' })
      return data ?? {
        total: 0,
        draft: 0,
        approved: 0,
        plans: []
      }
    },
    staleTime: 3 * 60 * 1000, // 3 minutes - maintenance plans change less frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

// Interface for equipment needing attention
export interface EquipmentAttention {
  id: number
  ten_thiet_bi: string
  ma_thiet_bi: string
  model: string | null
  tinh_trang_hien_tai: string
  vi_tri_lap_dat: string | null
  ngay_bt_tiep_theo: string | null
}

export interface EquipmentAttentionPage {
  data: EquipmentAttention[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Hook to get equipment needing attention
export function useEquipmentAttention() {
  const { data: session } = useSession()
  const user = session?.user as any
  
  return useQuery({
    queryKey: dashboardStatsKeys.equipmentAttention(user?.role, user?.dia_ban_id),
    queryFn: async (): Promise<EquipmentAttention[]> => {
      const data = await callRpc<any[]>({ fn: 'equipment_attention_list', args: { p_limit: 5 } })
      return (data as any[] || []).map((row: any) => ({
        id: row.id,
        ten_thiet_bi: row.ten_thiet_bi,
        ma_thiet_bi: row.ma_thiet_bi,
        model: row.model ?? null,
        tinh_trang_hien_tai: row.tinh_trang_hien_tai,
        vi_tri_lap_dat: row.vi_tri_lap_dat ?? null,
        ngay_bt_tiep_theo: row.ngay_bt_tiep_theo ?? null,
      }))
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

// Hook to get equipment needing attention with pagination (default 10 per page)
export function useEquipmentAttentionPaginated(options?: { page?: number; pageSize?: number; enabled?: boolean }) {
  const { data: session } = useSession()
  const user = session?.user as any

  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.max(1, options?.pageSize ?? 10)
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: dashboardStatsKeys.equipmentAttentionPaginated(user?.role, user?.dia_ban_id, page, pageSize),
    queryFn: async (): Promise<EquipmentAttentionPage> => {
      const response = await callRpc<Partial<EquipmentAttentionPage>>({
        fn: 'equipment_attention_list_paginated',
        args: { p_page: page, p_page_size: pageSize }
      })

      const normalizedPage = response?.page ?? page
      const normalizedPageSize = response?.pageSize ?? pageSize
      const total = response?.total ?? 0

      const normalizedData = (response?.data ?? []).map((row) => ({
        id: row.id,
        ten_thiet_bi: row.ten_thiet_bi,
        ma_thiet_bi: row.ma_thiet_bi,
        model: row.model ?? null,
        tinh_trang_hien_tai: row.tinh_trang_hien_tai,
        vi_tri_lap_dat: row.vi_tri_lap_dat ?? null,
        ngay_bt_tiep_theo: row.ngay_bt_tiep_theo ?? null,
      }))

      return {
        data: normalizedData,
        total,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        hasMore: typeof response?.hasMore === 'boolean'
          ? response.hasMore
          : (normalizedPage * normalizedPageSize) < total,
      }
    },
    placeholderData: (previousData) => previousData,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    enabled: enabled && Boolean(user),
  })
}
