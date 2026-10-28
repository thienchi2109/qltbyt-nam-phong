"use client"

import { useCallback } from "react"
import {
  EquipmentActionsMenu,
  type EquipmentActionsMenuProps,
} from "@/components/equipment/equipment-actions-menu"
import type { Equipment } from "@/types/database"

/** Keeps row commands subscribed to the current scope's active usage query. */
export function useEquipmentRowActions({
  activeUsageLogs,
  isLoadingActiveUsage,
  activeUsageError,
  onRetryActiveUsage,
}: Omit<EquipmentActionsMenuProps, "equipment">) {
  return useCallback(
    (equipment: Equipment) => (
      <EquipmentActionsMenu
        equipment={equipment}
        activeUsageLogs={activeUsageLogs}
        isLoadingActiveUsage={isLoadingActiveUsage}
        activeUsageError={activeUsageError}
        onRetryActiveUsage={onRetryActiveUsage}
      />
    ),
    [activeUsageLogs, isLoadingActiveUsage, activeUsageError, onRetryActiveUsage]
  )
}
