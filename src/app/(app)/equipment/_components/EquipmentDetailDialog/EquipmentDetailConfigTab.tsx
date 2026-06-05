/**
 * Configuration & Accessories tab for equipment detail dialog
 * Displays cau_hinh_thiet_bi and phu_kien_kem_theo fields
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailConfigTab
 */

"use client"

import * as React from "react"

import { EquipmentEditTextareaField } from "@/components/equipment-edit/EquipmentEditFieldControls"
import { ScrollArea } from "@/components/ui/scroll-area"
import { columnLabels } from "@/components/equipment/equipment-table-columns"
import type { Equipment } from "@/types/database"

export interface EquipmentDetailConfigTabProps {
  /** Equipment data to display */
  displayEquipment: Equipment
  /** Whether the tab is in editing mode */
  isEditing: boolean
}

/**
 * Renders a single long-text field with proper formatting
 */
function LongTextField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}): React.ReactNode {
  return (
    <div className="border-b pb-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="font-medium whitespace-pre-wrap break-words min-h-[2rem]">
        {value ? (
          value
        ) : (
          <span className="italic text-muted-foreground">Chưa có dữ liệu</span>
        )}
      </div>
    </div>
  )
}

/** Renders the equipment configuration tab in view or edit mode. */
export function EquipmentDetailConfigTab({
  displayEquipment,
  isEditing,
}: EquipmentDetailConfigTabProps): React.ReactNode {
  if (isEditing) {
    return <ConfigEditForm />
  }

  // View mode: display both fields with proper multiline formatting
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6 py-4">
        <LongTextField
          label={columnLabels.cau_hinh_thiet_bi}
          value={displayEquipment.cau_hinh_thiet_bi}
        />
        <LongTextField
          label={columnLabels.phu_kien_kem_theo}
          value={displayEquipment.phu_kien_kem_theo}
        />
      </div>
    </ScrollArea>
  )
}

/**
 * Edit form for configuration fields
 * Uses useFormContext to access form from parent FormProvider
 */
function ConfigEditForm(): React.ReactNode {
  return (
    <ScrollArea className="h-full pr-4">
      <div className="space-y-6 py-4">
        <EquipmentEditTextareaField
          name="cau_hinh_thiet_bi"
          label="Cấu hình thiết bị"
          rows={8}
          placeholder="Nhập cấu hình thiết bị…"
          className="resize-y min-h-[120px]"
        />

        <EquipmentEditTextareaField
          name="phu_kien_kem_theo"
          label="Phụ kiện kèm theo"
          rows={6}
          placeholder="Nhập phụ kiện kèm theo…"
          className="resize-y min-h-[100px]"
        />
      </div>
    </ScrollArea>
  )
}
