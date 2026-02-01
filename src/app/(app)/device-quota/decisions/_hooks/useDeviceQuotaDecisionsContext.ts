import { useContext } from "react"
import { DeviceQuotaDecisionsContext } from "../_components/DeviceQuotaDecisionsContext"

/**
 * Hook to access Device Quota Decisions context.
 * Must be used within DeviceQuotaDecisionsProvider.
 */
export function useDeviceQuotaDecisionsContext() {
  const context = useContext(DeviceQuotaDecisionsContext)
  if (!context) {
    throw new Error(
      'useDeviceQuotaDecisionsContext must be used within DeviceQuotaDecisionsProvider'
    )
  }
  return context
}
