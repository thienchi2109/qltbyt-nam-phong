'use client'

import * as React from 'react'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buildRepairRequestsByEquipmentHref } from '@/lib/repair-request-deep-link'
import { RepairRequestsDetailView } from '@/app/(app)/repair-requests/_components/RepairRequestsDetailView'
import type { RepairRequestWithEquipment } from '@/app/(app)/repair-requests/types'
import { STRINGS } from '@/components/equipment-linked-request/strings'

export interface RepairRequestSheetAdapterProps {
  request: RepairRequestWithEquipment
  activeCount: number
  onClose: () => void
}

/**
 * Phase 1 read/detail parity adapter. Wraps the existing repair-requests
 * detail sheet so it can be opened from Equipment list (#338) without
 * surfacing any mutation actions (those still live on the /repair-requests
 * page).
 *
 * Loaded lazily via next/dynamic from LinkedRequestSheetHost so its
 * dependencies do not ship in the equipment route initial chunk.
 */
export default function RepairRequestSheetAdapter({
  request,
  activeCount,
  onClose,
}: RepairRequestSheetAdapterProps) {
  const showMultiActiveAlert = activeCount > 1
  const openInRepairRequestsHref = buildRepairRequestsByEquipmentHref(request.thiet_bi_id)
  const contentHeader = showMultiActiveAlert ? (
    <Alert role="alert" variant="destructive" className="mx-4 mt-3">
      <AlertDescription>{STRINGS.multiActiveAlert(activeCount)}</AlertDescription>
    </Alert>
  ) : null
  const footerContent = (
    <Link
      href={openInRepairRequestsHref}
      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {STRINGS.footerOpenInRepairRequests}
    </Link>
  )

  return (
    <RepairRequestsDetailView
      requestToView={request}
      onClose={onClose}
      contentHeader={contentHeader}
      footerContent={footerContent}
    />
  )
}
