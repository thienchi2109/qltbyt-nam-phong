"use client"

import * as React from "react"

import { AddEquipmentDialog } from "@/components/add-equipment-dialog"
import { LinkedRequestSheetHost } from "@/components/equipment-linked-request"
import { ImportEquipmentDialog } from "@/components/import-equipment-dialog"
import { StartUsageDialog } from "@/components/start-usage-dialog"
import { EndUsageDialog } from "@/components/end-usage-dialog"
import type { Equipment } from "@/types/database"
import type { TenantBranding } from "@/hooks/use-tenant-branding"
import { EquipmentDetailDialog } from "./_components/EquipmentDetailDialog"
import { EquipmentDeleteDialog } from "./_components/EquipmentDeleteDialog"
import { useEquipmentContext } from "./_hooks/useEquipmentContext"
import { isPlacedEquipment, type EquipmentDataset } from "./_hooks/equipmentDataset"
import type { EquipmentFormValues } from "@/components/equipment-edit/EquipmentEditTypes"

// ============================================
// Props - Minimal props for export handlers only
// ============================================
export interface EquipmentDialogsProps {
  onGenerateProfileSheet: (equipment: Equipment) => Promise<void>
  onGenerateDeviceLabel: (equipment: Equipment) => Promise<void>
  tenantBranding: TenantBranding | undefined
}

// ============================================
// Component - Consumes context for dialog state
// ============================================
/** Renders the equipment CRUD and usage dialogs owned by the page context. */
export const EquipmentDialogs = React.memo(function EquipmentDialogs({
  onGenerateProfileSheet,
  onGenerateDeviceLabel,
  tenantBranding,
}: EquipmentDialogsProps) {
  const {
    user,
    isRegionalLeader,
    dialogState,
    closeAddDialog,
    closeImportDialog,
    closeDetailDialog,
    closeStartUsageDialog,
    closeEndUsageDialog,
    onDataMutationSuccess,
  } = useEquipmentContext()

  const detailDatasetRef = React.useRef<{
    equipmentId: number
    dataset: EquipmentDataset
  } | null>(null)
  React.useEffect(() => {
    const equipment = dialogState.detailEquipment
    if (!equipment) {
      detailDatasetRef.current = null
      return
    }
    if (detailDatasetRef.current?.equipmentId !== equipment.id) {
      detailDatasetRef.current = {
        equipmentId: equipment.id,
        dataset: isPlacedEquipment(equipment.nguon_kinh_phi) ? "placed" : "regular",
      }
    }
  }, [dialogState.detailEquipment])

  const handleEquipmentUpdated = React.useCallback(
    (savedPatch?: Partial<EquipmentFormValues>) => {
      const detailEquipment = dialogState.detailEquipment
      const trackedDataset = detailDatasetRef.current
      const sourceDataset: EquipmentDataset =
        trackedDataset && trackedDataset.equipmentId === detailEquipment?.id
          ? trackedDataset.dataset
          : isPlacedEquipment(detailEquipment?.nguon_kinh_phi)
            ? "placed"
            : "regular"
      const destinationDataset =
        savedPatch && "nguon_kinh_phi" in savedPatch
          ? isPlacedEquipment(savedPatch.nguon_kinh_phi)
            ? "placed"
            : "regular"
          : sourceDataset
      if (detailEquipment) {
        detailDatasetRef.current = { equipmentId: detailEquipment.id, dataset: destinationDataset }
      }
      onDataMutationSuccess(
        sourceDataset === destinationDataset ? sourceDataset : [sourceDataset, destinationDataset]
      )
    },
    [dialogState.detailEquipment, onDataMutationSuccess]
  )

  const handleStartUsageClose = React.useCallback(
    (open: boolean) => {
      if (!open) {
        closeStartUsageDialog()
      }
    },
    [closeStartUsageDialog]
  )

  const handleEndUsageClose = React.useCallback(
    (open: boolean) => {
      if (!open) {
        closeEndUsageDialog()
      }
    },
    [closeEndUsageDialog]
  )

  return (
    <>
      <AddEquipmentDialog
        open={dialogState.isAddOpen}
        onOpenChange={(open) => !open && closeAddDialog()}
        onSuccess={onDataMutationSuccess}
      />

      <ImportEquipmentDialog
        open={dialogState.isImportOpen}
        onOpenChange={(open) => !open && closeImportDialog()}
        onSuccess={onDataMutationSuccess}
      />

      <EquipmentDetailDialog
        equipment={dialogState.detailEquipment}
        open={dialogState.isDetailOpen}
        onOpenChange={(open) => !open && closeDetailDialog()}
        user={user}
        isRegionalLeader={isRegionalLeader}
        onGenerateProfileSheet={onGenerateProfileSheet}
        onGenerateDeviceLabel={onGenerateDeviceLabel}
        onEquipmentUpdated={handleEquipmentUpdated}
      />

      <LinkedRequestSheetHost />

      <EquipmentDeleteDialog />

      <StartUsageDialog
        open={dialogState.isStartUsageOpen}
        onOpenChange={handleStartUsageClose}
        equipment={dialogState.startUsageEquipment}
        onSuccess={onDataMutationSuccess}
      />

      <EndUsageDialog
        open={dialogState.isEndUsageOpen}
        onOpenChange={handleEndUsageClose}
        usageLog={dialogState.endUsageLog}
        onSuccess={onDataMutationSuccess}
      />
    </>
  )
})
