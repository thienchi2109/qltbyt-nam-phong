"use client"

import { RepairRequestsApproveDialog } from "./RepairRequestsApproveDialog"
import { RepairRequestsCompleteDialog } from "./RepairRequestsCompleteDialog"
import { RepairRequestsDeleteDialog } from "./RepairRequestsDeleteDialog"
import { RepairRequestsDetailView } from "./RepairRequestsDetailView"
import { RepairRequestsEditDialog } from "./RepairRequestsEditDialog"
import type { RepairRequestWithEquipment } from "../types"

interface RepairRequestsPageDialogsProps {
  readonly requestToView: RepairRequestWithEquipment | null
  readonly onClose: () => void
}

/** Renders the repair-requests dialog stack owned by the page client. */
export function RepairRequestsPageDialogs({
  requestToView,
  onClose,
}: RepairRequestsPageDialogsProps) {
  return (
    <>
      <RepairRequestsEditDialog />
      <RepairRequestsDeleteDialog />
      <RepairRequestsApproveDialog />
      <RepairRequestsCompleteDialog />

      <RepairRequestsDetailView
        requestToView={requestToView}
        onClose={onClose}
      />
    </>
  )
}
