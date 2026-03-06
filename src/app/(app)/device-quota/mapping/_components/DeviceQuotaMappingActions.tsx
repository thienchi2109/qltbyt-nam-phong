"use client"

import * as React from "react"
import { Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDeviceQuotaMappingContext } from "../_hooks/useDeviceQuotaMappingContext"
import { MappingPreviewDialog } from "./MappingPreviewDialog"

/**
 * Action bar for bulk mapping operations.
 * Shows selected equipment count and provides "Phân loại" button to open preview dialog.
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
  } = useDeviceQuotaMappingContext()

  const [showPreview, setShowPreview] = React.useState(false)

  const selectedCount = selectedEquipmentIds.size
  const canLink = selectedCount > 0 && selectedCategoryId !== null

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
        {
          thiet_bi_ids: confirmedIds,
          nhom_id: selectedCategoryId,
        },
        {
          onSuccess: () => {
            setShowPreview(false)
          },
        }
      )
    },
    [selectedCategoryId, linkEquipment]
  )

  // Don't render if nothing selected
  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      <div className="sticky bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center justify-between gap-4 py-3 md:py-4">
          {/* Selected count */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {selectedCount} thiết bị đã chọn
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleOpenPreview}
              disabled={!canLink || isLinking}
              size="sm"
              className="touch-target-sm"
            >
              <Link className="h-4 w-4" />
              {isLinking ? "Đang xử lý..." : "Phân loại"}
            </Button>
          </div>
        </div>
      </div>

      <MappingPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        selectedIds={selectedEquipmentIds}
        targetCategory={targetCategory}
        onConfirm={handleConfirm}
        isLinking={isLinking}
        donViId={donViId}
      />
    </>
  )
}
