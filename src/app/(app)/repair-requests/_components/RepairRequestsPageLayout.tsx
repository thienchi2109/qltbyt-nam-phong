import * as React from "react"
import type { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Building2, PlusCircle } from "lucide-react"
import { parseISO } from "date-fns"
import { KpiStatusBar, REPAIR_STATUS_CONFIGS } from "@/components/kpi"
import type { RepairStatus } from "@/components/kpi"
import { RepairRequestAlert } from "@/components/repair-request-alert"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import { FloatingActionButton } from "@/components/shared/FloatingActionButton"
import { RepairRequestsFilterModal, type FilterModalValue } from "./RepairRequestsFilterModal"
import { RepairRequestsCreateSheet } from "./RepairRequestsCreateSheet"
import { RepairRequestsToolbar } from "./RepairRequestsToolbar"
import { RepairRequestsTable } from "./RepairRequestsTable"
import { RepairRequestsMobileList } from "./RepairRequestsMobileList"
import { renderActions, type RepairRequestColumnOptions } from "./RepairRequestsColumns"
import type {
  RepairRequestOverdueSummary,
  RepairRequestWithEquipment,
} from "../types"
import type {
  UiFilters as UiFiltersPrefs,
} from "@/lib/rr-prefs"

const REPAIR_REQUEST_ENTITY = { singular: "yêu cầu" } as const

interface RepairRequestsPageLayoutProps {
  // Header
  selectedFacilityName: string | null
  isRegionalLeader: boolean

  // Summary
  statusCounts: Record<RepairStatus, number> | undefined
  statusCountsLoading: boolean
  overdueSummary: RepairRequestOverdueSummary | undefined
  overdueLoading: boolean

  // Requests data
  requests: RepairRequestWithEquipment[]

  // Search & Filters
  searchTerm: string
  onSearchChange: (value: string) => void
  searchInputRef: React.RefObject<HTMLInputElement>
  isFiltered: boolean
  onClearFilters: () => void
  isFilterModalOpen: boolean
  onFilterModalOpenChange: (open: boolean) => void
  uiFilters: UiFiltersPrefs
  onFilterChange: (v: FilterModalValue) => void
  selectedFacilityId: number | null
  showFacilityFilter: boolean
  facilityOptions: Array<{ id: number; name: string }>
  onRemoveFilter: (key: "status" | "facilityName" | "dateRange", sub?: string) => void

  // Table
  table: Table<RepairRequestWithEquipment>
  tableKey: string
  isMobile: boolean
  shouldFetchData: boolean
  isLoading: boolean
  isFetching: boolean

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
  isRegionalLeader,
  statusCounts,
  statusCountsLoading,
  overdueSummary,
  overdueLoading,
  requests,
  searchTerm,
  onSearchChange,
  searchInputRef,
  isFiltered,
  onClearFilters,
  isFilterModalOpen,
  onFilterModalOpenChange,
  uiFilters,
  onFilterChange,
  selectedFacilityId,
  showFacilityFilter,
  facilityOptions,
  onRemoveFilter,
  table,
  tableKey,
  isMobile,
  shouldFetchData,
  isLoading,
  isFetching,
  totalRequests,
  repairPagination,
  columnOptions,
  setRequestToView,
  openCreateSheet,
}: RepairRequestsPageLayoutProps) {
  return (
    <>
      {/* Repair Request Alert */}
      <RepairRequestAlert summary={overdueSummary} isLoading={overdueLoading} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">Yêu cầu sửa chữa</h1>
            {selectedFacilityName ? (
              <p className="text-sm text-muted-foreground">{selectedFacilityName}</p>
            ) : null}
          </div>
        </div>

        {/* Summary */}
        <KpiStatusBar
          configs={REPAIR_STATUS_CONFIGS}
          counts={statusCounts}
          loading={statusCountsLoading}
        />

        {/* Create Sheet */}
        {!isRegionalLeader ? <RepairRequestsCreateSheet /> : null}

        {/* Mobile FAB for quick create */}
        {!isRegionalLeader && isMobile ? (
          <FloatingActionButton
            onClick={() => openCreateSheet()}
            aria-label="Tạo yêu cầu"
          >
            <PlusCircle />
          </FloatingActionButton>
        ) : null}

        {/* Content area */}
        <div className="grid grid-cols-1 gap-4">
          <div className="w-full">
            <Card className="overflow-hidden">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="heading-responsive-h2">Tổng hợp các yêu cầu sửa chữa thiết bị</CardTitle>
                  <CardDescription className="body-responsive-sm">
                    Tất cả các yêu cầu sửa chữa đã được ghi nhận.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  {/* Tenant selector from shared context */}
                  {showFacilityFilter ? (
                    <TenantSelector />
                  ) : null}

                  {/* Create button — inside container */}
                  {!isRegionalLeader ? (
                    <Button onClick={() => openCreateSheet()} className="hidden md:flex touch-target">
                      <PlusCircle className="mr-2 h-4 w-4" /> Tạo yêu cầu
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-6 gap-3 md:gap-4">
                <RepairRequestsToolbar
                  searchTerm={searchTerm}
                  onSearchChange={onSearchChange}
                  searchInputRef={searchInputRef}
                  isFiltered={isFiltered as boolean}
                  onClearFilters={onClearFilters}
                  onOpenFilterModal={() => onFilterModalOpenChange(true)}
                  uiFilters={uiFilters}
                  selectedFacilityName={selectedFacilityName}
                  showFacilityFilter={showFacilityFilter}
                  onRemoveFilter={onRemoveFilter}
                />

                {/* Filter Modal */}
                <RepairRequestsFilterModal
                  open={isFilterModalOpen}
                  onOpenChange={onFilterModalOpenChange}
                  value={{
                    status: uiFilters.status,
                    facilityId: selectedFacilityId ?? null,
                    dateRange: uiFilters.dateRange ? {
                      from: uiFilters.dateRange.from ? parseISO(uiFilters.dateRange.from) : null,
                      to: uiFilters.dateRange.to ? parseISO(uiFilters.dateRange.to) : null,
                    } : { from: null, to: null },
                  }}
                  onChange={onFilterChange}
                  showFacility={showFacilityFilter}
                  facilities={facilityOptions.map(f => ({ id: f.id, name: f.name }))}
                  variant={isMobile ? 'sheet' : 'dialog'}
                />

                {shouldFetchData ? (
                  <>
                    {/* Mobile Card View */}
                    {isMobile ? (
                      <RepairRequestsMobileList
                        requests={table.getRowModel().rows.map((row) => row.original)}
                        isLoading={isLoading || isFetching}
                        setRequestToView={setRequestToView}
                        renderActions={(req: RepairRequestWithEquipment) => renderActions(req, columnOptions)}
                      />
                    ) : (
                      /* Desktop Table View */
                      <div key={tableKey} className="rounded-md border overflow-x-auto">
                        <div className="min-w-[1100px]">
                          <RepairRequestsTable
                            table={table}
                            isLoading={isLoading || isFetching}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center min-h-[400px]">
                    <div className="flex max-w-md flex-col items-center gap-4 text-center">
                      <Building2 className="h-12 w-12 text-muted-foreground" />
                      <div className="space-y-2">
                        <h3 className="text-lg font-medium">Chọn cơ sở y tế</h3>
                        <p className="text-sm text-muted-foreground">
                          Vui lòng chọn một cơ sở y tế từ bộ lọc phía trên để xem danh sách yêu cầu sửa chữa.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              {shouldFetchData ? (
                <CardFooter className="py-4">
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
                </CardFooter>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
