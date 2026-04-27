'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import { toast } from '@/hooks/use-toast'
import { useLinkedRequest } from './LinkedRequestContext'
import { useResolveActiveRepair } from './resolvers/useResolveActiveRepair'
import type { RepairRequestSheetAdapterProps } from './adapters/repairRequestSheetAdapter'
import { STRINGS } from './strings'

const RepairRequestSheetAdapter = dynamic<RepairRequestSheetAdapterProps>(
  () => import('./adapters/repairRequestSheetAdapter'),
  { ssr: false },
)

/**
 * Mounts the active-request side sheet at page level (sibling of
 * EquipmentDetailDialog). Keeps the sheet detached from Equipment Detail's
 * internal tree so the in-row icon (post 2026-04-27 pivot) can open the
 * sheet from anywhere on the equipment page.
 *
 * Auto-close-on-stale (active_count flips to 0) lives here because it
 * depends on the resolver result. The resolver fires only when state.open
 * becomes true (i.e., user clicks the row icon).
 */
export function LinkedRequestSheetHost() {
  const { state, close } = useLinkedRequest()

  const enabled = state.open && state.kind === 'repair'
  const equipmentId = enabled ? state.equipmentId : null
  const query = useResolveActiveRepair({ equipmentId, enabled })

  // Auto-close when the resolver settles with no active record.
  const data = query.data
  React.useEffect(() => {
    if (!enabled) return
    if (data && data.active_count === 0) {
      close()
      toast({ title: STRINGS.autoCloseToastTitle })
    }
  }, [enabled, data, close])

  if (!enabled || !data || data.active_count === 0 || !data.request) {
    return null
  }

  return (
    <RepairRequestSheetAdapter
      request={data.request}
      activeCount={data.active_count}
      onClose={close}
    />
  )
}
