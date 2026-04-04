"use client"

import * as React from "react"
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  SortingState,
  Table as ReactTable,
} from "@tanstack/react-table"
import { Filter, Loader2, PlusCircle } from "lucide-react"

import { DataTablePagination } from "@/components/shared/DataTablePagination"
import { SearchInput } from "@/components/shared/SearchInput"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { TransferCard } from "@/components/transfers/TransferCard"
import { FilterChips, type FilterChipsValue } from "@/components/transfers/FilterChips"
import { TransferTypeTabs } from "@/components/transfers/TransferTypeTabs"
import { TransfersKanbanView } from "@/components/transfers/TransfersKanbanView"
import { TransfersTableView } from "@/components/transfers/TransfersTableView"
import { TransfersTenantSelectionPlaceholder } from "@/components/transfers/TransfersTenantSelectionPlaceholder"
import { TransfersViewToggle } from "@/components/transfers/TransfersViewToggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { DisplayContext } from "@/components/shared/DataTablePagination/types"
import type {
  TransferCountsResponse,
  TransferListFilters,
  TransferListItem,
  TransferType,
} from "@/types/transfers-data-grid"

type TransferUserRole = "global" | "regional_leader" | "to_qltb" | "technician" | "user"

interface TransfersPagePanelProps {
  activeTab: TransferType
  onTabChange: (tab: TransferType) => void
  transferCounts: TransferCountsResponse | undefined
  totalCount: number
  showFacilityFilter: boolean
  activeFilterCount: number
  onOpenFilterModal: () => void
  onOpenAddDialog: () => void
  isRegionalLeader: boolean
  filterChipsValue: FilterChipsValue
  onRemoveFilter: (key: keyof FilterChipsValue, subkey?: string) => void
  onClearAllFilters: () => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  onClearSearch: () => void
  viewMode: "table" | "kanban"
  shouldFetchData: boolean
  isListLoading: boolean
  isListFetching: boolean
  tableData: TransferListItem[]
  referenceDate: Date
  onViewTransfer: (item: TransferListItem) => void
  RowActions: (props: { item: TransferListItem }) => React.ReactNode
  renderRowActions: (item: TransferListItem) => React.ReactNode
  filters: TransferListFilters
  userRole?: TransferUserRole
  columns: ColumnDef<TransferListItem>[]
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  pageCount: number
  table: ReactTable<TransferListItem>
  transferEntity: { singular: string }
  transferDisplayFormat: (ctx: DisplayContext) => React.ReactNode
}

function getTransferTypeCounts(
  activeTab: TransferType,
  transferCounts: TransferCountsResponse | undefined,
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
  showFacilityFilter,
  activeFilterCount,
  onOpenFilterModal,
  onOpenAddDialog,
  isRegionalLeader,
  filterChipsValue,
  onRemoveFilter,
  onClearAllFilters,
  searchTerm,
  onSearchTermChange,
  onClearSearch,
  viewMode,
  shouldFetchData,
  isListLoading,
  isListFetching,
  tableData,
  referenceDate,
  onViewTransfer,
  RowActions,
  renderRowActions,
  filters,
  userRole,
  columns,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  pageCount,
  table,
  transferEntity,
  transferDisplayFormat,
}: TransfersPagePanelProps) {
  const transferTypeCounts = getTransferTypeCounts(activeTab, transferCounts, totalCount)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình</CardTitle>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:gap-2">
          <div className="hidden sm:block">
            <TransfersViewToggle />
          </div>

          {showFacilityFilter && <TenantSelector />}

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

          {!isRegionalLeader && (
            <Button
              onClick={onOpenAddDialog}
              className="col-span-2 h-11 gap-2 font-medium sm:col-span-1 sm:h-9"
            >
              <PlusCircle className="h-5 w-5 sm:h-4 sm:w-4" />
              Tạo yêu cầu mới
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <TransferTypeTabs
          activeTab={activeTab}
          onTabChange={onTabChange}
          counts={transferTypeCounts}
        >
          <div className="flex flex-col gap-3">
            <FilterChips
              value={filterChipsValue}
              onRemove={onRemoveFilter}
              onClearAll={onClearAllFilters}
            />

            <SearchInput
              placeholder="Tìm kiếm mã yêu cầu, thiết bị, lý do..."
              value={searchTerm}
              onChange={onSearchTermChange}
              onClear={onClearSearch}
              showSearchIcon={true}
              className="w-full max-w-sm"
            />

            {viewMode === "kanban" ? (
              shouldFetchData ? (
                <TransfersKanbanView
                  filters={filters}
                  onViewTransfer={onViewTransfer}
                  renderRowActions={renderRowActions}
                  statusCounts={transferCounts?.columnCounts}
                  userRole={userRole}
                />
              ) : (
                <TransfersTenantSelectionPlaceholder />
              )
            ) : shouldFetchData ? (
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
                    sorting={sorting}
                    onSortingChange={onSortingChange}
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
      </CardContent>

      {viewMode === "table" && (
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
