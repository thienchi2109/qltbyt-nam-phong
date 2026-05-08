"use client"

import * as React from "react"
import type {
  ColumnDef,
  PaginationState,
  Table as ReactTable,
} from "@tanstack/react-table"
import { Filter, Loader2, PlusCircle } from "lucide-react"

import { DataTablePagination } from "@/components/shared/DataTablePagination"
import { ListFilterSearchCard } from "@/components/shared/ListFilterSearchCard"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { TransferCard } from "@/components/transfers/TransferCard"
import { FilterChips, type FilterChipsValue } from "@/components/transfers/FilterChips"
import { TransferTypeTabs } from "@/components/transfers/TransferTypeTabs"
import { TransfersKanbanView } from "@/components/transfers/TransfersKanbanView"
import { TransfersSearchParamsBoundary } from "@/components/transfers/TransfersSearchParamsBoundary"
import { TransfersTableView } from "@/components/transfers/TransfersTableView"
import { TransfersTenantSelectionPlaceholder } from "@/components/transfers/TransfersTenantSelectionPlaceholder"
import { TransfersViewToggle } from "@/components/transfers/TransfersViewToggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import type { DisplayContext } from "@/components/shared/DataTablePagination/types"
import type {
  TransferCountsResponse,
  TransferKanbanResponse,
  TransferListFilters,
  TransferListItem,
  TransferType,
} from "@/types/transfers-data-grid"

import type { TransferUserRole } from "./TransfersTypes"

export type TransfersPagePanelPermissions = Readonly<{
  showFacilityFilter: boolean
  isRegionalLeader: boolean
}>

export type TransfersPagePanelDataState = Readonly<{
  shouldFetch: boolean
  isLoading: boolean
  isFetching: boolean
}>

type TransfersPagePanelProps = Readonly<{
  activeTab: TransferType
  onTabChange: (tab: TransferType) => void
  transferCounts: TransferCountsResponse | null | undefined
  totalCount: number
  permissions: TransfersPagePanelPermissions
  activeFilterCount: number
  onOpenFilterModal: () => void
  onOpenAddDialog: () => void
  filterChipsValue: FilterChipsValue
  onRemoveFilter: (key: keyof FilterChipsValue, subkey?: string) => void
  onClearAllFilters: () => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  filterVariant: "dialog" | "sheet"
  viewMode: "table" | "kanban"
  dataState: TransfersPagePanelDataState
  tableData: TransferListItem[]
  referenceDate: Date
  onViewTransfer: (item: TransferListItem) => void
  RowActions: (props: { item: TransferListItem }) => React.ReactNode
  renderRowActions: (item: TransferListItem) => React.ReactNode
  filters: TransferListFilters
  kanbanData?: TransferKanbanResponse | null
  userRole?: TransferUserRole
  columns: ColumnDef<TransferListItem>[]
  pagination: PaginationState
  onPaginationChange: (updater: PaginationState | ((old: PaginationState) => PaginationState)) => void
  pageCount: number
  table: ReactTable<TransferListItem>
  transferEntity: { singular: string }
  transferDisplayFormat: (ctx: DisplayContext) => React.ReactNode
}>

function getTransferTypeCounts(
  activeTab: TransferType,
  transferCounts: TransferCountsResponse | null | undefined,
  totalCount: number,
) {
  const activeCount = transferCounts?.totalCount ?? totalCount

  return {
    noi_bo: activeTab === "noi_bo" ? activeCount : undefined,
    ben_ngoai: activeTab === "ben_ngoai" ? activeCount : undefined,
    thanh_ly: activeTab === "thanh_ly" ? activeCount : undefined,
  }
}

export function TransfersPagePanel({
  activeTab,
  onTabChange,
  transferCounts,
  totalCount,
  permissions,
  activeFilterCount,
  onOpenFilterModal,
  onOpenAddDialog,
  filterChipsValue,
  onRemoveFilter,
  onClearAllFilters,
  searchTerm,
  onSearchTermChange,
  filterVariant,
  viewMode,
  dataState,
  tableData,
  referenceDate,
  onViewTransfer,
  RowActions,
  renderRowActions,
  filters,
  kanbanData,
  userRole,
  columns,
  pagination,
  onPaginationChange,
  pageCount,
  table,
  transferEntity,
  transferDisplayFormat,
}: TransfersPagePanelProps) {
  const { showFacilityFilter, isRegionalLeader } = permissions
  const { shouldFetch, isLoading: isListLoading, isFetching: isListFetching } = dataState
  const transferTypeCounts = getTransferTypeCounts(activeTab, transferCounts, totalCount)
  const compactFilters = filterVariant === "sheet"

  const filterButton = (
    <Button
      variant="outline"
      onClick={onOpenFilterModal}
      className="h-11 gap-2 font-medium sm:h-9"
    >
      <Filter className="h-5 w-5 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">Bộ lọc</span>
      {activeFilterCount > 0 && (
        <Badge variant="secondary" className="h-5 px-1.5 text-xs sm:ml-1">
          {activeFilterCount}
        </Badge>
      )}
    </Button>
  )

  return (
    <Card>
      <CardContent className="space-y-4">
        <ListFilterSearchCard
          title="Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình"
          tenantControl={showFacilityFilter ? <TenantSelector /> : undefined}
          surface="plain"
          searchValue={searchTerm}
          onSearchChange={onSearchTermChange}
          searchPlaceholder="Tìm kiếm mã yêu cầu, thiết bị, lý do..."
          showSearchIcon={true}
          filterControls={filterButton}
          mobileFilterControl={filterButton}
          compactFilters={compactFilters}
          actions={(
            <>
              <div className="hidden sm:block">
                <TransfersViewToggle />
              </div>
              {!isRegionalLeader && (
                <Button onClick={onOpenAddDialog} className="h-11 gap-2 font-medium sm:h-9">
                  <PlusCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                  Tạo yêu cầu mới
                </Button>
              )}
            </>
          )}
          chips={(
            <FilterChips
              value={filterChipsValue}
              onRemove={onRemoveFilter}
              onClearAll={onClearAllFilters}
            />
          )}
        />

        <TransfersSearchParamsBoundary>
          <TransferTypeTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            counts={transferTypeCounts}
          >
            <div className="flex flex-col gap-3">
              {viewMode === "kanban" ? (
                shouldFetch ? (
                  <TransfersKanbanView
                    filters={filters}
                    onViewTransfer={onViewTransfer}
                    renderRowActions={renderRowActions}
                    statusCounts={transferCounts?.columnCounts}
                    initialData={isListFetching ? null : kanbanData}
                    userRole={userRole}
                  />
                ) : (
                  <TransfersTenantSelectionPlaceholder />
                )
              ) : shouldFetch ? (
                <>
                  <div className="space-y-3 lg:hidden">
                    {isListLoading ? (
                      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
                        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          Đang tải dữ liệu...
                        </div>
                      </div>
                    ) : tableData.length > 0 ? (
                      tableData.map((item) => (
                        <TransferCard
                          key={item.id}
                          transfer={item}
                          referenceDate={referenceDate}
                          onClick={() => onViewTransfer(item)}
                          actions={<RowActions item={item} />}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                        Không có dữ liệu phù hợp.
                      </div>
                    )}
                  </div>

                  <div className="hidden lg:block">
                    <TransfersTableView
                      data={tableData}
                      columns={columns}
                      pagination={pagination}
                      onPaginationChange={onPaginationChange}
                      pageCount={pageCount}
                      isLoading={isListLoading}
                      onRowClick={onViewTransfer}
                    />
                  </div>
                </>
              ) : (
                <TransfersTenantSelectionPlaceholder />
              )}

              {isListFetching && !isListLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang đồng bộ dữ liệu...
                </div>
              )}
            </div>
          </TransferTypeTabs>
        </TransfersSearchParamsBoundary>
      </CardContent>

      {viewMode === "table" && shouldFetch && (
        <CardFooter className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <DataTablePagination
            table={table}
            totalCount={totalCount}
            entity={transferEntity}
            paginationMode={{
              mode: "controlled",
              pagination,
              onPaginationChange,
            }}
            displayFormat={transferDisplayFormat}
            pageSizeOptions={[10, 20, 50, 100]}
            responsive={{ showFirstLastAt: "sm", stackLayoutAt: "md" }}
            isLoading={isListLoading}
          />
        </CardFooter>
      )}
    </Card>
  )
}
