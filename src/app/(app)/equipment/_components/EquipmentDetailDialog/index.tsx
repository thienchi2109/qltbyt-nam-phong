/**
 * EquipmentDetailDialog/index.tsx
 *
 * Main entry point for the Equipment Detail Dialog.
 * Full-screen dialog for viewing and editing equipment details.
 * Contains tabs: Details, Attachments, History, Usage.
 *
 * @module equipment/_components/EquipmentDetailDialog
 */

"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Equipment } from "@/types/database"
import { useEquipmentContext } from "../../_hooks/useEquipmentContext"

import {
  equipmentFormSchema,
  type EquipmentFormValues,
  type UserSession,
} from "./EquipmentDetailTypes"
import { isEquipmentManagerRole } from "@/lib/rbac"
import { useEquipmentHistory } from "./hooks/useEquipmentHistory"
import { useEquipmentAttachments } from "./hooks/useEquipmentAttachments"
import { useEquipmentUpdate } from "./hooks/useEquipmentUpdate"
import { EquipmentDetailFooter } from "./EquipmentDetailFooter"
import {
  DEFAULT_EQUIPMENT_FORM_VALUES,
  equipmentToFormValues,
} from "./EquipmentDetailFormDefaults"
import { EquipmentDetailTabs } from "./EquipmentDetailTabs"

export interface EquipmentDetailDialogProps {
  equipment: Equipment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserSession | null
  isRegionalLeader: boolean
  onGenerateProfileSheet: (equipment: Equipment) => void
  onGenerateDeviceLabel: (equipment: Equipment) => void
  onEquipmentUpdated: () => void
}

export function EquipmentDetailDialog({
  equipment,
  open,
  onOpenChange,
  user,
  isRegionalLeader,
  onGenerateProfileSheet,
  onGenerateDeviceLabel,
  onEquipmentUpdated,
}: EquipmentDetailDialogProps): React.ReactNode {
  // Internal state
  const [currentTab, setCurrentTab] = React.useState<string>("details")
  const [isEditingDetails, setIsEditingDetails] = React.useState(false)
  // Store saved values to display after save (equipment prop is stale until dialog reopens)
  const [savedValues, setSavedValues] = React.useState<Partial<EquipmentFormValues> | null>(null)
  // Ref for scrolling active tab into view on mobile
  const tabsScrollRef = React.useRef<HTMLDivElement>(null)
  const { openDeleteDialog } = useEquipmentContext()

  // Scroll active tab into view when tab changes (mobile accessibility)
  React.useEffect(() => {
    const scrollContainer = tabsScrollRef.current
    if (!scrollContainer) return
    const activeTab = scrollContainer.querySelector('[data-state="active"]') as HTMLElement
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [currentTab])

  // Form
  const editForm = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: DEFAULT_EQUIPMENT_FORM_VALUES,
  })

  // Track previous equipment ID to only reset form when viewing different equipment
  const prevEquipmentIdRef = React.useRef<number | null>(null)

  // Clear state when dialog closes to ensure fresh data on reopen
  React.useEffect(() => {
    if (!open) {
      prevEquipmentIdRef.current = null
      setSavedValues(null)
    }
  }, [open])

  // Reset form only when equipment ID changes (new equipment loaded)
  // This prevents form reset when toggling edit mode, preserving user edits after save
  React.useEffect(() => {
    if (equipment && equipment.id !== prevEquipmentIdRef.current) {
      prevEquipmentIdRef.current = equipment.id
      editForm.reset(equipmentToFormValues(equipment))
    }
  }, [equipment, editForm])

  // Custom hooks for data fetching and mutations
  const { history, isLoading: isLoadingHistory } = useEquipmentHistory({
    equipmentId: equipment?.id,
    enabled: open,
  })

  const {
    attachments,
    isLoading: isLoadingAttachments,
    addAttachment,
    deleteAttachment,
    isAdding: isAddingAttachment,
    isDeleting: isDeletingAttachment,
  } = useEquipmentAttachments({
    equipmentId: equipment?.id,
    enabled: open,
  })

  const { updateEquipment, isPending: isUpdating } = useEquipmentUpdate({
    onSuccess: (savedPatch) => {
      setSavedValues((prev) => ({ ...prev, ...savedPatch }))
      setIsEditingDetails(false)
      onEquipmentUpdated()
    },
  })

  // Handlers
  const onSubmitInlineEdit = async (values: EquipmentFormValues): Promise<void> => {
    if (!equipment) return
    await updateEquipment({ id: equipment.id, patch: values })
  }

  const handleDialogOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        onOpenChange(true)
        return
      }
      if (isEditingDetails && editForm.formState.isDirty) {
        const ok = confirm("Bạn có chắc muốn đóng? Các thay đổi chưa lưu sẽ bị mất.")
        if (!ok) return
      }
      setIsEditingDetails(false)
      onOpenChange(false)
    },
    [isEditingDetails, editForm.formState.isDirty, onOpenChange]
  )



  // Merge equipment prop with saved values for display
  // After save, savedValues contains updated data while equipment prop is stale
  const displayEquipment = React.useMemo(() => {
    if (!equipment) return null
    if (!savedValues) return equipment
    return {
      ...equipment,
      ...savedValues,
    } as Equipment
  }, [equipment, savedValues])

  // RBAC check
  const canEdit =
    !!user &&
    (isEquipmentManagerRole(user.role) ||
      (user.role === "qltb_khoa" && user.khoa_phong === equipment?.khoa_phong_quan_ly))
  const canDeleteEquipment = isEquipmentManagerRole(user?.role)

  if (!equipment || !displayEquipment) return null

  const handleTabChange = (value: string) => {
    setCurrentTab(value)
  }

  const handleStartEditing = () => {
    setIsEditingDetails(true)
  }

  const handleCancelEditing = () => {
    editForm.reset(equipmentToFormValues(displayEquipment))
    setIsEditingDetails(false)
  }

  const handleClose = () => {
    handleDialogOpenChange(false)
  }

  const handleDeleteEquipment = () => {
    openDeleteDialog(equipment, "detail_dialog")
  }

  const handleGenerateProfileSheetClick = () => {
    onGenerateProfileSheet(displayEquipment)
  }

  const handleGenerateDeviceLabelClick = () => {
    onGenerateDeviceLabel(displayEquipment)
  }

  const detailTabsProps = {
    currentTab,
    displayEquipment,
    editForm,
    isEditingDetails,
    onSubmitInlineEdit,
    onTabChange: handleTabChange,
    tabsScrollRef,
  }

  const attachmentTabsProps = {
    addAttachment,
    attachments,
    deleteAttachment,
    googleDriveFolderUrl: equipment.google_drive_folder_url,
    isAddingAttachment,
    isDeletingAttachment,
    isLoadingAttachments,
  }

  const historyTabsProps = {
    history,
    isLoadingHistory,
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Chi tiết thiết bị: {displayEquipment.ten_thiet_bi}</DialogTitle>
          <DialogDescription>Mã thiết bị: {displayEquipment.ma_thiet_bi}</DialogDescription>
        </DialogHeader>
        <EquipmentDetailTabs
          attachments={attachmentTabsProps}
          detail={detailTabsProps}
          history={historyTabsProps}
          usageEquipment={equipment}
        />
        <DialogFooter className="shrink-0 pt-4 border-t">
          <EquipmentDetailFooter
            canDeleteEquipment={canDeleteEquipment}
            canEdit={canEdit}
            isEditingDetails={isEditingDetails}
            isRegionalLeader={isRegionalLeader}
            isUpdating={isUpdating}
            onCancelEditing={handleCancelEditing}
            onClose={handleClose}
            onDeleteEquipment={handleDeleteEquipment}
            onGenerateDeviceLabel={handleGenerateDeviceLabelClick}
            onGenerateProfileSheet={handleGenerateProfileSheetClick}
            onStartEditing={handleStartEditing}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

