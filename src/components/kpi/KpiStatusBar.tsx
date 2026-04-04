"use client"

import * as React from "react"
import { Layers } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import { cn } from "@/lib/utils"
import type { KpiStatusBarProps } from "./types"

/**
 * KpiStatusBar — Generic, display-only KPI status card grid.
 *
 * Renders a "Total" card (optional) followed by one card per status config.
 * Counts are mapped from a `Record<TStatus, number>`.
 * No onClick/active props — purely for display.
 *
 * @example
 * ```tsx
 * <KpiStatusBar
 *   configs={REPAIR_STATUS_CONFIGS}
 *   counts={statusCounts}
 *   loading={isLoading}
 * />
 * ```
 */
export function KpiStatusBar<TStatus extends string>({
  configs,
  counts,
  loading = false,
  error = false,
  className,
  showTotal = true,
  totalLabel = "Tổng",
  totalOverride,
}: KpiStatusBarProps<TStatus>) {
  const total = React.useMemo(() => {
    if (totalOverride !== undefined) return totalOverride
    if (!counts) return 0
    return (Object.values(counts) as (number | undefined)[]).reduce<number>(
      (sum, val) => sum + (typeof val === "number" ? val : 0),
      0
    )
  }, [counts, totalOverride])

  // Determine grid columns based on item count
  const itemCount = configs.length + (showTotal ? 1 : 0)
  const gridCols = getGridCols(itemCount)

  if (error) {
    return (
      <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Không thể tải dữ liệu</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn("grid gap-4", gridCols, className)}>
      {showTotal ? (
        <StatCard
          label={totalLabel}
          value={total}
          icon={<Layers className="h-5 w-5" />}
          tone="default"
        />
      ) : null}

      {configs.map((config) => (
        <StatCard
          key={config.key}
          label={config.label}
          value={counts?.[config.key] ?? 0}
          icon={config.icon}
          tone={config.tone}
          loading={loading}
        />
      ))}
    </div>
  )
}

/** Compute responsive grid class string based on total card count */
function getGridCols(count: number): string {
  if (count <= 4) return "grid-cols-2 md:grid-cols-4"
  if (count === 5) return "grid-cols-2 md:grid-cols-4 xl:grid-cols-5"
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
}
