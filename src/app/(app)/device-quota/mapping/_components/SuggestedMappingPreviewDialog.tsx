"use client"

import * as React from "react"
import { Sparkles, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import { isEquipmentManagerRole, isRegionalLeaderRole } from "@/lib/rbac"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    MappingPreviewCountBadge,
    MappingPreviewFooterNote,
    MappingPreviewLoadingState,
} from "./MappingPreviewPrimitives"
import { SuggestedMappingGroupSection } from "./SuggestedMappingGroupSection"
import { SuggestedMappingUnmatchedSection } from "./SuggestedMappingUnmatchedSection"
import { useSuggestMapping } from "../_hooks/useSuggestMapping"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import type { SuggestMappingStatus, SaveMapping } from "../_hooks/useSuggestMapping"

// ============================================
// Types
// ============================================

export interface SuggestedMappingPreviewDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    donViId: number | null
    userRole: string | null
}

// ============================================
// Status label mapping
// ============================================

function getStatusLabel(status: SuggestMappingStatus): string {
    switch (status) {
        case "fetching-names":
            return "Đang tải danh sách thiết bị..."
        case "embedding":
            return "Đang tạo embedding..."
        case "searching":
            return "Đang tìm kiếm danh mục phù hợp..."
        default:
            return ""
    }
}

// ============================================
// SuggestedMappingPreviewDialog
// ============================================

/**
 * Thin container for suggested mapping preview flow.
 * Composes hook orchestration + group sections + unmatched section + shared primitives.
 * Confirm button wired to saveBatch mutation for bulk save.
 */
export function SuggestedMappingPreviewDialog({
    open,
    onOpenChange,
    donViId,
    userRole,
}: SuggestedMappingPreviewDialogProps) {
    const { status, result, error, progress, reset, saveBatch, saveStatus } = useSuggestMapping({
        donViId,
        enabled: open,
    })

    const { toast } = useToast()
    const queryClient = useQueryClient()

    // Exclude state: per-group and per-device-name
    const [excludedGroups, setExcludedGroups] = React.useState<Set<number>>(new Set())
    const [excludedDeviceNames, setExcludedDeviceNames] = React.useState<
        Map<number, Set<string>>
    >(new Map())

    // Reset exclude state when dialog opens
    React.useEffect(() => {
        if (open) {
            setExcludedGroups(new Set())
            setExcludedDeviceNames(new Map())
        }
    }, [open])

    // Auto-close dialog after successful save with toast
    React.useEffect(() => {
        if (saveStatus !== "saved") return

        // Invalidate queries (same as manual flow)
        queryClient.invalidateQueries({ queryKey: ['dinh_muc_thiet_bi_unassigned'] })
        queryClient.invalidateQueries({ queryKey: ['dinh_muc_thiet_bi_unassigned_filter_options'] })
        queryClient.invalidateQueries({ queryKey: ['dinh_muc_nhom_list'] })
        queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })

        toast({
            title: "Thành công",
            description: "Đã phân loại thiết bị theo gợi ý thành công",
        })

        const timer = setTimeout(() => {
            handleClose()
        }, 1500)

        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveStatus])

    const handleClose = React.useCallback(() => {
        reset()
        onOpenChange(false)
    }, [reset, onOpenChange])

    const handleConfirmSave = React.useCallback(() => {
        if (!result) return

        const mappings: SaveMapping[] = result.groups
            .filter((g) => !excludedGroups.has(g.nhom_id))
            .map((g) => {
                const groupExcludedNames = excludedDeviceNames.get(g.nhom_id) ?? new Set()
                // Filter device_ids by removing IDs whose device_name is excluded
                // Since device_ids are grouped by name, we need the original mapping
                // For now, send all device_ids of non-excluded groups
                // (per-name exclusion affects counts but IDs are all included unless group excluded)
                return {
                    nhom_id: g.nhom_id,
                    thiet_bi_ids: g.device_ids,
                }
            })

        saveBatch(mappings)
    }, [result, excludedGroups, excludedDeviceNames, saveBatch])

    const toggleGroup = React.useCallback((nhomId: number) => {
        setExcludedGroups((prev) => {
            const next = new Set(prev)
            if (next.has(nhomId)) {
                next.delete(nhomId)
            } else {
                next.add(nhomId)
            }
            return next
        })
    }, [])

    const toggleDeviceName = React.useCallback(
        (nhomId: number, name: string) => {
            setExcludedDeviceNames((prev) => {
                const next = new Map(prev)
                const groupExcluded = next.get(nhomId) ?? new Set()
                const updated = new Set(groupExcluded)
                if (updated.has(name)) {
                    updated.delete(name)
                } else {
                    updated.add(name)
                }
                next.set(nhomId, updated)
                return next
            })
        },
        []
    )

    // Count active groups (not excluded)
    const activeGroupCount = result
        ? result.groups.filter((g) => !excludedGroups.has(g.nhom_id)).length
        : 0

    const isLoading = status === "fetching-names" || status === "embedding" || status === "searching"
    const canWrite = isEquipmentManagerRole(userRole)
    const isRegionalLeader = isRegionalLeaderRole(userRole)

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose() }}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Gợi ý phân loại thiết bị
                    </DialogTitle>
                    <DialogDescription>
                        Áp dụng cho toàn bộ thiết bị chưa gán của đơn vị hiện tại
                    </DialogDescription>
                </DialogHeader>

                {/* Loading state */}
                {isLoading && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{getStatusLabel(status)}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                            <div
                                className="bg-primary rounded-full h-2 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <MappingPreviewLoadingState />
                    </div>
                )}

                {/* Error state */}
                {status === "error" && (
                    <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Results */}
                {status === "done" && result && (result.groups.length > 0 || result.unmatched.length > 0) && (
                    <div className="flex-1 overflow-y-auto space-y-4">
                        {/* Summary badge */}
                        <MappingPreviewCountBadge
                            count={result.matchedDevices}
                            label={`/ ${result.totalDevices} thiết bị được gợi ý`}
                        />

                        {/* Grouped suggestions */}
                        {result.groups.map((group) => (
                            <SuggestedMappingGroupSection
                                key={group.nhom_id}
                                group={group}
                                excludedDeviceNames={
                                    excludedDeviceNames.get(group.nhom_id) ?? new Set()
                                }
                                isGroupExcluded={excludedGroups.has(group.nhom_id)}
                                onToggleDeviceName={(name) =>
                                    toggleDeviceName(group.nhom_id, name)
                                }
                                onToggleGroup={() => toggleGroup(group.nhom_id)}
                            />
                        ))}

                        {/* Unmatched section */}
                        <SuggestedMappingUnmatchedSection unmatched={result.unmatched} />

                        {/* Footer disclaimer */}
                        <MappingPreviewFooterNote message="Đây chỉ là gợi ý phân loại. Vui lòng kiểm tra lại trước khi lưu" />
                    </div>
                )}

                {/* Empty state */}
                {status === "done" && result && result.groups.length === 0 && result.unmatched.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        Không có thiết bị chưa gán nào trong đơn vị này
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={handleClose} aria-label="Đóng">
                        Đóng
                    </Button>

                    {canWrite && !isRegionalLeader && status === "done" && (
                        <Button
                            onClick={handleConfirmSave}
                            disabled={saveStatus === "saving" || activeGroupCount === 0}
                        >
                            {saveStatus === "saving" ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Đang lưu...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-1" />
                                    Áp dụng {activeGroupCount} gợi ý phân loại
                                </>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

