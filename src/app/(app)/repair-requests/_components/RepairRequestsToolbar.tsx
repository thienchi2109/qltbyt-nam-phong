"use client"

import * as React from "react"
import { parseISO } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, FilterX } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { SearchInput } from "@/components/shared/SearchInput"
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
  searchInputRef: React.RefObject<HTMLInputElement | null>
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
    () =>
      uiFilters.dateRange && (uiFilters.dateRange.from || uiFilters.dateRange.to)
        ? {
            from: parseFilterDate(uiFilters.dateRange.from),
            to: parseFilterDate(uiFilters.dateRange.to),
          }
        : null,
    [uiFilters.dateRange]
  )

  const filterValue = React.useMemo<FilterModalValue>(
    () => ({
      status: uiFilters.status,
      facilityId: selectedFacilityId ?? null,
      dateRange,
    }),
    [dateRange, selectedFacilityId, uiFilters.status]
  )

  const applyFilterChange = React.useCallback(
    (patch: Partial<FilterModalValue>) => {
      onFilterChange({
        status: patch.status ?? filterValue.status,
        facilityId:
          patch.facilityId === undefined ? (filterValue.facilityId ?? null) : patch.facilityId,
        dateRange:
          patch.dateRange === undefined ? (filterValue.dateRange ?? null) : patch.dateRange,
      })
    },
    [filterValue, onFilterChange]
  )

  const setDateRangePart = React.useCallback(
    (key: "from" | "to", date: Date | null) => {
      applyFilterChange({
        dateRange: {
          from: key === "from" ? date : (filterValue.dateRange?.from ?? null),
          to: key === "to" ? date : (filterValue.dateRange?.to ?? null),
        },
      })
    },
    [applyFilterChange, filterValue.dateRange]
  )

  const statusOptions = React.useMemo(
    () =>
      REPAIR_REQUEST_STATUS_OPTIONS.map((status) => ({
        label: status,
        value: status,
      })),
    []
  )

  const clearAction = React.useMemo(
    () =>
      isFiltered ? (
        <Button
          variant="ghost"
          onClick={onClearFilters}
          className="h-9 px-2 lg:px-3 touch-target-sm"
          aria-label="Xóa bộ lọc"
        >
          <span className="hidden sm:inline">Xóa</span>
          <FilterX className="size-4 sm:ml-2" />
        </Button>
      ) : null,
    [isFiltered, onClearFilters]
  )

  const mobileFilterControl = React.useMemo(
    () => (
      <Button
        variant="outline"
        size="sm"
        className="h-12 shrink-0 rounded-lg px-4 font-medium touch-target"
        onClick={onOpenFilterModal}
      >
        Bộ lọc
      </Button>
    ),
    [onOpenFilterModal]
  )

  const chips = React.useMemo(
    () => (
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
    ),
    [
      onRemoveFilter,
      selectedFacilityName,
      showFacilityFilter,
      uiFilters.dateRange,
      uiFilters.status,
    ]
  )

  const resolvedTenantControl = React.useMemo(() => {
    if (tenantControl !== undefined) {
      return tenantControl
    }

    return showFacilityFilter ? (
      <TenantSelector className="w-full md:w-auto" variant="command" />
    ) : null
  }, [showFacilityFilter, tenantControl])

  if (compactFilters) {
    return (
      <div className="space-y-3" data-testid="repair-toolbar-compact">
        {resolvedTenantControl ? (
          <div className="w-full" data-testid="repair-toolbar-compact-tenant">
            {resolvedTenantControl}
          </div>
        ) : null}

        <div
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
          data-testid="repair-toolbar-compact-row"
        >
          <SearchInput
            ref={searchInputRef}
            placeholder="Tìm thiết bị, mô tả..."
            value={searchTerm}
            onChange={onSearchChange}
            showSearchIcon
            className="h-12 rounded-lg bg-muted/70"
            aria-label="Tìm thiết bị, mô tả..."
          />
          {mobileFilterControl}
        </div>

        <div data-testid="repair-toolbar-filter-chips">{chips}</div>
      </div>
    )
  }

  const filterControls = (
    <>
      <FacetedMultiSelectFilter
        title="Trạng thái"
        options={statusOptions}
        value={filterValue.status}
        onChange={(values) => applyFilterChange({ status: values })}
        triggerVariant="command"
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
      {clearAction}
    </>
  )

  return (
    <ListFilterSearchCard
      surface="plain"
      tenantControl={resolvedTenantControl}
      searchInputRef={searchInputRef}
      searchValue={searchTerm}
      onSearchChange={onSearchChange}
      searchPlaceholder="Tìm thiết bị, mô tả..."
      showSearchIcon={false}
      tenantClassName="w-full md:w-auto"
      searchClassName="md:min-w-[360px] md:max-w-none xl:min-w-[520px]"
      filterControls={filterControls}
      mobileFilterControl={mobileFilterControl}
      compactFilters={compactFilters}
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
          data-trigger-variant="command"
          className={cn(
            "h-9 min-w-[116px] justify-start rounded-lg border-slate-200 bg-muted/80 px-3 shadow-none transition-all hover:border-primary/30 hover:bg-muted",
            value ? "border-primary/50 bg-primary/10 hover:bg-primary/15" : "text-muted-foreground"
          )}
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
