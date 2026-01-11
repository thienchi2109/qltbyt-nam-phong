"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FilterX } from "lucide-react"
import { RepairRequestsFilterChips, type FilterChipsValue } from "./RepairRequestsFilterChips"
import type { ViewDensity, TextWrap as TextWrapPref } from "@/lib/rr-prefs"
import type { UiFilters as UiFiltersPrefs } from "@/lib/rr-prefs"

interface RepairRequestsToolbarProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  isFiltered: boolean
  onClearFilters: () => void
  onOpenFilterModal: () => void
  // Display settings
  density: ViewDensity
  setDensity: (d: ViewDensity) => void
  textWrap: TextWrapPref
  setTextWrap: (t: TextWrapPref) => void
  onColumnPreset: (preset: "compact" | "standard" | "full") => void
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
  density,
  setDensity,
  textWrap,
  setTextWrap,
  onColumnPreset,
  uiFilters,
  selectedFacilityName,
  showFacilityFilter,
  onRemoveFilter,
}: RepairRequestsToolbarProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2 md:mb-3">
        <div className="flex flex-1 items-center gap-2">
          <Input
            ref={searchInputRef}
            placeholder="Tìm thiết bị, mô tả..."
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 touch-target-sm">
                Hiển thị
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Preset cột</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onColumnPreset("compact")}>
                Compact
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onColumnPreset("standard")}>
                Standard
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onColumnPreset("full")}>
                Full
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Mật độ</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setDensity("compact")}>
                {density === "compact" ? "✓ " : ""}Compact
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDensity("standard")}>
                {density === "standard" ? "✓ " : ""}Standard
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDensity("spacious")}>
                {density === "spacious" ? "✓ " : ""}Spacious
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Văn bản</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setTextWrap("truncate")}>
                {textWrap === "truncate" ? "✓ " : ""}Thu gọn
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTextWrap("wrap")}>
                {textWrap === "wrap" ? "✓ " : ""}Xuống dòng
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
