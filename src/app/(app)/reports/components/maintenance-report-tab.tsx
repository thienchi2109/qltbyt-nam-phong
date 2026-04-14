"use client"

import * as React from "react"
import { endOfYear, startOfYear } from "date-fns"

import { useMaintenanceReportData } from "../hooks/use-maintenance-data"
import type { DateRange } from "../hooks/use-maintenance-data.types"
import { MaintenanceRepairCostVisualizations } from "./maintenance-repair-cost-visualizations"
import { MaintenanceReportDateFilter } from "./maintenance-report-date-filter"
import { MaintenanceReportPlanChart } from "./maintenance-report-plan-chart"
import { MaintenanceReportRepairCharts } from "./maintenance-report-repair-charts"
import { MaintenanceReportRepairTables } from "./maintenance-report-repair-tables"
import { MaintenanceReportSummaryCards } from "./maintenance-report-summary-cards"
import {
  buildMaintenancePlanChartData,
  buildRepairTrendChartData,
  buildTopEquipmentRepairRows,
  createMaintenanceReportDateFormatter,
  normalizeMaintenanceReportSummary,
} from "./maintenance-report-utils"

interface MaintenanceReportTabProps {
  tenantFilter?: string
  selectedDonVi?: number | null
  effectiveTenantKey?: string
}

export function MaintenanceReportTab({
  selectedDonVi,
  effectiveTenantKey,
}: MaintenanceReportTabProps) {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
  })

  const { data: reportData, isLoading } = useMaintenanceReportData(
    dateRange,
    selectedDonVi,
    effectiveTenantKey
  )

  const summary = reportData?.summary
  const charts = reportData?.charts
  const repairFrequency = charts?.repairFrequencyByMonth ?? []
  const repairStatusData = charts?.repairStatusDistribution ?? []
  const topEquipmentRepairs = reportData?.topEquipmentRepairs ?? []
  const topEquipmentRepairCosts = reportData?.topEquipmentRepairCosts ?? []
  const repairUsageCostCorrelation = charts?.repairUsageCostCorrelation
  const recentRepairHistory = reportData?.recentRepairHistory ?? []

  const normalizedSummary = React.useMemo(
    () => normalizeMaintenanceReportSummary(summary),
    [summary]
  )

  const maintenancePlanData = React.useMemo(
    () => buildMaintenancePlanChartData(charts?.maintenancePlanVsActual ?? []),
    [charts?.maintenancePlanVsActual]
  )

  const repairTrendData = React.useMemo(
    () => buildRepairTrendChartData(repairFrequency),
    [repairFrequency]
  )

  const topEquipmentRows = React.useMemo(
    () => buildTopEquipmentRepairRows(topEquipmentRepairs),
    [topEquipmentRepairs]
  )

  const numberFormatter = React.useMemo(() => new Intl.NumberFormat("vi-VN"), [])
  const formatDateDisplay = React.useMemo(() => createMaintenanceReportDateFormatter(), [])

  return (
    <div className="space-y-6">
      <MaintenanceReportDateFilter
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      <MaintenanceReportSummaryCards
        summary={normalizedSummary}
        isLoading={isLoading}
        numberFormatter={numberFormatter}
      />

      <MaintenanceReportRepairCharts
        isLoading={isLoading}
        repairTrendData={repairTrendData}
        repairStatusData={repairStatusData}
      />

      <MaintenanceReportPlanChart
        isLoading={isLoading}
        maintenancePlanData={maintenancePlanData}
      />

      {repairUsageCostCorrelation ? (
        <MaintenanceRepairCostVisualizations
          topEquipmentRepairCosts={topEquipmentRepairCosts}
          repairUsageCostCorrelation={repairUsageCostCorrelation}
        />
      ) : null}

      <MaintenanceReportRepairTables
        isLoading={isLoading}
        topEquipmentRows={topEquipmentRows}
        recentRepairHistory={recentRepairHistory}
        numberFormatter={numberFormatter}
        formatDateDisplay={formatDateDisplay}
      />
    </div>
  )
}
