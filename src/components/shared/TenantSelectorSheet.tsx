/**
 * TenantSelectorSheet.tsx
 *
 * Shared bottom sheet for selecting tenant/facility on mobile/tablet.
 * Uses TenantSelectionContext for state - no prop drilling.
 * Auto-applies selection on tap (simpler UX than Apply/Cancel pattern).
 */

"use client"

import * as React from "react"
import { Building2, Check, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"

export interface TenantSelectorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TenantSelectorSheet({
  open,
  onOpenChange,
}: TenantSelectorSheetProps) {
  const {
    selectedFacilityId,
    setSelectedFacilityId,
    facilities,
    isLoading,
  } = useTenantSelection()

  const [searchTerm, setSearchTerm] = React.useState("")

  // Clear search when sheet closes
  React.useEffect(() => {
    if (!open) {
      setSearchTerm("")
    }
  }, [open])

  // Memoize filtered facilities (per rerender-memo)
  const filteredFacilities = React.useMemo(() => {
    if (!searchTerm.trim()) return facilities
    const query = searchTerm.trim().toLowerCase()
    return facilities.filter((facility) =>
      facility.name.toLowerCase().includes(query)
    )
  }, [searchTerm, facilities])

  // Calculate total equipment count
  const totalEquipmentCount = React.useMemo(() => {
    return facilities.reduce((sum, f) => sum + (f.count ?? 0), 0)
  }, [facilities])

  // Auto-apply on selection (simpler UX)
  const handleSelect = React.useCallback(
    (facilityId: number | null) => {
      setSelectedFacilityId(facilityId)
      onOpenChange(false)
    },
    [setSelectedFacilityId, onOpenChange]
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[70vh] max-h-[70vh] flex-col rounded-t-3xl border-border/60 bg-background px-6 pb-6 pt-4"
      >
        <SheetHeader>
          <SheetTitle>Chọn cơ sở y tế</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Chọn cơ sở để lọc dữ liệu theo đơn vị quản lý.
          </p>
        </SheetHeader>

        {/* Search input */}
        <div className="mt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm kiếm cơ sở..."
              className="h-11 rounded-xl border-border/70 pl-9 pr-9"
            />
            {/* Use explicit ternary for conditional (per rendering-conditional-render) */}
            {searchTerm.length > 0 ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Facility list */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2">
          {/* "All facilities" option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition",
              selectedFacilityId === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 hover:border-primary/60 hover:bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">Tất cả cơ sở</span>
              {selectedFacilityId === null ? (
                <Check className="h-4 w-4 text-primary" />
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {facilities.length} cơ sở • {totalEquipmentCount} TB
            </span>
          </button>

          {/* Facility list with loading/empty states */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredFacilities.length > 0 ? (
            filteredFacilities.map((facility) => {
              const isSelected = selectedFacilityId === facility.id
              return (
                <button
                  key={facility.id}
                  type="button"
                  onClick={() => handleSelect(facility.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 hover:border-primary/60 hover:bg-primary/5"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="truncate">{facility.name}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {facility.count ?? 0} TB
                  </span>
                </button>
              )
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
              Không tìm thấy cơ sở phù hợp.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
