/**
 * Returns whether the linked-request feature is currently active.
 * Currently always false; will be wired to LinkedRequestContext in PR-3b.
 * Used by useEquipmentData to tighten staleTime when the feature is lit up.
 */
export function useIsLinkedRequestActive(): boolean {
  return false
}
