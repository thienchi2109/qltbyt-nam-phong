import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { differenceInMinutes, startOfDay, endOfDay, subDays, format } from 'date-fns'
import { vi } from 'date-fns/locale'

// Query keys for analytics
export const usageAnalyticsKeys = {
  all: ['usage-analytics'] as const,
  overview: () => [...usageAnalyticsKeys.all, 'overview'] as const,
  equipmentStats: (dateRange?: { from: Date; to: Date }) => 
    [...usageAnalyticsKeys.all, 'equipment-stats', { dateRange }] as const,
  userStats: (dateRange?: { from: Date; to: Date }) => 
    [...usageAnalyticsKeys.all, 'user-stats', { dateRange }] as const,
  dailyUsage: (days: number) => 
    [...usageAnalyticsKeys.all, 'daily-usage', { days }] as const,
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

export interface DailyUsageData {
  date: string
  sessionCount: number
  totalUsageTime: number
  uniqueUsers: number
  uniqueEquipment: number
}

// Get usage overview statistics
export function useUsageOverview() {
  return useQuery({
    queryKey: usageAnalyticsKeys.overview(),
    queryFn: async (): Promise<UsageOverview> => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      // Get all usage logs with related data
      const { data: usageLogs, error } = await supabase
        .from('nhat_ky_su_dung')
        .select(`
          *,
          thiet_bi:thiet_bi(id, ten_thiet_bi, ma_thiet_bi),
          nguoi_su_dung:nhan_vien(id, full_name)
        `)

      if (error) throw error

      const totalSessions = usageLogs.length
      const activeSessions = usageLogs.filter(log => log.trang_thai === 'dang_su_dung').length

      // Calculate total usage time
      const totalUsageTime = usageLogs.reduce((total, log) => {
        if (log.thoi_gian_ket_thuc) {
          return total + differenceInMinutes(
            new Date(log.thoi_gian_ket_thuc),
            new Date(log.thoi_gian_bat_dau)
          )
        }
        return total
      }, 0)

      const averageSessionTime = totalSessions > 0 ? Math.round(totalUsageTime / totalSessions) : 0

      // Find most used equipment
      const equipmentUsage = new Map<number, { 
        equipment: any, 
        sessionCount: number, 
        totalTime: number 
      }>()

      usageLogs.forEach(log => {
        if (!log.thiet_bi) return
        
        const existing = equipmentUsage.get(log.thiet_bi.id) || {
          equipment: log.thiet_bi,
          sessionCount: 0,
          totalTime: 0
        }

        existing.sessionCount++
        if (log.thoi_gian_ket_thuc) {
          existing.totalTime += differenceInMinutes(
            new Date(log.thoi_gian_ket_thuc),
            new Date(log.thoi_gian_bat_dau)
          )
        }

        equipmentUsage.set(log.thiet_bi.id, existing)
      })

      const mostUsedEquipment = Array.from(equipmentUsage.values())
        .sort((a, b) => b.sessionCount - a.sessionCount)[0] || null

      // Find top user
      const userUsage = new Map<number, { 
        user: any, 
        sessionCount: number, 
        totalTime: number 
      }>()

      usageLogs.forEach(log => {
        if (!log.nguoi_su_dung) return
        
        const existing = userUsage.get(log.nguoi_su_dung.id) || {
          user: log.nguoi_su_dung,
          sessionCount: 0,
          totalTime: 0
        }

        existing.sessionCount++
        if (log.thoi_gian_ket_thuc) {
          existing.totalTime += differenceInMinutes(
            new Date(log.thoi_gian_ket_thuc),
            new Date(log.thoi_gian_bat_dau)
          )
        }

        userUsage.set(log.nguoi_su_dung.id, existing)
      })

      const topUser = Array.from(userUsage.values())
        .sort((a, b) => b.sessionCount - a.sessionCount)[0] || null

      return {
        totalSessions,
        activeSessions,
        totalUsageTime,
        averageSessionTime,
        mostUsedEquipment: mostUsedEquipment ? {
          id: mostUsedEquipment.equipment.id,
          ten_thiet_bi: mostUsedEquipment.equipment.ten_thiet_bi,
          ma_thiet_bi: mostUsedEquipment.equipment.ma_thiet_bi,
          sessionCount: mostUsedEquipment.sessionCount,
          totalTime: mostUsedEquipment.totalTime
        } : null,
        topUser: topUser ? {
          id: topUser.user.id,
          full_name: topUser.user.full_name,
          sessionCount: topUser.sessionCount,
          totalTime: topUser.totalTime
        } : null
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get equipment usage statistics
export function useEquipmentUsageStats(dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: usageAnalyticsKeys.equipmentStats(dateRange),
    queryFn: async (): Promise<EquipmentUsageStats[]> => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      let query = supabase
        .from('nhat_ky_su_dung')
        .select(`
          *,
          thiet_bi:thiet_bi(id, ten_thiet_bi, ma_thiet_bi, khoa_phong_quan_ly)
        `)

      // Apply date range filter
      if (dateRange) {
        query = query
          .gte('thoi_gian_bat_dau', startOfDay(dateRange.from).toISOString())
          .lte('thoi_gian_bat_dau', endOfDay(dateRange.to).toISOString())
      }

      const { data: usageLogs, error } = await query

      if (error) throw error

      // Group by equipment
      const equipmentStats = new Map<number, EquipmentUsageStats>()

      usageLogs.forEach(log => {
        if (!log.thiet_bi) return

        const existing = equipmentStats.get(log.thiet_bi.id) || {
          id: log.thiet_bi.id,
          ten_thiet_bi: log.thiet_bi.ten_thiet_bi,
          ma_thiet_bi: log.thiet_bi.ma_thiet_bi,
          khoa_phong_quan_ly: log.thiet_bi.khoa_phong_quan_ly,
          sessionCount: 0,
          totalUsageTime: 0,
          averageSessionTime: 0,
          currentlyInUse: false
        }

        existing.sessionCount++
        
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

      // Calculate average session time
      equipmentStats.forEach(stats => {
        stats.averageSessionTime = stats.sessionCount > 0 
          ? Math.round(stats.totalUsageTime / stats.sessionCount) 
          : 0
      })

      return Array.from(equipmentStats.values())
        .sort((a, b) => b.sessionCount - a.sessionCount)
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Get user usage statistics
export function useUserUsageStats(dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: usageAnalyticsKeys.userStats(dateRange),
    queryFn: async (): Promise<UserUsageStats[]> => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      let query = supabase
        .from('nhat_ky_su_dung')
        .select(`
          *,
          nguoi_su_dung:nhan_vien(id, full_name, khoa_phong),
          thiet_bi:thiet_bi(id)
        `)

      // Apply date range filter
      if (dateRange) {
        query = query
          .gte('thoi_gian_bat_dau', startOfDay(dateRange.from).toISOString())
          .lte('thoi_gian_bat_dau', endOfDay(dateRange.to).toISOString())
      }

      const { data: usageLogs, error } = await query

      if (error) throw error

      // Group by user
      const userStats = new Map<number, UserUsageStats>()

      usageLogs.forEach(log => {
        if (!log.nguoi_su_dung) return

        const existing = userStats.get(log.nguoi_su_dung.id) || {
          id: log.nguoi_su_dung.id,
          full_name: log.nguoi_su_dung.full_name,
          khoa_phong: log.nguoi_su_dung.khoa_phong,
          sessionCount: 0,
          totalUsageTime: 0,
          averageSessionTime: 0,
          equipmentUsed: new Set<number>()
        }

        existing.sessionCount++
        
        if (log.thoi_gian_ket_thuc) {
          existing.totalUsageTime += differenceInMinutes(
            new Date(log.thoi_gian_ket_thuc),
            new Date(log.thoi_gian_bat_dau)
          )
        }

        if (log.thiet_bi?.id) {
          (existing.equipmentUsed as Set<number>).add(log.thiet_bi.id)
        }

        if (!existing.lastActivity || new Date(log.thoi_gian_bat_dau) > new Date(existing.lastActivity)) {
          existing.lastActivity = log.thoi_gian_bat_dau
        }

        userStats.set(log.nguoi_su_dung.id, existing)
      })

      // Convert Set to number and calculate averages
      const result = Array.from(userStats.values()).map(stats => ({
        ...stats,
        equipmentUsed: (stats.equipmentUsed as Set<number>).size,
        averageSessionTime: stats.sessionCount > 0 
          ? Math.round(stats.totalUsageTime / stats.sessionCount) 
          : 0
      }))

      return result.sort((a, b) => b.sessionCount - a.sessionCount)
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

// Get daily usage data for charts
export function useDailyUsageData(days: number = 30) {
  return useQuery({
    queryKey: usageAnalyticsKeys.dailyUsage(days),
    queryFn: async (): Promise<DailyUsageData[]> => {
      if (!supabase) {
        throw new Error('Supabase client not initialized')
      }

      const endDate = new Date()
      const startDate = subDays(endDate, days - 1)

      const { data: usageLogs, error } = await supabase
        .from('nhat_ky_su_dung')
        .select(`
          *,
          nguoi_su_dung:nhan_vien(id),
          thiet_bi:thiet_bi(id)
        `)
        .gte('thoi_gian_bat_dau', startOfDay(startDate).toISOString())
        .lte('thoi_gian_bat_dau', endOfDay(endDate).toISOString())

      if (error) throw error

      // Group by date
      const dailyData = new Map<string, DailyUsageData>()

      // Initialize all dates
      for (let i = 0; i < days; i++) {
        const date = subDays(endDate, i)
        const dateKey = format(date, 'yyyy-MM-dd')
        dailyData.set(dateKey, {
          date: dateKey,
          sessionCount: 0,
          totalUsageTime: 0,
          uniqueUsers: new Set<number>(),
          uniqueEquipment: new Set<number>()
        })
      }

      // Populate with actual data
      usageLogs.forEach(log => {
        const dateKey = format(new Date(log.thoi_gian_bat_dau), 'yyyy-MM-dd')
        const existing = dailyData.get(dateKey)
        
        if (existing) {
          existing.sessionCount++
          
          if (log.thoi_gian_ket_thuc) {
            existing.totalUsageTime += differenceInMinutes(
              new Date(log.thoi_gian_ket_thuc),
              new Date(log.thoi_gian_bat_dau)
            )
          }

          if (log.nguoi_su_dung?.id) {
            (existing.uniqueUsers as Set<number>).add(log.nguoi_su_dung.id)
          }

          if (log.thiet_bi?.id) {
            (existing.uniqueEquipment as Set<number>).add(log.thiet_bi.id)
          }
        }
      })

      // Convert Sets to numbers and sort by date
      return Array.from(dailyData.values())
        .map(data => ({
          ...data,
          uniqueUsers: (data.uniqueUsers as Set<number>).size,
          uniqueEquipment: (data.uniqueEquipment as Set<number>).size
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
