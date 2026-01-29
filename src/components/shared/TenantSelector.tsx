"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Building2, Check, ChevronsUpDown } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
 * - Desktop (xl+, ≥1280px): Searchable combobox (Popover + Command)
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
  const [open, setOpen] = React.useState(false)

  // Hooks must be called before early return
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

  // Memoize facility name lookup to avoid .find() on every render
  const currentFacilityName = React.useMemo(() => {
    if (selectedFacilityId === null) return "Tất cả cơ sở"
    if (selectedFacilityId === undefined) return "Chọn cơ sở..."
    return facilities.find((f) => f.id === selectedFacilityId)?.name ?? "Đang tải..."
  }, [selectedFacilityId, facilities])

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

  return (
    <>
      {/* Desktop (xl+): Searchable combobox - hidden on mobile/tablet */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Chọn cơ sở y tế"
            disabled={isLoading}
            className={cn(
              "hidden xl:flex w-[280px] justify-between font-normal",
              !selectValue && "text-muted-foreground",
              className
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{currentFacilityName}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          {/* Key resets search input when popover reopens */}
          <Command key={open ? "open" : "closed"}>
            <CommandInput placeholder="Tìm kiếm cơ sở..." />
            <CommandList>
              {isLoading ? (
                <div className="p-2 space-y-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <CommandEmpty>Không tìm thấy cơ sở phù hợp.</CommandEmpty>
                  <CommandGroup>
                    {/* "All facilities" option */}
                    <CommandItem
                      value="all"
                      keywords={["tất cả", "all"]}
                      onSelect={() => {
                        handleValueChange("all")
                        setOpen(false)
                      }}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      <span>Tất cả cơ sở</span>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          selectedFacilityId === null ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>

                    {/* Individual facilities */}
                    {facilities.map((facility) => (
                      <CommandItem
                        key={facility.id}
                        value={String(facility.id)}
                        keywords={[facility.name]}
                        onSelect={(value) => {
                          handleValueChange(value)
                          setOpen(false)
                        }}
                      >
                        <span className="truncate">{facility.name}</span>
                        <Check
                          className={cn(
                            "ml-auto h-4 w-4",
                            selectedFacilityId === facility.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
