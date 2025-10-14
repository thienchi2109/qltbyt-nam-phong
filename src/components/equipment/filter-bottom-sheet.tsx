"use client"

import * as React from "react"
import { X, Check } from "lucide-react"
import type { ColumnFiltersState } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type FilterOption = { id: string; label: string; count: number }

export type EquipmentFilterData = {
  status: FilterOption[]
  department: FilterOption[]
  location: FilterOption[]
  user: FilterOption[]
  classification: FilterOption[]
}

interface FilterBottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: EquipmentFilterData
  columnFilters: ColumnFiltersState
  onApply: (next: ColumnFiltersState) => void
  onClearAll: () => void
}

export function FilterBottomSheet({
  open,
  onOpenChange,
  data,
  columnFilters,
  onApply,
  onClearAll,
}: FilterBottomSheetProps) {
  // Local state for filter selections
  const [localFilters, setLocalFilters] = React.useState<Record<string, string[]>>({})
  
  // Refs for focus management
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  // Initialize local filters from columnFilters when sheet opens
  React.useEffect(() => {
    if (open) {
      const initial: Record<string, string[]> = {}
      columnFilters.forEach((filter) => {
        if (Array.isArray(filter.value)) {
          initial[filter.id] = filter.value as string[]
        }
      })
      setLocalFilters(initial)
    }
  }, [open, columnFilters])

  // Focus management: move focus into dialog when opened, restore on close
  React.useEffect(() => {
    if (open) {
      // Store current focus to restore later
      previousActiveElement.current = document.activeElement as HTMLElement
      
      // Focus the dialog after render
      setTimeout(() => {
        if (dialogRef.current) {
          const firstFocusable = dialogRef.current.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          if (firstFocusable) {
            firstFocusable.focus()
          } else {
            dialogRef.current.focus()
          }
        }
      }, 100)
    } else {
      // Restore focus when dialog closes
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
        previousActiveElement.current = null
      }
    }
  }, [open])

  const toggleFilter = (category: string, value: string) => {
    setLocalFilters((prev) => {
      const current = prev[category] || []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [category]: next }
    })
  }

  const isSelected = (category: string, value: string) => {
    return (localFilters[category] || []).includes(value)
  }

  const activeCount = React.useMemo(() => {
    return Object.values(localFilters).reduce((sum, arr) => sum + arr.length, 0)
  }, [localFilters])

  const handleApply = () => {
    const next: ColumnFiltersState = Object.entries(localFilters)
      .filter(([_, values]) => values.length > 0)
      .map(([id, value]) => ({ id, value }))
    onApply(next)
    onOpenChange(false)
  }

  const handleClearAll = () => {
    onClearAll()
    onOpenChange(false)
  }

  const handleBackdropClick = () => {
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onOpenChange(false)
      return
    }

    // Focus trap: keep Tab navigation inside the dialog
    if (e.key === "Tab" && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const focusableArray = Array.from(focusableElements)
      const firstFocusable = focusableArray[0]
      const lastFocusable = focusableArray[focusableArray.length - 1]

      if (e.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable?.focus()
        }
      }
    }
  }

  if (!open) return null

  const filterSections = [
    { key: "tinh_trang_hien_tai", label: "Trạng thái", options: data.status },
    { key: "khoa_phong_quan_ly", label: "Khoa/Phòng", options: data.department },
    { key: "vi_tri_lap_dat", label: "Vị trí", options: data.location },
    { key: "nguoi_dang_truc_tiep_quan_ly", label: "Người dùng", options: data.user },
    { key: "phan_loai_theo_nd98", label: "Phân loại", options: data.classification },
  ]

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-sheet-title"
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div className="relative w-full bg-background rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 id="filter-sheet-title" className="text-lg font-bold text-foreground">
            Bộ lọc thiết bị
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-10 w-10 rounded-full"
            aria-label="Đóng bộ lọc"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 space-y-6" style={{ 
          maxHeight: 'calc(100vh - 20rem)',
          WebkitOverflowScrolling: 'touch'
        }}>
          {filterSections.map((section) =>
            section.options.length > 0 ? (
              <div key={section.key}>
                <h3 className="text-sm font-bold text-foreground mb-3">
                  {section.label}
                </h3>
                <div className="space-y-2">
                  {section.options.map((option) => {
                    const selected = isSelected(section.key, option.id)
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleFilter(section.key, option.id)}
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
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                              selected
                                ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))]"
                                : "border-muted-foreground/40"
                            )}
                          >
                            {selected && (
                              <Check className="h-3.5 w-3.5 text-[hsl(var(--primary-foreground))]" strokeWidth={3} />
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
                        <Badge
                          variant="secondary"
                          className="text-xs font-semibold shrink-0"
                        >
                          {option.count}
                        </Badge>
                      </button>
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
            <Button
              variant="outline"
              onClick={handleClearAll}
              className="h-12 text-sm font-semibold rounded-xl"
            >
              Xóa tất cả
            </Button>
            <Button
              onClick={handleApply}
              className="h-12 text-sm font-semibold rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
            >
              Áp dụng {activeCount > 0 && `(${activeCount})`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
