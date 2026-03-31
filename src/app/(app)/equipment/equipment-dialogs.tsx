"use client"

import * as React from "react"

import { AddEquipmentDialog } from "@/components/add-equipment-dialog"
import { ImportEquipmentDialog } from "@/components/import-equipment-dialog"
import { EquipmentDetailDialog } from "./_components/EquipmentDetailDialog"
import { EquipmentDeleteDialog } from "./_components/EquipmentDeleteDialog"
import { StartUsageDialog } from "@/components/start-usage-dialog"
import { EndUsageDialog } from "@/components/end-usage-dialog"
import type { Equipment } from "@/types/database"
import type { TenantBranding } from "@/hooks/use-tenant-branding"
import { useEquipmentContext } from "./_hooks/useEquipmentContext"

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
        onEquipmentUpdated={onDataMutationSuccess}
      />

      <EquipmentDeleteDialog />

      <StartUsageDialog
        open={dialogState.isStartUsageOpen}
        onOpenChange={handleStartUsageClose}
        equipment={dialogState.startUsageEquipment}
      />

      <EndUsageDialog
        open={dialogState.isEndUsageOpen}
        onOpenChange={handleEndUsageClose}
        usageLog={dialogState.endUsageLog}
      />
    </>
  )
})
