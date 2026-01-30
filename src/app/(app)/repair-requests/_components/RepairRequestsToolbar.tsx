"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { FilterX } from "lucide-react"
import { SearchInput } from "@/components/shared/SearchInput"
import { RepairRequestsFilterChips, type FilterChipsValue } from "./RepairRequestsFilterChips"
import type { UiFilters as UiFiltersPrefs } from "@/lib/rr-prefs"

interface RepairRequestsToolbarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  isFiltered: boolean
  onClearFilters: () => void
  onOpenFilterModal: () => void
  // Filter chips
  uiFilters: UiFiltersPrefs
  selectedFacilityName: string | null
  showFacilityFilter: boolean
  onRemoveFilter: (key: keyof FilterChipsValue, sub?: string) => void
}

export function RepairRequestsToolbar({
  searchTerm,
  onSearchChange,
  searchInputRef,
  isFiltered,
  onClearFilters,
  onOpenFilterModal,
  uiFilters,
  selectedFacilityName,
  showFacilityFilter,
  onRemoveFilter,
}: RepairRequestsToolbarProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2 md:mb-3">
        <div className="flex flex-1 items-center gap-2">
          <SearchInput
            ref={searchInputRef}
            placeholder="Tìm thiết bị, mô tả..."
            value={searchTerm}
            onChange={onSearchChange}
            showSearchIcon={false}
            className="h-8 w-[120px] md:w-[200px] lg:w-[250px] touch-target-sm md:h-8"
          />

          <Button
            variant="outline"
            size="sm"
            className="h-8 touch-target-sm"
            onClick={onOpenFilterModal}
          >
            Bộ lọc
          </Button>

          {isFiltered && (
            <Button
              variant="ghost"
              onClick={onClearFilters}
              className="h-8 px-2 lg:px-3 touch-target-sm md:h-8"
              aria-label="Xóa bộ lọc"
            >
              <span className="hidden sm:inline">Xóa</span>
              <FilterX className="h-4 w-4 sm:ml-2" />
            </Button>
          )}
        </div>

        <div className="w-full pt-2">
          <RepairRequestsFilterChips
            value={{
              status: uiFilters.status,
              facilityName: selectedFacilityName,
              dateRange: uiFilters.dateRange
                ? { from: uiFilters.dateRange.from ?? null, to: uiFilters.dateRange.to ?? null }
                : null,
            }}
            showFacility={showFacilityFilter}
            onRemove={onRemoveFilter}
          />
        </div>
      </div>
    </>
  )
}
