"use client"

import * as React from "react"
import { Layers } from "lucide-react"

import { REPAIR_STATUS_CONFIGS, type RepairStatus } from "@/components/kpi"
import { cn } from "@/lib/utils"

interface RepairRequestsMobileKpiProps {
  counts: Partial<Record<RepairStatus, number>> | undefined
  loading?: boolean
}

const toneStyles: Record<
  "default" | "success" | "warning" | "danger" | "muted",
  {
    accent: string
    icon: string
    value: string
  }
> = {
  default: {
    accent: "bg-primary",
    icon: "bg-primary/10 text-primary",
    value: "text-foreground",
  },
  success: {
    accent: "bg-emerald-500",
    icon: "bg-emerald-100 text-emerald-700",
    value: "text-emerald-700",
  },
  warning: {
    accent: "bg-orange-500",
    icon: "bg-orange-100 text-orange-700",
    value: "text-orange-700",
  },
  danger: {
    accent: "bg-red-500",
    icon: "bg-red-100 text-red-700",
    value: "text-red-700",
  },
  muted: {
    accent: "bg-blue-500",
    icon: "bg-blue-100 text-blue-700",
    value: "text-blue-700",
  },
}

function countTotal(counts: RepairRequestsMobileKpiProps["counts"]) {
  if (!counts) return 0
  return REPAIR_STATUS_CONFIGS.reduce((total, config) => total + (counts[config.key] ?? 0), 0)
}

function KpiValue({
  value,
  loading,
  className,
}: {
  value: number
  loading?: boolean
  className?: string
}) {
  return (
    <span className={cn("text-2xl font-semibold leading-none", className)}>
      {loading ? "..." : value}
    </span>
  )
}

/** Renders the balanced mobile/tablet KPI grid for repair requests. */
export function RepairRequestsMobileKpi({ counts, loading = false }: RepairRequestsMobileKpiProps) {
  const total = countTotal(counts)

  return (
    <section
      aria-label="Tổng quan yêu cầu sửa chữa"
      className="grid grid-cols-2 gap-3 md:max-w-3xl md:gap-4"
      data-testid="repair-mobile-kpi"
    >
      <div
        className="col-span-2 overflow-hidden rounded-2xl border bg-card px-5 py-4 shadow-sm"
        data-testid="repair-mobile-kpi-total"
      >
        <div className="flex items-center gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Layers className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tổng yêu cầu
            </p>
            <KpiValue value={total} loading={loading} />
          </div>
        </div>
      </div>

      <div
        className="col-span-2 grid grid-cols-2 gap-3 md:gap-4"
        data-testid="repair-mobile-kpi-status-grid"
      >
        {REPAIR_STATUS_CONFIGS.map((config) => {
          const styles = toneStyles[config.tone]
          return (
            <div
              key={config.key}
              className="relative min-h-[132px] overflow-hidden rounded-2xl border bg-card p-4 shadow-sm"
              data-testid={`repair-mobile-kpi-status-${config.key}`}
            >
              <div className={cn("absolute inset-y-0 left-0 w-1", styles.accent)} />
              <div className="flex h-full flex-col justify-between gap-4 pl-1">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full",
                    styles.icon
                  )}
                >
                  {config.icon}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {config.label}
                  </p>
                  <KpiValue
                    value={counts?.[config.key] ?? 0}
                    loading={loading}
                    className={styles.value}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
