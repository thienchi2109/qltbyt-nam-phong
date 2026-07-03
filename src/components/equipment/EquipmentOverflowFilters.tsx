/**
 * EquipmentOverflowFilters.tsx
 *
 * Inline overflow filter controls for secondary equipment filters.
 */

"use client"

import * as React from "react"
import type { Table } from "@tanstack/react-table"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Equipment } from "@/types/database"
import {
  EQUIPMENT_OVERFLOW_FILTERS,
  type EquipmentOverflowFilterId,
  toStringArray,
  toggleSelection,
} from "./EquipmentOverflowFiltersUtils"

type EquipmentOverflowFiltersProps = {
  table: Table<Equipment>
  users: string[]
  fundingSources: string[]
}

/** Renders secondary equipment filters as inline controls inside a single popover. */
export function EquipmentOverflowFilters({
  table,
  users,
  fundingSources,
}: EquipmentOverflowFiltersProps) {
  const optionsByFilterId: Record<EquipmentOverflowFilterId, string[]> = {
    nguoi_dang_truc_tiep_quan_ly: users,
    nguon_kinh_phi: fundingSources,
  }

  return (
    <div className="space-y-3">
      {EQUIPMENT_OVERFLOW_FILTERS.map(({ id, title, Icon }) => {
        const column = table.getColumn(id)
        const selectedValues = toStringArray(column?.getFilterValue())
        const options = optionsByFilterId[id]

        return (
          <section key={id} aria-label={title} className="space-y-1.5">
            <div className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-900">
              <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{title}</span>
              {selectedValues.length > 0 ? (
                <Badge
                  variant="secondary"
                  className="h-5 min-w-[20px] rounded-full bg-primary px-1.5 text-xs font-semibold text-white"
                >
                  {selectedValues.length}
                </Badge>
              ) : null}
            </div>
            <div className="space-y-1">
              {options.length > 0 ? (
                options.map((option) => {
                  const isSelected = selectedValues.includes(option)
                  return (
                    <button
                      key={option}
                      type="button"
                      role="checkbox"
                      aria-label={`${title} ${option}`}
                      aria-checked={isSelected}
                      onClick={() => {
                        const nextValues = toggleSelection(selectedValues, option)
                        column?.setFilterValue(nextValues.length ? nextValues : undefined)
                      }}
                      className={cn(
                        "flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
                        "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected ? "bg-primary/10 text-slate-950" : "text-slate-600"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          isSelected
                            ? "border-primary bg-primary text-white"
                            : "border-slate-300 bg-white"
                        )}
                      >
                        {isSelected ? <Check className="size-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option}</span>
                    </button>
                  )
                })
              ) : (
                <p className="px-2 py-1 text-sm text-muted-foreground">Chưa có lựa chọn</p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
