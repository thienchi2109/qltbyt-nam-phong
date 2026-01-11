import { useContext } from "react"
import { RepairRequestsContext } from "../_components/RepairRequestsContext"

/**
 * Hook to access RepairRequests context.
 * Must be used within RepairRequestsProvider.
 */
export function useRepairRequestsContext() {
  const context = useContext(RepairRequestsContext)
  if (!context) {
    throw new Error(
      'useRepairRequestsContext must be used within RepairRequestsProvider'
    )
  }
  return context
}
