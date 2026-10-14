import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const replace = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}))

import { useEquipmentDatasetTab } from "../useEquipmentDatasetTab"

describe("useEquipmentDatasetTab", () => {
  beforeEach(() => {
    replace.mockReset()
    window.history.replaceState({}, "", "/equipment?search=monitor&tab=regular")
  })

  it("defaults invalid URL values to regular and replaces only the tab parameter", () => {
    window.history.replaceState({}, "", "/equipment?search=monitor&tab=unknown")
    const resetPage = vi.fn()
    const { result } = renderHook(() => useEquipmentDatasetTab({ onDatasetChange: resetPage }))

    expect(result.current.dataset).toBe("regular")

    act(() => result.current.setDataset("placed"))

    expect(resetPage).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith("/equipment?search=monitor&tab=placed", { scroll: false })
  })

  it("tracks browser back and forward dataset changes", () => {
    window.history.replaceState({}, "", "/equipment?tab=regular")
    const { result } = renderHook(() => useEquipmentDatasetTab())

    act(() => {
      window.history.replaceState({}, "", "/equipment?tab=placed")
      window.dispatchEvent(new PopStateEvent("popstate"))
    })

    expect(result.current.dataset).toBe("placed")
  })
})
