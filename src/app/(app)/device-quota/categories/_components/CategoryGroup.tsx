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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { CLASSIFICATION_STYLES } from "./category-tree-utils"
import type { CategoryListItem } from "../_types/categories"

// ============================================
// Child Row
// ============================================

interface CategoryChildRowProps {
    category: CategoryListItem
    onEdit: (category: CategoryListItem) => void
    onDelete: (category: CategoryListItem) => void
    isMutating: boolean
}

const CategoryChildRow = React.memo(function CategoryChildRow({
    category,
    onEdit,
    onDelete,
    isMutating,
}: CategoryChildRowProps) {
    const [isExpanded, setIsExpanded] = React.useState(false)
    const classStyle = CLASSIFICATION_STYLES[category.phan_loai || ""] ?? null
    const isLongText = (category.ten_nhom?.length ?? 0) > 80

    return (
        <div
            className={cn(
                "group relative flex items-start gap-3 rounded-md border border-transparent px-3 py-2.5 transition-all duration-150",
                "hover:bg-accent/50 hover:border-border/50"
            )}
            style={{ paddingLeft: `${Math.max(0, category.level - 2) * 20 + 16}px` }}
        >
            {/* Tree connector line */}
            {category.level > 2 && (
                <div
                    className="absolute top-0 bottom-0 border-l-2 border-muted-foreground/15"
                    style={{ left: `${Math.max(0, category.level - 3) * 20 + 20}px` }}
                    aria-hidden="true"
                />
            )}

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-primary/80 shrink-0">
                        {category.ma_nhom}
                    </span>
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span
                                    className={cn(
                                        "text-sm text-foreground/80 cursor-default",
                                        !isExpanded && "line-clamp-2"
                                    )}
                                    onClick={isLongText ? () => setIsExpanded(!isExpanded) : undefined}
                                    role={isLongText ? "button" : undefined}
                                    tabIndex={isLongText ? 0 : undefined}
                                    onKeyDown={
                                        isLongText
                                            ? (e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault()
                                                    setIsExpanded(!isExpanded)
                                                }
                                            }
                                            : undefined
                                    }
                                >
                                    {category.ten_nhom}
                                </span>
                            </TooltipTrigger>
                            {isLongText && !isExpanded && (
                                <TooltipContent
                                    side="bottom"
                                    align="start"
                                    className="max-w-md text-xs"
                                >
                                    {category.ten_nhom}
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                </div>
                {isExpanded && category.mo_ta && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                        {category.mo_ta}
                    </p>
                )}
            </div>

            {/* Right side: badges + actions */}
            <div className="flex items-center gap-2 shrink-0">
                {classStyle && (
                    <Badge variant="outline" className={cn("text-xs font-medium", classStyle.className)}>
                        {classStyle.label}
                    </Badge>
                )}
                <Badge variant="secondary" className="tabular-nums text-xs">
                    {category.so_luong_hien_co}
                </Badge>

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
        </div>
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
}

const CategoryGroup = React.memo(function CategoryGroup({
    root,
    children,
    onEdit,
    onDelete,
    mutatingCategoryId,
}: CategoryGroupProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(false)
    const classStyle = CLASSIFICATION_STYLES[root.phan_loai || ""] ?? null
    const totalEquipment = children.reduce((sum, c) => sum + c.so_luong_hien_co, 0) + root.so_luong_hien_co

    return (
        <div className="rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-sm">
            {/* Group Header */}
            <div
                className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer select-none",
                    "bg-muted/50 border-l-4 border-l-primary/60",
                    "hover:bg-muted/80 transition-colors"
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
                {/* Chevron */}
                <span className="shrink-0 text-muted-foreground">
                    {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronDown className="h-4 w-4" />
                    )}
                </span>

                {/* Root info */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-primary">
                            {root.ma_nhom}
                        </span>
                        <span className="text-sm font-semibold truncate">
                            {root.ten_nhom}
                        </span>
                    </div>
                </div>

                {/* Right side: meta */}
                <div className="flex items-center gap-2 shrink-0">
                    {classStyle && (
                        <Badge variant="outline" className={cn("text-xs font-medium", classStyle.className)}>
                            {classStyle.label}
                        </Badge>
                    )}
                    <Badge variant="secondary" className="tabular-nums text-xs">
                        {totalEquipment} TB
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        {children.length} mục con
                    </span>

                    {/* Actions (stop propagation to avoid collapse toggle) */}
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
                        />
                    ))}
                </div>
            )}
        </div>
    )
})

export { CategoryGroup }
export type { CategoryGroupProps }
