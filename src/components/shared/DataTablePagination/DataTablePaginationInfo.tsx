"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import type { DisplayContext, DisplayFormat } from "./types"

export interface DataTablePaginationInfoProps {
  displayContext: DisplayContext
  displayFormat?: DisplayFormat | ((ctx: DisplayContext) => React.ReactNode)
  showFilteredIndicator?: boolean
  isFiltered?: boolean
  className?: string
}

function renderDisplay(format: DisplayFormat, ctx: DisplayContext) {
  const entityLabel = ctx.entity.plural ?? ctx.entity.singular
  const currentCount = ctx.totalCount > 0 ? Math.max(0, ctx.endItem - ctx.startItem + 1) : 0

  switch (format) {
    case "range-total":
      return `Hiển thị ${ctx.startItem}-${ctx.endItem} trên tổng ${ctx.totalCount} ${entityLabel}`
    case "selection-count":
      return `Đã chọn ${ctx.selectedCount ?? 0} trên ${ctx.totalCount} ${entityLabel}`
    case "compact":
      return `${currentCount} / ${ctx.totalCount} ${entityLabel}`
    case "count-total":
    default:
      return `Hiển thị ${currentCount} trên ${ctx.totalCount} ${entityLabel}`
  }
}

export const DataTablePaginationInfo = React.memo(function DataTablePaginationInfo({
  displayContext,
  displayFormat = "count-total",
  showFilteredIndicator,
  isFiltered,
  className,
}: DataTablePaginationInfoProps) {
  const content =
    typeof displayFormat === "function"
      ? displayFormat(displayContext)
      : renderDisplay(displayFormat, displayContext)

  return (
    <div
      className={cn(
        "text-sm text-muted-foreground text-center sm:text-left",
        className
      )}
    >
      {content}
      {showFilteredIndicator && isFiltered ? " (đã lọc)" : null}
    </div>
  )
})
