"use client"

import * as React from "react"

import type { EquipmentSelectItem, RepairUnit } from "../types"
import { RepairRequestsFormFields } from "./RepairRequestsFormFields"
import { RepairRequestsEquipmentSearchField } from "./RepairRequestsEquipmentSearchField"
import { RepairRequestsSheetActions } from "./RepairRequestsSheetActions"

function getTodayStart(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

interface RepairRequestsCreateSheetFormProps {
  canSetRepairUnit: boolean
  desiredDate: Date | undefined
  externalCompanyName: string
  filteredEquipment: EquipmentSelectItem[]
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent) => void
  handleSelectEquipment: (equipment: EquipmentSelectItem) => void
  isSubmitting: boolean
  issueDescription: string
  onCancel: () => void
  repairItems: string
  repairUnit: RepairUnit
  searchQuery: string
  selectedEquipment: EquipmentSelectItem | null
  onDesiredDateChange: (value: Date | undefined) => void
  onExternalCompanyNameChange: (value: string) => void
  onIssueDescriptionChange: (value: string) => void
  onRepairItemsChange: (value: string) => void
  onRepairUnitChange: (value: RepairUnit) => void
  shouldShowNoResults: boolean
}

/** Renders the repair request create sheet form fields and actions. */
export function RepairRequestsCreateSheetForm({
  canSetRepairUnit,
  desiredDate,
  externalCompanyName,
  filteredEquipment,
  handleSearchChange,
  handleSubmit,
  handleSelectEquipment,
  isSubmitting,
  issueDescription,
  onCancel,
  repairItems,
  repairUnit,
  searchQuery,
  selectedEquipment,
  onDesiredDateChange,
  onExternalCompanyNameChange,
  onIssueDescriptionChange,
  onRepairItemsChange,
  onRepairUnitChange,
  shouldShowNoResults,
}: RepairRequestsCreateSheetFormProps) {
  const [minimumSelectableDate] = React.useState<Date>(() => getTodayStart())

  const isDateDisabled = React.useCallback(
    (date: Date) => date < minimumSelectableDate,
    [minimumSelectableDate]
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <RepairRequestsEquipmentSearchField
        searchQuery={searchQuery}
        selectedEquipment={selectedEquipment}
        filteredEquipment={filteredEquipment}
        shouldShowNoResults={shouldShowNoResults}
        onSearchChange={handleSearchChange}
        onSelectEquipment={handleSelectEquipment}
      />
      <RepairRequestsFormFields
        canSetRepairUnit={canSetRepairUnit}
        desiredDate={desiredDate}
        externalCompanyName={externalCompanyName}
        fieldIdPrefix="create-repair-request"
        isDateDisabled={isDateDisabled}
        issueDescription={issueDescription}
        onDesiredDateChange={onDesiredDateChange}
        onExternalCompanyNameChange={onExternalCompanyNameChange}
        onIssueDescriptionChange={onIssueDescriptionChange}
        onRepairItemsChange={onRepairItemsChange}
        onRepairUnitChange={onRepairUnitChange}
        repairItems={repairItems}
        repairItemsLabel="Các hạng mục yêu cầu sửa chữa (nếu có)"
        repairUnit={repairUnit}
      />
      <RepairRequestsSheetActions
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        submitLabel="Gửi yêu cầu"
        submittingLabel="Đang gửi..."
      />
    </form>
  )
}
