import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { EquipmentPreviewItem } from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import { useDeviceQuotaManualMappingEquipment } from "@/app/(app)/device-quota/_hooks/useDeviceQuotaManualMappingEquipment"
import { callRpc } from "@/lib/rpc-client"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { deviceQuotaCategoryAssignedEquipmentQueryKey } from "../_queries/deviceQuotaCategoryAssignedEquipmentQuery"
import { runUnassignment } from "./DeviceQuotaCategoryUnassignmentHookHarness"
import {
  ASSIGNED_KEY,
  equipment,
  seedVisibleCaches,
} from "./DeviceQuotaCategoryUnassignmentTestSupport"

const mockToast = vi.fn()

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

describe("useDeviceQuotaCategoryUnassignment integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps a concurrently moved assignment intact when the expected-category RPC affects zero rows", async () => {
    const queryClient = createTestQueryClient()
    seedVisibleCaches(queryClient)
    const movedAssignmentKey = deviceQuotaCategoryAssignedEquipmentQueryKey(6, 7)
    queryClient.setQueryDefaults([movedAssignmentKey[0]], { gcTime: Infinity })
    queryClient.setQueryData(movedAssignmentKey, Object.freeze([equipment]))
    const movedAssignmentBefore =
      queryClient.getQueryData<EquipmentPreviewItem[]>(movedAssignmentKey)
    mockCallRpc.mockResolvedValue(0)

    await runUnassignment(queryClient)

    expect(queryClient.getQueryData(ASSIGNED_KEY)).toEqual([])
    expect(queryClient.getQueryData(movedAssignmentKey)).toBe(movedAssignmentBefore)
    expect(queryClient.getQueryState(movedAssignmentKey)?.isInvalidated).toBe(false)
    expect(mockCallRpc).toHaveBeenCalledTimes(1)
  })

  it("refetches an inactive stale query when its consuming surface later mounts", async () => {
    const queryClient = createTestQueryClient()
    seedVisibleCaches(queryClient)
    const equipmentQueryKey = [
      "dinh_muc_thiet_bi_unassigned",
      {
        donViId: 7,
        search: "",
        departments: [],
        users: [],
        locations: [],
        fundingSources: [],
        page: 1,
        pageSize: 20,
      },
    ] as const
    mockCallRpc.mockImplementation(({ fn }) => {
      if (fn === "dinh_muc_thiet_bi_unlink") return Promise.resolve(1)
      if (fn === "dinh_muc_thiet_bi_unassigned_filter_options") {
        return Promise.resolve({
          departments: [],
          users: [],
          locations: [],
          fundingSources: [],
        })
      }
      if (fn === "dinh_muc_thiet_bi_unassigned") {
        return Promise.resolve([{ ...equipment, total_count: 1 }])
      }
      return Promise.resolve([])
    })
    const wrapper = createReactQueryWrapper(queryClient)
    const firstConsumer = renderHook(() => useDeviceQuotaManualMappingEquipment({ donViId: 7 }), {
      wrapper,
    })

    await waitFor(() => {
      expect(firstConsumer.result.current.unassignedEquipment).toEqual([equipment])
    })
    expect(
      mockCallRpc.mock.calls.filter(([request]) => request.fn === "dinh_muc_thiet_bi_unassigned")
    ).toHaveLength(1)
    firstConsumer.unmount()

    await runUnassignment(queryClient)

    expect(queryClient.getQueryState(equipmentQueryKey)?.isInvalidated).toBe(true)
    expect(
      mockCallRpc.mock.calls.filter(([request]) => request.fn === "dinh_muc_thiet_bi_unassigned")
    ).toHaveLength(1)
    expect(
      mockCallRpc.mock.calls.filter(([request]) => request.fn === "dinh_muc_thiet_bi_unlink")
    ).toHaveLength(1)

    const secondConsumer = renderHook(() => useDeviceQuotaManualMappingEquipment({ donViId: 7 }), {
      wrapper,
    })

    await waitFor(() => {
      expect(secondConsumer.result.current.unassignedEquipment).toEqual([equipment])
      expect(
        mockCallRpc.mock.calls.filter(([request]) => request.fn === "dinh_muc_thiet_bi_unassigned")
      ).toHaveLength(2)
    })
    expect(queryClient.getQueryState(equipmentQueryKey)?.isInvalidated).toBe(false)
  })
})
