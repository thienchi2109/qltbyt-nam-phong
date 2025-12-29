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

export default function EquipmentPage() {
  const {
    // Session/Auth
    user,
    status,
    isGlobal,
    isRegionalLeader,
    router,

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

    // Dialogs
    isAddDialogOpen,
    setIsAddDialogOpen,
    isImportDialogOpen,
    setIsImportDialogOpen,
    editingEquipment,
    setEditingEquipment,
    selectedEquipment,
    setSelectedEquipment,
    isDetailModalOpen,
    setIsDetailModalOpen,
    isStartUsageDialogOpen,
    setIsStartUsageDialogOpen,
    startUsageEquipment,
    setStartUsageEquipment,
    isEndUsageDialogOpen,
    setIsEndUsageDialogOpen,
    endUsageLog,
    setEndUsageLog,

    // Filter sheet
    isFilterSheetOpen,
    setIsFilterSheetOpen,

    // Columns dialog
    isColumnsDialogOpen,
    setIsColumnsDialogOpen,

    // Handlers
    handleShowDetails,
    handleDownloadTemplate,
    handleExportData,
    handleGenerateProfileSheet,
    handleGenerateDeviceLabel,
    onDataMutationSuccessWithStatePreservation,

    // UI state
    isMobile,
    isCardView,
    useTabletFilters,

    // Branding
    tenantBranding,
  } = useEquipmentPage()

  // Redirect if not authenticated
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/")
    return null
  }

  return (
    <>
      <EquipmentDialogs
        isAddDialogOpen={isAddDialogOpen}
        setIsAddDialogOpen={setIsAddDialogOpen}
        isImportDialogOpen={isImportDialogOpen}
        setIsImportDialogOpen={setIsImportDialogOpen}
        editingEquipment={editingEquipment}
        setEditingEquipment={setEditingEquipment}
        selectedEquipment={selectedEquipment}
        isDetailModalOpen={isDetailModalOpen}
        setIsDetailModalOpen={setIsDetailModalOpen}
        isStartUsageDialogOpen={isStartUsageDialogOpen}
        setIsStartUsageDialogOpen={setIsStartUsageDialogOpen}
        startUsageEquipment={startUsageEquipment}
        setStartUsageEquipment={setStartUsageEquipment}
        isEndUsageDialogOpen={isEndUsageDialogOpen}
        setIsEndUsageDialogOpen={setIsEndUsageDialogOpen}
        endUsageLog={endUsageLog}
        setEndUsageLog={setEndUsageLog}
        onSuccess={onDataMutationSuccessWithStatePreservation}
        onGenerateProfileSheet={handleGenerateProfileSheet}
        onGenerateDeviceLabel={handleGenerateDeviceLabel}
        user={user}
        isRegionalLeader={isRegionalLeader}
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
            onOpenColumnsDialog={() => setIsColumnsDialogOpen(true)}
            onDownloadTemplate={handleDownloadTemplate}
            onExportData={handleExportData}
            onAddEquipment={() => setIsAddDialogOpen(true)}
            onImportEquipment={() => setIsImportDialogOpen(true)}
            onClearFacilityFilter={() => setSelectedFacilityId(null)}
          />

          {/* Columns dialog */}
          <Dialog open={isColumnsDialogOpen} onOpenChange={setIsColumnsDialogOpen}>
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
                <Button variant="outline" onClick={() => setIsColumnsDialogOpen(false)}>Đóng</Button>
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
              onShowDetails={handleShowDetails}
              onEdit={setEditingEquipment}
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
              <DropdownMenuItem onSelect={() => setIsAddDialogOpen(true)}>
                Thêm thủ công
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsImportDialogOpen(true)}>
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
