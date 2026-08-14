"use client"

import * as React from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DeviceQuotaManualMappingEquipmentList } from "../../_components/manual-mapping/DeviceQuotaManualMappingEquipmentList"
import { DeviceQuotaManualMappingPreviewTrigger } from "../../_components/manual-mapping/DeviceQuotaManualMappingPreviewTrigger"
import { useDeviceQuotaManualMappingEquipment } from "../../_hooks/useDeviceQuotaManualMappingEquipment"
import { DeviceQuotaMappingPreviewDialog } from "../../mapping/_components/DeviceQuotaMappingPreviewDialog"
import type { CategoryListItem } from "../_types/categories"
import { useDeviceQuotaCategoryAssignment } from "../_hooks/useDeviceQuotaCategoryAssignment"

type DeviceQuotaCategoryAssignmentPaneProps = {
  category: CategoryListItem
  donViId: number | null
  isFacilitySelected: boolean
  onCancel: () => void
  onReconciled: (confirmedIds: number[]) => void
}

/** Renders route-agnostic manual mapping inside the selected Categories context. */
export function DeviceQuotaCategoryAssignmentPane({
  category,
  donViId,
  isFacilitySelected,
  onCancel,
  onReconciled,
}: DeviceQuotaCategoryAssignmentPaneProps) {
  const [showPreview, setShowPreview] = React.useState(false)
  const [assignmentDonViId] = React.useState(donViId)
  const manualMapping = useDeviceQuotaManualMappingEquipment({ donViId: assignmentDonViId })
  const assignment = useDeviceQuotaCategoryAssignment({
    clearEquipmentSelection: manualMapping.clearEquipmentSelection,
    onReconciled,
  })
  const selectedCount = manualMapping.selectedEquipmentIds.size

  const handleConfirm = React.useCallback(
    (confirmedIds: number[]) => {
      assignment.mutate(
        {
          thiet_bi_ids: confirmedIds,
          nhom_id: category.id,
          donViId: assignmentDonViId,
        },
        {
          onSuccess: () => setShowPreview(false),
        }
      )
    },
    [assignment, assignmentDonViId, category.id]
  )

  return (
    <div
      data-testid="device-quota-category-assignment-pane"
      className="flex min-h-0 flex-col gap-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Phân loại thiết bị vào danh mục</p>
          <h2 className="truncate text-base font-semibold" title={category.ten_nhom}>
            {category.ma_nhom} · {category.ten_nhom}
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={assignment.isPending}>
          <ArrowLeft className="size-4" />
          Quay lại chi tiết
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <DeviceQuotaManualMappingEquipmentList
          unassignedEquipment={manualMapping.unassignedEquipment}
          totalEquipmentCount={manualMapping.totalEquipmentCount}
          selectedEquipmentIds={manualMapping.selectedEquipmentIds}
          toggleEquipmentSelection={manualMapping.toggleEquipmentSelection}
          selectAllEquipment={manualMapping.selectAllEquipment}
          deselectPageEquipment={manualMapping.deselectPageEquipment}
          filters={manualMapping.filters}
          filterOptions={manualMapping.filterOptions}
          pagination={manualMapping.pagination}
          isLoading={manualMapping.isLoading}
          isFacilitySelected={isFacilitySelected}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-sm font-medium">{selectedCount} thiết bị đã chọn</span>
        <DeviceQuotaManualMappingPreviewTrigger
          canOpenPreview={selectedCount > 0}
          isLinking={assignment.isPending}
          onOpenPreview={() => setShowPreview(true)}
        />
      </div>

      <DeviceQuotaMappingPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        selectedIds={manualMapping.selectedEquipmentIds}
        targetCategory={category}
        onConfirm={handleConfirm}
        isLinking={assignment.isPending}
        donViId={assignmentDonViId}
      />
    </div>
  )
}
