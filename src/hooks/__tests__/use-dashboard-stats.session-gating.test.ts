import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

import {
  useEquipmentAttention,
  useEquipmentAttentionPaginated,
} from "@/hooks/use-dashboard-stats"

describe("use-dashboard-stats session gating", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useQuery.mockImplementation((options: unknown) => options)
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1", role: "global", dia_ban_id: 12 } },
      status: "authenticated",
    })
  })

  it("keeps equipment attention disabled while session hydration is loading", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1", role: "global", dia_ban_id: 12 } },
      status: "loading",
    })

    renderHook(() => useEquipmentAttention())

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["dashboard-stats", "equipment-attention", "global", "12"],
        enabled: false,
      })
    )
  })

  it("keeps paginated equipment attention disabled while session hydration is loading", () => {
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1", role: "global", dia_ban_id: 12 } },
      status: "loading",
    })

    renderHook(() =>
      useEquipmentAttentionPaginated({
        page: 2,
        pageSize: 25,
        enabled: true,
      })
    )

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["dashboard-stats", "equipment-attention", "global", "12", 2, 25],
        enabled: false,
      })
    )
  })

  it("enables paginated equipment attention only after authenticated session is ready", () => {
    renderHook(() =>
      useEquipmentAttentionPaginated({
        page: 2,
        pageSize: 25,
        enabled: true,
      })
    )

    expect(mocks.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["dashboard-stats", "equipment-attention", "global", "12", 2, 25],
        enabled: true,
      })
    )
  })
})
