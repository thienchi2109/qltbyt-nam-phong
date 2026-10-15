import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useSession: vi.fn(),
  callRpc: vi.fn(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { useEquipmentAttention, useEquipmentAttentionPaginated } from "@/hooks/use-dashboard-stats"

describe("use-dashboard-stats session gating", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useQuery.mockImplementation((options: unknown) => options)
    mocks.callRpc.mockResolvedValue([])
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

  it("pins equipment attention RPCs to the regular dataset", () => {
    renderHook(() => useEquipmentAttention())
    const attentionOptions = mocks.useQuery.mock.calls[0]?.[0] as {
      queryFn: () => Promise<unknown>
    }
    return attentionOptions.queryFn().then(() => {
      expect(mocks.callRpc).toHaveBeenCalledWith({
        fn: "equipment_attention_list",
        args: { p_limit: 5, p_equipment_dataset: "regular" },
      })
    })
  })

  it("pins paginated attention rows to the regular dataset", () => {
    renderHook(() => useEquipmentAttentionPaginated({ page: 2, pageSize: 25 }))
    const options = mocks.useQuery.mock.calls[0]?.[0] as { queryFn: () => Promise<unknown> }
    return options.queryFn().then(() => {
      expect(mocks.callRpc).toHaveBeenCalledWith({
        fn: "equipment_attention_list_paginated",
        args: { p_page: 2, p_page_size: 25, p_equipment_dataset: "regular" },
      })
    })
  })
})
