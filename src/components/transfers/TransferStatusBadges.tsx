import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TRANSFER_STATUSES } from "@/types/database"
import type { TransferStatus, TransferStatusCounts } from "@/types/transfers-data-grid"

const STATUS_ORDER: TransferStatus[] = [
  "cho_duyet",
  "da_duyet",
  "dang_luan_chuyen",
  "da_ban_giao",
  "hoan_thanh",
]

const STATUS_STYLES: Record<TransferStatus, { base: string; active: string; dot: string }> = {
  cho_duyet: {
    base: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
    active: "border-amber-500 bg-amber-500 text-white hover:bg-amber-500/90",
    dot: "bg-amber-500",
  },
  da_duyet: {
    base: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
    active: "border-sky-500 bg-sky-500 text-white hover:bg-sky-500/90",
    dot: "bg-sky-500",
  },
  dang_luan_chuyen: {
    base: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    active: "border-rose-500 bg-rose-600 text-white hover:bg-rose-600/90",
    dot: "bg-rose-500",
  },
  da_ban_giao: {
    base: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
    active: "border-violet-500 bg-violet-600 text-white hover:bg-violet-600/90",
    dot: "bg-violet-500",
  },
  hoan_thanh: {
    base: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    active: "border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-600/90",
    dot: "bg-emerald-500",
  },
}

export interface TransferStatusBadgesProps {
  counts?: TransferStatusCounts
  isLoading?: boolean
  selectedStatuses: TransferStatus[]
  onToggleStatus: (status: TransferStatus) => void
  onClearStatuses?: () => void
}

export function TransferStatusBadges({
  counts,
  isLoading,
  selectedStatuses,
  onToggleStatus,
  onClearStatuses,
}: TransferStatusBadgesProps) {
  const handleToggle = React.useCallback(
    (status: TransferStatus) => {
      if (isLoading) return
      onToggleStatus(status)
    },
    [isLoading, onToggleStatus],
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_ORDER.map((status) => {
        const isActive = selectedStatuses.includes(status)
        const count = counts?.[status] ?? 0
        const styles = STATUS_STYLES[status]

        return (
          <button
            key={status}
            type="button"
            disabled={isLoading}
            onClick={() => handleToggle(status)}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isActive ? styles.active : styles.base,
              isLoading && "cursor-not-allowed opacity-70",
            )}
          >
            <span
              aria-hidden
              className={cn("h-2 w-2 rounded-full", styles.dot, isActive ? "opacity-100" : "opacity-80")}
            />
            <span>{TRANSFER_STATUSES[status]}</span>
            <Badge
              variant="secondary"
              className={cn(
                "rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-900",
                isActive && "bg-white/90 text-slate-900",
              )}
            >
              {count}
            </Badge>
          </button>
        )
      })}

      {onClearStatuses && selectedStatuses.length > 0 ? (
        <button
          type="button"
          onClick={onClearStatuses}
          className="inline-flex items-center rounded-full border border-transparent bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          Bỏ lọc trạng thái
        </button>
      ) : null}
    </div>
  )
}
