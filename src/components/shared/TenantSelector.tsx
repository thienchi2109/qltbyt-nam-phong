"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Building2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"

// Lazy load sheet - only needed on mobile/tablet (per bundle-dynamic-imports)
const TenantSelectorSheet = dynamic(
  () => import("./TenantSelectorSheet").then((m) => m.TenantSelectorSheet),
  { ssr: false }
)

/**
 * Shared tenant/facility selector component.
 * Uses the TenantSelectionContext for state management.
 * Only renders for global/admin/regional_leader users.
 *
 * Responsive behavior (CSS-only, no hydration issues):
 * - Desktop (xl+, ≥1280px): Radix Select dropdown
 * - Mobile/Tablet (<1280px): Button that opens bottom sheet
 */
export function TenantSelector({ className }: { className?: string }) {
  const {
    selectedFacilityId,
    setSelectedFacilityId,
    facilities,
    showSelector,
    isLoading,
  } = useTenantSelection()

  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Don't render if user doesn't have multi-tenant privileges
  if (!showSelector) {
    return null
  }

  // Convert selection state to string for Select component
  // undefined = not selected yet (show placeholder)
  // null = "all facilities" = "all"
  // number = specific facility = String(id)
  const selectValue =
    selectedFacilityId === undefined
      ? ""
      : selectedFacilityId === null
        ? "all"
        : String(selectedFacilityId)

  // Get current facility name for mobile button
  const currentFacilityName =
    selectedFacilityId === null
      ? "Tất cả cơ sở"
      : selectedFacilityId === undefined
        ? "Chọn cơ sở..."
        : facilities.find((f) => f.id === selectedFacilityId)?.name ??
          "Đang tải..."

  const handleValueChange = React.useCallback(
    (value: string) => {
      if (value === "all") {
        setSelectedFacilityId(null)
      } else {
        const facilityId = parseInt(value, 10)
        if (Number.isFinite(facilityId)) {
          setSelectedFacilityId(facilityId)
        }
      }
    },
    [setSelectedFacilityId]
  )

  return (
    <>
      {/* Desktop (xl+): Dropdown - hidden on mobile/tablet */}
      <Select
        value={selectValue}
        onValueChange={handleValueChange}
        disabled={isLoading}
      >
        <SelectTrigger
          aria-label="Chọn cơ sở y tế"
          className={cn(
            "hidden xl:flex w-[280px] font-normal",
            !selectValue && "text-muted-foreground",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <SelectValue placeholder="Chọn cơ sở y tế..." />
          </div>
        </SelectTrigger>
        <SelectContent>
          {/* "All Facilities" option */}
          <SelectItem value="all">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Tất cả cơ sở</span>
            </div>
          </SelectItem>

          {/* Individual facilities */}
          {facilities.map((facility) => (
            <SelectItem key={facility.id} value={String(facility.id)}>
              <span className="truncate">{facility.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Mobile/Tablet (<xl): Button trigger - hidden on desktop */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setSheetOpen(true)}
        disabled={isLoading}
        aria-label="Chọn cơ sở y tế"
        aria-haspopup="dialog"
        className={cn(
          "flex xl:hidden items-center gap-2 font-normal",
          !selectValue && "text-muted-foreground",
          className
        )}
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-[200px]">{currentFacilityName}</span>
      </Button>

      {/* Sheet - lazy loaded, only renders when needed */}
      <TenantSelectorSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}
