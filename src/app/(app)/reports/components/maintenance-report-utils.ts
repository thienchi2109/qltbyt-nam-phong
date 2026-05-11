import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

import type { ChartData } from "@/lib/chart-utils"
import type {
  MaintenanceReportData,
  RepairCompletionBucket,
  RepairCompletionTimeByMonthPoint,
  RepairFrequencyPoint,
  TopEquipmentRepairEntry,
} from "../hooks/use-maintenance-data.types"

type MaintenanceSummary = MaintenanceReportData["summary"]
type MaintenanceSummaryInput = Partial<Record<keyof MaintenanceSummary, unknown>> | null | undefined
const REPAIR_FREQUENCY_PERIOD_PATTERN = /^(\d{4})-(\d{2})$/

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

export interface CompletionTimeChartPoint extends ChartData {
  bucketKey: string
  label: string
  count: number
  fill: string
}

export interface CompletionTimeTrendPoint extends ChartData {
  period: string
  medianMinutes: number
  p90Minutes: number
  averageMinutes: number
  completedCount: number
}

export interface TopEquipmentRepairRow {
  equipmentId: number
  name: string
  totalRequests: number
  rank: number
  latestCompletedDate?: string | null
  latestStatus: string
}

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
    return {
      period: formatRepairFrequencyPeriod(period),
      totalRequests: parseMaintenanceReportNumber(total),
      completedRequests: parseMaintenanceReportNumber(completed),
    }
  })
}

export function buildCompletionTimeChartData(
  distribution: Array<Omit<RepairCompletionBucket, "count"> & { count: unknown }> = []
): CompletionTimeChartPoint[] {
  return distribution.map((bucket) => ({
    bucketKey: bucket.bucketKey,
    label: bucket.label,
    count: parseMaintenanceReportNumber(bucket.count),
    fill: getCompletionBucketColor(bucket),
  }))
}

export function buildCompletionTimeTrendData(
  points: Array<
    Omit<RepairCompletionTimeByMonthPoint, "medianMinutes" | "p90Minutes" | "averageMinutes" | "completedCount"> & {
      medianMinutes: unknown
      p90Minutes: unknown
      averageMinutes: unknown
      completedCount: unknown
    }
  > = []
): CompletionTimeTrendPoint[] {
  return points.map((point) => ({
    period: formatRepairFrequencyPeriod(point.period),
    medianMinutes: parseMaintenanceReportNumber(point.medianMinutes),
    p90Minutes: parseMaintenanceReportNumber(point.p90Minutes),
    averageMinutes: parseMaintenanceReportNumber(point.averageMinutes),
    completedCount: parseMaintenanceReportNumber(point.completedCount),
  }))
}

export function formatDurationAuto(minutes?: number | null): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) {
    return "—"
  }

  const value = minutes < 24 * 60 ? minutes / 60 : minutes / (24 * 60)
  const unit = minutes < 24 * 60 ? "giờ" : "ngày"
  const formatted = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 1,
  }).format(value)

  return `${formatted} ${unit}`
}

function getCompletionBucketColor(bucket: Pick<RepairCompletionBucket, "bucketKey" | "isOverThreshold">): string {
  if (!bucket.isOverThreshold) {
    return "hsl(var(--chart-1))"
  }

  return bucket.bucketKey === "30d+" ? "hsl(var(--destructive))" : "hsl(var(--chart-5))"
}

function formatRepairFrequencyPeriod(period: string): string {
  const match = REPAIR_FREQUENCY_PERIOD_PATTERN.exec(period)
  if (!match) {
    return period
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    return period
  }

  const parsed = new Date(year, month - 1, 1)
  return Number.isNaN(parsed.getTime()) ? period : format(parsed, "MMM yyyy", { locale: vi })
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
