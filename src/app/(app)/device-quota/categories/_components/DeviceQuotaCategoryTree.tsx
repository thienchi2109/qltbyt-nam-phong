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
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"
import { CATEGORY_GRID_COLS, groupByRoot } from "./category-tree-utils"
import { CategoryGroup } from "./CategoryGroup"
import { CategoryTreeSkeleton, CategoryTreeEmpty } from "./CategoryTreeStates"

export function DeviceQuotaCategoryTree() {
  const {
    categories,
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

  const rootCount = roots.length

  return (
    <Card className="h-full flex flex-col">
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
                    children={childrenMap.get(root.id) || []}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                    mutatingCategoryId={mutatingCategoryId}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
