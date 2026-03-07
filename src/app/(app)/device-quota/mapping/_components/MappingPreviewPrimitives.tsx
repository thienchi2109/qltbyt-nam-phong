"use client"

import * as React from "react"
import { X, Undo2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

// ============================================
// Types
// ============================================

export interface EquipmentPreviewItem {
    id: number
    ma_thiet_bi: string
    ten_thiet_bi: string
    model: string | null
    serial: string | null
    hang_san_xuat: string | null
    khoa_phong_quan_ly: string | null
    tinh_trang: string | null
}

// ============================================
// MappingPreviewCountBadge
// ============================================

export function MappingPreviewCountBadge({
    count,
    label,
}: {
    count: number
    label: string
}) {
    return (
        <div className="text-center">
            <Badge variant="secondary" className="text-sm px-3 py-1">
                {count} {label}
            </Badge>
        </div>
    )
}

// ============================================
// MappingPreviewFooterNote
// ============================================

export function MappingPreviewFooterNote({
    message,
}: {
    message: string
}) {
    return (
        <div
            className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2"
            data-testid="footer-note"
        >
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>{message}</span>
        </div>
    )
}

// ============================================
// MappingPreviewLoadingState
// ============================================

export function MappingPreviewLoadingState({
    count = 3,
}: {
    count?: number
}) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-md border p-3 space-y-2"
                    data-testid="equipment-skeleton"
                >
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex gap-1.5">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-28" />
                    </div>
                </div>
            ))}
        </div>
    )
}

// ============================================
// MappingPreviewEquipmentItem
// ============================================

export function MappingPreviewEquipmentItem({
    item,
    isExcluded,
    onToggle,
}: {
    item: EquipmentPreviewItem
    isExcluded: boolean
    onToggle: () => void
}) {
    return (
        <div
            className={cn(
                "flex items-start justify-between gap-2 rounded-md border p-3 transition-opacity",
                isExcluded && "opacity-50 bg-muted/30"
            )}
            data-testid="equipment-item"
        >
            <div className="flex-1 min-w-0">
                <p
                    className={cn(
                        "text-sm font-semibold truncate",
                        isExcluded && "line-through"
                    )}
                >
                    {item.ten_thiet_bi}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge variant="secondary" className="font-mono text-xs">
                        {item.ma_thiet_bi}
                    </Badge>
                    {item.khoa_phong_quan_ly ? (
                        <Badge variant="outline" className="text-xs">
                            {item.khoa_phong_quan_ly}
                        </Badge>
                    ) : null}
                </div>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={onToggle}
                aria-label={isExcluded ? "Khôi phục" : "Loại bỏ"}
            >
                {isExcluded ? (
                    <Undo2 className="h-4 w-4" />
                ) : (
                    <X className="h-4 w-4 text-destructive" />
                )}
            </Button>
        </div>
    )
}
