"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X, Calendar as CalendarIcon } from "lucide-react"
import type { TransferStatus } from "@/types/transfers-data-grid"

const STATUS_LABELS: Record<TransferStatus, string> = {
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  dang_luan_chuyen: "Đang luân chuyển",
  da_ban_giao: "Đã bàn giao",
  hoan_thanh: "Hoàn thành",
}

export type FilterChipsValue = {
  statuses: TransferStatus[]
  dateRange?: { from: string | null; to: string | null } | null
  searchText?: string | null
}

export function FilterChips({
  value,
  onRemove,
  onClearAll,
}: {
  value: FilterChipsValue
  onRemove: (key: keyof FilterChipsValue, subkey?: string) => void
  onClearAll?: () => void
}) {
  const hasStatusFilters = (value.statuses?.length ?? 0) > 0
  const hasDateRange = !!(value.dateRange && (value.dateRange.from || value.dateRange.to))
  const hasSearchText = !!value.searchText

  const hasAny = hasStatusFilters || hasDateRange || hasSearchText

  if (!hasAny) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Đang lọc:</span>

      {value.statuses?.map((status) => (
        <Badge key={status} variant="secondary" className="pr-1">
          <span>{STATUS_LABELS[status]}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-5 w-5 p-0"
            onClick={() => onRemove("statuses", status)}
            aria-label={`Xóa trạng thái ${STATUS_LABELS[status]}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      {hasDateRange && (
        <Badge variant="secondary" className="pr-1 gap-1">
          <CalendarIcon className="h-3 w-3" />
          <span>
            {value.dateRange?.from ?? "…"} → {value.dateRange?.to ?? "…"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-5 w-5 p-0"
            onClick={() => onRemove("dateRange")}
            aria-label="Xóa khoảng ngày"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onClearAll}
        >
          Xóa tất cả
        </Button>
      )}
    </div>
  )
}
