"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { FilterBottomSheet } from "@/components/equipment/filter-bottom-sheet"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import type { DisplayContext } from "@/components/shared/DataTablePagination/types"
import { EquipmentToolbar } from "@/components/equipment/equipment-toolbar"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { applyAttentionStatusPresetFilters } from "@/lib/equipment-attention-preset"

import { useEquipmentPage } from "../use-equipment-page"
import { EquipmentContent } from "../equipment-content"
import { EquipmentDialogs } from "../equipment-dialogs"
import { EquipmentDialogProvider } from "./EquipmentDialogContext"
import { EquipmentColumnsDialog } from "./EquipmentColumnsDialog"
import { useEquipmentContext } from "../_hooks/useEquipmentContext"

const EQUIPMENT_ENTITY = { singular: "thiết bị" } as const

const equipmentDisplayFormat = (ctx: DisplayContext) => {
  const entityLabel = ctx.entity.plural ?? ctx.entity.singular
  const currentCount =
    ctx.totalCount > 0 ? Math.max(0, ctx.endItem - ctx.startItem + 1) : 0

  return (
    <div className="space-y-1">
      <div className="block sm:hidden">
        <div>
          <strong>{currentCount}</strong> / <strong>{ctx.totalCount}</strong>{" "}
          {entityLabel}
        </div>
        <div>
          Trang <strong>{ctx.currentPage}</strong> /{" "}
          <strong>{ctx.totalPages}</strong>
        </div>
      </div>
      <div className="hidden sm:block">
        Hiển thị <strong>{currentCount}</strong> trên{" "}
        <strong>{ctx.totalCount}</strong> {entityLabel}.
      </div>
    </div>
  )
}

export function EquipmentPageClient() {
  const pageState = useEquipmentPage()

  // Redirect unauthenticated users via useEffect to avoid side effects during render
  React.useEffect(() => {
    if (pageState.status === "unauthenticated") {
      pageState.router.push("/")
    }
  }, [pageState.status, pageState.router])

  // Show loading state
  if (pageState.status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    )
  }

  // Show nothing while redirecting unauthenticated users
  if (pageState.status === "unauthenticated") {
    return null
  }

  return (
    <EquipmentDialogProvider effectiveTenantKey={pageState.effectiveTenantKey}>
      <EquipmentPageContent pageState={pageState} />
    </EquipmentDialogProvider>
  )
}

// Separate component to use context inside provider - memoized to prevent re-renders
const EquipmentPageContent = React.memo(function EquipmentPageContent({
  pageState
}: {
  pageState: ReturnType<typeof useEquipmentPage>
}) {
  const {
    openAddDialog,
    openImportDialog,
    openColumnsDialog,
    openDetailDialog,
    openEditDialog,
  } = useEquipmentContext()

  const {
    // Session/Auth
    isGlobal,
    isRegionalLeader,

    // Route sync
    pendingAction,
    clearPendingAction,

    // Data
    total,
    isLoading,
    isFetching,
    shouldFetchEquipment,

    // Table
    table,
    columns,
    pagination,
    setPagination,

    // Filters
    searchTerm,
    setSearchTerm,
    columnFilters,
    setColumnFilters,
    isFiltered,

    // Filter options
    departments,
    users,
    statuses,
    classifications,
    fundingSources,
    filterData,

    // Facility filter - now from TenantSelectionContext
    showFacilityFilter,
    hasFacilityFilter,
    handleFacilityClear,

    // Filter sheet
    isFilterSheetOpen,
    setIsFilterSheetOpen,

    // Handlers
    handleExportData,
    handleDownloadTemplate,
    handleGenerateProfileSheet,
    handleGenerateDeviceLabel,

    // UI state
    isMobile,
    isCardView,
    useTabletFilters,

    // Branding
    tenantBranding,
  } = pageState

  // Handle route sync pending actions using context
  React.useEffect(() => {
    if (!pendingAction) return

    if (pendingAction.type === "openAdd") {
      openAddDialog()
      clearPendingAction()
      return
    }

    if (pendingAction.type === "openDetail" && pendingAction.equipment) {
      openDetailDialog(pendingAction.equipment)
      clearPendingAction()
      return
    }

    if (pendingAction.type === "applyAttentionStatusPreset") {
      if (!isGlobal && !isRegionalLeader) {
        setColumnFilters((prev) => applyAttentionStatusPresetFilters(prev))
      }
      clearPendingAction()
    }
  }, [
    pendingAction,
    clearPendingAction,
    openAddDialog,
    openDetailDialog,
    isGlobal,
    isRegionalLeader,
    setColumnFilters,
  ])

  return (
    <>
      <EquipmentDialogs
        onGenerateProfileSheet={handleGenerateProfileSheet}
        onGenerateDeviceLabel={handleGenerateDeviceLabel}
        tenantBranding={tenantBranding}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="heading-responsive-h2">Danh mục thiết bị</CardTitle>
              <CardDescription className="body-responsive-sm">
                Quản lý danh sách các trang thiết bị y tế.
              </CardDescription>
            </div>

            {/* Facility selector using shared TenantSelector component */}
            {showFacilityFilter ? (
              <div className="flex w-full max-w-md items-center gap-2">
                <TenantSelector className="flex-1" />
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 px-4 md:px-6">
          {/* Unified toolbar */}
          <EquipmentToolbar
            table={table}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            columnFilters={columnFilters}
            isFiltered={isFiltered}
            statuses={statuses}
            departments={departments}
            users={users}
            classifications={classifications}
            fundingSources={fundingSources}
            isMobile={isMobile}
            useTabletFilters={useTabletFilters}
            isRegionalLeader={isRegionalLeader}
            hasFacilityFilter={hasFacilityFilter}
            onOpenFilterSheet={() => setIsFilterSheetOpen(true)}
            onOpenColumnsDialog={openColumnsDialog}
            onDownloadTemplate={handleDownloadTemplate}
            onExportData={handleExportData}
            onAddEquipment={openAddDialog}
            onImportEquipment={openImportDialog}
            onClearFacilityFilter={handleFacilityClear}
            onShowEquipmentDetails={(eq) => openDetailDialog(eq)}
          />

          <EquipmentColumnsDialog table={table} />

          <div className="mt-4">
            <EquipmentContent
              isGlobal={isGlobal}
              isRegionalLeader={isRegionalLeader}
              shouldFetchEquipment={shouldFetchEquipment}
              isLoading={isLoading}
              isFetching={isFetching}
              isCardView={isCardView}
              table={table}
              columns={columns}
              onShowDetails={(eq) => openDetailDialog(eq)}
              onEdit={(eq) => eq && openEditDialog(eq)}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 py-4 px-4 md:px-6 sm:flex-row sm:items-center sm:justify-between">
          <DataTablePagination
            table={table}
            totalCount={total}
            entity={EQUIPMENT_ENTITY}
            paginationMode={{
              mode: "controlled",
              pagination,
              onPaginationChange: setPagination,
            }}
            displayFormat={equipmentDisplayFormat}
            responsive={{ showFirstLastAt: "sm", showSizeSelectorAt: "sm" }}
            isLoading={isLoading}
            enabled={shouldFetchEquipment}
            slots={{
              beforeNav: (
                <button
                  onClick={handleExportData}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                  disabled={table.getFilteredRowModel().rows.length === 0 || isLoading}
                >
                  Tải về file Excel
                </button>
              ),
            }}
          />
        </CardFooter>
      </Card>

      {/* Floating Add Button - Mobile only */}
      {!isRegionalLeader ? (
        <div className="fixed bottom-20 right-6 md:hidden z-[100]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <Plus className="h-6 w-6" />
                <span className="sr-only">Them thiet bi</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              <DropdownMenuItem onSelect={openAddDialog}>
                Thêm từng thiết bị
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openImportDialog}>
                Thêm hàng loạt bằng Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <FilterBottomSheet
        open={isFilterSheetOpen}
        onOpenChange={setIsFilterSheetOpen}
        data={filterData}
        columnFilters={columnFilters}
        onApply={setColumnFilters}
        onClearAll={() => setColumnFilters([])}
      />
    </>
  )
})
