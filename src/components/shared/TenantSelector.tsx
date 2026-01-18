"use client"

import * as React from "react"
import { Building2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"

/**
 * Shared tenant/facility selector component.
 * Uses the TenantSelectionContext for state management.
 * Only renders for global/admin/regional_leader users.
 *
 * Uses Radix Select instead of cmdk Command for reliable selection behavior.
 */
export function TenantSelector({ className }: { className?: string }) {
  const {
    selectedFacilityId,
    setSelectedFacilityId,
    facilities,
    showSelector,
    isLoading,
  } = useTenantSelection()

  // Don't render if user doesn't have multi-tenant privileges
  if (!showSelector) {
    return null
  }

  // Convert selection state to string for Select component
  // undefined = not selected yet (show placeholder)
  // null = "all facilities" = "all"
  // number = specific facility = String(id)
  const selectValue = selectedFacilityId === undefined
    ? ""
    : selectedFacilityId === null
      ? "all"
      : String(selectedFacilityId)

  const handleValueChange = React.useCallback((value: string) => {
    if (value === "all") {
      setSelectedFacilityId(null)
    } else {
      const facilityId = parseInt(value, 10)
      if (Number.isFinite(facilityId)) {
        setSelectedFacilityId(facilityId)
      }
    }
  }, [setSelectedFacilityId])

  return (
    <Select
      value={selectValue}
      onValueChange={handleValueChange}
      disabled={isLoading}
    >
      <SelectTrigger
        aria-label="Chọn cơ sở y tế"
        className={cn(
          "w-[280px] font-normal",
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
  )
}
