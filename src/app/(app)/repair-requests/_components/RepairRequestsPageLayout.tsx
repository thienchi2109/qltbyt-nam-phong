import * as React from "react"
import type { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, PlusCircle } from "lucide-react"
import { parseISO } from "date-fns"
import { KpiStatusBar, REPAIR_STATUS_CONFIGS } from "@/components/kpi"
import type { RepairStatus } from "@/components/kpi"
import { RepairRequestAlert } from "@/components/repair-request-alert"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import { FloatingActionButton } from "@/components/shared/FloatingActionButton"
import { RepairRequestsFilterModal, type FilterModalValue } from "./RepairRequestsFilterModal"
import { RepairRequestsCreateSheet } from "./RepairRequestsCreateSheet"
import { RepairRequestsToolbar } from "./RepairRequestsToolbar"
import { RepairRequestsTable } from "./RepairRequestsTable"
import { RepairRequestsMobileList } from "./RepairRequestsMobileList"
import { RepairRequestsMobileKpi } from "./RepairRequestsMobileKpi"
import type { RepairRequestColumnOptions } from "./RepairRequestsColumns"
import type { RepairRequestOverdueSummary, RepairRequestWithEquipment } from "../types"
import type { UiFilters as UiFiltersPrefs } from "@/lib/rr-prefs"

const REPAIR_REQUEST_ENTITY = { singular: "yêu cầu" } as const

interface RepairRequestsPageLayoutProps {
  // Header
  selectedFacilityName: string | null
  accessState: {
    isRegionalLeader: boolean
    showFacilityFilter: boolean
    shouldFetchData: boolean
  }

  // Summary
  statusCounts: Record<RepairStatus, number> | undefined
  overdueSummary: RepairRequestOverdueSummary | undefined
  summaryState: {
    statusCountsLoading: boolean
    overdueLoading: boolean
  }

  // Requests data
  requests: RepairRequestWithEquipment[]

  // Search & Filters
  searchTerm: string
  onSearchChange: (value: string) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  onClearFilters: () => void
  onFilterModalOpenChange: (open: boolean) => void
  uiFilters: UiFiltersPrefs
  onFilterChange: (v: FilterModalValue) => void
  selectedFacilityId: number | null
  facilityOptions: Array<{ id: number; name: string }>
  onRemoveFilter: (key: "status" | "facilityName" | "dateRange", sub?: string) => void
  filterState: {
    isFiltered: boolean
    isFilterModalOpen: boolean
  }

  // Table
  table: Table<RepairRequestWithEquipment>
  tableKey: string
  listState: {
    isMobile: boolean
    isCompactLayout?: boolean
    isLoading: boolean
    isFetching: boolean
  }

  // Pagination
  totalRequests: number
  repairPagination: {
    pagination: { pageIndex: number; pageSize: number }
    setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>
  }

  // Column options (for mobile renderActions)
  columnOptions: RepairRequestColumnOptions
  setRequestToView: (req: RepairRequestWithEquipment | null) => void

  // Create
  openCreateSheet: () => void
}

/**
 * Main layout for the repair-requests page — header, summary bar, card
 * with toolbar / filter modal / table / pagination / placeholder.
 * Extracted from RepairRequestsPageClient (Batch 2 Cycle 5).
 */
export function RepairRequestsPageLayout({
  selectedFacilityName,
  accessState,
  statusCounts,
  overdueSummary,
  summaryState,
  requests,
  searchTerm,
  onSearchChange,
  searchInputRef,
  onClearFilters,
  onFilterModalOpenChange,
  uiFilters,
  onFilterChange,
  selectedFacilityId,
  facilityOptions,
  onRemoveFilter,
  filterState,
  table,
  tableKey,
  listState,
  totalRequests,
  repairPagination,
  columnOptions,
  setRequestToView,
  openCreateSheet,
}: RepairRequestsPageLayoutProps) {
  const { isRegionalLeader, showFacilityFilter, shouldFetchData } = accessState
  const { statusCountsLoading, overdueLoading } = summaryState
  const { isFiltered, isFilterModalOpen } = filterState
  const { isMobile, isLoading, isFetching } = listState
  const isCompactLayout = listState.isCompactLayout ?? isMobile
  const tableRows = table.getRowModel().rows.map((row) => row.original)

  const toolbar = (
    <RepairRequestsToolbar
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      searchInputRef={searchInputRef}
      isFiltered={isFiltered}
      onClearFilters={onClearFilters}
      onOpenFilterModal={() => onFilterModalOpenChange(true)}
      compactFilters={isCompactLayout}
      uiFilters={uiFilters}
      selectedFacilityId={selectedFacilityId}
      selectedFacilityName={selectedFacilityName}
      showFacilityFilter={showFacilityFilter}
      onFilterChange={onFilterChange}
      onRemoveFilter={onRemoveFilter}
    />
  )

  const filterModal = (
    <RepairRequestsFilterModal
      open={isFilterModalOpen}
      onOpenChange={onFilterModalOpenChange}
      value={{
        status: uiFilters.status,
        facilityId: selectedFacilityId ?? null,
        dateRange: uiFilters.dateRange
          ? {
              from: uiFilters.dateRange.from ? parseISO(uiFilters.dateRange.from) : null,
              to: uiFilters.dateRange.to ? parseISO(uiFilters.dateRange.to) : null,
            }
          : { from: null, to: null },
      }}
      onChange={onFilterChange}
      showFacility={showFacilityFilter}
      facilities={facilityOptions.map((f) => ({ id: f.id, name: f.name }))}
      variant={isCompactLayout ? "sheet" : "dialog"}
    />
  )

  const pagination = shouldFetchData ? (
    <div className={isCompactLayout ? "pt-1" : "rounded-b-xl border-x border-b bg-card px-6 py-4"}>
      <DataTablePagination
        table={table}
        totalCount={totalRequests}
        entity={REPAIR_REQUEST_ENTITY}
        paginationMode={{
          mode: "controlled",
          pagination: repairPagination.pagination,
          onPaginationChange: repairPagination.setPagination,
        }}
        displayFormat="range-total"
        responsive={{ stackLayoutAt: "md", showFirstLastAt: "lg" }}
        isLoading={isLoading || isFetching}
      />
    </div>
  ) : null

  return (
    <>
      {/* Repair Request Alert */}
      <RepairRequestAlert summary={overdueSummary} isLoading={overdueLoading} />

      <div className="space-y-5 pb-28 md:space-y-6 lg:pb-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Yêu cầu sửa chữa</h1>
          </div>
          {!isRegionalLeader && isCompactLayout && !isMobile ? (
            <Button onClick={() => openCreateSheet()} className="h-11 shrink-0 rounded-lg">
              <PlusCircle className="mr-2 size-4" /> Tạo yêu cầu
            </Button>
          ) : null}
        </div>

        {/* Summary */}
        {isCompactLayout ? (
          <RepairRequestsMobileKpi counts={statusCounts} loading={statusCountsLoading} />
        ) : (
          <KpiStatusBar
            configs={REPAIR_STATUS_CONFIGS}
            counts={statusCounts}
            loading={statusCountsLoading}
          />
        )}

        {/* Create Sheet */}
        {!isRegionalLeader ? <RepairRequestsCreateSheet /> : null}

        {/* Mobile FAB for quick create */}
        {!isRegionalLeader && isMobile ? (
          <FloatingActionButton onClick={() => openCreateSheet()} aria-label="Tạo yêu cầu">
            <PlusCircle />
          </FloatingActionButton>
        ) : null}

        {isCompactLayout ? (
          <div className="space-y-4" data-testid="repair-requests-mobile-content">
            {toolbar}
            {filterModal}

            {shouldFetchData ? (
              <div data-testid="repair-mobile-list">
                <RepairRequestsMobileList
                  requests={tableRows}
                  isLoading={isLoading || isFetching}
                  setRequestToView={setRequestToView}
                  columnOptions={columnOptions}
                />
              </div>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border bg-card p-6">
                <div className="flex max-w-md flex-col items-center gap-4 text-center">
                  <Building2 className="size-12 text-muted-foreground" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Chọn cơ sở y tế</h3>
                    <p className="text-sm text-muted-foreground">
                      Vui lòng chọn một cơ sở y tế từ bộ lọc phía trên để xem danh sách yêu cầu sửa
                      chữa.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {pagination}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <Card
              className={shouldFetchData ? "overflow-hidden rounded-b-none" : "overflow-hidden"}
              data-testid="repair-requests-desktop-card"
            >
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="heading-responsive-h2">
                    Tổng hợp các yêu cầu sửa chữa thiết bị
                  </CardTitle>
                  <CardDescription className="body-responsive-sm">
                    Tất cả các yêu cầu sửa chữa đã được ghi nhận.
                  </CardDescription>
                </div>

                {!isRegionalLeader ? (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => openCreateSheet()}
                      className="hidden md:flex touch-target"
                    >
                      <PlusCircle className="mr-2 size-4" /> Tạo yêu cầu
                    </Button>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent className="p-3 md:p-6 gap-3 md:gap-4">
                {toolbar}
                {filterModal}

                {shouldFetchData ? (
                  <div key={tableKey} className="rounded-md border overflow-x-auto">
                    <div className="min-w-[1100px]">
                      <RepairRequestsTable table={table} isLoading={isLoading || isFetching} />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex max-w-md flex-col items-center gap-4 text-center">
                      <Building2 className="size-12 text-muted-foreground" />
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium">Chọn cơ sở y tế</h3>
                        <p className="text-sm text-muted-foreground">
                          Vui lòng chọn một cơ sở y tế từ bộ lọc phía trên để xem danh sách yêu cầu
                          sửa chữa.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            {pagination}
          </div>
        )}
      </div>
    </>
  )
}
