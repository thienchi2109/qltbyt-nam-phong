"use client"

import * as React from "react"
import { parseISO, format, startOfDay } from "date-fns"
import { SideSheetShell } from "@/components/shared/SideSheetShell"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import type { RepairUnit } from "../types"
import { RepairRequestsFormFields } from "./RepairRequestsFormFields"
import { RepairRequestsSheetActions } from "./RepairRequestsSheetActions"

interface RepairRequestsEditFormState {
  desiredDate: Date | undefined
  externalCompanyName: string
  issueDescription: string
  repairItems: string
  repairUnit: RepairUnit
}

type RepairRequestsEditFormAction = { type: "patch"; updates: Partial<RepairRequestsEditFormState> }

function repairRequestsEditFormReducer(
  state: RepairRequestsEditFormState,
  action: RepairRequestsEditFormAction
): RepairRequestsEditFormState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.updates }
  }
}

type RepairRequestToEdit = NonNullable<
  ReturnType<typeof useRepairRequestsContext>["dialogState"]["requestToEdit"]
>

function createEditFormState(requestToEdit: RepairRequestToEdit): RepairRequestsEditFormState {
  return {
    desiredDate: requestToEdit.ngay_mong_muon_hoan_thanh
      ? parseISO(requestToEdit.ngay_mong_muon_hoan_thanh)
      : undefined,
    externalCompanyName: requestToEdit.ten_don_vi_thue || "",
    issueDescription: requestToEdit.mo_ta_su_co,
    repairItems: requestToEdit.hang_muc_sua_chua || "",
    repairUnit: requestToEdit.don_vi_thuc_hien || "noi_bo",
  }
}

/** Renders the repair-request edit workflow inside the page-owned side sheet. */
export function RepairRequestsEditDialog() {
  const {
    dialogState: { requestToEdit },
    closeAllDialogs,
    updateMutation,
    canSetRepairUnit,
  } = useRepairRequestsContext()

  if (!requestToEdit) return null

  return (
    <RepairRequestsEditDialogContent
      key={requestToEdit.id}
      canSetRepairUnit={canSetRepairUnit}
      closeAllDialogs={closeAllDialogs}
      requestToEdit={requestToEdit}
      updateMutation={updateMutation}
    />
  )
}

function RepairRequestsEditDialogContent({
  canSetRepairUnit,
  closeAllDialogs,
  requestToEdit,
  updateMutation,
}: {
  canSetRepairUnit: boolean
  closeAllDialogs: () => void
  requestToEdit: RepairRequestToEdit
  updateMutation: ReturnType<typeof useRepairRequestsContext>["updateMutation"]
}) {
  const [formState, dispatchForm] = React.useReducer(
    repairRequestsEditFormReducer,
    requestToEdit,
    createEditFormState
  )

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    updateMutation.mutate(
      {
        id: requestToEdit.id,
        mo_ta_su_co: formState.issueDescription,
        hang_muc_sua_chua: formState.repairItems,
        ngay_mong_muon_hoan_thanh: formState.desiredDate
          ? format(formState.desiredDate, "yyyy-MM-dd")
          : null,
        don_vi_thuc_hien: canSetRepairUnit ? formState.repairUnit : undefined,
        ten_don_vi_thue:
          canSetRepairUnit && formState.repairUnit === "thue_ngoai"
            ? formState.externalCompanyName.trim()
            : null,
      },
      { onSuccess: closeAllDialogs }
    )
  }

  return (
    <SideSheetShell
      open={!!requestToEdit}
      onOpenChange={(open) => !open && closeAllDialogs()}
      title="Sửa yêu cầu sửa chữa"
      description={`Cập nhật thông tin cho yêu cầu của thiết bị: ${requestToEdit.thiet_bi?.ten_thiet_bi ?? ""}`}
      contentClassName="sm:max-w-lg"
      bodyClassName="mt-4 overflow-y-auto px-4 pb-4"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <RepairRequestsFormFields
          canSetRepairUnit={canSetRepairUnit}
          desiredDate={formState.desiredDate}
          externalCompanyName={formState.externalCompanyName}
          fieldIdPrefix="edit-repair-request"
          isDateDisabled={(date) => {
            const requestTimestamp = Date.parse(requestToEdit.ngay_yeu_cau)
            return Number.isFinite(requestTimestamp)
              ? date.getTime() < startOfDay(requestTimestamp).getTime()
              : false
          }}
          issueDescription={formState.issueDescription}
          onDesiredDateChange={(desiredDate) =>
            dispatchForm({
              type: "patch",
              updates: { desiredDate },
            })
          }
          onExternalCompanyNameChange={(externalCompanyName) =>
            dispatchForm({
              type: "patch",
              updates: { externalCompanyName },
            })
          }
          onIssueDescriptionChange={(issueDescription) =>
            dispatchForm({
              type: "patch",
              updates: { issueDescription },
            })
          }
          onRepairItemsChange={(repairItems) =>
            dispatchForm({
              type: "patch",
              updates: { repairItems },
            })
          }
          onRepairUnitChange={(repairUnit) =>
            dispatchForm({
              type: "patch",
              updates: { repairUnit },
            })
          }
          repairItems={formState.repairItems}
          repairItemsLabel="Các hạng mục yêu cầu sửa chữa"
          repairItemsRequired
          repairUnit={formState.repairUnit}
        />
        <RepairRequestsSheetActions
          isSubmitting={updateMutation.isPending}
          onCancel={closeAllDialogs}
          submitLabel="Lưu thay đổi"
        />
      </form>
    </SideSheetShell>
  )
}
