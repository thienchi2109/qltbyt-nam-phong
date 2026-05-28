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

export type SuggestedMappingPreviewDialogProps = Readonly<{
    open: boolean
    onOpenChange: (open: boolean) => void
    donViId: number | null
    userRole: string | null
}>

function getStatusLabel(status: SuggestMappingStatus): string {
    switch (status) {
        case "starting-job":
            return "Đang chuẩn bị gợi ý phân loại..."
        case "processing":
            return "Đang xử lý gợi ý phân loại..."
        default:
            return ""
    }
}

/**
 * Suggested mapping preview dialog with per-open-session exclusion state.
 */
export function SuggestedMappingPreviewDialog({
    open,
    onOpenChange,
    donViId,
    userRole,
}: SuggestedMappingPreviewDialogProps) {
    if (!open) return null

    return (
        <SuggestedMappingPreviewDialogContent
            open={open}
            onOpenChange={onOpenChange}
            donViId={donViId}
            userRole={userRole}
        />
    )
}

function SuggestedMappingPreviewDialogContent({
    open,
    onOpenChange,
    donViId,
    userRole,
}: SuggestedMappingPreviewDialogProps) {
    const {
        canRetry,
        status,
        result,
        error,
        progress,
        processedUniqueNames,
        totalUniqueNames,
        retryFailedJob,
        reset,
        saveBatch,
        saveStatus,
        saveError,
        saveResult,
    } = useSuggestMapping({
        donViId,
        enabled: open,
    })

    const { toast } = useToast()
    const queryClient = useQueryClient()

    const [excludedGroups, setExcludedGroups] = React.useState<Set<number>>(new Set())
    const [excludedDeviceNames, setExcludedDeviceNames] = React.useState<
        Map<number, Set<string>>
    >(new Map())

    const hasNotifiedRef = React.useRef(false)
    const handleCloseRef = React.useRef<() => void>(() => { })

    const handleClose = React.useCallback(() => {
        reset()
        onOpenChange(false)
    }, [reset, onOpenChange])

    handleCloseRef.current = handleClose

    React.useEffect(() => {
        if (saveStatus !== "saved") return
        if (hasNotifiedRef.current) return
        hasNotifiedRef.current = true

        queryClient.invalidateQueries({ queryKey: ['dinh_muc_thiet_bi_unassigned'] })
        queryClient.invalidateQueries({ queryKey: ['dinh_muc_thiet_bi_unassigned_filter_options'] })
        queryClient.invalidateQueries({ queryKey: ['dinh_muc_nhom_list'] })
        queryClient.invalidateQueries({ queryKey: ['dinh_muc_compliance_summary'] })

        toast({
            title: "Thành công",
            description: (() => {
                const skipped = (saveResult?.skipped_already_assigned ?? 0) + (saveResult?.skipped_not_found ?? 0)
                return skipped > 0
                    ? `Đã phân loại thiết bị theo gợi ý thành công. Bỏ qua ${skipped} thiết bị đã được gán hoặc không tìm thấy.`
                    : "Đã phân loại thiết bị theo gợi ý thành công"
            })(),
        })

        const timer = setTimeout(() => {
            handleCloseRef.current()
        }, 1500)

        return () => clearTimeout(timer)
    }, [saveStatus, saveResult, queryClient, toast])

    const handleConfirmSave = React.useCallback(() => {
        if (!result) return

        const mappings: SaveMapping[] = []
        for (const group of result.groups) {
            if (excludedGroups.has(group.nhom_id)) continue

            const groupExcludedNames = excludedDeviceNames.get(group.nhom_id) ?? new Set()
            const filteredIds: number[] = []
            for (const [name, ids] of Object.entries(group.device_name_to_ids)) {
                if (!groupExcludedNames.has(name)) filteredIds.push(...ids)
            }

            if (filteredIds.length > 0) {
                mappings.push({
                    nhom_id: group.nhom_id,
                    thiet_bi_ids: filteredIds,
                })
            }
        }

        if (mappings.length === 0) {
            toast({
                title: "Không có thiết bị để phân loại",
                description: "Tất cả thiết bị đã bị loại bỏ. Vui lòng chọn lại ít nhất một thiết bị.",
                variant: "destructive",
            })
            return
        }
        saveBatch(mappings)
    }, [result, excludedGroups, excludedDeviceNames, saveBatch, toast])

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

    const activeGroupCount = result
        ? result.groups.filter((g) => {
            if (excludedGroups.has(g.nhom_id)) return false
            const groupExcludedNames = excludedDeviceNames.get(g.nhom_id) ?? new Set()
            return g.device_names.some((name) => !groupExcludedNames.has(name))
        }).length
        : 0

    const isLoading = status === "starting-job" || status === "processing"
    const canWrite = isEquipmentManagerRole(userRole)
    const isRegionalLeader = isRegionalLeaderRole(userRole)
    const progressLabel = totalUniqueNames > 0
        ? `${processedUniqueNames} / ${totalUniqueNames} tên thiết bị`
        : `${progress}%`
    const hasResults =
        status === "done" &&
        ((result?.groups.length ?? 0) > 0 || (result?.unmatched.length ?? 0) > 0)
    const isEmptyResult =
        status === "done" &&
        result !== null &&
        result.groups.length === 0 &&
        result.unmatched.length === 0

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose() }}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="size-5 text-primary" />
                        Gợi ý phân loại thiết bị
                    </DialogTitle>
                    <DialogDescription>
                        Áp dụng cho toàn bộ thiết bị chưa gán của đơn vị hiện tại
                    </DialogDescription>
                </DialogHeader>

                {isLoading && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{getStatusLabel(status)}</span>
                            <span>{progressLabel}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                            <div
                                className="bg-primary rounded-full h-2 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Quá trình chỉ tiếp tục khi hộp thoại hoặc phiên làm việc này còn mở.
                        </p>
                        <MappingPreviewLoadingState />
                    </div>
                )}

                {status === "error" && (
                    <div className="space-y-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="size-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                        {canRetry && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={retryFailedJob}
                            >
                                Thử lại
                            </Button>
                        )}
                    </div>
                )}

                {saveStatus === "save-error" && (
                    <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertTriangle className="size-4 shrink-0" />
                        <span>{saveError ?? "Không thể lưu phân loại. Vui lòng thử lại."}</span>
                    </div>
                )}

                {hasResults && result && (
                    <div className="flex-1 overflow-y-auto space-y-4">
                        <MappingPreviewCountBadge
                            count={result.matchedDevices}
                            label={`/ ${result.totalDevices} thiết bị được gợi ý`}
                        />

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

                        <SuggestedMappingUnmatchedSection unmatched={result.unmatched} />

                        <MappingPreviewFooterNote message="Đây chỉ là gợi ý phân loại. Vui lòng kiểm tra lại trước khi lưu" />
                    </div>
                )}

                {isEmptyResult && (
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
                            disabled={saveStatus === "saving" || saveStatus === "saved" || activeGroupCount === 0}
                        >
                            {saveStatus === "saving" ? (
                                <>
                                    <Loader2 className="size-4 mr-1 animate-spin" />
                                    Đang lưu…
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="size-4 mr-1" />
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
