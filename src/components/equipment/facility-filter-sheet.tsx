/**
 * facility-filter-sheet.tsx
 *
 * Bottom sheet for regional leaders to filter equipment by facility.
 * Includes search, facility list with equipment counts, and apply/clear/cancel buttons.
 */

"use client"

import * as React from "react"
import { Building2, Check, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { FacilityOption } from "@/types/tenant"

export interface FacilityFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  facilities: FacilityOption[]
  isLoading: boolean
  selectedFacilityId: number | null | undefined
  pendingFacilityId: number | null
  onPendingChange: (facilityId: number | null) => void
  onApply: () => void
  onClear: () => void
  onCancel: () => void
  totalEquipmentCount: number
}

export function FacilityFilterSheet({
  open,
  onOpenChange,
  facilities,
  isLoading,
  selectedFacilityId,
  pendingFacilityId,
  onPendingChange,
  onApply,
  onClear,
  onCancel,
  totalEquipmentCount,
}: FacilityFilterSheetProps) {
  const [searchTerm, setSearchTerm] = React.useState("")

  // Clear search when sheet closes
  React.useEffect(() => {
    if (!open) {
      setSearchTerm("")
    }
  }, [open])

  const filteredFacilities = React.useMemo(() => {
    if (!searchTerm.trim()) return facilities
    const query = searchTerm.trim().toLowerCase()
    return facilities.filter((facility) => facility.name.toLowerCase().includes(query))
  }, [searchTerm, facilities])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="flex h-[70vh] flex-col rounded-t-3xl border-border/60 bg-background px-6 pb-6 pt-4">
        <SheetHeader>
          <SheetTitle>Chọn cơ sở quản lý</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Lọc danh sách thiết bị theo cơ sở thuộc địa bàn của bạn.
          </p>
        </SheetHeader>
        <div className="mt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm kiếm cơ sở..."
              className="h-11 rounded-xl border-border/70 pl-9 pr-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-2">
          <button
            type="button"
            onClick={() => onPendingChange(null)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition",
              pendingFacilityId === null ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:border-primary/60 hover:bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">Tất cả cơ sở</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {facilities.length} cơ sở • {totalEquipmentCount} TB
            </span>
          </button>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredFacilities.length > 0 ? (
            filteredFacilities.map((facility) => {
              const isSelected = pendingFacilityId === facility.id
              return (
                <button
                  key={facility.id}
                  type="button"
                  onClick={() => onPendingChange(facility.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition",
                    isSelected ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:border-primary/60 hover:bg-primary/5"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="truncate">{facility.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary" />}
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

        <SheetFooter className="mt-4 flex-col sm:flex-col">
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full"
            >
              Hủy
            </Button>
            <Button
              variant="ghost"
              className="w-full border border-border/60"
              onClick={onClear}
              disabled={pendingFacilityId === null && selectedFacilityId === null}
            >
              Xóa
            </Button>
            <SheetClose asChild>
              <Button onClick={onApply} className="w-full">
                Áp dụng
              </Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
