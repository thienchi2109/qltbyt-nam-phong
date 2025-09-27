import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import { differenceInMinutes, startOfDay, endOfDay, subDays, format } from 'date-fns'
import { type UsageLog } from '@/types/database'

// Query keys for analytics
export const usageAnalyticsKeys = {
  all: ['usage-analytics'] as const,
  overview: (params?: Record<string, any>) => [...usageAnalyticsKeys.all, 'overview', params || {}] as const,
  equipmentStats: (params?: Record<string, any>) => 
    [...usageAnalyticsKeys.all, 'equipment-stats', params || {}] as const,
  userStats: (params?: Record<string, any>) => 
    [...usageAnalyticsKeys.all, 'user-stats', params || {}] as const,
  dailyUsage: (params?: Record<string, any>) => 
    [...usageAnalyticsKeys.all, 'daily-usage', params || {}] as const,
}

export interface UsageOverview {
  totalSessions: number
  activeSessions: number
  totalUsageTime: number // in minutes
  averageSessionTime: number // in minutes
  mostUsedEquipment: {
    id: number
    ten_thiet_bi: string
    ma_thiet_bi: string
    sessionCount: number
    totalTime: number
  } | null
  topUser: {
    id: number
    full_name: string
    sessionCount: number
    totalTime: number
  } | null
}

export interface EquipmentUsageStats {
  id: number
  ten_thiet_bi: string
  ma_thiet_bi: string
  khoa_phong_quan_ly?: string
  sessionCount: number
  totalUsageTime: number // in minutes
  averageSessionTime: number
  lastUsed?: string
  currentlyInUse: boolean
}

export interface UserUsageStats {
  id: number
  full_name: string
  khoa_phong?: string
  sessionCount: number
  totalUsageTime: number // in minutes
  averageSessionTime: number
  equipmentUsed: number // unique equipment count
  lastActivity?: string
}

// Internal accumulator with Set for equipment uniqueness
interface UserUsageStatsInternal {
  id: number
  full_name: string
  khoa_phong?: string
  sessionCount: number
  totalUsageTime: number
  averageSessionTime: number
  equipmentUsed: Set<number>
  lastActivity?: string
}

export interface DailyUsageData {
  date: string
  sessionCount: number
  totalUsageTime: number
  uniqueUsers: number
  uniqueEquipment: number
}

type UsageLogWithRelations = UsageLog & {
  thiet_bi?: {
    id: number
    ma_thiet_bi: string
    ten_thiet_bi: string
    khoa_phong_quan_ly?: string | null
    don_vi?: number | null
  } | null
  nguoi_su_dung?: {
    id: number
    full_name: string
    khoa_phong?: string | null
  } | null
}

interface UsageLogQueryOptions {
  equipmentId?: number | null
  status?: 'dang_su_dung' | 'hoan_thanh'
  activeOnly?: boolean
  startedFrom?: Date
  startedTo?: Date
  limit?: number
  donVi?: number | null
}

async function fetchUsageLogs(options: UsageLogQueryOptions = {}): Promise<UsageLogWithRelations[]> {
  const payload = await callRpc<UsageLogWithRelations[]>({
    fn: 'usage_log_list',
    args: {
      p_thiet_bi_id: options.equipmentId ?? null,
      p_trang_thai: options.status ?? null,
      p_active_only: options.activeOnly ?? false,
      p_started_from: options.startedFrom ? options.startedFrom.toISOString() : null,
      p_started_to: options.startedTo ? options.startedTo.toISOString() : null,
      p_limit: options.limit ?? 2000,
      p_offset: 0,
      p_don_vi: options.donVi ?? null,
    },
  })

  return payload ?? []
}

// Get usage overview statistics
export function useUsageOverview(
  tenantFilter?: string,
  selectedDonVi?: number | null,
  effectiveTenantKey?: string
) {
  return useQuery({
    queryKey: usageAnalyticsKeys.overview({ tenant: effectiveTenantKey || 'auto' }),
    queryFn: async (): Promise<UsageOverview> => {
      const usageLogs = await fetchUsageLogs({
        donVi: selectedDonVi ?? null,
        limit: 3000,
      })

      const totalSessions = usageLogs.length
      const activeSessions = usageLogs.filter((log) => log.trang_thai === 'dang_su_dung').length

      const totalUsageTime = usageLogs.reduce((total, log) => {
        if (log.thoi_gian_ket_thuc) {
          return (
            total +
            differenceInMinutes(
              new Date(log.thoi_gian_ket_thuc),
              new Date(log.thoi_gian_bat_dau)
            )
          )
        }
        return total
      }, 0)

      const averageSessionTime = totalSessions > 0 ? Math.round(totalUsageTime / totalSessions) : 0

      const equipmentUsage = new Map<
        number,
        {
          equipment: NonNullable<UsageLogWithRelations['thiet_bi']>
          sessionCount: number
          totalTime: number
        }
      >()

      usageLogs.forEach((log) => {
        if (!log.thiet_bi) return

        const existing = equipmentUsage.get(log.thiet_bi.id) ?? {
          equipment: log.thiet_bi,
          sessionCount: 0,
          totalTime: 0,
        }

        existing.sessionCount += 1
        if (log.thoi_gian_ket_thuc) {
          existing.totalTime += differenceInMinutes(
            new Date(log.thoi_gian_ket_thuc),
            new Date(log.thoi_gian_bat_dau)
          )
        }

        equipmentUsage.set(log.thiet_bi.id, existing)
      })

      const mostUsedEquipment =
        Array.from(equipmentUsage.values()).sort((a, b) => b.sessionCount - a.sessionCount)[0] || null

      const userUsage = new Map<
        number,
        {
          user: NonNullable<UsageLogWithRelations['nguoi_su_dung']>
          sessionCount: number
          totalTime: number
        }
      >()

      usageLogs.forEach((log) => {
        if (!log.nguoi_su_dung) return

        const existing = userUsage.get(log.nguoi_su_dung.id) ?? {
          user: log.nguoi_su_dung,
          sessionCount: 0,
          totalTime: 0,
        }

        existing.sessionCount += 1
        if (log.thoi_gian_ket_thuc) {
          existing.totalTime += differenceInMinutes(
            new Date(log.thoi_gian_ket_thuc),
            new Date(log.thoi_gian_bat_dau)
          )
        }

        userUsage.set(log.nguoi_su_dung.id, existing)
      })

      const topUser =
        Array.from(userUsage.values()).sort((a, b) => b.sessionCount - a.sessionCount)[0] || null

      return {
        totalSessions,
        activeSessions,
        totalUsageTime,
        averageSessionTime,
        mostUsedEquipment:
          mostUsedEquipment && mostUsedEquipment.equipment
            ? {
                id: mostUsedEquipment.equipment.id,
                ten_thiet_bi: mostUsedEquipment.equipment.ten_thiet_bi,
                ma_thiet_bi: mostUsedEquipment.equipment.ma_thiet_bi,
                sessionCount: mostUsedEquipment.sessionCount,
                totalTime: mostUsedEquipment.totalTime,
              }
            : null,
        topUser:
          topUser && topUser.user
            ? {
                id: topUser.user.id,
                full_name: topUser.user.full_name,
                sessionCount: topUser.sessionCount,
                totalTime: topUser.totalTime,
              }
            : null,
      }
    },
    enabled: effectiveTenantKey !== 'unset', // Gate query for global users
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get equipment usage statistics
export function useEquipmentUsageStats(
  dateRange?: { from: Date; to: Date },
  tenantFilter?: string,
  selectedDonVi?: number | null,
  effectiveTenantKey?: string
) {
  return useQuery({
    queryKey: usageAnalyticsKeys.equipmentStats({ dateRange, tenant: effectiveTenantKey || 'auto' }),
    queryFn: async (): Promise<EquipmentUsageStats[]> => {
      const usageLogs = await fetchUsageLogs({
        startedFrom: dateRange ? startOfDay(dateRange.from) : undefined,
        startedTo: dateRange ? endOfDay(dateRange.to) : undefined,
        donVi: selectedDonVi ?? null,
        limit: 5000,
      })

      const equipmentStats = new Map<number, EquipmentUsageStats>()

      usageLogs.forEach((log) => {
        if (!log.thiet_bi) return

        const existing = equipmentStats.get(log.thiet_bi.id) ?? {
          id: log.thiet_bi.id,
          ten_thiet_bi: log.thiet_bi.ten_thiet_bi,
          ma_thiet_bi: log.thiet_bi.ma_thiet_bi,
          khoa_phong_quan_ly: log.thiet_bi.khoa_phong_quan_ly ?? undefined,
          sessionCount: 0,
          totalUsageTime: 0,
          averageSessionTime: 0,
          currentlyInUse: false,
          lastUsed: undefined,
        }

        existing.sessionCount += 1

        if (log.thoi_gian_ket_thuc) {
          existing.totalUsageTime += differenceInMinutes(
            new Date(log.thoi_gian_ket_thuc),
            new Date(log.thoi_gian_bat_dau)
          )
        }

        if (log.trang_thai === 'dang_su_dung') {
          existing.currentlyInUse = true
        }

        if (!existing.lastUsed || new Date(log.thoi_gian_bat_dau) > new Date(existing.lastUsed)) {
          existing.lastUsed = log.thoi_gian_bat_dau
        }

        equipmentStats.set(log.thiet_bi.id, existing)
      })

      equipmentStats.forEach((stats) => {
        stats.averageSessionTime = stats.sessionCount > 0
          ? Math.round(stats.totalUsageTime / stats.sessionCount)
          : 0
      })

      return Array.from(equipmentStats.values()).sort((a, b) => b.sessionCount - a.sessionCount)
    },
    enabled: effectiveTenantKey !== 'unset', // Gate query for global users
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Get user usage statistics
export function useUserUsageStats(
  dateRange?: { from: Date; to: Date },
  tenantFilter?: string,
  selectedDonVi?: number | null,
  effectiveTenantKey?: string
) {
  return useQuery({
    queryKey: usageAnalyticsKeys.userStats({ dateRange, tenant: effectiveTenantKey || 'auto' }),
    queryFn: async (): Promise<UserUsageStats[]> => {
      const usageLogs = await fetchUsageLogs({
        startedFrom: dateRange ? startOfDay(dateRange.from) : undefined,
        startedTo: dateRange ? endOfDay(dateRange.to) : undefined,
        donVi: selectedDonVi ?? null,
        limit: 5000,
      })

      const userStats = new Map<number, UserUsageStatsInternal>()

      usageLogs.forEach((log) => {
        if (!log.nguoi_su_dung) return

        const existing = userStats.get(log.nguoi_su_dung.id) ?? {
          id: log.nguoi_su_dung.id,
          full_name: log.nguoi_su_dung.full_name,
          khoa_phong: log.nguoi_su_dung.khoa_phong ?? undefined,
          sessionCount: 0,
          totalUsageTime: 0,
          averageSessionTime: 0,
          equipmentUsed: new Set<number>(),
          lastActivity: undefined,
        }

        existing.sessionCount += 1

        if (log.thoi_gian_ket_thuc) {
          existing.totalUsageTime += differenceInMinutes(
            new Date(log.thoi_gian_ket_thuc),
            new Date(log.thoi_gian_bat_dau)
          )
        }

        if (log.thiet_bi?.id) {
          existing.equipmentUsed.add(log.thiet_bi.id)
        }

        if (!existing.lastActivity || new Date(log.thoi_gian_bat_dau) > new Date(existing.lastActivity)) {
          existing.lastActivity = log.thoi_gian_bat_dau
        }

        userStats.set(log.nguoi_su_dung.id, existing)
      })

      const result: UserUsageStats[] = Array.from(userStats.values()).map((stats) => ({
        id: stats.id,
        full_name: stats.full_name,
        khoa_phong: stats.khoa_phong,
        sessionCount: stats.sessionCount,
        totalUsageTime: stats.totalUsageTime,
        averageSessionTime:
          stats.sessionCount > 0 ? Math.round(stats.totalUsageTime / stats.sessionCount) : 0,
        equipmentUsed: stats.equipmentUsed.size,
        lastActivity: stats.lastActivity,
      }))

      return result.sort((a, b) => b.sessionCount - a.sessionCount)
    },
    enabled: effectiveTenantKey !== 'unset', // Gate query for global users
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Get daily usage data for charts
export function useDailyUsageData(
  days: number = 30,
  tenantFilter?: string,
  selectedDonVi?: number | null,
  effectiveTenantKey?: string
) {
  return useQuery({
    queryKey: usageAnalyticsKeys.dailyUsage({ days, tenant: effectiveTenantKey || 'auto' }),
    queryFn: async (): Promise<DailyUsageData[]> => {
      const endDate = new Date()
      const startDate = subDays(endDate, days - 1)

      const usageLogs = await fetchUsageLogs({
        startedFrom: startOfDay(startDate),
        startedTo: endOfDay(endDate),
        donVi: selectedDonVi ?? null,
        limit: Math.max(days * 200, 2000),
      })

      const dailyData = new Map<string, DailyUsageData & { __uu?: Set<number>; __ue?: Set<number> }>()

      for (let i = 0; i < days; i++) {
        const date = subDays(endDate, i)
        const dateKey = format(date, 'yyyy-MM-dd')
        dailyData.set(dateKey, {
          date: dateKey,
          sessionCount: 0,
          totalUsageTime: 0,
          uniqueUsers: 0,
          uniqueEquipment: 0,
          __uu: new Set<number>(),
          __ue: new Set<number>(),
        })
      }

      usageLogs.forEach((log) => {
        const dateKey = format(new Date(log.thoi_gian_bat_dau), 'yyyy-MM-dd')
        const existing = dailyData.get(dateKey)

        if (!existing) {
          return
        }

        existing.sessionCount += 1

        if (log.thoi_gian_ket_thuc) {
          existing.totalUsageTime += differenceInMinutes(
            new Date(log.thoi_gian_ket_thuc),
            new Date(log.thoi_gian_bat_dau)
          )
        }

        if (log.nguoi_su_dung?.id) {
          existing.__uu?.add(log.nguoi_su_dung.id)
        }
        if (log.thiet_bi?.id) {
          existing.__ue?.add(log.thiet_bi.id)
        }
      })

      return Array.from(dailyData.values())
        .map(({ __uu, __ue, ...rest }) => ({
          ...rest,
          uniqueUsers: __uu?.size ?? 0,
          uniqueEquipment: __ue?.size ?? 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    },
    enabled: effectiveTenantKey !== 'unset', // Gate query for global users
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
