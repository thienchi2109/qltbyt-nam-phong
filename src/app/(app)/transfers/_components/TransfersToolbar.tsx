"use client"

import * as React from "react"
import { Filter, PlusCircle } from "lucide-react"

import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"
import { FilterChips, type FilterChipsValue } from "@/components/transfers/FilterChips"
import type { FilterModalValue } from "@/components/transfers/FilterModal"
import { TransfersViewToggle } from "@/components/transfers/TransfersViewToggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { TransferStatus } from "@/types/transfers-data-grid"
import { TRANSFER_STATUS_LABELS } from "@/types/transfers-data-grid"

import { TransfersDateFilterButton } from "./TransfersDateFilterButton"

type TransfersToolbarProps = Readonly<{
  showFacilityFilter: boolean
  isRegionalLeader: boolean
  activeFilterCount: number
  onOpenFilterModal: () => void
  onOpenAddDialog: () => void
  filterChipsValue: FilterChipsValue
  onRemoveFilter: (key: keyof FilterChipsValue, subkey?: string) => void
  onClearAllFilters: () => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  filterValue: FilterModalValue
  onFilterChange: (value: FilterModalValue) => void
  compactFilters: boolean
}>

/** Renders the Transfers tenant, search, filter, chips, and page actions toolbar. */
export function TransfersToolbar({
  showFacilityFilter,
  isRegionalLeader,
  activeFilterCount,
  onOpenFilterModal,
  onOpenAddDialog,
  filterChipsValue,
  onRemoveFilter,
  onClearAllFilters,
  searchTerm,
  onSearchTermChange,
  filterValue,
  onFilterChange,
  compactFilters,
}: TransfersToolbarProps) {
  const statusOptions = React.useMemo(
    () =>
      (Object.entries(TRANSFER_STATUS_LABELS) as [TransferStatus, string][]).map(
        ([value, label]) => ({ value, label })
      ),
    []
  )

  const setDateRangePart = React.useCallback(
    (key: "from" | "to", date: Date | null) => {
      onFilterChange({
        ...filterValue,
        dateRange: {
          from: key === "from" ? date : (filterValue.dateRange?.from ?? null),
          to: key === "to" ? date : (filterValue.dateRange?.to ?? null),
        },
      })
    },
    [filterValue, onFilterChange]
  )

  const tenantControl = React.useMemo(
    () =>
      showFacilityFilter ? (
        <TenantSelector className="w-full md:w-auto" variant="command" />
      ) : undefined,
    [showFacilityFilter]
  )

  const filterButton = React.useMemo(
    () => (
      <Button
        variant="outline"
        onClick={onOpenFilterModal}
        className="h-11 shrink-0 gap-2 rounded-lg px-4 font-medium sm:h-9"
        aria-label="Bộ lọc"
      >
        <Filter className="size-5 sm:size-4" />
        <span className="hidden sm:inline">Bộ lọc</span>
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs sm:ml-1">
            {activeFilterCount}
          </Badge>
        )}
      </Button>
    ),
    [activeFilterCount, onOpenFilterModal]
  )

  const filterControls = React.useMemo(
    () => (
      <>
        <FacetedMultiSelectFilter
          title="Trạng thái"
          options={statusOptions}
          value={filterValue.statuses}
          onChange={(statuses) =>
            onFilterChange({ ...filterValue, statuses: statuses as TransferStatus[] })
          }
          triggerVariant="command"
        />
        <TransfersDateFilterButton
          label="Từ ngày"
          value={filterValue.dateRange?.from ?? null}
          onChange={(date) => setDateRangePart("from", date)}
        />
        <TransfersDateFilterButton
          label="Đến ngày"
          value={filterValue.dateRange?.to ?? null}
          onChange={(date) => setDateRangePart("to", date)}
        />
      </>
    ),
    [filterValue, onFilterChange, setDateRangePart, statusOptions]
  )

  const actions = React.useMemo(
    () => (
      <>
        <div className="hidden sm:block">
          <TransfersViewToggle />
        </div>
        {!isRegionalLeader && (
          <Button onClick={onOpenAddDialog} className="h-11 gap-2 font-medium sm:h-9">
            <PlusCircle className="size-5 sm:size-4" />
            Tạo yêu cầu mới
          </Button>
        )}
      </>
    ),
    [isRegionalLeader, onOpenAddDialog]
  )

  const chips = React.useMemo(
    () => (
      <FilterChips
        value={filterChipsValue}
        onRemove={onRemoveFilter}
        onClearAll={onClearAllFilters}
      />
    ),
    [filterChipsValue, onClearAllFilters, onRemoveFilter]
  )

  return (
    <ListFilterSearchCard
      title="Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình"
      tenantControl={tenantControl}
      surface="plain"
      searchValue={searchTerm}
      onSearchChange={onSearchTermChange}
      searchPlaceholder="Tìm kiếm mã yêu cầu, thiết bị, lý do..."
      showSearchIcon={true}
      tenantClassName="w-full md:w-auto"
      searchClassName="md:min-w-[360px] md:max-w-none xl:min-w-[520px]"
      filterControls={filterControls}
      mobileFilterControl={filterButton}
      compactFilters={compactFilters}
      actions={actions}
      chips={chips}
    />
  )
}
