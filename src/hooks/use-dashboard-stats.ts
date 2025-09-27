import { useQuery } from '@tanstack/react-query'
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
      const data = await callRpc<Partial<RepairRequestStats>>({
        fn: 'dashboard_repair_request_stats',
      })

      return {
        total: data?.total ?? 0,
        pending: data?.pending ?? 0,
        approved: data?.approved ?? 0,
        completed: data?.completed ?? 0,
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
      const payload = await callRpc<{ total?: number; draft?: number; approved?: number; plans?: any[] }>({
        fn: 'dashboard_maintenance_plan_snapshot',
        args: { p_limit: 10 },
      })

      const rawPlans = Array.isArray(payload?.plans) ? (payload?.plans as any[]) : []

      return {
        total: payload?.total ?? 0,
        draft: payload?.draft ?? 0,
        approved: payload?.approved ?? 0,
        plans: rawPlans.map((plan) => ({
          id: Number(plan.id),
          ten_ke_hoach: String(plan.ten_ke_hoach ?? ''),
          nam: Number(plan.nam ?? 0),
          khoa_phong: plan.khoa_phong ?? null,
          loai_cong_viec: String(plan.loai_cong_viec ?? ''),
          trang_thai: String(plan.trang_thai ?? ''),
          created_at: String(plan.created_at ?? ''),
        })),
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
