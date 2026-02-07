import { useContext } from "react"
import { MaintenanceContext } from "../_components/MaintenanceContext"

/**
 * Hook to access Maintenance context.
 * Must be used within MaintenanceProvider.
 */
export function useMaintenanceContext() {
  const context = useContext(MaintenanceContext)
  if (!context) {
    throw new Error(
      'useMaintenanceContext must be used within MaintenanceProvider'
    )
  }
  return context
}
