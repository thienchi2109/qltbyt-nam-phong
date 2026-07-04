"use client"

import * as React from "react"
import { Building2, ChevronDown, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
  variant?: "default" | "command"
}

/** Renders a shared tenant/facility selector with default or command-token presentation. */
export function TenantSelector({
  className,
  hideAllOption = false,
  variant = "default",
}: TenantSelectorProps) {
  const { selectedFacilityId, setSelectedFacilityId, facilities, showSelector, isLoading } =
    useTenantSelection()

  const [sheetOpen, setSheetOpen] = React.useState(false)

  // Get current facility name for button display
  // Must be before early return to satisfy Rules of Hooks
  // When hideAllOption is true, treat null selection as "not selected" to avoid UX confusion
  const effectiveSelectionId =
    hideAllOption && selectedFacilityId === null ? undefined : selectedFacilityId
  const currentFacilityName =
    effectiveSelectionId === null
      ? "Tất cả cơ sở"
      : effectiveSelectionId === undefined
        ? "Chọn cơ sở..."
        : (facilities.find((f) => f.id === effectiveSelectionId)?.name ?? "Đang tải...")

  // Don't render if user doesn't have multi-tenant privileges
  if (!showSelector) {
    return null
  }

  const isCommandVariant = variant === "command"
  const hasActiveSelection = effectiveSelectionId !== null && effectiveSelectionId !== undefined
  const canClearFacility = !hideAllOption && hasActiveSelection
  const commandTitle = currentFacilityName

  if (isCommandVariant) {
    return (
      <>
        <div
          className={cn(
            "inline-flex h-9 min-w-[132px] overflow-hidden rounded-lg border border-slate-200 bg-muted/80 shadow-none transition-all hover:border-primary/30 hover:bg-muted",
            canClearFacility && "border-primary/50 bg-primary/10 hover:bg-primary/15",
            className
          )}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSheetOpen(true)}
            disabled={isLoading}
            aria-label={`Cơ sở: ${commandTitle}`}
            aria-haspopup="dialog"
            data-trigger-variant="command"
            title={commandTitle}
            className={cn(
              "h-full min-w-0 flex-1 justify-start rounded-none px-3 font-normal hover:bg-transparent",
              effectiveSelectionId === undefined && "text-muted-foreground"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate font-medium text-foreground">Cơ sở</span>
              {canClearFacility ? (
                <Badge
                  variant="secondary"
                  className="h-5 min-w-[20px] rounded-full bg-primary px-1.5 text-xs font-semibold text-white"
                >
                  1
                </Badge>
              ) : null}
            </span>
          </Button>
          {canClearFacility ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Xóa lọc cơ sở"
              onClick={() => setSelectedFacilityId(null)}
              className="h-full w-8 rounded-none border-l border-slate-200 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <TenantSelectorSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          hideAllOption={hideAllOption}
        />
      </>
    )
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
          "justify-start",
          effectiveSelectionId === undefined && "text-muted-foreground",
          className
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Building2 className="size-4 shrink-0" aria-hidden="true" />
          <span className="max-w-[200px] truncate">{currentFacilityName}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      </Button>

      <TenantSelectorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        hideAllOption={hideAllOption}
      />
    </>
  )
}
