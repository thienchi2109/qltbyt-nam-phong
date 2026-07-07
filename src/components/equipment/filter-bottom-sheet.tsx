"use client"

import * as React from "react"
import { X, Check } from "lucide-react"
import type { ColumnFiltersState } from "@tanstack/react-table"
import { Badge as HeroBadge } from "@heroui/react/badge"
import { Button as HeroButton } from "@heroui/react/button"

import { cn } from "@/lib/utils"
import { MobileBottomSheet } from "@/components/shared/mobile-bottom-sheet"

type FilterOption = { id: string; label: string; count: number }

export type EquipmentFilterData = {
  status: FilterOption[]
  department: FilterOption[]
  location: FilterOption[]
  user: FilterOption[]
  classification: FilterOption[]
  fundingSource: FilterOption[]
}

interface FilterBottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: EquipmentFilterData
  columnFilters: ColumnFiltersState
  onDraftFiltersChange?: (next: ColumnFiltersState) => void
  onApply: (next: ColumnFiltersState) => void
  onClearAll: () => void
}

function getLocalFilters(columnFilters: ColumnFiltersState): Record<string, string[]> {
  const initial: Record<string, string[]> = {}
  columnFilters.forEach((filter) => {
    if (Array.isArray(filter.value)) {
      initial[filter.id] = filter.value as string[]
    }
  })
  return initial
}

function toColumnFilters(localFilters: Record<string, string[]>): ColumnFiltersState {
  const next: ColumnFiltersState = []
  for (const [id, value] of Object.entries(localFilters)) {
    if (value.length > 0) {
      next.push({ id, value })
    }
  }
  return next
}

/** Renders the mobile equipment filter sheet with an apply-only local draft. */
export function FilterBottomSheet({
  open,
  onOpenChange,
  data,
  columnFilters,
  onDraftFiltersChange,
  onApply,
  onClearAll,
}: FilterBottomSheetProps) {
  const [localFilters, setLocalFilters] = React.useState<Record<string, string[]>>(() =>
    open ? getLocalFilters(columnFilters) : {}
  )
  const wasOpenRef = React.useRef(open)

  if (wasOpenRef.current !== open) {
    wasOpenRef.current = open
    if (open) {
      setLocalFilters(getLocalFilters(columnFilters))
    } else {
      setLocalFilters({})
    }
  }

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setLocalFilters({})
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const toggleFilter = (category: string, value: string) => {
    setLocalFilters((prev) => {
      const current = prev[category] || []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      const nextFilters = { ...prev, [category]: next }
      onDraftFiltersChange?.(toColumnFilters(nextFilters))
      return nextFilters
    })
  }

  const isSelected = (category: string, value: string) => {
    return (localFilters[category] || []).includes(value)
  }

  const activeCount = React.useMemo(() => {
    return Object.values(localFilters).reduce((sum, arr) => sum + arr.length, 0)
  }, [localFilters])

  const handleApply = () => {
    onApply(toColumnFilters(localFilters))
    handleOpenChange(false)
  }

  const handleClearAll = () => {
    onClearAll()
    handleOpenChange(false)
  }

  const filterSections = [
    { key: "tinh_trang_hien_tai", label: "Trạng thái", options: data.status },
    { key: "khoa_phong_quan_ly", label: "Khoa/Phòng", options: data.department },
    { key: "vi_tri_lap_dat", label: "Vị trí", options: data.location },
    { key: "nguoi_dang_truc_tiep_quan_ly", label: "Người dùng", options: data.user },
    { key: "phan_loai_theo_nd98", label: "Phân loại", options: data.classification },
    { key: "nguon_kinh_phi", label: "Nguồn kinh phí", options: data.fundingSource },
  ]

  return (
    <MobileBottomSheet open={open} onOpenChange={handleOpenChange} ariaLabel="Bộ lọc thiết bị">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Bộ lọc thiết bị</h2>
        <HeroButton
          variant="ghost"
          size="sm"
          isIconOnly
          onPress={() => handleOpenChange(false)}
          className="size-10 rounded-full"
          aria-label="Đóng bộ lọc"
        >
          <X className="size-5" />
        </HeroButton>
      </div>

      {/* Scrollable Content */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-6"
        style={{
          maxHeight: "calc(100vh - 20rem)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {filterSections.map((section) =>
          section.options.length > 0 ? (
            <div key={section.key}>
              <h3 className="text-sm font-semibold text-foreground mb-3">{section.label}</h3>
              <div className="space-y-2">
                {section.options.map((option) => {
                  const selected = isSelected(section.key, option.id)
                  return (
                    <HeroButton
                      key={option.id}
                      type="button"
                      variant="outline"
                      onPress={() => toggleFilter(section.key, option.id)}
                      aria-pressed={selected}
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all touch-target-sm",
                        selected
                          ? "bg-[hsl(var(--primary))]/12 border-[hsl(var(--primary))]"
                          : "bg-background border-border hover:border-[hsl(var(--primary))]/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "size-5 rounded-md border-2 flex items-center justify-center transition-all",
                            selected
                              ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))]"
                              : "border-muted-foreground/40"
                          )}
                        >
                          {selected && (
                            <Check
                              className="size-3.5 text-[hsl(var(--primary-foreground))]"
                              strokeWidth={3}
                            />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            selected ? "text-[hsl(var(--primary))]" : "text-foreground"
                          )}
                        >
                          {option.label}
                        </span>
                      </div>
                      <HeroBadge
                        variant="secondary"
                        size="sm"
                        className="text-xs font-semibold shrink-0"
                      >
                        {option.count}
                      </HeroBadge>
                    </HeroButton>
                  )
                })}
              </div>
            </div>
          ) : null
        )}
      </div>

      {/* Footer - Extra padding to clear bottom navigation */}
      <div className="shrink-0 px-6 pt-4 pb-24 border-t border-border bg-muted/30">
        <div className="grid grid-cols-2 gap-3">
          <HeroButton
            variant="outline"
            onPress={handleClearAll}
            className="h-12 text-sm font-semibold rounded-xl"
          >
            Xóa tất cả
          </HeroButton>
          <HeroButton
            onPress={handleApply}
            className="h-12 text-sm font-semibold rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
          >
            Áp dụng {activeCount > 0 && `(${activeCount})`}
          </HeroButton>
        </div>
      </div>
    </MobileBottomSheet>
  )
}
