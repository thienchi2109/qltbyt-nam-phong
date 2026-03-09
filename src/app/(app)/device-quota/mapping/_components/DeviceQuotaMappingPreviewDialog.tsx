"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Folder, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { callRpc } from "@/lib/rpc-client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Category } from "./DeviceQuotaMappingContext"
import {
    MappingPreviewCountBadge,
    MappingPreviewLoadingState,
    MappingPreviewEquipmentItem,
    type EquipmentPreviewItem,
} from "./MappingPreviewPrimitives"

// ============================================
// Types
// ============================================

const EMPTY_EQUIPMENT_LIST: EquipmentPreviewItem[] = []

export interface DeviceQuotaMappingPreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedIds: Set<number>
    targetCategory: Category | null
    onConfirm: (confirmedIds: number[]) => void
    isLinking: boolean
    donViId: number | null
}

// ============================================
// Sub-components
// ============================================

function CategoryCard({ category }: { category: Category }) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted/50 p-4 text-center min-w-[160px] max-w-[200px]"
            data-testid="category-card"
        >
            <Folder className="h-8 w-8 text-primary/70" />
            <span className="text-xs text-muted-foreground">Gán vào danh mục:</span>
            <span className="text-sm font-bold">{category.ma_nhom}</span>
            <span className="text-sm">{category.ten_nhom}</span>
            <Badge variant="secondary">Cấp {category.level}</Badge>
        </div>
    )
}

// EquipmentPreviewItem and EquipmentSkeletonList extracted to MappingPreviewPrimitives.tsx

// ============================================
// SVG Connectors
// ============================================

function SvgConnectors({
    categoryRef,
    itemRefs,
    containerRef,
    scrollRef,
    excludedIds,
    itemCount,
}: {
    categoryRef: React.RefObject<HTMLDivElement | null>
    itemRefs: React.RefObject<Map<number, HTMLDivElement>>
    containerRef: React.RefObject<HTMLDivElement | null>
    scrollRef: React.RefObject<HTMLDivElement | null>
    excludedIds: Set<number>
    /** Drives effect re-run when equipment items finish loading */
    itemCount: number
}) {
    const [paths, setPaths] = React.useState<
        { id: number; d: string; excluded: boolean }[]
    >([])

    React.useLayoutEffect(() => {
        function recalculate() {
            const container = containerRef.current
            const catEl = categoryRef.current
            const items = itemRefs.current
            if (!container || !catEl || !items) return

            const containerRect = container.getBoundingClientRect()
            const catRect = catEl.getBoundingClientRect()
            const startX = catRect.right - containerRect.left
            const startY = catRect.top + catRect.height / 2 - containerRect.top

            const newPaths: typeof paths = []
            items.forEach((el, id) => {
                const elRect = el.getBoundingClientRect()
                const endX = elRect.left - containerRect.left
                const endY = elRect.top + elRect.height / 2 - containerRect.top
                const cpOffset = Math.min(60, Math.abs(endX - startX) * 0.4)
                const d = `M ${startX},${startY} C ${startX + cpOffset},${startY} ${endX - cpOffset},${endY} ${endX},${endY}`
                newPaths.push({ id, d, excluded: excludedIds.has(id) })
            })
            setPaths(newPaths)
        }

        recalculate()

        const observer = new ResizeObserver(recalculate)
        if (containerRef.current) observer.observe(containerRef.current)

        // Recalculate on scroll so lines track equipment items
        const scrollEl = scrollRef.current
        scrollEl?.addEventListener('scroll', recalculate, { passive: true })

        return () => {
            observer.disconnect()
            scrollEl?.removeEventListener('scroll', recalculate)
        }
    }, [categoryRef, itemRefs, containerRef, scrollRef, excludedIds, itemCount])

    if (paths.length === 0) return null

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
        >
            {paths.map(({ id, d, excluded }) => (
                <path
                    key={id}
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className={cn(
                        "text-primary/40 transition-opacity",
                        excluded && "opacity-30"
                    )}
                    strokeDasharray={excluded ? "6 4" : undefined}
                />
            ))}
        </svg>
    )
}

// ============================================
// Main Dialog Component
// ============================================

/**
 * Preview confirmation dialog for equipment-to-category mapping.
 * Shows a mapping diagram with category on the left and equipment list on the right,
 * connected by SVG bezier curves. Users can exclude/restore individual items before confirming.
 */
export function DeviceQuotaMappingPreviewDialog({
    open,
    onOpenChange,
    selectedIds,
    targetCategory,
    onConfirm,
    isLinking,
    donViId,
}: DeviceQuotaMappingPreviewDialogProps) {
    const [excludedIds, setExcludedIds] = React.useState<Set<number>>(new Set())

    // Reset excluded items whenever the dialog opens
    React.useEffect(() => {
        if (open) setExcludedIds(new Set())
    }, [open])

    // Reset parent open state if targetCategory disappears while dialog is open
    React.useEffect(() => {
        if (open && !targetCategory) {
            onOpenChange(false)
        }
    }, [open, targetCategory, onOpenChange])

    // Fetch full equipment details for selected IDs
    const idsArray = React.useMemo(() => Array.from(selectedIds), [selectedIds])

    const { data: equipment, isLoading } = useQuery({
        queryKey: ["dinh_muc_thiet_bi_by_ids", { ids: idsArray, donViId }],
        queryFn: () =>
            callRpc<EquipmentPreviewItem[]>({
                fn: "dinh_muc_thiet_bi_by_ids",
                args: { p_thiet_bi_ids: idsArray, p_don_vi: donViId },
            }),
        enabled: open && idsArray.length > 0 && donViId !== null,
    })

    const equipmentList = equipment ?? EMPTY_EQUIPMENT_LIST
    const activeCount = equipmentList.filter(
        (eq) => !excludedIds.has(eq.id)
    ).length

    // Refs for SVG connectors
    const containerRef = React.useRef<HTMLDivElement>(null)
    const categoryRef = React.useRef<HTMLDivElement>(null)
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const itemRefsMap = React.useRef<Map<number, HTMLDivElement>>(new Map())

    const toggleExclude = React.useCallback((id: number) => {
        setExcludedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }, [])

    const handleConfirm = React.useCallback(() => {
        const confirmedIds = equipmentList
            .filter((eq) => !excludedIds.has(eq.id))
            .map((eq) => eq.id)
        onConfirm(confirmedIds)
    }, [equipmentList, excludedIds, onConfirm])

    const handleCancel = React.useCallback(() => {
        onOpenChange(false)
    }, [onOpenChange])

    if (!targetCategory) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        Xác nhận phân loại thiết bị
                    </DialogTitle>
                    <DialogDescription>
                        Vui lòng kiểm tra lại trước khi lưu
                    </DialogDescription>
                </DialogHeader>

                {/* Active count badge */}
                <MappingPreviewCountBadge count={activeCount} label="thiết bị đã chọn" />

                {/* Mapping diagram */}
                <div
                    ref={containerRef}
                    className="relative flex flex-row items-start gap-6 min-h-[200px]"
                >
                    {/* Category card (left) */}
                    <div
                        ref={categoryRef}
                        className="flex-shrink-0 self-center hidden md:block"
                    >
                        <CategoryCard category={targetCategory} />
                    </div>

                    {/* Mobile category card (stacked, no SVG) */}
                    <div className="md:hidden w-full mb-2">
                        <CategoryCard category={targetCategory} />
                    </div>

                    {/* SVG connectors (desktop only) */}
                    <SvgConnectors
                        categoryRef={categoryRef}
                        itemRefs={itemRefsMap}
                        containerRef={containerRef}
                        scrollRef={scrollRef}
                        excludedIds={excludedIds}
                        itemCount={equipmentList.length}
                    />

                    {/* Equipment list (right) */}
                    <div ref={scrollRef} className="flex-1 overflow-y-auto max-h-[350px] space-y-2 relative z-10">
                        {isLoading ? (
                            <MappingPreviewLoadingState />
                        ) : (
                            equipmentList.map((item) => (
                                <div
                                    key={item.id}
                                    ref={(el) => {
                                        if (el) {
                                            itemRefsMap.current.set(item.id, el)
                                        } else {
                                            itemRefsMap.current.delete(item.id)
                                        }
                                    }}
                                >
                                    <MappingPreviewEquipmentItem
                                        item={item}
                                        isExcluded={excludedIds.has(item.id)}
                                        onToggle={() => toggleExclude(item.id)}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel}>
                        Hủy
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={activeCount === 0 || isLinking}
                    >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {isLinking ? "Đang xử lý..." : "Xác nhận phân loại"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
