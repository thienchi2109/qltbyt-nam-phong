"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DeviceQuotaSplitPane } from "../../_components/DeviceQuotaSplitPane"
import type { CategoryListItem } from "../_types/categories"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"
import { CATEGORY_GRID_COLS, groupByRoot, buildAggregatedCounts, buildAggregatedQuotas, getLeafIds } from "./category-tree-utils"
import { CategoryGroup } from "./CategoryGroup"
import { DeviceQuotaCategoryDetailPane } from "./DeviceQuotaCategoryDetailPane"
import { CategoryTreeSkeleton, CategoryTreeEmpty } from "./CategoryTreeStates"

function findDefaultCategory(
  categories: CategoryListItem[],
  aggregatedCounts: Map<number, number>,
  leafIds: Set<number>
) {
  return (
    categories.find(
      (category) =>
        leafIds.has(category.id) && (aggregatedCounts.get(category.id) ?? category.so_luong_hien_co) > 0
    ) ??
    categories.find((category) => leafIds.has(category.id)) ??
    categories.find((category) => category.level === 1) ??
    null
  )
}

export function DeviceQuotaCategoryTree() {
  const {
    categories,
    allCategories,
    donViId,
    isLoading,
    searchTerm,
    openCreateDialog,
    openEditDialog,
    openDeleteDialog,
    mutatingCategoryId,
  } = useDeviceQuotaCategoryContext()

  const { roots, childrenMap } = React.useMemo(
    () => groupByRoot(categories),
    [categories]
  )

  const aggregatedCounts = React.useMemo(
    () => buildAggregatedCounts(allCategories),
    [allCategories]
  )

  const aggregatedQuotas = React.useMemo(
    () => buildAggregatedQuotas(allCategories),
    [allCategories]
  )

  const leafIds = React.useMemo(
    () => getLeafIds(allCategories),
    [allCategories]
  )

  const [selectedCategoryId, setSelectedCategoryId] = React.useState<number | null>(null)

  const defaultCategory = React.useMemo(
    () => findDefaultCategory(categories, aggregatedCounts, leafIds),
    [aggregatedCounts, categories, leafIds]
  )

  const visibleSelectedCategory = React.useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  )

  const selectedCategory = visibleSelectedCategory ?? defaultCategory

  React.useEffect(() => {
    const nextSelectedId = selectedCategory?.id ?? null
    if (selectedCategoryId !== nextSelectedId) {
      setSelectedCategoryId(nextSelectedId)
    }
  }, [selectedCategory?.id, selectedCategoryId])

  const handleSelectCategory = React.useCallback((category: CategoryListItem) => {
    setSelectedCategoryId(category.id)
  }, [])

  const rootCount = roots.length
  const selectedCount = selectedCategory
    ? (aggregatedCounts.get(selectedCategory.id) ?? selectedCategory.so_luong_hien_co)
    : 0
  const selectedQuota = selectedCategory
    ? aggregatedQuotas.get(selectedCategory.id)
    : undefined

  const navigationPane = (
    <Card className="h-full flex flex-col" data-testid="device-quota-category-nav-pane">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          Tiêu chuẩn, định mức thiết bị
        </CardTitle>
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

            <div
              role="list"
              aria-label="Tiêu chuẩn, định mức thiết bị"
              className="space-y-3"
            >
              {roots.map((root) => (
                <div key={root.id} role="listitem">
                  <CategoryGroup
                    root={root}
                    childCategories={childrenMap.get(root.id) || []}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                    mutatingCategoryId={mutatingCategoryId}
                    aggregatedCounts={aggregatedCounts}
                    aggregatedQuotas={aggregatedQuotas}
                    leafIds={leafIds}
                    selectedCategoryId={selectedCategory?.id ?? null}
                    onSelectCategory={handleSelectCategory}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <DeviceQuotaSplitPane
      ratio="40-60"
      leftPanel={navigationPane}
      rightPanel={
        <DeviceQuotaCategoryDetailPane
          category={selectedCategory}
          allCategories={allCategories}
          aggregatedCount={selectedCount}
          aggregatedQuota={selectedQuota}
          isLeaf={selectedCategory ? leafIds.has(selectedCategory.id) : false}
          donViId={donViId}
        />
      }
      leftClassName="lg:overflow-x-hidden"
    />
  )
}
