import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useMaintenancePlanListControls } from "../_hooks/use-maintenance-plan-list-controls"

describe("useMaintenancePlanListControls", () => {
  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
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

  it("persists pageSize without persisting the current page", () => {
    window.localStorage.setItem("datatable:maintenance-plans:page-size", "100")

    const { result, unmount } = renderHook(() => useMaintenancePlanListControls(null))

    expect(result.current.pageSize).toBe(100)

    act(() => {
      result.current.setCurrentPage(3)
      result.current.handlePageSizeChange(200)
    })

    expect(window.localStorage.getItem("datatable:maintenance-plans:page-size")).toBe("200")
    expect(window.localStorage.getItem("datatable:maintenance-plans:page-index")).toBeNull()

    unmount()

    const nextHook = renderHook(() => useMaintenancePlanListControls(null))

    expect(nextHook.result.current.currentPage).toBe(1)
    expect(nextHook.result.current.pageSize).toBe(200)
  })

  it("normalizes non-finite pageSize values before persisting", () => {
    const { result } = renderHook(() => useMaintenancePlanListControls(null))

    act(() => {
      result.current.handlePageSizeChange(Number.NaN)
    })

    expect(result.current.pageSize).toBe(1)
    expect(window.localStorage.getItem("datatable:maintenance-plans:page-size")).toBe("1")
  })
})
