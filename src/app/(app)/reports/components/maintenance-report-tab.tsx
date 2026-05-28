"use client"

import * as React from "react"
import { endOfYear, startOfYear } from "date-fns"

import { useMaintenanceReportData } from "../hooks/use-maintenance-data"
import { defaultMaintenanceReportData, type DateRange } from "../hooks/use-maintenance-data.types"
import { MaintenanceRepairCostVisualizations } from "./maintenance-repair-cost-visualizations"
import { MaintenanceReportDateFilter } from "./maintenance-report-date-filter"
import { MaintenanceReportCompletionTime } from "./maintenance-report-completion-time"
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

const VI_NUMBER_FORMATTER = new Intl.NumberFormat("vi-VN")

interface MaintenanceReportTabProps {
  tenantFilter?: string
  selectedDonVi?: number | null
  effectiveTenantKey?: string
}

/** Renders the maintenance report dashboard tab for the selected facility scope. */
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
  const repairFrequency = React.useMemo(
    () => charts?.repairFrequencyByMonth ?? [],
    [charts?.repairFrequencyByMonth]
  )
  const repairStatusData = React.useMemo(
    () => charts?.repairStatusDistribution ?? [],
    [charts?.repairStatusDistribution]
  )
  const topEquipmentRepairs = React.useMemo(
    () => reportData?.topEquipmentRepairs ?? [],
    [reportData?.topEquipmentRepairs]
  )
  const topEquipmentRepairCosts = reportData?.topEquipmentRepairCosts ?? []
  const repairUsageCostCorrelation = charts?.repairUsageCostCorrelation

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

  const numberFormatter = VI_NUMBER_FORMATTER
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

      <MaintenanceReportCompletionTime
        isLoading={isLoading}
        repairCompletionTime={
          charts?.repairCompletionTime ?? defaultMaintenanceReportData.charts.repairCompletionTime
        }
        repairCompletionTimeByMonth={
          charts?.repairCompletionTimeByMonth ??
          defaultMaintenanceReportData.charts.repairCompletionTimeByMonth
        }
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
        numberFormatter={numberFormatter}
        formatDateDisplay={formatDateDisplay}
      />
    </div>
  )
}
