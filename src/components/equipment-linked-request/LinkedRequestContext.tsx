'use client'

import * as React from 'react'
import { EquipmentDialogContext } from '@/app/(app)/equipment/_components/EquipmentDialogContext'
import type { LinkedRequestKind, LinkedRequestState } from './types'

export interface LinkedRequestContextValue {
  state: LinkedRequestState
  openRepair: (equipmentId: number) => void
  close: () => void
}

export const Context = React.createContext<LinkedRequestContextValue | null>(null)

const CLOSED_STATE: LinkedRequestState = {
  open: false,
  kind: null,
  equipmentId: null,
}

export function LinkedRequestProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<LinkedRequestState>(CLOSED_STATE)

  // Idempotent setters: bail out when the next state is structurally equal so
  // callers can safely invoke openRepair/close from effects without triggering
  // re-render loops (React useState only short-circuits on Object.is identity).
  const openRepair = React.useCallback((equipmentId: number) => {
    setState((prev) =>
      prev.open && prev.kind === 'repair' && prev.equipmentId === equipmentId
        ? prev
        : { open: true, kind: 'repair', equipmentId },
    )
  }, [])

  const close = React.useCallback(() => {
    setState((prev) => (prev.open ? CLOSED_STATE : prev))
  }, [])

  // Auto-close when the parent Equipment Detail dialog closes.
  // Subscribing via an effect keeps the provider usable outside the equipment
  // page (the EquipmentDialogContext is `null` there); we just skip the effect.
  const equipmentDialog = React.useContext(EquipmentDialogContext)
  const isDetailOpen = equipmentDialog?.dialogState.isDetailOpen ?? false

  React.useEffect(() => {
    if (!isDetailOpen) {
      setState((prev) => (prev.open ? CLOSED_STATE : prev))
    }
  }, [isDetailOpen])

  const value = React.useMemo<LinkedRequestContextValue>(
    () => ({ state, openRepair, close }),
    [state, openRepair, close],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useLinkedRequest(): LinkedRequestContextValue {
  const value = React.useContext(Context)
  if (!value) {
    throw new Error('useLinkedRequest must be used within a LinkedRequestProvider')
  }
  return value
}

// Phase 2/3 may reuse these types/aliases without the kind union widening;
// re-export so consumers don't import from ./types directly.
export type { LinkedRequestKind, LinkedRequestState }
