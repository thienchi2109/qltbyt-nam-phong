"use client"

import * as React from "react"
import {
    ChevronDown,
    ChevronRight,
    MoreHorizontal,
    Pencil,
    Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CATEGORY_GRID_COLS, CLASSIFICATION_STYLES } from "./category-tree-utils"
import { QuotaProgressBar } from "./QuotaProgressBar"
import { DeviceQuotaCategoryAssignedEquipment } from "./DeviceQuotaCategoryAssignedEquipment"
import type { CategoryListItem } from "../_types/categories"

// ============================================
// Child Row
// ============================================

interface CategoryChildRowProps {
    category: CategoryListItem
    onEdit: (category: CategoryListItem) => void
    onDelete: (category: CategoryListItem) => void
    isMutating: boolean
    aggregatedCount: number
    isLeaf: boolean
    isExpanded: boolean
    onToggleExpand: (id: number) => void
    donViId: number | null
}

const CategoryChildRow = React.memo(function CategoryChildRow({
    category,
    onEdit,
    onDelete,
    isMutating,
    aggregatedCount,
    isLeaf,
    isExpanded,
    onToggleExpand,
    donViId,
}: CategoryChildRowProps) {
    const classStyle = CLASSIFICATION_STYLES[category.phan_loai || ""] ?? null

    const indentPx = Math.max(0, category.level - 2) * 20

    const isExpandable = isLeaf && aggregatedCount > 0

    return (
        <>
            <div
                className={cn(
                    "group relative rounded-md border border-transparent px-4 py-2.5 transition-all duration-150",
                    "hover:bg-accent/50 hover:border-border/50",
                    isExpanded && "bg-accent/30 border-border/50",
                    CATEGORY_GRID_COLS
                )}
            >
                {/* Column 1: Category name */}
                <div className="relative min-w-0" style={{ paddingLeft: `${indentPx}px` }}>
                    {category.level > 2 && (
                        <div
                            className="absolute top-0 bottom-0 border-l-2 border-muted-foreground/15"
                            style={{ left: `${Math.max(0, category.level - 3) * 20}px` }}
                            aria-hidden="true"
                        />
                    )}
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-primary/80 shrink-0">
                            {category.ma_nhom}
                        </span>
                        <span className="text-sm text-foreground/80 break-words">
                            {category.ten_nhom}
                        </span>
                    </div>
                    {category.mo_ta && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                            {category.mo_ta}
                        </p>
                    )}
                </div>

                {/* Column 2: Classification badge */}
                <div>
                    {classStyle && (
                        <Badge variant="outline" className={cn("text-xs font-medium", classStyle.className)}>
                            {classStyle.label}
                        </Badge>
                    )}
                </div>

                {/* Column 3: Quota progress bar — clickable for expandable leaves */}
                {isExpandable ? (
                    <button
                        type="button"
                        className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggleExpand(category.id)
                        }}
                        aria-expanded={isExpanded}
                        aria-label={`Xem thiết bị ${category.ten_nhom}`}
                    >
                        <ChevronRight className={cn(
                            "h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200",
                            isExpanded && "rotate-90"
                        )} />
                        <QuotaProgressBar
                            current={aggregatedCount}
                            max={category.so_luong_toi_da}
                        />
                    </button>
                ) : (
                    <QuotaProgressBar
                        current={aggregatedCount}
                        max={category.so_luong_toi_da}
                    />
                )}

                {/* Column 4: Actions */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={isMutating}
                        >
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

            {/* Expanded equipment panel */}
            {isExpanded && isExpandable && (
                <DeviceQuotaCategoryAssignedEquipment
                    nhomId={category.id}
                    donViId={donViId}
                />
            )}
        </>
    )
})

// ============================================
// Group (Root header + children)
// ============================================

interface CategoryGroupProps {
    root: CategoryListItem
    children: CategoryListItem[]
    onEdit: (category: CategoryListItem) => void
    onDelete: (category: CategoryListItem) => void
    mutatingCategoryId: number | null
    aggregatedCounts: Map<number, number>
    leafIds: Set<number>
    expandedCategoryId: number | null
    onToggleExpand: (id: number) => void
    donViId: number | null
}

const CategoryGroup = React.memo(function CategoryGroup({
    root,
    children,
    onEdit,
    onDelete,
    mutatingCategoryId,
    aggregatedCounts,
    leafIds,
    expandedCategoryId,
    onToggleExpand,
    donViId,
}: CategoryGroupProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(false)
    const classStyle = CLASSIFICATION_STYLES[root.phan_loai || ""] ?? null

    // Use aggregated count from full-tree computation — no double-counting
    const totalEquipment = aggregatedCounts.get(root.id) ?? root.so_luong_hien_co

    const allGroupItems = [root, ...children]
    const hasUnknownQuota = allGroupItems.some((item) => item.so_luong_toi_da == null)
    const totalQuota = allGroupItems.reduce((sum, item) => sum + (item.so_luong_toi_da ?? 0), 0)

    return (
        <div className="rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-sm">
            {/* Group Header */}
            <div
                className={cn(
                    "group cursor-pointer select-none px-4 py-3",
                    "bg-muted/50 border-l-4 border-l-primary/60",
                    "hover:bg-muted/80 transition-colors",
                    CATEGORY_GRID_COLS
                )}
                onClick={() => setIsCollapsed(!isCollapsed)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setIsCollapsed(!isCollapsed)
                    }
                }}
                aria-expanded={!isCollapsed}
                aria-label={`Nhóm ${root.ma_nhom}: ${root.ten_nhom}`}
            >
                {/* Column 1: Chevron + Root info */}
                <div className="min-w-0 flex items-center gap-3">
                    <span className="shrink-0 text-muted-foreground">
                        {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-sm font-bold text-primary">
                                {root.ma_nhom}
                            </span>
                            <span className="text-sm font-semibold truncate">
                                {root.ten_nhom}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                · {children.length} mục con
                            </span>
                        </div>
                    </div>
                </div>

                {/* Column 2: Classification badge */}
                <div>
                    {classStyle && (
                        <Badge variant="outline" className={cn("text-xs font-medium", classStyle.className)}>
                            {classStyle.label}
                        </Badge>
                    )}
                </div>

                {/* Column 3: Aggregated quota progress */}
                <QuotaProgressBar
                    current={totalEquipment}
                    max={hasUnknownQuota ? null : totalQuota}
                />

                {/* Column 4: Actions */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={mutatingCategoryId === root.id}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEdit(root)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => onDelete(root)}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Xóa
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Children */}
            {!isCollapsed && children.length > 0 && (
                <div className="divide-y divide-border/50">
                    {children.map((child) => (
                        <CategoryChildRow
                            key={child.id}
                            category={child}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            isMutating={mutatingCategoryId === child.id}
                            aggregatedCount={aggregatedCounts.get(child.id) ?? child.so_luong_hien_co}
                            isLeaf={leafIds.has(child.id)}
                            isExpanded={expandedCategoryId === child.id}
                            onToggleExpand={onToggleExpand}
                            donViId={donViId}
                        />
                    ))}
                </div>
            )}
        </div>
    )
})

export { CategoryGroup }
export type { CategoryGroupProps }
