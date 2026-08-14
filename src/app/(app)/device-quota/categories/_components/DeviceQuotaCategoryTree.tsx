"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeviceQuotaSplitPane } from "../../_components/DeviceQuotaSplitPane"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"
import { useDeviceQuotaCategoryWorkspaceState } from "../_hooks/useDeviceQuotaCategoryWorkspaceState"
import {
  CATEGORY_GRID_COLS,
  groupByRoot,
  buildAggregatedCounts,
  buildAggregatedQuotas,
  getLeafIds,
} from "./category-tree-utils"
import { CategoryGroup } from "./CategoryGroup"
import { DeviceQuotaCategoryAssignmentPane } from "./DeviceQuotaCategoryAssignmentPane"
import { DeviceQuotaCategoryDetailPane } from "./DeviceQuotaCategoryDetailPane"
import { CategoryTreeSkeleton, CategoryTreeEmpty } from "./CategoryTreeStates"

const RESTRICTED_DETAIL_PANE = (
  <Card className="h-full">
    <CardContent className="flex min-h-[18rem] items-center justify-center text-sm text-muted-foreground">
      Bạn không có quyền xem chi tiết danh mục
    </CardContent>
  </Card>
)

interface DeviceQuotaCategoryTreeProps {
  onAssignmentActiveChange?: (isActive: boolean) => void
}

/** Renders the device quota category tree and detail pane. */
export function DeviceQuotaCategoryTree({
  onAssignmentActiveChange,
}: DeviceQuotaCategoryTreeProps = {}) {
  const {
    categories,
    allCategories,
    donViId,
    isFacilitySelected,
    canManageCategories,
    canInspectCategoryDetail,
    canAssignManually,
    isLoading,
    searchTerm,
    openCreateDialog,
    openEditDialog,
    openDeleteDialog,
    mutatingCategoryId,
  } = useDeviceQuotaCategoryContext()

  const { roots, childrenMap } = React.useMemo(() => groupByRoot(categories), [categories])

  const aggregatedCounts = React.useMemo(
    () => buildAggregatedCounts(allCategories),
    [allCategories]
  )

  const aggregatedQuotas = React.useMemo(
    () => buildAggregatedQuotas(allCategories),
    [allCategories]
  )

  const leafIds = React.useMemo(() => getLeafIds(allCategories), [allCategories])
  const workspace = useDeviceQuotaCategoryWorkspaceState({
    categories,
    allCategories,
    aggregatedCounts,
    leafIds,
  })
  const selectedCategory = workspace.selectedCategory

  const rootCount = roots.length
  const selectedCount = selectedCategory
    ? (aggregatedCounts.get(selectedCategory.id) ?? selectedCategory.so_luong_hien_co)
    : 0
  const selectedQuota = selectedCategory ? aggregatedQuotas.get(selectedCategory.id) : undefined
  const startAssignment = React.useCallback(() => {
    workspace.startAssignment()
    onAssignmentActiveChange?.(true)
  }, [onAssignmentActiveChange, workspace.startAssignment])
  const cancelAssignment = React.useCallback(() => {
    workspace.cancelAssignment()
    onAssignmentActiveChange?.(false)
  }, [onAssignmentActiveChange, workspace.cancelAssignment])
  const completeAssignment = React.useCallback(
    (confirmedIds: number[]) => {
      workspace.completeAssignment(confirmedIds)
      onAssignmentActiveChange?.(false)
    },
    [onAssignmentActiveChange, workspace.completeAssignment]
  )

  const navigationPane = (
    <Card className="h-full flex flex-col" data-testid="device-quota-category-nav-pane">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Tiêu chuẩn, định mức thiết bị</CardTitle>
        <CardDescription>
          {isLoading
            ? "Đang tải..."
            : rootCount > 0
              ? `${rootCount} nhóm gốc · ${categories.length} danh mục`
              : "Không có dữ liệu"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <CategoryTreeSkeleton />
        ) : roots.length === 0 ? (
          <CategoryTreeEmpty
            onCreate={openCreateDialog}
            hasSearch={searchTerm.length > 0}
            canCreate={canManageCategories}
          />
        ) : (
          <div className="space-y-3">
            {/* Column header */}
            <div
              className={cn(
                CATEGORY_GRID_COLS,
                "px-4 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
              )}
              aria-hidden="true"
            >
              <span>Tên nhóm</span>
              <span>Phân loại</span>
              <span>Tình trạng sử dụng</span>
              <span /> {/* Actions column */}
            </div>

            <ul aria-label="Tiêu chuẩn, định mức thiết bị" className="space-y-3">
              {roots.map((root) => (
                <li key={root.id}>
                  <CategoryGroup
                    root={root}
                    childCategories={childrenMap.get(root.id) || []}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                    mutatingCategoryId={mutatingCategoryId}
                    aggregatedCounts={aggregatedCounts}
                    aggregatedQuotas={aggregatedQuotas}
                    leafIds={leafIds}
                    selectedCategoryId={workspace.selectedCategoryId}
                    onSelectCategory={workspace.selectCategory}
                    canManageCategories={canManageCategories}
                    selectionDisabled={workspace.mode === "assign"}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const detailPane = (
    <DeviceQuotaCategoryDetailPane
      category={selectedCategory}
      allCategories={allCategories}
      aggregatedCount={selectedCount}
      aggregatedQuota={selectedQuota}
      isLeaf={selectedCategory ? leafIds.has(selectedCategory.id) : false}
      donViId={donViId}
      canAssign={canAssignManually}
      onStartAssignment={startAssignment}
      reconciledEquipmentIds={workspace.reconciledEquipmentIds}
    />
  )

  const assignmentPane =
    selectedCategory && workspace.mode === "assign" ? (
      <DeviceQuotaCategoryAssignmentPane
        category={selectedCategory}
        donViId={donViId}
        isFacilitySelected={isFacilitySelected}
        onCancel={cancelAssignment}
        onReconciled={completeAssignment}
      />
    ) : null

  return (
    <DeviceQuotaSplitPane
      ratio="46-54"
      leftPanel={navigationPane}
      rightPanel={
        canInspectCategoryDetail ? (assignmentPane ?? detailPane) : RESTRICTED_DETAIL_PANE
      }
      leftClassName="lg:overflow-x-hidden"
    />
  )
}
