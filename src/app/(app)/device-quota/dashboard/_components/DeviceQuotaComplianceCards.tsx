"use client"

import * as React from "react"
import { DEVICE_QUOTA_CONFIGS, KpiStatusBar } from "@/components/kpi"
import { useDeviceQuotaDashboardContext } from "../_hooks/useDeviceQuotaDashboardContext"

/**
 * DeviceQuotaComplianceCards
 *
 * Displays 4 KPI cards showing compliance summary:
 * 1. Total categories (Tổng danh mục) - blue/neutral
 * 2. Compliant (Đạt định mức) - green
 * 3. Under quota (Thiếu định mức) - red/destructive
 * 4. Over quota (Vượt định mức) - amber/warning
 *
 * Pattern: RepairRequestCard with context-based data fetching
 */
export function DeviceQuotaComplianceCards() {
  const { complianceSummary, isLoading, isError } = useDeviceQuotaDashboardContext()

  const counts = React.useMemo(() => {
    if (!complianceSummary) return undefined

    return {
      dat: complianceSummary.dat_count,
      thieu: complianceSummary.thieu_count,
      vuot: complianceSummary.vuot_count,
    }
  }, [complianceSummary])

  return (
    <KpiStatusBar
      configs={DEVICE_QUOTA_CONFIGS}
      counts={counts}
      loading={isLoading}
      error={isError}
      showTotal
      totalLabel="Tổng danh mục"
      totalOverride={complianceSummary?.total_categories}
    />
  )
}
