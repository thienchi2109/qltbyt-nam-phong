"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { PackageOpen } from "lucide-react"

import { callRpc } from "@/lib/rpc-client"
import { Badge } from "@/components/ui/badge"
import {
    MappingPreviewLoadingState,
    type EquipmentPreviewItem,
} from "@/app/(app)/device-quota/mapping/_components/MappingPreviewPrimitives"

// ============================================
// Types
// ============================================

interface DeviceQuotaCategoryAssignedEquipmentProps {
    nhomId: number
    donViId: number | null
}

// ============================================
// Status badge styles
// ============================================

const STATUS_STYLES: Record<string, string> = {
    "Hoạt động": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    "Bảo trì": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    "Hỏng": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
}

// ============================================
// Equipment Row
// ============================================

function EquipmentRow({ item }: { item: EquipmentPreviewItem }) {
    const statusStyle = STATUS_STYLES[item.tinh_trang ?? ""] ?? ""

    return (
        <div
            className="grid grid-cols-[5rem_minmax(0,1fr)_6rem_6rem_7rem_5rem] gap-x-3 items-center px-3 py-2 text-xs hover:bg-accent/30 transition-colors"
            data-testid="assigned-equipment-row"
        >
            <span className="font-mono text-muted-foreground truncate">
                {item.ma_thiet_bi}
            </span>
            <span className="font-medium truncate">
                {item.ten_thiet_bi}
            </span>
            <span className="text-muted-foreground truncate">
                {item.model ?? "–"}
            </span>
            <span className="text-muted-foreground truncate">
                {item.serial ?? "–"}
            </span>
            <span className="text-muted-foreground truncate">
                {item.khoa_phong_quan_ly ?? "–"}
            </span>
            <div>
                {item.tinh_trang ? (
                    <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-normal ${statusStyle}`}
                    >
                        {item.tinh_trang}
                    </Badge>
                ) : (
                    <span className="text-muted-foreground">–</span>
                )}
            </div>
        </div>
    )
}

// ============================================
// Column Header
// ============================================

function ColumnHeader() {
    return (
        <div
            className="grid grid-cols-[5rem_minmax(0,1fr)_6rem_6rem_7rem_5rem] gap-x-3 items-center px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide border-b"
            aria-hidden="true"
        >
            <span>Mã TB</span>
            <span>Tên thiết bị</span>
            <span>Model</span>
            <span>Serial</span>
            <span>Khoa phòng</span>
            <span>Tình trạng</span>
        </div>
    )
}

// ============================================
// Main Component
// ============================================

/**
 * Read-only panel showing equipment assigned to a leaf category.
 * Fetches data via the existing dinh_muc_thiet_bi_by_nhom RPC.
 */
export function DeviceQuotaCategoryAssignedEquipment({
    nhomId,
    donViId,
}: DeviceQuotaCategoryAssignedEquipmentProps) {
    const { data: equipment, isLoading } = useQuery({
        queryKey: ["dinh_muc_thiet_bi_by_nhom", { nhomId, donViId }],
        queryFn: () =>
            callRpc<EquipmentPreviewItem[]>({
                fn: "dinh_muc_thiet_bi_by_nhom",
                args: { p_nhom_id: nhomId, p_don_vi: donViId },
            }),
        enabled: !!donViId,
    })

    return (
        <div className="ml-6 mt-1 mb-2 rounded-md border border-border/50 bg-muted/30 border-l-2 border-l-primary/20 overflow-hidden">
            {isLoading ? (
                <div className="p-3">
                    <MappingPreviewLoadingState count={2} />
                </div>
            ) : !equipment || equipment.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <PackageOpen className="h-4 w-4" />
                    <span>Chưa có thiết bị nào được gán</span>
                </div>
            ) : (
                <>
                    <ColumnHeader />
                    <div className="divide-y divide-border/30">
                        {equipment.map((item) => (
                            <EquipmentRow key={item.id} item={item} />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}
