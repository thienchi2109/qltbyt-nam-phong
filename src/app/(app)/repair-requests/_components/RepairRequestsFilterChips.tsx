"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type FilterChipsValue = {
  status: string[]
  facilityName?: string | null
  dateRange?: { from: string | null; to: string | null } | null
}

const statusColorMap: Record<string, string> = {
  'Chờ xử lý': "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
  'Đã duyệt': "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  'Hoàn thành': "bg-green-100 text-green-700 border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  'Không HT': "bg-red-100 text-red-700 border-red-200 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
}

export function RepairRequestsFilterChips({
  value,
  onRemove,
  onClearAll,
  showFacility,
}: {
  value: FilterChipsValue
  onRemove: (key: keyof FilterChipsValue, subkey?: string) => void
  onClearAll?: () => void
  showFacility?: boolean
}) {
  const hasAny = (value.status?.length ?? 0) > 0 || (!!value.facilityName && showFacility) || !!value.dateRange

  if (!hasAny) return null

  return (
    <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
      <span className="text-xs text-muted-foreground font-medium mr-1 uppercase tracking-wider">Đang lọc:</span>

      {value.status?.map((s) => (
        <Badge
          key={s}
          variant="outline"
          className={cn("pl-2.5 pr-1 py-1 h-7 text-sm font-normal rounded-full transition-colors", statusColorMap[s] || "bg-secondary/50 text-secondary-foreground")}
        >
          <span>{s}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-5 w-5 p-0 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
            onClick={() => onRemove("status", s)}
            aria-label={`Xóa trạng thái ${s}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      {showFacility && value.facilityName && (
        <Badge variant="outline" className="pl-2.5 pr-1 py-1 h-7 text-sm font-normal rounded-full bg-background hover:bg-accent transition-colors">
          <span className="truncate max-w-[150px]">Cơ sở: {value.facilityName}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-5 w-5 p-0 rounded-full hover:bg-muted-foreground/20"
            onClick={() => onRemove("facilityName")}
            aria-label="Xóa cơ sở"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {value.dateRange && (value.dateRange.from || value.dateRange.to) && (
        <Badge variant="outline" className="pl-2.5 pr-1 py-1 h-7 text-sm font-normal rounded-full bg-background hover:bg-accent transition-colors">
          <span>
            {value.dateRange.from ? value.dateRange.from : "..."}
            {" → "}
            {value.dateRange.to ? value.dateRange.to : "..."}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 h-5 w-5 p-0 rounded-full hover:bg-muted-foreground/20"
            onClick={() => onRemove("dateRange")}
            aria-label="Xóa khoảng ngày"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      )}

      {onClearAll && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground font-medium" onClick={onClearAll}>
          Xóa tất cả
        </Button>
      )}
    </div>
  )
}
