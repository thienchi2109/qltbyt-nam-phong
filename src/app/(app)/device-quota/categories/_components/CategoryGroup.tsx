"use client"

import * as React from "react"
import {
    ChevronDown,
    ChevronRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CategoryActionMenu } from "./CategoryActionMenu"
import { CATEGORY_GRID_COLS, CLASSIFICATION_STYLES, type AggregatedQuota } from "./category-tree-utils"
import { QuotaProgressBar } from "./QuotaProgressBar"
import type { CategoryListItem } from "../_types/categories"

function quotaLabel(current: number, max: number | null) {
    return `${current}/${max ?? "–"}`
}

function categorySelectLabel(
    category: CategoryListItem,
    classLabel: string | null,
    quotaText: string
) {
    return [
        `Chọn danh mục ${category.ma_nhom}: ${category.ten_nhom}`,
        classLabel,
        `Tình trạng ${quotaText}`,
    ].filter(Boolean).join(" · ")
}

// ============================================
// Child Row
// ============================================

interface CategoryChildRowProps {
    category: CategoryListItem
    onEdit: (category: CategoryListItem) => void
    onDelete: (category: CategoryListItem) => void
    isMutating: boolean
    aggregatedCount: number
    aggregatedQuota: AggregatedQuota | undefined
    isLeaf: boolean
    isSelected: boolean
    onSelectCategory: (category: CategoryListItem) => void
}

const CategoryChildRow = React.memo(function CategoryChildRow({
    category,
    onEdit,
    onDelete,
    isMutating,
    aggregatedCount,
    aggregatedQuota,
    isLeaf,
    isSelected,
    onSelectCategory,
}: CategoryChildRowProps) {
    const classStyle = CLASSIFICATION_STYLES[category.phan_loai || ""] ?? null

    const indentPx = Math.max(0, category.level - 2) * 20

    const quotaMax = aggregatedQuota?.hasUnknown ? null : (aggregatedQuota?.total ?? category.so_luong_toi_da)
    const quotaText = quotaLabel(aggregatedCount, quotaMax)
    const selectLabel = categorySelectLabel(category, classStyle?.label ?? null, quotaText)

    const selectCategory = () => onSelectCategory(category)

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={selectLabel}
            aria-pressed={isSelected}
            title={category.ten_nhom}
            onClick={selectCategory}
            onKeyDown={(event) => {
                if (event.target !== event.currentTarget) {
                    return
                }
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    selectCategory()
                }
            }}
            className={cn(
                "group relative cursor-pointer rounded-md border border-transparent px-4 py-2.5 transition-all duration-150",
                "hover:bg-accent/50 hover:border-border/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected && "border-primary/30 bg-primary/5 ring-1 ring-primary/20",
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
                    <span className="shrink-0 text-sm font-semibold text-primary/80">
                        {category.ma_nhom}
                    </span>
                    <span className="line-clamp-2 text-sm text-foreground/80">
                        {category.ten_nhom}
                    </span>
                </div>
                {category.mo_ta && (
                    <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">
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

            {/* Column 3: Quota progress bar */}
            <div aria-label={isLeaf ? "Danh mục lá" : "Danh mục cha"}>
                <QuotaProgressBar
                    current={aggregatedCount}
                    max={quotaMax}
                />
            </div>

            {/* Column 4: Actions */}
            <CategoryActionMenu
                category={category}
                disabled={isMutating}
                onEdit={onEdit}
                onDelete={onDelete}
                className="opacity-100 transition-opacity focus-visible:opacity-100"
            />
        </div>
    )
})

// ============================================
// Group (Root header + children)
// ============================================

interface CategoryGroupProps {
    root: CategoryListItem
    childCategories: CategoryListItem[]
    onEdit: (category: CategoryListItem) => void
    onDelete: (category: CategoryListItem) => void
    mutatingCategoryId: number | null
    aggregatedCounts: Map<number, number>
    aggregatedQuotas: Map<number, AggregatedQuota>
    leafIds: Set<number>
    selectedCategoryId: number | null
    onSelectCategory: (category: CategoryListItem) => void
}

const CategoryGroup = React.memo(function CategoryGroup({
    root,
    childCategories,
    onEdit,
    onDelete,
    mutatingCategoryId,
    aggregatedCounts,
    aggregatedQuotas,
    leafIds,
    selectedCategoryId,
    onSelectCategory,
}: CategoryGroupProps) {
    const [isCollapsed, setIsCollapsed] = React.useState(false)
    const classStyle = CLASSIFICATION_STYLES[root.phan_loai || ""] ?? null

    // Use aggregated values from full-tree computation — same scope for both
    const totalEquipment = aggregatedCounts.get(root.id) ?? root.so_luong_hien_co
    const rootQuota = aggregatedQuotas.get(root.id)
    const hasUnknownQuota = rootQuota?.hasUnknown ?? true
    const totalQuota = rootQuota?.total ?? 0
    const quotaMax = hasUnknownQuota ? null : totalQuota
    const rootQuotaText = quotaLabel(totalEquipment, quotaMax)
    const rootSelectLabel = categorySelectLabel(root, classStyle?.label ?? null, rootQuotaText)
    const rootSelected = selectedCategoryId === root.id
    const toggleLabel = `${isCollapsed ? "Mở rộng" : "Thu gọn"} nhóm ${root.ma_nhom}: ${root.ten_nhom}`

    const selectRoot = () => onSelectCategory(root)

    return (
        <div className="rounded-lg border bg-card overflow-hidden transition-shadow hover:shadow-sm">
            {/* Group Header */}
            <div
                className={cn(
                    "group select-none px-4 py-3",
                    "bg-muted/50 ring-1 ring-inset ring-primary/20",
                    "hover:bg-muted/80 transition-colors",
                    rootSelected && "bg-primary/5 ring-primary/40",
                    CATEGORY_GRID_COLS
                )}
            >
                {/* Column 1: Chevron + Root info */}
                <div className="min-w-0 flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground"
                        onClick={() => setIsCollapsed((current) => !current)}
                        aria-expanded={!isCollapsed}
                        aria-label={toggleLabel}
                    >
                        {isCollapsed ? (
                            <ChevronRight className="size-4" />
                        ) : (
                            <ChevronDown className="size-4" />
                        )}
                    </Button>
                    <div
                        role="button"
                        tabIndex={0}
                        aria-label={rootSelectLabel}
                        aria-pressed={rootSelected}
                        title={root.ten_nhom}
                        onClick={selectRoot}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                selectRoot()
                            }
                        }}
                        className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <div className="flex items-baseline gap-2">
                            <span className="text-sm font-bold text-primary">
                                {root.ma_nhom}
                            </span>
                            <span className="line-clamp-2 text-sm font-semibold">
                                {root.ten_nhom}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                · {childCategories.length} mục con
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
                <div aria-label={leafIds.has(root.id) ? "Danh mục lá" : "Danh mục cha"}>
                    <QuotaProgressBar
                        current={totalEquipment}
                        max={quotaMax}
                    />
                </div>

                {/* Column 4: Actions */}
                <CategoryActionMenu
                    category={root}
                    disabled={mutatingCategoryId === root.id}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            </div>

            {/* Children */}
            {!isCollapsed && childCategories.length > 0 && (
                <div className="divide-y divide-border/50">
                    {childCategories.map((child) => (
                        <div key={child.id}>
                            <CategoryChildRow
                                category={child}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                isMutating={mutatingCategoryId === child.id}
                                aggregatedCount={aggregatedCounts.get(child.id) ?? child.so_luong_hien_co}
                                aggregatedQuota={aggregatedQuotas.get(child.id)}
                                isLeaf={leafIds.has(child.id)}
                                isSelected={selectedCategoryId === child.id}
                                onSelectCategory={onSelectCategory}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
})

export { CategoryGroup }
