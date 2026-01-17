"use client"

import * as React from "react"
import { Building2, Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"

/**
 * Shared tenant/facility selector component.
 * Uses the TenantSelectionContext for state management.
 * Only renders for global/admin/regional_leader users.
 */
export function TenantSelector({ className }: { className?: string }) {
  const {
    selectedFacilityId,
    setSelectedFacilityId,
    facilities,
    showSelector,
    isLoading,
  } = useTenantSelection()

  const [open, setOpen] = React.useState(false)

  // Don't render if user doesn't have multi-tenant privileges
  if (!showSelector) {
    return null
  }

  // Find selected facility name
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId)
  const displayValue = selectedFacility?.name || "Chọn cơ sở y tế..."

  const handleSelect = React.useCallback((facilityId: number | null) => {
    setSelectedFacilityId(facilityId)
    setOpen(false)
  }, [setSelectedFacilityId])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Chọn cơ sở y tế"
          className={cn(
            "w-[280px] justify-between font-normal",
            !selectedFacilityId && "text-muted-foreground",
            className
          )}
          disabled={isLoading}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{displayValue}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Tìm cơ sở..." />
          <CommandList>
            <CommandEmpty>Không tìm thấy cơ sở</CommandEmpty>
            <CommandGroup>
              {/* "All Facilities" option - clears selection */}
              <CommandItem value="Tất cả cơ sở" onSelect={() => handleSelect(null)}>
                <Building2 className="mr-2 h-4 w-4" />
                <span>Tất cả cơ sở</span>
                {selectedFacilityId === null && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </CommandItem>

              {/* Individual facilities */}
              {facilities.map((facility) => (
                <CommandItem
                  key={facility.id}
                  value={facility.name}
                  onSelect={() => handleSelect(facility.id)}
                >
                  <span className="truncate">{facility.name}</span>
                  {selectedFacilityId === facility.id && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
