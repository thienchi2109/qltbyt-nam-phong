"use client"

import { Building2, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { FilterBottomSheet } from "@/components/equipment/filter-bottom-sheet"
import { columnLabels } from "@/components/equipment/equipment-table-columns"
import { EquipmentPagination } from "@/components/equipment/equipment-pagination"
import { FacilityFilterSheet } from "@/components/equipment/facility-filter-sheet"
import { EquipmentToolbar } from "@/components/equipment/equipment-toolbar"
import type { Equipment } from "@/types/database"

import { useEquipmentPage } from "./use-equipment-page"
import { EquipmentContent } from "./equipment-content"
import { EquipmentDialogs } from "./equipment-dialogs"
import { EquipmentDialogProvider } from "./_components/EquipmentDialogContext"
import { useEquipmentContext } from "./_hooks/useEquipmentContext"

export default function EquipmentPage() {
  const pageState = useEquipmentPage()

  // Redirect if not authenticated
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

  if (pageState.status === "unauthenticated") {
    pageState.router.push("/")
    return null
  }

  return (
    <EquipmentDialogProvider effectiveTenantKey={pageState.data.length > 0 ? String(pageState.data[0]?.don_vi || "all") : "all"}>
      <EquipmentPageContent pageState={pageState} />
    </EquipmentDialogProvider>
  )
}

// Separate component to use context inside provider
function EquipmentPageContent({ pageState }: { pageState: ReturnType<typeof useEquipmentPage> }) {
  const {
    openAddDialog,
    openImportDialog,
    openColumnsDialog,
    openDetailDialog,
    openEditDialog,
    dialogState,
    closeColumnsDialog,
  } = useEquipmentContext()

  const {
    // Session/Auth
    isGlobal,
    isRegionalLeader,

    // Data
    data,
    total,
    isLoading,
    isFetching,
    shouldFetchEquipment,

    // Table
    table,
    columns,
    pagination,
    setPagination,
    pageCount,

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
    filterData,

    // Facility filter
    showFacilityFilter,
    facilities,
    selectedFacilityId,
    setSelectedFacilityId,
    activeFacility,
    hasFacilityFilter,
    isFacilitiesLoading,

    // Facility sheet
    isFacilitySheetOpen,
    setIsFacilitySheetOpen,
    pendingFacilityId,
    setPendingFacilityId,
    handleFacilityApply,
    handleFacilityClear,
    handleFacilityCancel,

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

            {/* Facility filter (global + regional leader) */}
            {showFacilityFilter && (
              <div className="flex w-full max-w-md items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex h-10 flex-1 items-center justify-start gap-2 rounded-xl border border-dashed px-3"
                  onClick={() => setIsFacilitySheetOpen(true)}
                  disabled={isFacilitiesLoading}
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-left text-sm font-medium">
                    {activeFacility ? activeFacility.name : "Tất cả cơ sở"}
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {activeFacility ? `${activeFacility.count ?? 0} TB` : `${facilities.length || 0} cơ sở`}
                  </Badge>
                </Button>
              </div>
            )}
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
            onClearFacilityFilter={() => setSelectedFacilityId(null)}
            onShowEquipmentDetails={(eq) => openDetailDialog(eq)}
          />

          {/* Columns dialog */}
          <Dialog open={dialogState.isColumnsOpen} onOpenChange={(open) => !open && closeColumnsDialog()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hiện/Ẩn cột</DialogTitle>
                <DialogDescription>Chọn các cột muốn hiển thị trong bảng.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[50vh] overflow-y-auto space-y-1">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <div key={column.id} className="flex items-center justify-between py-1">
                      <span className="text-sm text-muted-foreground">
                        {columnLabels[column.id as keyof Equipment] || column.id}
                      </span>
                      <Button
                        variant={column.getIsVisible() ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-7"
                        onClick={() => column.toggleVisibility(!column.getIsVisible())}
                      >
                        {column.getIsVisible() ? 'Ẩn' : 'Hiện'}
                      </Button>
                    </div>
                  ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeColumnsDialog}>Đóng</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="mt-4">
            <EquipmentContent
              isGlobal={isGlobal}
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
          <EquipmentPagination
            table={table}
            pagination={pagination}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            currentCount={data.length}
            totalCount={total}
            onExportData={handleExportData}
            isLoading={isLoading}
            shouldFetchEquipment={shouldFetchEquipment}
          />
        </CardFooter>
      </Card>

      {/* Floating Add Button - Mobile only */}
      {!isRegionalLeader && (
        <div className="fixed bottom-20 right-6 md:hidden z-[100]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <Plus className="h-6 w-6" />
                <span className="sr-only">Thêm thiết bị</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              <DropdownMenuItem onSelect={openAddDialog}>
                Thêm thủ công
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openImportDialog}>
                Nhập từ Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <FilterBottomSheet
        open={isFilterSheetOpen}
        onOpenChange={setIsFilterSheetOpen}
        data={filterData}
        columnFilters={columnFilters}
        onApply={setColumnFilters}
        onClearAll={() => setColumnFilters([])}
      />

      <FacilityFilterSheet
        open={isFacilitySheetOpen}
        onOpenChange={setIsFacilitySheetOpen}
        facilities={facilities}
        isLoading={isFacilitiesLoading}
        selectedFacilityId={selectedFacilityId}
        pendingFacilityId={pendingFacilityId}
        onPendingChange={setPendingFacilityId}
        onApply={handleFacilityApply}
        onClear={handleFacilityClear}
        onCancel={handleFacilityCancel}
        totalEquipmentCount={total}
      />
    </>
  )
}
