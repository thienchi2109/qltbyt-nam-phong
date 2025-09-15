import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { callRpc } from '@/lib/rpc-client'

// Query keys for dashboard statistics
export const dashboardStatsKeys = {
  all: ['dashboard-stats'] as const,
  totalEquipment: () => [...dashboardStatsKeys.all, 'total-equipment'] as const,
  maintenanceCount: () => [...dashboardStatsKeys.all, 'maintenance-count'] as const,
  repairRequests: () => [...dashboardStatsKeys.all, 'repair-requests'] as const,
  maintenancePlans: () => [...dashboardStatsKeys.all, 'maintenance-plans'] as const,
  equipmentAttention: () => [...dashboardStatsKeys.all, 'equipment-attention'] as const,
}

// Hook to get total equipment count
export function useTotalEquipment() {
  return useQuery({
    queryKey: dashboardStatsKeys.totalEquipment(),
    queryFn: async (): Promise<number> => {
      const data = await callRpc<number>({ fn: 'equipment_count' })
      return data ?? 0
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - equipment count changes less frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

// Hook to get equipment needing maintenance/calibration count
export function useMaintenanceCount() {
  return useQuery({
    queryKey: dashboardStatsKeys.maintenanceCount(),
    queryFn: async (): Promise<number> => {
      const data = await callRpc<number>({ fn: 'equipment_count', args: { p_statuses: ['Chờ bảo trì', 'Chờ hiệu chuẩn/kiểm định'] } })
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

// Hook to get repair request statistics
export function useRepairRequestStats() {
  return useQuery({
    queryKey: dashboardStatsKeys.repairRequests(),
    queryFn: async (): Promise<RepairRequestStats> => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      // Get counts for different statuses in parallel
      const [pendingResult, approvedResult, completedResult] = await Promise.all([
        supabase
          .from('yeu_cau_sua_chua')
          .select('*', { count: 'exact', head: true })
          .eq('trang_thai', 'Chờ xử lý'),
        supabase
          .from('yeu_cau_sua_chua')
          .select('*', { count: 'exact', head: true })
          .eq('trang_thai', 'Đã duyệt'),
        supabase
          .from('yeu_cau_sua_chua')
          .select('*', { count: 'exact', head: true })
          .in('trang_thai', ['Hoàn thành', 'Không HT'])
      ])

      if (pendingResult.error) throw pendingResult.error
      if (approvedResult.error) throw approvedResult.error
      if (completedResult.error) throw completedResult.error

      const pending = pendingResult.count ?? 0
      const approved = approvedResult.count ?? 0
      const completed = completedResult.count ?? 0
      const total = pending + approved

      return {
        total,
        pending,
        approved,
        completed
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

// Hook to get maintenance plan statistics
export function useMaintenancePlanStats() {
  return useQuery({
    queryKey: dashboardStatsKeys.maintenancePlans(),
    queryFn: async (): Promise<MaintenancePlanStats> => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const { data: plans, error } = await supabase
        .from('ke_hoach_bao_tri')
        .select('id, ten_ke_hoach, nam, khoa_phong, loai_cong_viec, trang_thai, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      const plansList = plans || []
      const total = plansList.length
      const draft = plansList.filter(p => p.trang_thai === 'Bản nháp').length
      const approved = plansList.filter(p => p.trang_thai === 'Đã duyệt').length

      return {
        total,
        draft,
        approved,
        plans: plansList
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

// Hook to get equipment needing attention
export function useEquipmentAttention() {
  return useQuery({
    queryKey: dashboardStatsKeys.equipmentAttention(),
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
