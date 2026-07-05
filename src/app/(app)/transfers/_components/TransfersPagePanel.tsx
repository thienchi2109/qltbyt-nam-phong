"use client"

import * as React from "react"
import type { ColumnDef, PaginationState, Table as ReactTable } from "@tanstack/react-table"
import { Loader2 } from "lucide-react"

import { DataTablePagination } from "@/components/shared/DataTablePagination"
import { TransferCard } from "@/components/transfers/TransferCard"
import type { FilterChipsValue } from "@/components/transfers/FilterChips"
import type { FilterModalValue } from "@/components/transfers/FilterModal"
import { TransferTypeTabs } from "@/components/transfers/TransferTypeTabs"
import { TransfersKanbanView } from "@/components/transfers/TransfersKanbanView"
import { TransfersSearchParamsBoundary } from "@/components/transfers/TransfersSearchParamsBoundary"
import { TransfersTableView } from "@/components/transfers/TransfersTableView"
import { TransfersTenantSelectionPlaceholder } from "@/components/transfers/TransfersTenantSelectionPlaceholder"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import type { DisplayContext } from "@/components/shared/DataTablePagination/types"
import type {
  TransferCountsResponse,
  TransferKanbanResponse,
  TransferListFilters,
  TransferListItem,
  TransferType,
} from "@/types/transfers-data-grid"

import { TransfersToolbar } from "./TransfersToolbar"
import type { TransferUserRole } from "./TransfersTypes"

type TransfersPagePanelPermissions = Readonly<{
  showFacilityFilter: boolean
  isRegionalLeader: boolean
}>

type TransfersPagePanelDataState = Readonly<{
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
  filterValue: FilterModalValue
  onFilterChange: (value: FilterModalValue) => void
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
  onPaginationChange: (
    updater: PaginationState | ((old: PaginationState) => PaginationState)
  ) => void
  pageCount: number
  table: ReactTable<TransferListItem>
  transferEntity: { singular: string }
  transferDisplayFormat: (ctx: DisplayContext) => React.ReactNode
}>

function getTransferTypeCounts(
  activeTab: TransferType,
  transferCounts: TransferCountsResponse | null | undefined,
  totalCount: number
) {
  const activeCount = transferCounts?.totalCount ?? totalCount

  return {
    noi_bo: activeTab === "noi_bo" ? activeCount : undefined,
    ben_ngoai: activeTab === "ben_ngoai" ? activeCount : undefined,
    thanh_ly: activeTab === "thanh_ly" ? activeCount : undefined,
  }
}

/** Renders the Transfers page shell around toolbar, tabs, list, kanban, and pagination. */
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
  filterValue,
  onFilterChange,
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

  const toolbar = (
    <TransfersToolbar
      showFacilityFilter={showFacilityFilter}
      isRegionalLeader={isRegionalLeader}
      activeFilterCount={activeFilterCount}
      onOpenFilterModal={onOpenFilterModal}
      onOpenAddDialog={onOpenAddDialog}
      filterChipsValue={filterChipsValue}
      onRemoveFilter={onRemoveFilter}
      onClearAllFilters={onClearAllFilters}
      searchTerm={searchTerm}
      onSearchTermChange={onSearchTermChange}
      filterValue={filterValue}
      onFilterChange={onFilterChange}
      compactFilters={compactFilters}
    />
  )

  const content = (
    <TransfersSearchParamsBoundary>
      <TransferTypeTabs activeTab={activeTab} onTabChange={onTabChange} counts={transferTypeCounts}>
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
              <div className="space-y-3 pb-2 lg:hidden">
                {isListLoading ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
                    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-6 animate-spin" />
                      Đang tải dữ liệu…
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
              <Loader2 className="size-4 animate-spin" /> Đang đồng bộ dữ liệu…
            </div>
          )}
        </div>
      </TransferTypeTabs>
    </TransfersSearchParamsBoundary>
  )

  const paginationFooter =
    viewMode === "table" && shouldFetch ? (
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
    ) : null

  if (compactFilters) {
    return (
      <div className="space-y-4" data-testid="transfers-page-compact-content">
        {toolbar}

        <Card data-testid="transfers-page-card">
          <CardContent className="px-4 pb-5 sm:px-6 sm:pb-6">{content}</CardContent>
          {paginationFooter}
        </Card>
      </div>
    )
  }

  return (
    <Card data-testid="transfers-page-card">
      <CardContent className="space-y-4 px-4 pb-5 sm:px-6 sm:pb-6">
        {toolbar}
        {content}
      </CardContent>

      {paginationFooter}
    </Card>
  )
}
