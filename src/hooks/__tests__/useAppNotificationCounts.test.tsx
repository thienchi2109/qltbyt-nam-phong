import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

let consoleErrorSpy: ReturnType<typeof vi.spyOn>

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { useAppNotificationCounts } from "../useAppNotificationCounts"

describe("useAppNotificationCounts", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy.mockRestore()
  })

  it("merges header notifications with approved maintenance counts", async () => {
    mocks.callRpc
      .mockResolvedValueOnce({
        pending_repairs: 2,
        pending_transfers: 3,
      })
      .mockResolvedValueOnce({
        "Bản nháp": 5,
        "Đã duyệt": 4,
        "Không duyệt": 1,
      })

    const { result } = renderHook(() => useAppNotificationCounts({ enabled: true }))

    await waitFor(() =>
      expect(result.current.counts).toEqual({
        repair: 2,
        transfer: 3,
        maintenance: 4,
      })
    )

    expect(mocks.callRpc).toHaveBeenNthCalledWith(1, {
      fn: "header_notifications_summary",
      args: { p_don_vi: null },
    })
    expect(mocks.callRpc).toHaveBeenNthCalledWith(2, {
      fn: "maintenance_plan_status_counts",
      args: {},
    })
    expect(result.current.isLoading).toBe(false)
  })

  it("falls back maintenance to zero when maintenance counts fail", async () => {
    mocks.callRpc
      .mockResolvedValueOnce({
        pending_repairs: 1,
        pending_transfers: 2,
      })
      .mockRejectedValueOnce(new Error("unstable maintenance counts"))

    const { result } = renderHook(() => useAppNotificationCounts({ enabled: true }))

    await waitFor(() =>
      expect(result.current.counts).toEqual({
        repair: 1,
        transfer: 2,
        maintenance: 0,
      })
    )

    expect(result.current.isLoading).toBe(false)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Maintenance notification counts error:",
      expect.any(Error)
    )
  })

  it("does not fetch when disabled", async () => {
    const { result } = renderHook(() => useAppNotificationCounts({ enabled: false }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mocks.callRpc).not.toHaveBeenCalled()
    expect(result.current.counts).toEqual({
      repair: 0,
      transfer: 0,
      maintenance: 0,
    })
  })
})
