import { renderHook, waitFor } from "@testing-library/react"
import { useQuery } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { EquipmentPreviewItem } from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import { callRpc } from "@/lib/rpc-client"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"
import { deviceQuotaCategoryAssignedEquipmentQueryKey } from "../_queries/deviceQuotaCategoryAssignedEquipmentQuery"
import { runUnassignment } from "./DeviceQuotaCategoryUnassignmentHookHarness"
import {
  ASSIGNED_KEY,
  equipment,
  seedVisibleCaches,
  UNASSIGNED_KEY,
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
    mockCallRpc.mockResolvedValueOnce(1).mockResolvedValueOnce([equipment])

    await runUnassignment(queryClient)

    expect(queryClient.getQueryState(UNASSIGNED_KEY)?.isInvalidated).toBe(true)
    expect(mockCallRpc).toHaveBeenCalledTimes(1)

    const rendered = renderHook(
      () =>
        useQuery({
          queryKey: UNASSIGNED_KEY,
          queryFn: () =>
            callRpc<EquipmentPreviewItem[]>({
              fn: "dinh_muc_thiet_bi_unassigned",
              args: { p_don_vi: 7 },
            }),
          staleTime: Infinity,
        }),
      { wrapper: createReactQueryWrapper(queryClient) }
    )

    await waitFor(() => {
      expect(rendered.result.current.data).toEqual([equipment])
    })
    expect(queryClient.getQueryState(UNASSIGNED_KEY)?.isInvalidated).toBe(false)
    expect(
      mockCallRpc.mock.calls.filter(([request]) => request.fn === "dinh_muc_thiet_bi_unassigned")
    ).toHaveLength(1)
    expect(mockCallRpc).toHaveBeenCalledTimes(2)
  })
})
