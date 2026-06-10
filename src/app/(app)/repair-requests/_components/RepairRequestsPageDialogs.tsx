"use client"

import { RepairRequestsApproveDialog } from "./RepairRequestsApproveDialog"
import { RepairRequestsCompleteDialog } from "./RepairRequestsCompleteDialog"
import { RepairRequestsDeleteDialog } from "./RepairRequestsDeleteDialog"
import { RepairRequestsDetailView } from "./RepairRequestsDetailView"
import { RepairRequestsEditDialog } from "./RepairRequestsEditDialog"
import { RepairRequestsPrintOptionsDialog } from "./RepairRequestsPrintOptionsDialog"
import type { RepairRequestWithEquipment } from "../types"
import type { RepairRequestSheetOptions } from "../request-sheet"

interface RepairRequestsPageDialogsProps {
  readonly onGenerateSheet: (
    request: RepairRequestWithEquipment,
    options?: RepairRequestSheetOptions
  ) => void
}

/** Renders the repair-requests dialog stack owned by the page client. */
export function RepairRequestsPageDialogs({ onGenerateSheet }: RepairRequestsPageDialogsProps) {
  return (
    <>
      <RepairRequestsEditDialog />
      <RepairRequestsDeleteDialog />
      <RepairRequestsApproveDialog />
      <RepairRequestsCompleteDialog />
      <RepairRequestsPrintOptionsDialog onGenerateSheet={onGenerateSheet} />

      <RepairRequestsDetailView />
    </>
  )
}
