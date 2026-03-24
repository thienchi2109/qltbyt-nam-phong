/**
 * Edit form for equipment details
 * Uses useFormContext to access form from parent FormProvider
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailEditForm
 */

"use client"

import * as React from "react"
import { useFormContext } from "react-hook-form"

import { ScrollArea } from "@/components/ui/scroll-area"
import { useDecommissionDateAutofill } from "@/components/equipment-decommission-form"

import { EquipmentDetailAssignmentSection } from "./EquipmentDetailAssignmentSection"
import { EquipmentDetailBasicInfoSection } from "./EquipmentDetailBasicInfoSection"
import { EquipmentDetailDatesSection } from "./EquipmentDetailDatesSection"
import { EquipmentDetailStatusSection } from "./EquipmentDetailStatusSection"
import type { EquipmentFormValues } from "./EquipmentDetailTypes"

export interface EquipmentDetailEditFormProps {
  formId: string
  initialStatus?: string | null
  onSubmit: (values: EquipmentFormValues) => void
}

export function EquipmentDetailEditForm({
  formId,
  initialStatus,
  onSubmit,
}: EquipmentDetailEditFormProps): React.ReactNode {
  const form = useFormContext<EquipmentFormValues>()

  useDecommissionDateAutofill({
    control: form.control,
    setValue: form.setValue,
    initialStatus,
  })

  return (
    <form
      id={formId}
      className="h-full flex flex-col overflow-hidden"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4 py-4">
          <EquipmentDetailBasicInfoSection />
          <EquipmentDetailDatesSection />
          <EquipmentDetailAssignmentSection />
          <EquipmentDetailStatusSection />
        </div>
      </ScrollArea>
    </form>
  )
}
