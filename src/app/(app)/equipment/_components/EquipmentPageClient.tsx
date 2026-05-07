"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { FilterBottomSheet } from "@/components/equipment/filter-bottom-sheet"
import { LinkedRequestProvider } from "@/components/equipment-linked-request"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import type { DisplayContext } from "@/components/shared/DataTablePagination/types"
import { floatingActionButtonClassName } from "@/components/shared/FloatingActionButton"
import { EquipmentToolbar } from "@/components/equipment/equipment-toolbar"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { applyAttentionStatusPresetFilters } from "@/lib/equipment-attention-preset"
import { ROLES } from "@/lib/rbac"
import { cn } from "@/lib/utils"

import { useEquipmentPage } from "../use-equipment-page"
import { EquipmentContent } from "../equipment-content"
import { EquipmentDialogs } from "../equipment-dialogs"
import { EquipmentDialogProvider } from "./EquipmentDialogContext"
import { EquipmentColumnsDialog } from "./EquipmentColumnsDialog"
import { EquipmentBulkDeleteBar } from "./EquipmentBulkDeleteBar"
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

  // The page wrapper owns unauthenticated access; keep this as a defensive fallback.
  if (pageState.status === "unauthenticated") {
    return null
  }

  return (
    <EquipmentDialogProvider effectiveTenantKey={pageState.effectiveTenantKey}>
      <LinkedRequestProvider>
        <EquipmentPageContent pageState={pageState} />
      </LinkedRequestProvider>
    </EquipmentDialogProvider>
  )
}

// Separate component to use context inside provider.
// Do not memoize this boundary: TanStack Table keeps a stable table reference
// while its internal row selection changes, so memoizing by pageState can leave
// selection checkboxes visually stale until an unrelated parent render occurs.
function EquipmentPageContent({
  pageState
}: {
  pageState: ReturnType<typeof useEquipmentPage>
}) {
  const {
    openAddDialog,
    openImportDialog,
    openColumnsDialog,
    openDetailDialog,
    user: dialogUser,
  } = useEquipmentContext()

  const {
    user,
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
    canBulkSelect,
    isExporting,

    // Branding
    tenantBranding,
  } = pageState

  const canCreateEquipment = React.useMemo(() => {
    const role = (dialogUser?.role ?? user?.role ?? "").toLowerCase().trim()
    return role !== ROLES.USER && !isRegionalLeader
  }, [dialogUser?.role, user?.role, isRegionalLeader])
  const floatingBarSelectionCount =
    (table as {
      getFilteredSelectedRowModel?: () => { rows: unknown[] }
    }).getFilteredSelectedRowModel?.().rows.length ?? 0
  const shouldReserveFloatingBarSpace =
    canBulkSelect &&
    !isCardView &&
    floatingBarSelectionCount > 0

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

      <div className={cn("space-y-4", shouldReserveFloatingBarSpace && "pb-24 md:pb-28")}>
        <EquipmentToolbar
          table={table}
          title="Danh mục thiết bị"
          description="Quản lý danh sách các trang thiết bị y tế."
          tenantControl={showFacilityFilter ? <TenantSelector className="w-full" /> : null}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          columnFilters={columnFilters}
          statuses={statuses}
          departments={departments}
          users={users}
          classifications={classifications}
          fundingSources={fundingSources}
          filterMode={isMobile || useTabletFilters ? "sheet" : "faceted"}
          filterState={{ isFiltered, hasFacilityFilter }}
          actionState={{ canCreateEquipment, isExporting }}
          selectionActions={
            <EquipmentBulkDeleteBar
              table={table}
              canBulkSelect={canBulkSelect}
              isCardView={isCardView}
            />
          }
          onOpenFilterSheet={() => setIsFilterSheetOpen(true)}
          onOpenColumnsDialog={openColumnsDialog}
          onDownloadTemplate={handleDownloadTemplate}
          onExportData={handleExportData}
          onAddEquipment={openAddDialog}
          onImportEquipment={openImportDialog}
          onClearFacilityFilter={handleFacilityClear}
          onShowEquipmentDetails={(eq) => openDetailDialog(eq)}
        />

        <Card>
          <CardContent className="space-y-4 px-4 pt-4 md:px-6">
            <EquipmentColumnsDialog table={table} />
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
            />
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
                    disabled={table.getFilteredRowModel().rows.length === 0 || isLoading || isExporting}
                  >
                    {isExporting ? "Đang tải..." : "Tải về file Excel"}
                  </button>
                ),
              }}
            />
          </CardFooter>
        </Card>
      </div>

      {/* Floating Add Button - Mobile only */}
      {canCreateEquipment ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={floatingActionButtonClassName()}
            aria-label="Thêm thiết bị"
          >
            <Plus />
            <span className="sr-only">Them thiet bi</span>
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
}
