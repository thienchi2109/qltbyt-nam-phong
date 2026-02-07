import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"

describe("useMaintenanceContext", () => {
  it("throws when used outside provider", () => {
    expect(() => renderHook(() => useMaintenanceContext())).toThrow(
      "useMaintenanceContext must be used within MaintenanceProvider"
    )
  })
})
