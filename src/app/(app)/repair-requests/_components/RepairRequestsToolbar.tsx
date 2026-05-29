"use client"

import * as React from "react"
import { parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, FilterX } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"
import { cn } from "@/lib/utils"
import { RepairRequestsFilterChips, type FilterChipsValue } from "./RepairRequestsFilterChips"
import { REPAIR_REQUEST_STATUS_OPTIONS, type FilterModalValue } from "./RepairRequestsFilterModal"
import type { UiFilters as UiFiltersPrefs } from "@/lib/rr-prefs"

interface RepairRequestsToolbarProps {
  tenantControl?: React.ReactNode
  searchTerm: string
  onSearchChange: (value: string) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  isFiltered: boolean
  onClearFilters: () => void
  onOpenFilterModal: () => void
  compactFilters?: boolean
  // Filter chips
  uiFilters: UiFiltersPrefs
  selectedFacilityId: number | null
  selectedFacilityName: string | null
  showFacilityFilter: boolean
  onFilterChange: (v: FilterModalValue) => void
  onRemoveFilter: (key: keyof FilterChipsValue, sub?: string) => void
}

const parseFilterDate = (value: string | null | undefined) => {
  if (!value) return null
  const date = parseISO(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Renders the repair request search, filter, and chip toolbar. */
export function RepairRequestsToolbar({
  tenantControl,
  searchTerm,
  onSearchChange,
  searchInputRef,
  isFiltered,
  onClearFilters,
  onOpenFilterModal,
  compactFilters = false,
  uiFilters,
  selectedFacilityId,
  selectedFacilityName,
  showFacilityFilter,
  onFilterChange,
  onRemoveFilter,
}: RepairRequestsToolbarProps) {
  const dateRange = React.useMemo(
    () => uiFilters.dateRange && (uiFilters.dateRange.from || uiFilters.dateRange.to)
      ? {
        from: parseFilterDate(uiFilters.dateRange.from),
        to: parseFilterDate(uiFilters.dateRange.to),
      }
      : null,
    [uiFilters.dateRange]
  )

  const filterValue = React.useMemo<FilterModalValue>(() => ({
    status: uiFilters.status,
    facilityId: selectedFacilityId ?? null,
    dateRange,
  }), [dateRange, selectedFacilityId, uiFilters.status])

  const applyFilterChange = React.useCallback((patch: Partial<FilterModalValue>) => {
    onFilterChange({
      status: patch.status ?? filterValue.status,
      facilityId: patch.facilityId === undefined ? filterValue.facilityId ?? null : patch.facilityId,
      dateRange: patch.dateRange === undefined ? filterValue.dateRange ?? null : patch.dateRange,
    })
  }, [filterValue, onFilterChange])

  const setDateRangePart = React.useCallback((key: "from" | "to", date: Date | null) => {
    applyFilterChange({
      dateRange: {
        from: key === "from" ? date : filterValue.dateRange?.from ?? null,
        to: key === "to" ? date : filterValue.dateRange?.to ?? null,
      },
    })
  }, [applyFilterChange, filterValue.dateRange])

  const statusOptions = React.useMemo(() => REPAIR_REQUEST_STATUS_OPTIONS.map((status) => ({
    label: status,
    value: status,
  })), [])

  const filterControls = React.useMemo(() => (
    <>
      <FacetedMultiSelectFilter
        title="Trạng thái"
        options={statusOptions}
        value={filterValue.status}
        onChange={(values) => applyFilterChange({ status: values })}
      />
      <DateFilterButton
        label="Từ ngày"
        value={filterValue.dateRange?.from ?? null}
        onChange={(date) => setDateRangePart("from", date)}
      />
      <DateFilterButton
        label="Đến ngày"
        value={filterValue.dateRange?.to ?? null}
        onChange={(date) => setDateRangePart("to", date)}
      />
    </>
  ), [applyFilterChange, filterValue.dateRange, filterValue.status, setDateRangePart, statusOptions])

  const mobileFilterControl = React.useMemo(() => (
    <Button
      variant="outline"
      size="sm"
      className="h-9 touch-target-sm"
      onClick={onOpenFilterModal}
    >
      Bộ lọc
    </Button>
  ), [onOpenFilterModal])

  const clearAction = React.useMemo(() => isFiltered ? (
    <Button
      variant="ghost"
      onClick={onClearFilters}
      className="h-9 px-2 lg:px-3 touch-target-sm"
      aria-label="Xóa bộ lọc"
    >
      <span className="hidden sm:inline">Xóa</span>
      <FilterX className="size-4 sm:ml-2" />
    </Button>
  ) : null, [isFiltered, onClearFilters])

  const chips = React.useMemo(() => (
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
  ), [onRemoveFilter, selectedFacilityName, showFacilityFilter, uiFilters.dateRange, uiFilters.status])

  const resolvedTenantControl = React.useMemo(() => {
    if (tenantControl !== undefined) {
      return tenantControl
    }

    return showFacilityFilter ? <TenantSelector className="w-full" /> : null
  }, [showFacilityFilter, tenantControl])

  return (
    <ListFilterSearchCard
      surface="plain"
      tenantControl={resolvedTenantControl}
      searchInputRef={searchInputRef}
      searchValue={searchTerm}
      onSearchChange={onSearchChange}
      searchPlaceholder="Tìm thiết bị, mô tả..."
      showSearchIcon={false}
      searchClassName="md:min-w-[220px] md:max-w-[320px] xl:min-w-[260px]"
      filterControls={filterControls}
      mobileFilterControl={mobileFilterControl}
      compactFilters={compactFilters}
      actions={clearAction}
      chips={chips}
    />
  )
}

interface DateFilterButtonProps {
  readonly label: string
  readonly value: Date | null
  readonly onChange: (date: Date | null) => void
}

function DateFilterButton({ label, value, onChange }: DateFilterButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-9 min-w-[116px] justify-start", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="mr-2 size-4" />
          {value ? value.toLocaleDateString("vi-VN") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[1100]" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(date) => onChange(date ?? null)}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
