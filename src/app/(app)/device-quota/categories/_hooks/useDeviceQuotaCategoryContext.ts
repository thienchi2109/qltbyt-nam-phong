import { useContext } from "react"
import { DeviceQuotaCategoryContext } from "../_components/DeviceQuotaCategoryContext"

export function useDeviceQuotaCategoryContext() {
  const context = useContext(DeviceQuotaCategoryContext)
  if (!context) {
    throw new Error("useDeviceQuotaCategoryContext must be used within DeviceQuotaCategoryProvider")
  }
  return context
}
