import { describe, expect, it } from "vitest"
import { getNextMaintenanceTempTaskId } from "../_components/MaintenanceContext"

describe("getNextMaintenanceTempTaskId", () => {
  it("returns -2 when there are no temporary IDs", () => {
    const nextId = getNextMaintenanceTempTaskId([{ id: 10 }, { id: 20 }])

    expect(nextId).toBe(-2)
  })

  it("returns one less than the smallest temporary ID", () => {
    const nextId = getNextMaintenanceTempTaskId([{ id: -2 }, { id: -8 }, { id: 5 }])

    expect(nextId).toBe(-9)
  })

  it("handles large draft arrays without spreading IDs into function args", () => {
    const drafts = Array.from({ length: 70_000 }, (_, index) => ({
      id: -(index + 1),
    }))

    expect(() => getNextMaintenanceTempTaskId(drafts)).not.toThrow()
    expect(getNextMaintenanceTempTaskId(drafts)).toBe(-70_001)
  })
})
