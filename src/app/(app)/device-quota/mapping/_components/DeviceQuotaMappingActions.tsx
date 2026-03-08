"use client"

import * as React from "react"
import { Link, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isEquipmentManagerRole, isRegionalLeaderRole } from "@/lib/rbac"
import { useDeviceQuotaMappingContext } from "../_hooks/useDeviceQuotaMappingContext"
import { DeviceQuotaMappingPreviewDialog } from "./DeviceQuotaMappingPreviewDialog"
import { SuggestedMappingPreviewDialog } from "./SuggestedMappingPreviewDialog"

/**
 * Action bar for bulk mapping operations.
 * Shows selected equipment count and provides "Phân loại" button to open preview dialog.
 * Also shows "Gợi ý phân loại" button when a facility is selected.
 *
 * Usage: Place within DeviceQuotaMappingProvider
 */
export function DeviceQuotaMappingActions() {
  const {
    selectedEquipmentIds,
    selectedCategoryId,
    allCategories,
    linkEquipment,
    isLinking,
    donViId,
    user,
  } = useDeviceQuotaMappingContext()

  const [showPreview, setShowPreview] = React.useState(false)
  const [showSuggested, setShowSuggested] = React.useState(false)

  const selectedCount = selectedEquipmentIds.size
  const canLink = selectedCount > 0 && selectedCategoryId !== null
  const hasFacility = donViId !== null

  // Derive the target category object from allCategories
  const targetCategory = React.useMemo(
    () => allCategories.find((c) => c.id === selectedCategoryId) ?? null,
    [allCategories, selectedCategoryId]
  )

  const handleOpenPreview = () => {
    if (!canLink) return
    setShowPreview(true)
  }

  const handleConfirm = React.useCallback(
    (confirmedIds: number[]) => {
      if (selectedCategoryId === null) return
      linkEquipment.mutate(
        { thiet_bi_ids: confirmedIds, nhom_id: selectedCategoryId },
        { onSuccess: () => setShowPreview(false) }
      )
    },
    [selectedCategoryId, linkEquipment]
  )

  // Keep mounted while dialog is open so .mutate() onSuccess can close it cleanly
  // (context-level onSuccess clears selection before .mutate() onSuccess fires)
  const showSuggestButton = hasFacility && (isEquipmentManagerRole(user?.role) || isRegionalLeaderRole(user?.role))
  if (selectedCount === 0 && !showPreview && !showSuggestButton) {
    return null
  }

  return (
    <>
      <div className="sticky bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between gap-4 py-3 md:py-4">
          {/* Selected count / scope info */}
          <div className="flex items-center gap-2">
            {selectedCount > 0 ? (
              <span className="text-sm font-medium">
                {selectedCount} thiết bị đã chọn
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Áp dụng cho toàn bộ thiết bị chưa gán của đơn vị hiện tại
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {showSuggestButton && (
              <Button
                size="sm"
                className="touch-target-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md hover:from-amber-600 hover:to-orange-600 hover:shadow-lg transition-all duration-200 group"
                onClick={() => setShowSuggested(true)}
              >
                <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
                Gợi ý phân loại
              </Button>
            )}

            {selectedCount > 0 && (
              <Button
                onClick={handleOpenPreview}
                disabled={!canLink || isLinking}
                size="sm"
                className="touch-target-sm"
              >
                <Link className="h-4 w-4" />
                {isLinking ? "Đang xử lý..." : "Phân loại"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <DeviceQuotaMappingPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        selectedIds={selectedEquipmentIds}
        targetCategory={targetCategory}
        onConfirm={handleConfirm}
        isLinking={isLinking}
        donViId={donViId}
      />

      <SuggestedMappingPreviewDialog
        open={showSuggested}
        onOpenChange={setShowSuggested}
        donViId={donViId}
        userRole={user?.role ?? null}
      />
    </>
  )
}
