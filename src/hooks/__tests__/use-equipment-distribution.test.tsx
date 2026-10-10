import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useEquipmentDistribution } from "../use-equipment-distribution"
import {
  rpcDistribution,
  statusCounts,
  statusCatalog,
} from "./equipment-status-distribution-fixtures"

const rpc = vi.hoisted(() => vi.fn())
vi.mock("@/lib/rpc-client", () => ({ callRpc: (...args: unknown[]) => rpc(...args) }))
function Wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
describe("catalog distribution RPC adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue(rpcDistribution)
  })
  it("preserves the RPC count keys and catalog metadata without losing department or location overloads", async () => {
    const { result } = renderHook(
      () => useEquipmentDistribution("Khoa Nội", "101", "42", 42, "42"),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({
      totalEquipment: 8,
      statusCounts,
      statusCatalog,
      byDepartment: rpcDistribution.by_department,
      byLocation: rpcDistribution.by_location,
    })
    expect(rpc).toHaveBeenCalledWith(
      expect.objectContaining({
        fn: "equipment_status_distribution",
        args: { p_q: null, p_don_vi: 42, p_khoa_phong: "Khoa Nội", p_vi_tri: "101" },
      })
    )
  })
  it("retains zero-count catalog metadata when the distribution has no equipment", async () => {
    rpc.mockResolvedValue({
      ...rpcDistribution,
      total_equipment: 0,
      by_department: [],
      by_location: [],
      status_counts: Object.fromEntries(Object.keys(statusCounts).map((key) => [key, 0])),
    })
    const { result } = renderHook(
      () => useEquipmentDistribution(undefined, undefined, undefined, 42, "42"),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({
      statusCatalog,
      statusCounts: { "Thanh lý nội bộ": 0, "Đang đánh giá kỹ thuật": 0 },
      totalEquipment: 0,
    })
  })
  it("preserves the actual RPC khac bucket without inventing raw historical count keys", async () => {
    const { "Giá trị lịch sử": historical, ...knownCounts } = statusCounts
    const rpcCounts = { ...knownCounts, khac: knownCounts.khac + historical }
    const row = { name: "Khoa Nội", total: 8, ...rpcCounts }
    rpc.mockResolvedValue({
      ...rpcDistribution,
      status_counts: rpcCounts,
      by_department: [row],
      by_location: [{ ...row, name: "101" }],
    })
    const { result } = renderHook(
      () => useEquipmentDistribution(undefined, undefined, undefined, 42, "42"),
      { wrapper: Wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.statusCounts).toEqual(rpcCounts)
    expect(result.current.data?.statusCounts?.khac).toBe(2)
    expect(result.current.data?.statusCounts).not.toHaveProperty("Giá trị lịch sử")
  })
  it("keeps old responses without catalog or overall counts compatible", async () => {
    const { status_catalog: _catalog, status_counts: _counts, ...legacy } = rpcDistribution
    rpc.mockResolvedValue(legacy)
    const { result } = renderHook(() => useEquipmentDistribution(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toMatchObject({
      totalEquipment: 8,
      byDepartment: legacy.by_department,
      byLocation: legacy.by_location,
    })
    expect(result.current.data?.statusCatalog).toBeUndefined()
    expect(result.current.data?.statusCounts).toBeUndefined()
  })
  it.each([
    ["Khoa Nội", undefined],
    [undefined, "101"],
  ])(
    "keeps legacy department/location filtering %s %s compatible without catalog metadata",
    async (department, location) => {
      const { status_catalog: _catalog, ...legacy } = rpcDistribution
      rpc.mockResolvedValue(legacy)
      const { result } = renderHook(
        () => useEquipmentDistribution(department, location, "42", 42, "42"),
        { wrapper: Wrapper }
      )
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toMatchObject({
        byDepartment: legacy.by_department,
        byLocation: legacy.by_location,
        statusCounts,
      })
      expect(result.current.data).not.toHaveProperty("statusCatalog", expect.any(Array))
      expect(rpc).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            p_khoa_phong: department ?? null,
            p_vi_tri: location ?? null,
          }),
        })
      )
    }
  )
})
