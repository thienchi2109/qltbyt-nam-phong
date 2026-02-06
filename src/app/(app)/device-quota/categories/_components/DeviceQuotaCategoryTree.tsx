"use client"

import * as React from "react"
import { FolderTree, MoreHorizontal, Package, Pencil, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"
import type { CategoryListItem } from "../_types/categories"

interface CategoryTreeItemProps {
  category: CategoryListItem
  onEdit: (category: CategoryListItem) => void
  onDelete: (category: CategoryListItem) => void
  isMutating: boolean
}

const CategoryTreeItem = React.memo(function CategoryTreeItem({
  category,
  onEdit,
  onDelete,
  isMutating,
}: CategoryTreeItemProps) {
  return (
    <div
      role="option"
      aria-level={category.level}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border border-transparent p-3 transition-colors",
        "hover:bg-accent"
      )}
      style={{ paddingLeft: `${(category.level - 1) * 24 + 12}px` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{category.ma_nhom}</span>
          <span className="text-sm text-muted-foreground truncate">
            {category.ten_nhom}
          </span>
        </div>
        {category.phan_loai && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Phân loại: {category.phan_loai}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="flex-shrink-0">
          <Package className="h-3 w-3 mr-1" />
          {category.so_luong_hien_co}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isMutating}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(category)}>
              <Pencil className="mr-2 h-4 w-4" />
              Sửa
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onDelete(category)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
})

function CategoryTreeSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function CategoryTreeEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-4">
        <FolderTree className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-base mb-1">Chưa có danh mục nào</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Hiện tại chưa có danh mục thiết bị nào được thiết lập. Vui lòng tạo danh mục
        trước khi phân loại thiết bị.
      </p>
      <Button variant="outline" size="sm" onClick={onCreate}>
        Tạo danh mục
      </Button>
    </div>
  )
}

export function DeviceQuotaCategoryTree() {
  const {
    categories,
    isLoading,
    openCreateDialog,
    openEditDialog,
    openDeleteDialog,
    mutatingCategoryId,
  } = useDeviceQuotaCategoryContext()

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Danh mục thiết bị</CardTitle>
        <CardDescription>
          Quản lý danh mục nhóm thiết bị ({categories.length} danh mục)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <CategoryTreeSkeleton />
        ) : categories.length === 0 ? (
          <CategoryTreeEmpty onCreate={openCreateDialog} />
        ) : (
          <div role="listbox" aria-label="Danh mục thiết bị" className="space-y-1">
            {categories.map((category) => (
              <CategoryTreeItem
                key={category.id}
                category={category}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
                isMutating={mutatingCategoryId === category.id}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
