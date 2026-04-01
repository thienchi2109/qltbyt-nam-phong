"use client"

/**
 * Thin wrapper over EquipmentFilterContext for backward compatibility.
 *
 * All filter state is now managed by EquipmentFilterContext with
 * sessionStorage persistence. This hook simply re-exports the context
 * value so existing consumers don't need code changes.
 *
 * @see {@link EquipmentFilterContext} for the actual implementation.
 */
import { useEquipmentFilterContext } from "@/contexts/EquipmentFilterContext"
import type { EquipmentFilterContextValue } from "@/contexts/EquipmentFilterContext"

export type UseEquipmentFiltersReturn = EquipmentFilterContextValue

export function useEquipmentFilters(): UseEquipmentFiltersReturn {
  return useEquipmentFilterContext()
}
