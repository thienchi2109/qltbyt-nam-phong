import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  callRpc: vi.fn(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import {
  repairRequestHistoryQueryKeys,
  useRepairRequestHistory,
} from "../_hooks/useRepairRequestHistory"

describe("useRepairRequestHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useQuery.mockImplementation((options: unknown) => options)
  })

  it("uses an app-scoped query key with request id, tenant, role, and diaBan", () => {
    renderHook(() =>
      useRepairRequestHistory({
        requestId: 42,
        effectiveTenantKey: "tenant-1",
        userRole: "to_qltb",
        userDiaBanId: "7",
        hasUser: true,
      }),
    )

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: repairRequestHistoryQueryKeys.detail({
          requestId: 42,
          tenant: "tenant-1",
          role: "to_qltb",
          diaBan: "7",
        }),
        enabled: true,
      }),
    )
  })

  it("calls the dedicated repair history RPC and normalizes empty payloads", async () => {
    mocks.callRpc.mockResolvedValueOnce(null)

    renderHook(() =>
      useRepairRequestHistory({
        requestId: 101,
        effectiveTenantKey: "tenant-1",
        userRole: "regional_leader",
        userDiaBanId: "1",
        hasUser: true,
      }),
    )

    const firstCall = mocks.useQuery.mock.calls[0]?.[0]
    expect(firstCall).toBeDefined()

    await expect(
      firstCall.queryFn({ signal: new AbortController().signal }),
    ).resolves.toEqual([])

    expect(mocks.callRpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "repair_request_change_history_list",
        args: { p_repair_request_id: 101 },
      }),
    )
  })

  it("disables the query when there is no authenticated user or request id", () => {
    renderHook(() =>
      useRepairRequestHistory({
        requestId: null,
        effectiveTenantKey: null,
        userRole: undefined,
        userDiaBanId: null,
        hasUser: false,
      }),
    )

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
  })
})
