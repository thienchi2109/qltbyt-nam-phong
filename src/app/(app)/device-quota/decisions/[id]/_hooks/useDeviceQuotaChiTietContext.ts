import { useContext } from "react"
import { DeviceQuotaChiTietContext } from "../_components/DeviceQuotaChiTietContext"

/**
 * Hook to access Device Quota Detail context.
 * Must be used within DeviceQuotaChiTietProvider.
 */
export function useDeviceQuotaChiTietContext() {
  const context = useContext(DeviceQuotaChiTietContext)
  if (!context) {
    throw new Error(
      'useDeviceQuotaChiTietContext must be used within DeviceQuotaChiTietProvider'
    )
  }
  return context
}
