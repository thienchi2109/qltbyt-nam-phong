import * as React from "react"
import type { RepairRequestWithEquipment, RepairUnit } from "../types"

/**
 * Consolidates all dialog/form state for repair requests page.
 * Groups 15+ useState declarations into a single hook for cleaner code organization.
 */
export interface RepairRequestDialogsState {
  // Create dialog
  isCreateOpen: boolean

  // Edit dialog state
  editingRequest: RepairRequestWithEquipment | null
  editIssueDescription: string
  editRepairItems: string
  editDesiredDate: Date | undefined
  editRepairUnit: RepairUnit
  editExternalCompanyName: string

  // Delete dialog state
  requestToDelete: RepairRequestWithEquipment | null

  // Approve dialog state
  requestToApprove: RepairRequestWithEquipment | null
  approvalRepairUnit: RepairUnit
  approvalExternalCompanyName: string

  // Complete dialog state
  requestToComplete: RepairRequestWithEquipment | null
  completionType: 'Hoàn thành' | 'Không HT' | null
  completionResult: string
  nonCompletionReason: string

  // View detail state
  requestToView: RepairRequestWithEquipment | null
}

export interface RepairRequestDialogsActions {
  setIsCreateOpen: (open: boolean) => void

  setEditingRequest: (req: RepairRequestWithEquipment | null) => void
  setEditIssueDescription: (val: string) => void
  setEditRepairItems: (val: string) => void
  setEditDesiredDate: (val: Date | undefined) => void
  setEditRepairUnit: (val: RepairUnit) => void
  setEditExternalCompanyName: (val: string) => void

  setRequestToDelete: (req: RepairRequestWithEquipment | null) => void

  setRequestToApprove: (req: RepairRequestWithEquipment | null) => void
  setApprovalRepairUnit: (val: RepairUnit) => void
  setApprovalExternalCompanyName: (val: string) => void

  setRequestToComplete: (req: RepairRequestWithEquipment | null) => void
  setCompletionType: (val: 'Hoàn thành' | 'Không HT' | null) => void
  setCompletionResult: (val: string) => void
  setNonCompletionReason: (val: string) => void

  setRequestToView: (req: RepairRequestWithEquipment | null) => void
}

export type RepairRequestDialogs = RepairRequestDialogsState & RepairRequestDialogsActions

export function useRepairRequestDialogs(): RepairRequestDialogs {
  // Create dialog
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)

  // Edit dialog state
  const [editingRequest, setEditingRequest] = React.useState<RepairRequestWithEquipment | null>(null)
  const [editIssueDescription, setEditIssueDescription] = React.useState("")
  const [editRepairItems, setEditRepairItems] = React.useState("")
  const [editDesiredDate, setEditDesiredDate] = React.useState<Date | undefined>()
  const [editRepairUnit, setEditRepairUnit] = React.useState<RepairUnit>('noi_bo')
  const [editExternalCompanyName, setEditExternalCompanyName] = React.useState("")

  // Delete dialog state
  const [requestToDelete, setRequestToDelete] = React.useState<RepairRequestWithEquipment | null>(null)

  // Approve dialog state
  const [requestToApprove, setRequestToApprove] = React.useState<RepairRequestWithEquipment | null>(null)
  const [approvalRepairUnit, setApprovalRepairUnit] = React.useState<RepairUnit>('noi_bo')
  const [approvalExternalCompanyName, setApprovalExternalCompanyName] = React.useState("")

  // Complete dialog state
  const [requestToComplete, setRequestToComplete] = React.useState<RepairRequestWithEquipment | null>(null)
  const [completionType, setCompletionType] = React.useState<'Hoàn thành' | 'Không HT' | null>(null)
  const [completionResult, setCompletionResult] = React.useState("")
  const [nonCompletionReason, setNonCompletionReason] = React.useState("")

  // View detail state
  const [requestToView, setRequestToView] = React.useState<RepairRequestWithEquipment | null>(null)

  return {
    isCreateOpen, setIsCreateOpen,

    editingRequest, setEditingRequest,
    editIssueDescription, setEditIssueDescription,
    editRepairItems, setEditRepairItems,
    editDesiredDate, setEditDesiredDate,
    editRepairUnit, setEditRepairUnit,
    editExternalCompanyName, setEditExternalCompanyName,

    requestToDelete, setRequestToDelete,

    requestToApprove, setRequestToApprove,
    approvalRepairUnit, setApprovalRepairUnit,
    approvalExternalCompanyName, setApprovalExternalCompanyName,

    requestToComplete, setRequestToComplete,
    completionType, setCompletionType,
    completionResult, setCompletionResult,
    nonCompletionReason, setNonCompletionReason,

    requestToView, setRequestToView,
  }
}
