import { useContext } from "react"
import { DeviceQuotaDashboardContext } from "../_components/DeviceQuotaDashboardContext"

/**
 * Hook to access Device Quota Dashboard context.
 * Must be used within DeviceQuotaDashboardProvider.
 */
export function useDeviceQuotaDashboardContext() {
  const context = useContext(DeviceQuotaDashboardContext)
  if (!context) {
    throw new Error(
      'useDeviceQuotaDashboardContext must be used within DeviceQuotaDashboardProvider'
    )
  }
  return context
}
