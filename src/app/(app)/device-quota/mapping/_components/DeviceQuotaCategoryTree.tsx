"use client"

import * as React from "react"
import { ChevronRight, FolderTree, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useDeviceQuotaMappingContext } from "../_hooks/useDeviceQuotaMappingContext"
import type { Category } from "./DeviceQuotaMappingContext"

/**
 * Category tree item component with radio-button selection
 */
interface CategoryTreeItemProps {
  category: Category
  isSelected: boolean
  onSelect: (id: number) => void
}

function CategoryTreeItem({ category, isSelected, onSelect }: CategoryTreeItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      className={cn(
        "w-full text-left p-3 rounded-md transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isSelected && "bg-primary/10 border-2 border-primary"
      )}
      style={{ paddingLeft: `${(category.level - 1) * 24 + 12}px` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Radio indicator */}
          <div
            className={cn(
              "h-4 w-4 rounded-full border-2 flex-shrink-0 transition-colors",
              isSelected
                ? "border-primary bg-primary"
                : "border-muted-foreground/50"
            )}
          >
            {isSelected && (
              <div className="h-full w-full rounded-full bg-background scale-[0.4]" />
            )}
          </div>

          {/* Hierarchy indicator */}
          {category.level > 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}

          {/* Category info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-sm">{category.ma_nhom}</span>
              <span className="text-sm text-muted-foreground truncate">
                {category.ten_nhom}
              </span>
            </div>
            {category.phan_loai && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {category.phan_loai}
              </div>
            )}
          </div>
        </div>

        {/* Equipment count badge */}
        <Badge variant="secondary" className="flex-shrink-0 ml-2">
          <Package className="h-3 w-3 mr-1" />
          {category.so_luong_hien_co}
        </Badge>
      </div>
    </button>
  )
}

/**
 * Loading skeleton for category tree
 */
function CategoryTreeSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  )
}

/**
 * Empty state when no categories exist
 */
function CategoryTreeEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-4">
        <FolderTree className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-base mb-1">
        Chưa có danh mục nào
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Hiện tại chưa có danh mục định mức nào được thiết lập.
        Vui lòng tạo quyết định định mức và danh mục trước khi gán thiết bị.
      </p>
      <Button variant="outline" size="sm" asChild>
        <a href="/device-quota/decisions">
          Quản lý quyết định định mức
        </a>
      </Button>
    </div>
  )
}

/**
 * DeviceQuotaCategoryTree - Hierarchical category selection for equipment mapping
 *
 * Features:
 * - Radio-button style single selection
 * - Visual hierarchy with indentation based on level
 * - Equipment count badges
 * - Loading and empty states
 * - Responsive design
 */
export function DeviceQuotaCategoryTree() {
  const {
    categories,
    selectedCategoryId,
    setSelectedCategory,
    isLoading,
  } = useDeviceQuotaMappingContext()

  const handleSelect = React.useCallback((id: number) => {
    setSelectedCategory(selectedCategoryId === id ? null : id)
  }, [selectedCategoryId, setSelectedCategory])

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-lg">Danh mục định mức</CardTitle>
        <CardDescription>
          Chọn danh mục để gán thiết bị ({categories.length} danh mục)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <CategoryTreeSkeleton />
        ) : categories.length === 0 ? (
          <CategoryTreeEmpty />
        ) : (
          <div className="space-y-1">
            {categories.map((category) => (
              <CategoryTreeItem
                key={category.id}
                category={category}
                isSelected={selectedCategoryId === category.id}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
