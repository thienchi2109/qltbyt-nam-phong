"use client"

import * as React from "react"

import { KpiStatusBar, TRANSFER_STATUS_CONFIGS } from "@/components/kpi"
import { OverdueTransfersAlert } from "@/components/overdue-transfers-alert"
import type { DisplayContext } from "@/components/shared/DataTablePagination/types"

import { TransfersDialogs } from "./TransfersDialogs"
import { TransfersPagePanel } from "./TransfersPagePanel"
import {
  useTransfersPageController,
  type TransfersPageUser,
} from "./useTransfersPageController"

const TRANSFER_ENTITY = { singular: "yêu cầu" } as const

function transferDisplayFormat(ctx: DisplayContext) {
  const entityLabel = ctx.entity.plural ?? ctx.entity.singular
  const currentCount =
    ctx.totalCount > 0 ? Math.max(0, ctx.endItem - ctx.startItem + 1) : 0

  return (
    <>
      <div className="block sm:hidden">
        <div className="space-y-1">
          <div>
            <strong>{currentCount}</strong> / <strong>{ctx.totalCount}</strong>{" "}
            {entityLabel}
          </div>
          <div>
            Trang <strong>{ctx.currentPage}</strong> /{" "}
            <strong>{ctx.totalPages}</strong>
          </div>
        </div>
      </div>
      <div className="hidden sm:block">
        Hiển thị <strong>{currentCount}</strong> trên{" "}
        <strong>{ctx.totalCount}</strong> {entityLabel}.
      </div>
    </>
  )
}

type TransfersPageContentProps = Readonly<{
  user: TransfersPageUser
}>

export function TransfersPageContent({ user }: TransfersPageContentProps) {
  const controller = useTransfersPageController(user)

  return (
    <>
      <TransfersDialogs
        isAddDialogOpen={controller.isAddDialogOpen}
        onAddDialogOpenChange={controller.setIsAddDialogOpen}
        onAddSuccess={controller.invalidateTransferQueries}
        isEditDialogOpen={controller.rowActions.isEditDialogOpen}
        onEditDialogOpenChange={controller.rowActions.setIsEditDialogOpen}
        onEditSuccess={controller.invalidateTransferQueries}
        editingTransfer={controller.rowActions.editingTransfer}
        detailDialogOpen={controller.rowActions.isDetailDialogOpen}
        onDetailDialogOpenChange={controller.rowActions.setIsDetailDialogOpen}
        detailTransfer={controller.rowActions.detailTransfer}
        handoverDialogOpen={controller.rowActions.isHandoverDialogOpen}
        onHandoverDialogOpenChange={controller.rowActions.setIsHandoverDialogOpen}
        handoverTransfer={controller.rowActions.handoverTransfer}
        returnLocationDialogOpen={controller.rowActions.isReturnLocationDialogOpen}
        onReturnLocationDialogOpenChange={controller.rowActions.setIsReturnLocationDialogOpen}
        returnTransfer={controller.rowActions.returnTransfer}
        isReturning={controller.isReturning}
        onConfirmReturn={controller.rowActions.handleConfirmReturn}
        deleteDialogOpen={controller.rowActions.isDeleteDialogOpen}
        onDeleteDialogOpenChange={controller.rowActions.setIsDeleteDialogOpen}
        onConfirmDelete={controller.rowActions.handleConfirmDelete}
        isFilterModalOpen={controller.filtersState.isFilterModalOpen}
        onFilterModalOpenChange={controller.filtersState.setIsFilterModalOpen}
        filterValue={controller.filterModalValue}
        onFilterChange={controller.setFilterModalValue}
        filterVariant={controller.filterVariant}
      />

      <OverdueTransfersAlert
        overdueSummary={controller.overdueSummary}
        isLoading={controller.isListLoading || controller.isListFetching}
        onViewTransfer={controller.openTransferFromAlert}
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold md:text-2xl">Luân chuyển thiết bị</h1>
        </div>

        <KpiStatusBar
          configs={TRANSFER_STATUS_CONFIGS}
          counts={controller.transferCounts?.columnCounts}
          loading={controller.isCountsLoading}
          error={controller.isCountsError}
        />

        <TransfersPagePanel
          activeTab={controller.activeTab}
          onTabChange={controller.setActiveTab}
          transferCounts={controller.transferCounts}
          totalCount={controller.totalCount}
          permissions={{
            showFacilityFilter: controller.showFacilityFilter,
            isRegionalLeader: controller.isRegionalLeader,
          }}
          activeFilterCount={controller.filtersState.activeFilterCount}
          onOpenFilterModal={() => controller.filtersState.setIsFilterModalOpen(true)}
          onOpenAddDialog={() => controller.setIsAddDialogOpen(true)}
          filterChipsValue={controller.filterChipsValue}
          onRemoveFilter={controller.filtersState.handleRemoveFilter}
          onClearAllFilters={controller.filtersState.handleClearAllFilters}
          searchTerm={controller.filtersState.searchTerm}
          onSearchTermChange={controller.filtersState.setSearchTerm}
          filterValue={controller.filterModalValue}
          onFilterChange={controller.setFilterModalValue}
          filterVariant={controller.filterVariant}
          viewMode={controller.viewMode}
          dataState={{
            shouldFetch: controller.shouldFetchData,
            isLoading: controller.isListLoading,
            isFetching: controller.isListFetching,
          }}
          tableData={controller.tableData}
          referenceDate={controller.referenceDate}
          onViewTransfer={controller.rowActions.handleViewDetail}
          RowActions={controller.rowActions.RowActions}
          renderRowActions={controller.rowActions.renderRowActions}
          filters={controller.filters}
          kanbanData={controller.kanbanData}
          userRole={controller.userRole}
          columns={controller.columns}
          pagination={controller.transferPagination.pagination}
          onPaginationChange={controller.transferPagination.setPagination}
          pageCount={controller.transferPagination.pageCount}
          table={controller.table}
          transferEntity={TRANSFER_ENTITY}
          transferDisplayFormat={transferDisplayFormat}
        />
      </div>
    </>
  )
}
