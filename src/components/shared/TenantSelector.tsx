"use client"

import * as React from "react"
import { Building2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { TenantSelectorSheet } from "./TenantSelectorSheet"

/**
 * Shared tenant/facility selector component.
 * Uses the TenantSelectionContext for state management.
 * Only renders for global/admin/regional_leader users.
 *
 * Opens a bottom sheet with search functionality on all viewports.
 */
export interface TenantSelectorProps {
  className?: string
  /** Hide the "All facilities" option - useful for pages that require a specific facility */
  hideAllOption?: boolean
}

export function TenantSelector({ className, hideAllOption = false }: TenantSelectorProps) {
  const {
    selectedFacilityId,
    facilities,
    showSelector,
    isLoading,
  } = useTenantSelection()

  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Get current facility name for button display
  // Must be before early return to satisfy Rules of Hooks
  const currentFacilityName =
    selectedFacilityId === null
      ? "Tất cả cơ sở"
      : selectedFacilityId === undefined
        ? "Chọn cơ sở..."
        : facilities.find((f) => f.id === selectedFacilityId)?.name ?? "Đang tải..."

  // Don't render if user doesn't have multi-tenant privileges
  if (!showSelector) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setSheetOpen(true)}
        disabled={isLoading}
        aria-label="Chọn cơ sở y tế"
        aria-haspopup="dialog"
        className={cn(
          "flex items-center gap-2 font-normal",
          selectedFacilityId === undefined && "text-muted-foreground",
          className
        )}
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-[200px]">{currentFacilityName}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </Button>

      <TenantSelectorSheet open={sheetOpen} onOpenChange={setSheetOpen} hideAllOption={hideAllOption} />
    </>
  )
}
