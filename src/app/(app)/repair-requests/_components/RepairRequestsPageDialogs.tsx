"use client"

import { RepairRequestsApproveDialog } from "./RepairRequestsApproveDialog"
import { RepairRequestsCompleteDialog } from "./RepairRequestsCompleteDialog"
import { RepairRequestsDeleteDialog } from "./RepairRequestsDeleteDialog"
import { RepairRequestsDetailView } from "./RepairRequestsDetailView"
import { RepairRequestsEditDialog } from "./RepairRequestsEditDialog"

/** Renders the repair-requests dialog stack owned by the page client. */
export function RepairRequestsPageDialogs() {
  return (
    <>
      <RepairRequestsEditDialog />
      <RepairRequestsDeleteDialog />
      <RepairRequestsApproveDialog />
      <RepairRequestsCompleteDialog />

      <RepairRequestsDetailView />
    </>
  )
}
