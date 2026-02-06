"use client"

import * as React from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export interface DataTablePaginationSizeSelectorProps {
  pageSize: number
  pageSizeOptions: number[]
  onPageSizeChange: (size: number) => void
  showAt?: "sm" | "md" | "lg" | null
  disabled?: boolean
  className?: string
}

export const DataTablePaginationSizeSelector = React.memo(function DataTablePaginationSizeSelector({
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  showAt = null,
  disabled,
  className,
}: DataTablePaginationSizeSelectorProps) {
  if (!pageSizeOptions.length) {
    return null
  }

  const showAtClass = showAt ? `hidden ${showAt}:flex` : ""

  return (
    <div className={cn("flex items-center space-x-2", showAtClass, className)}>
      <p className="text-sm font-medium">Số dòng</p>
      <Select
        value={`${pageSize}`}
        onValueChange={(value) => {
          onPageSizeChange(Number(value))
        }}
        disabled={disabled}
        aria-label="Chọn số dòng mỗi trang"
      >
        <SelectTrigger className="h-8 w-20">
          <SelectValue placeholder={pageSize} />
        </SelectTrigger>
        <SelectContent side="top">
          {pageSizeOptions.map((size) => (
            <SelectItem key={size} value={`${size}`}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
})
