"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

export type FilterChipsValue = {
  status: string[]
  facilityName?: string | null
  dateRange?: { from: string | null; to: string | null } | null
}

export function FilterChips({
  value,
  onRemove,
  onClearAll,
  showFacility,
}: {
  value: FilterChipsValue
  onRemove: (key: keyof FilterChipsValue, subkey?: string) => void
  onClearAll: () => void
  showFacility?: boolean
}) {
  const hasAny = (value.status?.length ?? 0) > 0 || (!!value.facilityName && showFacility) || !!value.dateRange

  if (!hasAny) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {value.status?.map((s) => (
        <Badge key={s} variant="secondary" className="pr-1">
          <span>{s}</span>
<Button variant="ghost" size="sm" className="ml-1 h-5 w-5 p-0" onClick={() => onRemove("status", s)} aria-label={`Xóa trạng thái ${s}`}>
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      {showFacility && value.facilityName && (
        <Badge variant="secondary" className="pr-1">
          <span>Cơ sở: {value.facilityName}</span>
<Button variant="ghost" size="sm" className="ml-1 h-5 w-5 p-0" onClick={() => onRemove("facilityName")} aria-label="Xóa cơ sở">
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {value.dateRange && (value.dateRange.from || value.dateRange.to) && (
        <Badge variant="secondary" className="pr-1">
          <span>
            Ngày: {value.dateRange.from ?? "…"} → {value.dateRange.to ?? "…"}
          </span>
<Button variant="ghost" size="sm" className="ml-1 h-5 w-5 p-0" onClick={() => onRemove("dateRange")} aria-label="Xóa khoảng ngày">
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      <Button variant="ghost" size="sm" className="h-7" onClick={onClearAll}>
        Xóa tất cả
      </Button>
    </div>
  )
}
