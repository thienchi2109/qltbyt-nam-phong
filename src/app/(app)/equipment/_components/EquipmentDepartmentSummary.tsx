"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import type { EquipmentDepartmentDistributionItem } from "@/app/(app)/equipment/types"

interface EquipmentDepartmentSummaryProps {
  items: EquipmentDepartmentDistributionItem[]
  selectedDepartments: string[]
  onSelectDepartment: (department: string) => void
}

const INLINE_DEPARTMENT_LIMIT = 4

/** Renders department distribution chips for the current equipment result set. */
export function EquipmentDepartmentSummary({
  items,
  selectedDepartments,
  onSelectDepartment,
}: EquipmentDepartmentSummaryProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  if (items.length === 0) return null

  const inlineItems = items.slice(0, INLINE_DEPARTMENT_LIMIT)
  const hiddenCount = Math.max(0, items.length - inlineItems.length)
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const visiblePopoverItems = normalizedSearch
    ? items.filter((item) => item.label.toLowerCase().includes(normalizedSearch))
    : items

  const renderDepartmentButton = (
    item: EquipmentDepartmentDistributionItem,
    variant: "inline" | "popover"
  ) => {
    const isSelectable = Boolean(item.department)
    const isSelected = item.department
      ? selectedDepartments.includes(item.department)
      : false

    return (
      <Button
        key={`${variant}-${item.department ?? "__missing"}-${item.label}`}
        type="button"
        variant="outline"
        size="sm"
        disabled={!isSelectable}
        aria-label={`${item.label} ${item.count} thiết bị`}
        onClick={() => {
          if (item.department) onSelectDepartment(item.department)
        }}
        className={cn(
          "h-8 min-w-0 gap-2 rounded-full border-slate-200 bg-background px-2.5 text-xs font-medium text-slate-700 shadow-none hover:border-slate-300 hover:bg-slate-50",
          variant === "popover" && "w-full justify-between rounded-md px-3",
          isSelected && "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
          !isSelectable && "cursor-default opacity-75"
        )}
      >
        <span className="truncate">{item.label}</span>
        <Badge
          variant="outline"
          className={cn(
            "h-5 min-w-5 justify-center rounded-full border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-700",
            isSelected && "border-primary/30 bg-primary/10 text-primary"
          )}
        >
          {item.count}
        </Badge>
      </Button>
    )
  }

  return (
    <section
      aria-label="Phân bố theo khoa/phòng"
      className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-background px-3 py-2"
    >
      <div className="mr-1 text-xs font-medium text-slate-600">Khoa/phòng</div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {inlineItems.map((item) => renderDepartmentButton(item, "inline"))}
        {hiddenCount > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                aria-label={`Xem thêm ${hiddenCount} khoa/phòng`}
              >
                +{hiddenCount} khoa/phòng
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[min(380px,calc(100vw-2rem))] p-0"
            >
              <div className="border-b px-3 py-2">
                <div className="text-sm font-medium">Tất cả khoa/phòng</div>
                <div className="text-xs text-muted-foreground">
                  {items.length} khoa/phòng trong kết quả hiện tại
                </div>
              </div>
              <div className="border-b p-2">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    aria-label="Tìm khoa/phòng"
                    placeholder="Tìm khoa/phòng"
                    className="h-9 pl-9"
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {visiblePopoverItems.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Không có khoa/phòng phù hợp
                  </div>
                ) : (
                  <div className="space-y-1">
                    {visiblePopoverItems.map((item) => renderDepartmentButton(item, "popover"))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
        <div className="ml-auto text-xs text-muted-foreground">
          {items.length} khoa/phòng
        </div>
      </div>
    </section>
  )
}
