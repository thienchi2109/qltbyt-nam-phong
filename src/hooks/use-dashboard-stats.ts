import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { useSession } from 'next-auth/react'
import type { Session } from 'next-auth'
import {
  mapEquipmentAttentionRows,
  type EquipmentAttention,
  type EquipmentAttentionPage,
  type EquipmentAttentionPageResponse,
  type EquipmentAttentionRow,
} from './use-dashboard-stats.types'

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

type DashboardSessionUser = Session["user"]

function getDashboardUserScope(user: DashboardSessionUser | undefined) {
  return {
    role: user?.role,
    diaBanId: user?.dia_ban_id != null ? String(user.dia_ban_id) : null,
  }
}

// Hook to get total equipment count (tenant-filtered)
export function useTotalEquipment() {
  const { data: session } = useSession()
  const user: DashboardSessionUser | undefined = session?.user
  const scope = getDashboardUserScope(user)
  
  return useQuery({
    queryKey: dashboardStatsKeys.totalEquipment(scope.role, scope.diaBanId),
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
  const user: DashboardSessionUser | undefined = session?.user
  const scope = getDashboardUserScope(user)
  
  return useQuery({
    queryKey: dashboardStatsKeys.maintenanceCount(scope.role, scope.diaBanId),
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
  const user: DashboardSessionUser | undefined = session?.user
  const scope = getDashboardUserScope(user)
  
  return useQuery({
    queryKey: dashboardStatsKeys.repairRequests(scope.role, scope.diaBanId),
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
  const user: DashboardSessionUser | undefined = session?.user
  const scope = getDashboardUserScope(user)
  
  return useQuery({
    queryKey: dashboardStatsKeys.maintenancePlans(scope.role, scope.diaBanId),
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

// Hook to get equipment needing attention
export function useEquipmentAttention() {
  const { data: session } = useSession()
  const user: DashboardSessionUser | undefined = session?.user
  const scope = getDashboardUserScope(user)
  
  return useQuery({
    queryKey: dashboardStatsKeys.equipmentAttention(scope.role, scope.diaBanId),
    queryFn: async (): Promise<EquipmentAttention[]> => {
      const data = await callRpc<EquipmentAttentionRow[]>({ fn: 'equipment_attention_list', args: { p_limit: 5 } })
      return mapEquipmentAttentionRows(data)
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
  const user: DashboardSessionUser | undefined = session?.user
  const scope = getDashboardUserScope(user)

  const page = Math.max(1, options?.page ?? 1)
  const pageSize = Math.max(1, options?.pageSize ?? 10)
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: dashboardStatsKeys.equipmentAttentionPaginated(scope.role, scope.diaBanId, page, pageSize),
    queryFn: async (): Promise<EquipmentAttentionPage> => {
      const response = await callRpc<EquipmentAttentionPageResponse>({
        fn: 'equipment_attention_list_paginated',
        args: { p_page: page, p_page_size: pageSize }
      })

      const normalizedPage = response?.page ?? page
      const normalizedPageSize = response?.pageSize ?? pageSize
      const total = response?.total ?? 0

      const normalizedData = mapEquipmentAttentionRows(response?.data)

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
