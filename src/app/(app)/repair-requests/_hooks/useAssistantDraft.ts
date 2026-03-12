'use client'

import * as React from 'react'

import type { RepairRequestDraftPayload } from '@/lib/ai/draft/repair-request-draft-schema'
import type { EquipmentSelectItem } from '../types'

/**
 * Hook for managing assistant-generated repair request draft state.
 *
 * Extracted from RepairRequestsContext to respect the 350-line guard.
 * Provides state + actions for applying/clearing a pending draft.
 */
export function useAssistantDraft() {
  const [assistantDraft, setAssistantDraft] =
    React.useState<RepairRequestDraftPayload | null>(null)

  const applyAssistantDraft = React.useCallback(
    (draft: RepairRequestDraftPayload) => {
      setAssistantDraft(draft)
    },
    [],
  )

  const clearAssistantDraft = React.useCallback(() => {
    setAssistantDraft(null)
  }, [])

  /** Derive pre-selected equipment from draft data. */
  const draftEquipment: EquipmentSelectItem | null = React.useMemo(() => {
    if (!assistantDraft?.equipment?.thiet_bi_id) return null
    return {
      id: assistantDraft.equipment.thiet_bi_id,
      ma_thiet_bi: assistantDraft.equipment.ma_thiet_bi ?? '',
      ten_thiet_bi: assistantDraft.equipment.ten_thiet_bi ?? '',
    }
  }, [assistantDraft])

  return {
    assistantDraft,
    draftEquipment,
    applyAssistantDraft,
    clearAssistantDraft,
  } as const
}
