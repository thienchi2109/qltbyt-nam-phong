import { useCallback, useRef, useState } from "react"

import type {
  DeviceQuotaDraftItem,
  DeviceQuotaDraftSaveItem,
} from "@/lib/device-quota-draft-contract"
import {
  DeviceQuotaDraftError,
  normalizeDeviceQuotaDraftError,
} from "../_components/DeviceQuotaDraftCatalogMutations"

export type FailedDraftAction =
  { type: "save" } | { type: "item"; sourceIdentifier: string; excluded: boolean }

/** Maps one editable draft item to the save RPC payload contract. */
export function toDraftSaveItem(item: DeviceQuotaDraftItem): DeviceQuotaDraftSaveItem {
  return {
    regulatory_item_id: item.regulatory_item_id,
    display_name_override: item.display_name_override,
    applied_unit: item.applied_unit,
    applied_quantity: item.applied_quantity,
    notes: item.notes,
    is_excluded: item.is_excluded,
    display_order: item.display_order,
  }
}

/** Returns the field-level validation message for a draft quantity. */
export function getQuantityError(item: DeviceQuotaDraftItem): string | null {
  if (item.applied_quantity == null) return null
  if (!Number.isInteger(item.applied_quantity)) return "Số lượng phải là số nguyên."
  if (item.applied_quantity < 0) return "Số lượng không được âm."
  return null
}

/** Normalizes unknown mutation failures into the draft error contract. */
export function mapMutationError(error: unknown): DeviceQuotaDraftError {
  return error instanceof DeviceQuotaDraftError ? error : normalizeDeviceQuotaDraftError(error)
}

/** Rebases staged editable fields onto a successful item-mutation snapshot. */
export function mergeStagedItemValues(
  serverItems: DeviceQuotaDraftItem[],
  stagedItems: DeviceQuotaDraftItem[] | null
): DeviceQuotaDraftItem[] {
  return serverItems.map((serverItem) => {
    const stagedItem = stagedItems?.find(
      (candidate) => candidate.source_identifier === serverItem.source_identifier
    )
    return stagedItem
      ? {
          ...serverItem,
          display_name_override: stagedItem.display_name_override,
          applied_unit: stagedItem.applied_unit,
          applied_quantity: stagedItem.applied_quantity,
          notes: stagedItem.notes,
          display_order: stagedItem.display_order,
        }
      : serverItem
  })
}

/** Owns the synchronous mutation lock and the failed-action recovery state. */
export function useDeviceQuotaDraftCatalogMutationState() {
  const lockRef = useRef(false)
  const [lastError, setLastError] = useState<DeviceQuotaDraftError | null>(null)
  const [failedAction, setFailedAction] = useState<FailedDraftAction | null>(null)

  const tryLock = useCallback(() => {
    if (lockRef.current) return false
    lockRef.current = true
    return true
  }, [])
  const unlock = useCallback(() => {
    lockRef.current = false
  }, [])
  const isLocked = useCallback(() => lockRef.current, [])
  const clearError = useCallback(() => {
    setLastError(null)
    setFailedAction(null)
  }, [])
  const recordError = useCallback((error: unknown, action: FailedDraftAction) => {
    setLastError(mapMutationError(error))
    setFailedAction(action)
  }, [])

  return {
    lastError,
    failedAction,
    tryLock,
    unlock,
    isLocked,
    clearError,
    recordError,
    setLastError,
    setFailedAction,
  }
}
