"use client"

import * as React from "react"
import { Layers, Clock, CheckCheck, CheckCircle, XCircle } from "lucide-react"
import type { SummaryItem } from "@/components/summary/summary-bar"
import type { UiFilters } from "@/lib/rr-prefs"

// ── Types ────────────────────────────────────────────────────────

const STATUSES = ['Chờ xử lý', 'Đã duyệt', 'Hoàn thành', 'Không HT'] as const
type Status = typeof STATUSES[number]

export interface UseRepairRequestsSummaryOptions {
  statusCounts: Record<string, number> | undefined
  uiFilters: UiFilters
  setUiFiltersState: (v: UiFilters) => void
  setUiFilters: (v: UiFilters) => void
}

export interface UseRepairRequestsSummaryReturn {
  kpiTotal: number
  summaryItems: SummaryItem[]
}

// ── Hook ─────────────────────────────────────────────────────────

export function useRepairRequestsSummary(
  opts: UseRepairRequestsSummaryOptions
): UseRepairRequestsSummaryReturn {
  const { statusCounts, uiFilters, setUiFiltersState, setUiFilters } = opts

  // KPI total: sum of all status counts
  const kpiTotal = React.useMemo(() => {
    if (!statusCounts) return 0
    return Object.values(statusCounts).reduce((sum, v) => sum + (v || 0), 0)
  }, [statusCounts])

  const summaryItems: SummaryItem[] = React.useMemo(() => {
    const toneMap: Record<Status, SummaryItem["tone"]> = {
      'Chờ xử lý': 'warning',
      'Đã duyệt': 'muted',
      'Hoàn thành': 'success',
      'Không HT': 'danger',
    }
    const iconMap: Record<string, React.ReactNode> = {
      'total': <Layers className="h-5 w-5" />,
      'Chờ xử lý': <Clock className="h-5 w-5" />,
      'Đã duyệt': <CheckCheck className="h-5 w-5" />,
      'Hoàn thành': <CheckCircle className="h-5 w-5" />,
      'Không HT': <XCircle className="h-5 w-5" />,
    }

    const isTotalActive = uiFilters.status.length === 0

    const handleShowAll = () => {
      const updated = { ...uiFilters, status: [] }
      setUiFiltersState(updated)
      setUiFilters(updated)
    }

    const handleFilterByStatus = (status: Status) => {
      const updated = { ...uiFilters, status: [status] }
      setUiFiltersState(updated)
      setUiFilters(updated)
    }

    const base: SummaryItem[] = [
      { key: 'total', label: 'Tổng', value: kpiTotal, tone: 'default', icon: iconMap['total'], onClick: handleShowAll, active: isTotalActive },
    ]
    const statusItems: SummaryItem[] = STATUSES.map((s) => ({
      key: s,
      label: s,
      value: statusCounts?.[s] ?? 0,
      tone: toneMap[s],
      icon: iconMap[s],
      onClick: () => handleFilterByStatus(s),
      active: uiFilters.status.length === 1 && uiFilters.status[0] === s,
    }))
    return [...base, ...statusItems]
  }, [kpiTotal, statusCounts, uiFilters, setUiFiltersState, setUiFilters])

  return { kpiTotal, summaryItems }
}
