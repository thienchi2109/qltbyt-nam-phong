"use client"

import * as React from "react"
import { CheckCircle2, Building2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { SearchInput } from "@/components/shared/SearchInput"
import { FacetedMultiSelectFilter } from "@/components/shared/table-filters/FacetedMultiSelectFilter"
import { DataTablePaginationNavigation } from "@/components/shared/DataTablePagination/DataTablePaginationNavigation"
import { DataTablePaginationSizeSelector } from "@/components/shared/DataTablePagination/DataTablePaginationSizeSelector"
import { useDeviceQuotaMappingContext } from "../_hooks/useDeviceQuotaMappingContext"
import { cn } from "@/lib/utils"

/**
 * DeviceQuotaUnassignedList - List of unassigned equipment for quota mapping
 *
 * Features:
 * - SearchInput with debounced server-side search
 * - Faceted filters (Khoa/Phòng, Người sử dụng, Vị trí, Nguồn kinh phí)
 * - Server-side pagination via DataTablePagination
 * - Select all (current page only), cross-page selection persistence
 * - Loading skeleton and empty states
 */
export function DeviceQuotaUnassignedList() {
  const {
    unassignedEquipment,
    totalEquipmentCount,
    selectedEquipmentIds,
    toggleEquipmentSelection,
    selectAllEquipment,
    clearEquipmentSelection,
    filters,
    filterOptions,
    pagination,
    isLoading,
    isFacilitySelected,
  } = useDeviceQuotaMappingContext()

  // Check if all equipment on the current page is selected
  const allPageSelected = unassignedEquipment.length > 0 &&
    unassignedEquipment.every(eq => selectedEquipmentIds.has(eq.id))
  const somePageSelected = unassignedEquipment.some(eq => selectedEquipmentIds.has(eq.id))

  const handleSelectAllChange = React.useCallback(() => {
    if (allPageSelected) {
      // Deselect only current page items (keep cross-page selections)
      const currentPageIds = new Set(unassignedEquipment.map(eq => eq.id))
      const prev = selectedEquipmentIds
      const next = new Set([...prev].filter(id => !currentPageIds.has(id)))
      // We need to use clearEquipmentSelection or toggle individually
      // For simplicity, clear all current page selections
      for (const eq of unassignedEquipment) {
        if (selectedEquipmentIds.has(eq.id)) {
          toggleEquipmentSelection(eq.id)
        }
      }
    } else {
      selectAllEquipment()
    }
  }, [allPageSelected, unassignedEquipment, selectedEquipmentIds, selectAllEquipment, toggleEquipmentSelection])

  // Build filter options for FacetedMultiSelectFilter
  const departmentOptions = React.useMemo(
    () => filterOptions.departments.map(d => ({ label: d, value: d })),
    [filterOptions.departments]
  )
  const userOptions = React.useMemo(
    () => filterOptions.users.map(u => ({ label: u, value: u })),
    [filterOptions.users]
  )
  const locationOptions = React.useMemo(
    () => filterOptions.locations.map(l => ({ label: l, value: l })),
    [filterOptions.locations]
  )
  const fundingOptions = React.useMemo(
    () => filterOptions.fundingSources.map(f => ({ label: f, value: f })),
    [filterOptions.fundingSources]
  )

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Thiết bị chưa phân loại</CardTitle>

        {/* Search */}
        <div className="mt-4">
          <SearchInput
            value={filters.searchTerm}
            onChange={filters.setSearchTerm}
            placeholder={isFacilitySelected ? "Tìm kiếm thiết bị..." : "Chọn cơ sở để tìm kiếm..."}
            disabled={!isFacilitySelected}
          />
        </div>

        {/* Faceted Filters */}
        {isFacilitySelected && (
          <div className="flex flex-wrap gap-2 mt-3">
            <FacetedMultiSelectFilter
              title="Khoa/Phòng"
              options={departmentOptions}
              value={filters.selectedDepartments}
              onChange={filters.setSelectedDepartments}
            />
            <FacetedMultiSelectFilter
              title="Người sử dụng"
              options={userOptions}
              value={filters.selectedUsers}
              onChange={filters.setSelectedUsers}
            />
            <FacetedMultiSelectFilter
              title="Vị trí"
              options={locationOptions}
              value={filters.selectedLocations}
              onChange={filters.setSelectedLocations}
            />
            <FacetedMultiSelectFilter
              title="Nguồn kinh phí"
              options={fundingOptions}
              value={filters.selectedFundingSources}
              onChange={filters.setSelectedFundingSources}
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        {!isFacilitySelected ? (
          <FacilitySelectionEmptyState />
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : unassignedEquipment.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Select All Header */}
            <div className="flex items-center gap-2 pb-3 border-b mb-3">
              <Checkbox
                checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                onCheckedChange={handleSelectAllChange}
              />
              <span className="text-sm font-medium">
                Chọn tất cả trang này ({selectedEquipmentIds.size}/{totalEquipmentCount})
              </span>
            </div>

            {/* Equipment List */}
            <div className="space-y-2">
              {unassignedEquipment.map((equipment) => (
                <EquipmentItem
                  key={equipment.id}
                  equipment={equipment}
                  isSelected={selectedEquipmentIds.has(equipment.id)}
                  onToggle={() => toggleEquipmentSelection(equipment.id)}
                />
              ))}
            </div>
          </>
        )}
      </CardContent>

      {isFacilitySelected && totalEquipmentCount > 0 && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {unassignedEquipment.length > 0
                ? `${(pagination.pagination.pageIndex) * pagination.pagination.pageSize + 1}–${Math.min((pagination.pagination.pageIndex + 1) * pagination.pagination.pageSize, totalEquipmentCount)} trên ${totalEquipmentCount}`
                : `0 trên ${totalEquipmentCount}`
              }
            </p>
            <div className="flex items-center gap-4">
              <DataTablePaginationSizeSelector
                pageSize={pagination.pagination.pageSize}
                pageSizeOptions={[10, 20, 50]}
                onPageSizeChange={(size) => pagination.setPagination({ pageIndex: 0, pageSize: size })}
              />
              <DataTablePaginationNavigation
                currentPage={pagination.pagination.pageIndex + 1}
                totalPages={pagination.pageCount}
                canPreviousPage={pagination.canPreviousPage}
                canNextPage={pagination.canNextPage}
                onFirstPage={() => pagination.setPagination(prev => ({ ...prev, pageIndex: 0 }))}
                onPreviousPage={() => pagination.setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex - 1 }))}
                onNextPage={() => pagination.setPagination(prev => ({ ...prev, pageIndex: prev.pageIndex + 1 }))}
                onLastPage={() => pagination.setPagination(prev => ({ ...prev, pageIndex: pagination.pageCount - 1 }))}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================
// Equipment Item Component
// ============================================

interface EquipmentItemProps {
  equipment: {
    id: number
    ma_thiet_bi: string
    ten_thiet_bi: string
    model: string | null
    khoa_phong_quan_ly: string | null
  }
  isSelected: boolean
  onToggle: () => void
}

function EquipmentItem({ equipment, isSelected, onToggle }: EquipmentItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent",
        isSelected && "bg-accent border-primary"
      )}
      onClick={onToggle}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="mt-1"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-medium text-sm leading-tight">
          {equipment.ten_thiet_bi}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">{equipment.ma_thiet_bi}</span>
          {equipment.model && (
            <span className="truncate">Model: {equipment.model}</span>
          )}
        </div>
        {equipment.khoa_phong_quan_ly && (
          <div className="text-xs text-muted-foreground">
            Khoa: {equipment.khoa_phong_quan_ly}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Loading Skeleton
// ============================================

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-3 border-b">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
          <Skeleton className="h-4 w-4 mt-1" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// Empty States
// ============================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3 mb-4">
        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
      </div>
      <h3 className="font-semibold text-lg mb-1">Hoàn thành phân loại</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Tất cả thiết bị đã được phân loại vào các nhóm định mức.
      </p>
    </div>
  )
}

function FacilitySelectionEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-blue-100 dark:bg-blue-900/20 p-3 mb-4">
        <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-500" />
      </div>
      <h3 className="font-semibold text-lg mb-1">Chọn cơ sở</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Vui lòng chọn cơ sở để xem danh sách thiết bị chưa phân loại.
      </p>
    </div>
  )
}
