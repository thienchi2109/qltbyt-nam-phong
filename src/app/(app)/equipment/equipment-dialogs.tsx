"use client"

import * as React from "react"

import { AddEquipmentDialog } from "@/components/add-equipment-dialog"
import { ImportEquipmentDialog } from "@/components/import-equipment-dialog"
import { EditEquipmentDialog } from "@/components/edit-equipment-dialog"
import { EquipmentDetailDialog } from "@/components/equipment/equipment-detail-dialog"
import { StartUsageDialog } from "@/components/start-usage-dialog"
import { EndUsageDialog } from "@/components/end-usage-dialog"
import type { Equipment, UsageLog } from "@/types/database"
import type { TenantBranding } from "@/hooks/use-tenant-branding"
import type { SessionUser } from "./use-equipment-page"

export interface EquipmentDialogsProps {
  // Add dialog
  isAddDialogOpen: boolean
  setIsAddDialogOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Import dialog
  isImportDialogOpen: boolean
  setIsImportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Edit dialog
  editingEquipment: Equipment | null
  setEditingEquipment: React.Dispatch<React.SetStateAction<Equipment | null>>

  // Detail dialog
  selectedEquipment: Equipment | null
  isDetailModalOpen: boolean
  setIsDetailModalOpen: React.Dispatch<React.SetStateAction<boolean>>

  // Usage dialogs
  isStartUsageDialogOpen: boolean
  setIsStartUsageDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  startUsageEquipment: Equipment | null
  setStartUsageEquipment: React.Dispatch<React.SetStateAction<Equipment | null>>
  isEndUsageDialogOpen: boolean
  setIsEndUsageDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  endUsageLog: UsageLog | null
  setEndUsageLog: React.Dispatch<React.SetStateAction<UsageLog | null>>

  // Callbacks
  onSuccess: () => void
  onGenerateProfileSheet: (equipment: Equipment) => Promise<void>
  onGenerateDeviceLabel: (equipment: Equipment) => Promise<void>

  // Context
  user: SessionUser | null
  isRegionalLeader: boolean
  tenantBranding: TenantBranding | undefined
}

export function EquipmentDialogs({
  isAddDialogOpen,
  setIsAddDialogOpen,
  isImportDialogOpen,
  setIsImportDialogOpen,
  editingEquipment,
  setEditingEquipment,
  selectedEquipment,
  isDetailModalOpen,
  setIsDetailModalOpen,
  isStartUsageDialogOpen,
  setIsStartUsageDialogOpen,
  startUsageEquipment,
  setStartUsageEquipment,
  isEndUsageDialogOpen,
  setIsEndUsageDialogOpen,
  endUsageLog,
  setEndUsageLog,
  onSuccess,
  onGenerateProfileSheet,
  onGenerateDeviceLabel,
  user,
  isRegionalLeader,
  tenantBranding,
}: EquipmentDialogsProps) {
  return (
    <>
      <AddEquipmentDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={onSuccess}
      />

      <ImportEquipmentDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSuccess={onSuccess}
      />

      <EditEquipmentDialog
        open={!!editingEquipment}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEquipment(null)
          }
        }}
        onSuccess={() => {
          setEditingEquipment(null)
          onSuccess()
        }}
        equipment={editingEquipment}
      />

      <EquipmentDetailDialog
        equipment={selectedEquipment}
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
        user={user}
        isRegionalLeader={isRegionalLeader}
        onGenerateProfileSheet={onGenerateProfileSheet}
        onGenerateDeviceLabel={onGenerateDeviceLabel}
        onEquipmentUpdated={onSuccess}
      />

      <StartUsageDialog
        open={isStartUsageDialogOpen}
        onOpenChange={(open) => {
          setIsStartUsageDialogOpen(open)
          if (!open) {
            setStartUsageEquipment(null)
          }
        }}
        equipment={startUsageEquipment}
      />

      <EndUsageDialog
        open={isEndUsageDialogOpen}
        onOpenChange={(open) => {
          setIsEndUsageDialogOpen(open)
          if (!open) setEndUsageLog(null)
        }}
        usageLog={endUsageLog}
      />
    </>
  )
}
