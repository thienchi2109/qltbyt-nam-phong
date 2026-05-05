import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  callRpc: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

vi.mock("next-auth/react", () => ({
  useSession: mocks.useSession,
}))

import { useRecentActivities } from "@/hooks/use-recent-activities"

describe("useRecentActivities", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useQuery.mockImplementation((options: unknown) => options)
    mocks.useSession.mockReturnValue({
      data: { user: { id: 1, role: "global" } },
      status: "authenticated",
    })
  })

  it("uses the dedicated dashboard_recent_activities RPC with the provided limit", async () => {
    mocks.callRpc.mockResolvedValueOnce([])

    renderHook(() => useRecentActivities(7))

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["dashboard-recent-activities", "1", 7],
        enabled: true,
      }),
    )

    const firstCall = mocks.useQuery.mock.calls[0]?.[0]
    expect(firstCall).toBeDefined()

    await expect(firstCall.queryFn()).resolves.toEqual([])

    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "dashboard_recent_activities",
      args: { p_limit: 7 },
    })
  })

  it("keeps the query disabled while session hydration is still loading", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: 1, role: "global" } },
      status: "loading",
    })

    renderHook(() => useRecentActivities())

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["dashboard-recent-activities", "1", 15],
        enabled: false,
      }),
    )
  })

  it("disables the query when there is no authenticated session", () => {
    mocks.useSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    })

    renderHook(() => useRecentActivities())

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["dashboard-recent-activities", "anonymous", 15],
        enabled: false,
      }),
    )
  })
})
