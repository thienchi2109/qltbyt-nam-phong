"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { EquipmentDepartmentDistributionItem } from "../types"
import type { DepartmentColorClasses } from "@/components/equipment/equipment-department-grouping"

interface EquipmentDepartmentSummaryProps {
  items: EquipmentDepartmentDistributionItem[]
  colorClassByLabel: Record<string, DepartmentColorClasses>
  selectedDepartments: string[]
  onSelectDepartment: (department: string) => void
}

/** Renders department distribution chips for the current equipment result set. */
export function EquipmentDepartmentSummary({
  items,
  colorClassByLabel,
  selectedDepartments,
  onSelectDepartment,
}: EquipmentDepartmentSummaryProps) {
  if (items.length === 0) return null

  return (
    <section
      aria-label="Phân bố theo khoa/phòng"
      className="rounded-md border bg-muted/20 px-3 py-2"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-foreground">Phân bố theo khoa/phòng</div>
        <div className="text-xs text-muted-foreground">
          {items.length} khoa/phòng
        </div>
      </div>
      <div className="max-h-24 overflow-y-auto pr-1">
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const isSelectable = Boolean(item.department)
            const isSelected = item.department
              ? selectedDepartments.includes(item.department)
              : false
            const colors = colorClassByLabel[item.label]
            return (
              <Button
                key={`${item.department ?? "__missing"}-${item.label}`}
                type="button"
                variant="outline"
                size="sm"
                disabled={!isSelectable}
                aria-label={`${item.label} ${item.count} thiết bị`}
                onClick={() => {
                  if (item.department) onSelectDepartment(item.department)
                }}
                className={cn(
                  "h-8 gap-2 rounded-full border px-2.5 text-xs font-medium shadow-none",
                  colors?.chipClassName,
                  isSelected && "ring-1 ring-primary/40",
                  !isSelectable && "cursor-default opacity-80"
                )}
              >
                <span className="max-w-[12rem] truncate">{item.label}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 min-w-5 justify-center rounded-full border bg-background/80 px-1.5 text-[11px]",
                    colors?.badgeClassName
                  )}
                >
                  {item.count}
                </Badge>
              </Button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
