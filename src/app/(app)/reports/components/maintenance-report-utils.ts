import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

import type { ChartData } from "@/lib/chart-utils"
import type {
  MaintenanceReportData,
  RecentRepairHistoryEntry,
  RepairFrequencyPoint,
  TopEquipmentRepairEntry,
} from "../hooks/use-maintenance-data.types"

type MaintenanceSummary = MaintenanceReportData["summary"]
type MaintenanceSummaryInput = Partial<Record<keyof MaintenanceSummary, unknown>> | null | undefined

export interface RepairTrendChartPoint extends ChartData {
  period: string
  totalRequests: number
  completedRequests: number
}

export interface MaintenancePlanChartPoint extends ChartData {
  name: string
  planned: number
  actual: number
}

export interface TopEquipmentRepairRow {
  equipmentId: number
  name: string
  totalRequests: number
  rank: number
  latestCompletedDate?: string | null
  latestStatus: string
}

export type RecentRepairHistoryRow = RecentRepairHistoryEntry

export function parseMaintenanceReportNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function normalizeMaintenanceReportSummary(summary: MaintenanceSummaryInput): MaintenanceSummary {
  return {
    totalRepairs: parseMaintenanceReportNumber(summary?.totalRepairs),
    repairCompletionRate: parseMaintenanceReportNumber(summary?.repairCompletionRate),
    totalMaintenancePlanned: parseMaintenanceReportNumber(summary?.totalMaintenancePlanned),
    maintenanceCompletionRate: parseMaintenanceReportNumber(summary?.maintenanceCompletionRate),
    totalRepairCost: parseMaintenanceReportNumber(summary?.totalRepairCost),
    averageCompletedRepairCost: parseMaintenanceReportNumber(summary?.averageCompletedRepairCost),
    costRecordedCount: parseMaintenanceReportNumber(summary?.costRecordedCount),
    costMissingCount: parseMaintenanceReportNumber(summary?.costMissingCount),
  }
}

export function buildMaintenancePlanChartData(
  items: Array<{ name: string; planned: unknown; actual: unknown }> = []
): MaintenancePlanChartPoint[] {
  return items.map((item) => ({
    ...item,
    planned: parseMaintenanceReportNumber(item.planned),
    actual: parseMaintenanceReportNumber(item.actual),
  }))
}

export function buildRepairTrendChartData(
  repairFrequency: Array<Omit<RepairFrequencyPoint, "total" | "completed"> & {
    total: unknown
    completed: unknown
  }> = []
): RepairTrendChartPoint[] {
  return repairFrequency.map(({ period, total, completed }) => {
    const [year, month] = period.split("-")
    const parsed = new Date(Number(year), Number(month) - 1)
    const label = Number.isNaN(parsed.getTime()) ? period : format(parsed, "MMM yyyy", { locale: vi })

    return {
      period: label,
      totalRequests: parseMaintenanceReportNumber(total),
      completedRequests: parseMaintenanceReportNumber(completed),
    }
  })
}

export function buildTopEquipmentRepairRows(
  items: Array<Omit<TopEquipmentRepairEntry, "totalRequests"> & { totalRequests: unknown }> = []
): TopEquipmentRepairRow[] {
  return items.slice(0, 8).map((item, index) => ({
    equipmentId: item.equipmentId,
    name: item.equipmentName,
    totalRequests: parseMaintenanceReportNumber(item.totalRequests),
    rank: index + 1,
    latestCompletedDate: item.latestCompletedDate,
    latestStatus: item.latestStatus,
  }))
}

export function createMaintenanceReportDateFormatter() {
  return (value?: string | null) => {
    if (!value) return "—"

    try {
      return format(parseISO(value), "dd/MM/yyyy")
    } catch {
      return "—"
    }
  }
}
