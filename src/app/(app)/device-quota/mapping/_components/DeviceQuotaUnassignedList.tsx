"use client"

import * as React from "react"
import { Search, CheckCircle2, Building2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeviceQuotaMappingContext } from "../_hooks/useDeviceQuotaMappingContext"
import { cn } from "@/lib/utils"

/**
 * DeviceQuotaUnassignedList - List of unassigned equipment for quota mapping
 *
 * Features:
 * - Search input at top
 * - Select all checkbox
 * - Individual equipment checkboxes
 * - Loading skeleton states
 * - Empty state when all equipment is assigned
 *
 * Uses DeviceQuotaMappingContext for state and actions.
 */
export function DeviceQuotaUnassignedList() {
  const {
    unassignedEquipment,
    selectedEquipmentIds,
    toggleEquipmentSelection,
    selectAllEquipment,
    clearEquipmentSelection,
    searchQuery,
    setSearchQuery,
    isLoading,
    isFacilitySelected,
  } = useDeviceQuotaMappingContext()

  // Determine if all visible equipment is selected
  const allSelected = unassignedEquipment.length > 0 &&
    unassignedEquipment.every(eq => selectedEquipmentIds.has(eq.id))

  const someSelected = unassignedEquipment.some(eq => selectedEquipmentIds.has(eq.id))

  const handleSelectAllChange = React.useCallback(() => {
    if (allSelected) {
      clearEquipmentSelection()
    } else {
      selectAllEquipment()
    }
  }, [allSelected, clearEquipmentSelection, selectAllEquipment])

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Thiết bị chưa phân loại</CardTitle>

        {/* Search Input */}
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={isFacilitySelected ? "Tìm kiếm thiết bị..." : "Chọn cơ sở để tìm kiếm..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={!isFacilitySelected}
            className="pl-9"
          />
        </div>
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
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={handleSelectAllChange}
              />
              <span className="text-sm font-medium">
                Chọn tất cả ({selectedEquipmentIds.size}/{unassignedEquipment.length})
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
      {/* Select all skeleton */}
      <div className="flex items-center gap-2 pb-3 border-b">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Equipment item skeletons */}
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
// Empty State
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
