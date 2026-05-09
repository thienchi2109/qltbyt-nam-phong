import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useMaintenancePlanListControls } from "../_hooks/use-maintenance-plan-list-controls"

describe("useMaintenancePlanListControls", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("resets the effective page when the pagination reset key changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey?: number | null }) => useMaintenancePlanListControls(resetKey),
      { initialProps: { resetKey: null } },
    )

    act(() => {
      result.current.setCurrentPage(3)
    })
    expect(result.current.currentPage).toBe(3)

    rerender({ resetKey: 7 })

    expect(result.current.currentPage).toBe(1)
  })

  it("resets the effective page when debounced search changes", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useMaintenancePlanListControls(null))

    act(() => {
      result.current.setCurrentPage(3)
    })
    expect(result.current.currentPage).toBe(3)

    act(() => {
      result.current.handlePlanSearchChange("máy thở")
    })
    expect(result.current.currentPage).toBe(1)

    act(() => {
      result.current.setCurrentPage(3)
    })
    expect(result.current.currentPage).toBe(3)

    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(result.current.currentPage).toBe(1)
  })
})
