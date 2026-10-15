import type { UsageLog } from "@/types/database"

export interface UsageOverview {
  totalSessions: number
  activeSessions: number
  totalUsageTime: number
  averageSessionTime: number
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
  totalUsageTime: number
  averageSessionTime: number
  lastUsed?: string
  currentlyInUse: boolean
}

export interface UserUsageStats {
  id: number
  full_name: string
  khoa_phong?: string
  sessionCount: number
  totalUsageTime: number
  averageSessionTime: number
  equipmentUsed: number
  lastActivity?: string
}

export interface DailyUsageData {
  date: string
  sessionCount: number
  totalUsageTime: number
  uniqueUsers: number
  uniqueEquipment: number
}

export type UsageLogWithRelations = UsageLog & {
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

export interface UsageLogQueryOptions {
  equipmentId?: number | null
  status?: "dang_su_dung" | "hoan_thanh"
  activeOnly?: boolean
  startedFrom?: Date
  startedTo?: Date
  limit?: number
  donVi?: number | null
}
