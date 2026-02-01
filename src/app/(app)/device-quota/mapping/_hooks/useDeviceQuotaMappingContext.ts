import { useContext } from "react"
import { DeviceQuotaMappingContext } from "../_components/DeviceQuotaMappingContext"

/**
 * Hook to access Device Quota Mapping context.
 * Must be used within DeviceQuotaMappingProvider.
 */
export function useDeviceQuotaMappingContext() {
  const context = useContext(DeviceQuotaMappingContext)
  if (!context) {
    throw new Error(
      'useDeviceQuotaMappingContext must be used within DeviceQuotaMappingProvider'
    )
  }
  return context
}
