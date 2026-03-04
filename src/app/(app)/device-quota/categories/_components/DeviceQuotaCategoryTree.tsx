"use client"

import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"
import { CATEGORY_ENTITY, groupByRoot } from "./category-tree-utils"
import { CategoryGroup } from "./CategoryGroup"
import { CategoryTreeSkeleton, CategoryTreeEmpty } from "./CategoryTreeStates"

/** Minimal stub table for DataTablePagination compatibility */
function useStubTable() {
  return React.useMemo(
    () => ({
      getState: () => ({ pagination: { pageIndex: 0, pageSize: 20 } }),
      setPageIndex: () => { },
      setPageSize: () => { },
      getFilteredSelectedRowModel: () => ({ rows: [] }),
      getFilteredRowModel: () => ({ rows: [] }),
    }),
    []
  )
}

export function DeviceQuotaCategoryTree() {
  const {
    categories,
    isLoading,
    totalRootCount,
    searchTerm,
    pagination: paginationState,
    openCreateDialog,
    openEditDialog,
    openDeleteDialog,
    mutatingCategoryId,
  } = useDeviceQuotaCategoryContext()

  const { roots, childrenMap } = React.useMemo(
    () => groupByRoot(categories),
    [categories]
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stubTable = useStubTable() as any

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          Tiêu chuẩn, định mức thiết bị
        </CardTitle>
        <CardDescription>
          {isLoading
            ? "Đang tải..."
            : totalRootCount > 0
              ? `${totalRootCount} nhóm gốc · ${categories.length} danh mục trên trang này`
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
        )}
      </CardContent>

      <CardFooter className="border-t pt-4">
        <DataTablePagination
          table={stubTable}
          totalCount={totalRootCount}
          entity={CATEGORY_ENTITY}
          paginationMode={{
            mode: "controlled",
            pagination: paginationState.pagination,
            onPaginationChange: paginationState.setPagination,
          }}
          displayFormat="range-total"
          responsive={{ showFirstLastAt: "sm", showSizeSelectorAt: "sm" }}
          isLoading={isLoading}
          enabled={totalRootCount > 0}
          pageSizeOptions={[10, 20, 50]}
        />
      </CardFooter>
    </Card>
  )
}
