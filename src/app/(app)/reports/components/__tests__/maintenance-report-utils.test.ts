import { describe, expect, it } from "vitest"

import {
  buildCompletionTimeChartData,
  buildCompletionTimeTrendData,
  buildMaintenancePlanChartData,
  buildRepairTrendChartData,
  buildTopEquipmentRepairRows,
  createMaintenanceReportDateFormatter,
  formatDurationAuto,
  normalizeMaintenanceReportSummary,
  parseMaintenanceReportNumber,
} from "../maintenance-report-utils"

describe("maintenance-report-utils", () => {
  it("normalizes numeric summary values from mixed RPC output", () => {
    const summary = normalizeMaintenanceReportSummary({
      totalRepairs: "12",
      repairCompletionRate: 75,
      totalMaintenancePlanned: "8.5",
      maintenanceCompletionRate: "bad-data",
      totalRepairCost: 3500000,
      averageCompletedRepairCost: "1750000",
      costRecordedCount: Number.POSITIVE_INFINITY,
      costMissingCount: null,
    })

    expect(summary).toEqual({
      totalRepairs: 12,
      repairCompletionRate: 75,
      totalMaintenancePlanned: 8.5,
      maintenanceCompletionRate: 0,
      totalRepairCost: 3500000,
      averageCompletedRepairCost: 1750000,
      costRecordedCount: 0,
      costMissingCount: 0,
    })
    expect(parseMaintenanceReportNumber("")).toBe(0)
  })

  it("builds chart and table view models without losing existing fields", () => {
    expect(
      buildMaintenancePlanChartData([
        { name: "Tháng 1", planned: "4", actual: "3" },
        { name: "Tháng 2", planned: Number.NaN, actual: "not-a-number" },
      ])
    ).toEqual([
      { name: "Tháng 1", planned: 4, actual: 3 },
      { name: "Tháng 2", planned: 0, actual: 0 },
    ])

    expect(
      buildRepairTrendChartData([
        { period: "2026-01", total: "9", completed: "7" },
        { period: "2026-13", total: "4", completed: "3" },
        { period: "unknown", total: "bad", completed: 2 },
      ])
    ).toEqual([
      { period: "thg 1 2026", totalRequests: 9, completedRequests: 7 },
      { period: "2026-13", totalRequests: 4, completedRequests: 3 },
      { period: "unknown", totalRequests: 0, completedRequests: 2 },
    ])

    expect(
      buildTopEquipmentRepairRows([
        {
          equipmentId: 7,
          equipmentName: "Máy thở",
          totalRequests: "5",
          latestStatus: "Hoàn thành",
          latestCompletedDate: "2026-04-01",
        },
      ])
    ).toEqual([
      {
        equipmentId: 7,
        name: "Máy thở",
        totalRequests: 5,
        rank: 1,
        latestStatus: "Hoàn thành",
        latestCompletedDate: "2026-04-01",
      },
    ])
  })

  it("formats optional ISO dates for the repair tables", () => {
    const formatDateDisplay = createMaintenanceReportDateFormatter()

    expect(formatDateDisplay("2026-04-12")).toBe("12/04/2026")
    expect(formatDateDisplay("not-a-date")).toBe("—")
    expect(formatDateDisplay(null)).toBe("—")
  })

  it("formats completion durations using hours below one day and days at or above one day", () => {
    expect(formatDurationAuto(90)).toBe("1,5 giờ")
    expect(formatDurationAuto(1080)).toBe("18 giờ")
    expect(formatDurationAuto(1440)).toBe("1 ngày")
    expect(formatDurationAuto(10368)).toBe("7,2 ngày")
    expect(formatDurationAuto(null)).toBe("—")
  })

  it("builds completion histogram and trend data from the RPC payload", () => {
    expect(
      buildCompletionTimeChartData([
        { bucketKey: "0-1d", label: "0-1 ngày", count: "7", isOverThreshold: false },
        { bucketKey: "30d+", label: ">30 ngày", count: 3, isOverThreshold: true },
      ])
    ).toEqual([
      { bucketKey: "0-1d", label: "0-1 ngày", count: 7, fill: "hsl(var(--chart-1))" },
      { bucketKey: "30d+", label: ">30 ngày", count: 3, fill: "hsl(var(--destructive))" },
    ])

    expect(
      buildCompletionTimeTrendData([
        {
          period: "2026-03",
          medianMinutes: "10800",
          p90Minutes: 43200,
          averageMinutes: 18600,
          completedCount: "6",
        },
      ])
    ).toEqual([
      {
        period: "thg 3 2026",
        medianMinutes: 10800,
        p90Minutes: 43200,
        averageMinutes: 18600,
        completedCount: 6,
      },
    ])
  })
})
