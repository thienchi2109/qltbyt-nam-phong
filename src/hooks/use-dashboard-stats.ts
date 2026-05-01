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

export type { EquipmentAttention, EquipmentAttentionPage } from './use-dashboard-stats.types'

// Query keys for dashboard statistics
export const dashboardStatsKeys = {
  all: ['dashboard-stats'] as const,
  kpiSummaryRoot: () => [...dashboardStatsKeys.all, 'kpi-summary'] as const,
  kpiSummary: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.kpiSummaryRoot(), userRole, diaBanId] as const,
  totalEquipment: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'total-equipment', userRole, diaBanId] as const,
  maintenanceCount: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'maintenance-count', userRole, diaBanId] as const,
  repairRequests: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'repair-requests', userRole, diaBanId] as const,
  maintenancePlans: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'maintenance-plans', userRole, diaBanId] as const,
  equipmentAttention: (userRole?: string, diaBanId?: string | null) => [...dashboardStatsKeys.all, 'equipment-attention', userRole, diaBanId] as const,
  equipmentAttentionPaginated: (userRole?: string, diaBanId?: string | null, page?: number, pageSize?: number) => [...dashboardStatsKeys.all, 'equipment-attention', userRole, diaBanId, page, pageSize] as const,
}

type DashboardSessionUser = Session["user"]

function getDashboardUserScope(
  user: DashboardSessionUser | undefined,
): { role: string | undefined; diaBanId: string | null } {
  return {
    role: typeof user?.role === 'string' ? user.role : undefined,
    diaBanId: user?.dia_ban_id != null ? String(user.dia_ban_id) : null,
  }
}

// Hook to get total equipment count (tenant-filtered)
export function useTotalEquipment() {
  const query = useDashboardKpiSummary()
  return { ...query, data: query.data?.totalEquipment ?? (query.data ? 0 : undefined) }
}

// Hook to get equipment needing maintenance/calibration count (tenant-filtered)
export function useMaintenanceCount() {
  const query = useDashboardKpiSummary()
  return { ...query, data: query.data?.maintenanceCount ?? (query.data ? 0 : undefined) }
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
  const query = useDashboardKpiSummary()
  return { ...query, data: query.data?.repairRequests ?? (query.data ? EMPTY_REPAIR_REQUEST_STATS : undefined) }
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

export interface DashboardKpiSummary {
  totalEquipment: number
  maintenanceCount: number
  repairRequests: RepairRequestStats
  maintenancePlans: MaintenancePlanStats
}

const EMPTY_REPAIR_REQUEST_STATS: RepairRequestStats = {
  total: 0,
  pending: 0,
  approved: 0,
  completed: 0,
}

const EMPTY_MAINTENANCE_PLAN_STATS: MaintenancePlanStats = {
  total: 0,
  draft: 0,
  approved: 0,
  plans: [],
}

function normalizeDashboardKpiSummary(data: Partial<DashboardKpiSummary> | null | undefined): DashboardKpiSummary {
  return {
    totalEquipment: data?.totalEquipment ?? 0,
    maintenanceCount: data?.maintenanceCount ?? 0,
    repairRequests: {
      ...EMPTY_REPAIR_REQUEST_STATS,
      ...(data?.repairRequests ?? {}),
    },
    maintenancePlans: {
      ...EMPTY_MAINTENANCE_PLAN_STATS,
      ...(data?.maintenancePlans ?? {}),
      plans: data?.maintenancePlans?.plans ?? [],
    },
  }
}

export function useDashboardKpiSummary() {
  const { data: session } = useSession()
  const user: DashboardSessionUser | undefined = session?.user
  const scope = getDashboardUserScope(user)

  return useQuery({
    queryKey: dashboardStatsKeys.kpiSummary(scope.role, scope.diaBanId),
    queryFn: async (): Promise<DashboardKpiSummary> => {
      const data = await callRpc<Partial<DashboardKpiSummary>>({ fn: 'dashboard_kpi_summary' })
      return normalizeDashboardKpiSummary(data)
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// Hook to get maintenance plan statistics (tenant-filtered)
export function useMaintenancePlanStats() {
  const query = useDashboardKpiSummary()
  return { ...query, data: query.data?.maintenancePlans ?? (query.data ? EMPTY_MAINTENANCE_PLAN_STATS : undefined) }
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
