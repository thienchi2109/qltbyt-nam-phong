import * as React from "react"
import { QueryClient, QueryClientProvider, type UseMutationResult } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { EquipmentPreviewItem } from "@/app/(app)/device-quota/_components/mapping-preview/MappingPreviewPrimitives"
import { callRpc } from "@/lib/rpc-client"
import type { CategoryListItem } from "../_types/categories"
import * as categoryAssignmentHooks from "../_hooks/useDeviceQuotaCategoryAssignment"
import { deviceQuotaCategoryAssignedEquipmentQueryKey } from "../_queries/deviceQuotaCategoryAssignedEquipmentQuery"

const mockToast = vi.fn()

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockCallRpc = vi.mocked(callRpc)

type UnassignmentVariables = {
  thiet_bi_ids: [number]
  nhom_id: number
  donViId: number
}

type UseDeviceQuotaCategoryUnassignment = () => UseMutationResult<
  number,
  Error,
  UnassignmentVariables,
  unknown
>

const useUnassignmentCandidate = (
  categoryAssignmentHooks as typeof categoryAssignmentHooks & {
    useDeviceQuotaCategoryUnassignment?: UseDeviceQuotaCategoryUnassignment
  }
).useDeviceQuotaCategoryUnassignment

const ASSIGNED_KEY = deviceQuotaCategoryAssignedEquipmentQueryKey(5, 7)
const CATEGORY_LIST_KEY = ["dinh_muc_nhom_list", { donViId: 7 }] as const
const UNASSIGNED_KEY = ["dinh_muc_thiet_bi_unassigned", { donViId: 7 }] as const
const FILTER_OPTIONS_KEY = ["dinh_muc_thiet_bi_unassigned_filter_options", { donViId: 7 }] as const
const COMPLIANCE_KEY = ["dinh_muc_compliance_summary", { donViId: 7 }] as const
const VARIABLES: UnassignmentVariables = {
  thiet_bi_ids: [101],
  nhom_id: 5,
  donViId: 7,
}

const equipment: EquipmentPreviewItem = {
  id: 101,
  ma_thiet_bi: "TB-001",
  ten_thiet_bi: "Máy X quang",
  model: null,
  serial: null,
  hang_san_xuat: null,
  khoa_phong_quan_ly: null,
  tinh_trang: "Hoạt động",
}

const category: CategoryListItem = {
  id: 5,
  parent_id: null,
  ma_nhom: "CĐHA",
  ten_nhom: "Chẩn đoán hình ảnh",
  phan_loai: "A",
  don_vi_tinh: null,
  thu_tu_hien_thi: 1,
  level: 1,
  so_luong_hien_co: 3,
  so_luong_toi_da: 5,
  so_luong_toi_thieu: 2,
  mo_ta: null,
}

function useUnassignmentUnderTest() {
  if (!useUnassignmentCandidate) {
    throw new Error("Phase 0 RED: useDeviceQuotaCategoryUnassignment has not been implemented")
  }
  return useUnassignmentCandidate()
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 5 * 60 * 1000 },
      mutations: { retry: false },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function seedVisibleCaches(queryClient: QueryClient) {
  queryClient.setQueryData(ASSIGNED_KEY, [equipment])
  queryClient.setQueryData(CATEGORY_LIST_KEY, [category])
  queryClient.setQueryData(UNASSIGNED_KEY, [])
  queryClient.setQueryData(FILTER_OPTIONS_KEY, [])
  queryClient.setQueryData(COMPLIANCE_KEY, [{ nhom_id: 5, so_luong_hien_co: 3 }])
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

async function runUnassignment(queryClient: QueryClient) {
  const rendered = renderHook(() => useUnassignmentUnderTest(), {
    wrapper: createWrapper(queryClient),
  })

  await act(async () => {
    await rendered.result.current.mutateAsync(VARIABLES)
  })

  return rendered
}

describe("useDeviceQuotaCategoryUnassignment RED contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sends one unlink RPC with the equipment, expected category, and captured tenant", async () => {
    const queryClient = createQueryClient()
    seedVisibleCaches(queryClient)
    mockCallRpc.mockResolvedValue(1)

    await runUnassignment(queryClient)

    expect(mockCallRpc).toHaveBeenCalledTimes(1)
    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "dinh_muc_thiet_bi_unlink",
      args: {
        p_thiet_bi_ids: [101],
        p_nhom_id: 5,
        p_don_vi: 7,
      },
    })
  })

  it("cancels matching reads before patching visible caches and avoids immediate reads", async () => {
    const queryClient = createQueryClient()
    seedVisibleCaches(queryClient)
    const cancelQueries = vi.spyOn(queryClient, "cancelQueries")
    const setQueryData = vi.spyOn(queryClient, "setQueryData")
    const fetchQuery = vi.spyOn(queryClient, "fetchQuery")
    const refetchQueries = vi.spyOn(queryClient, "refetchQueries")
    mockCallRpc.mockResolvedValue(1)

    await runUnassignment(queryClient)

    for (const queryKey of [
      ASSIGNED_KEY,
      CATEGORY_LIST_KEY,
      UNASSIGNED_KEY,
      FILTER_OPTIONS_KEY,
      COMPLIANCE_KEY,
    ]) {
      expect(cancelQueries).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey,
        })
      )
    }
    expect(Math.max(...cancelQueries.mock.invocationCallOrder)).toBeLessThan(
      Math.min(...setQueryData.mock.invocationCallOrder)
    )
    expect(queryClient.getQueryData(ASSIGNED_KEY)).toEqual([])
    expect(queryClient.getQueryData<CategoryListItem[]>(CATEGORY_LIST_KEY)?.[0]).toMatchObject({
      id: 5,
      so_luong_hien_co: 2,
    })
    expect(fetchQuery).not.toHaveBeenCalled()
    expect(refetchQueries).not.toHaveBeenCalled()
    expect(mockCallRpc).toHaveBeenCalledTimes(1)
  })

  it("prevents a delayed pre-mutation assigned read from restoring the removed row", async () => {
    const queryClient = createQueryClient()
    seedVisibleCaches(queryClient)
    const delayedAssignedRead = createDeferred<EquipmentPreviewItem[]>()
    await queryClient.invalidateQueries({
      queryKey: ASSIGNED_KEY,
      exact: true,
      refetchType: "none",
    })
    const staleRead = queryClient
      .fetchQuery({
        queryKey: ASSIGNED_KEY,
        queryFn: () => delayedAssignedRead.promise,
        staleTime: 0,
      })
      .catch(() => undefined)
    mockCallRpc.mockResolvedValue(1)

    await waitFor(() => {
      expect(queryClient.getQueryState(ASSIGNED_KEY)?.fetchStatus).toBe("fetching")
    })
    await runUnassignment(queryClient)
    expect(queryClient.getQueryData(ASSIGNED_KEY)).toEqual([])

    delayedAssignedRead.resolve([equipment])
    await staleRead

    expect(queryClient.getQueryData(ASSIGNED_KEY)).toEqual([])
  })

  it("removes a stale assigned row without decrementing count when zero rows are affected", async () => {
    const queryClient = createQueryClient()
    seedVisibleCaches(queryClient)
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries")
    const fetchQuery = vi.spyOn(queryClient, "fetchQuery")
    mockCallRpc.mockResolvedValue(0)

    await runUnassignment(queryClient)

    expect(queryClient.getQueryData(ASSIGNED_KEY)).toEqual([])
    expect(queryClient.getQueryData<CategoryListItem[]>(CATEGORY_LIST_KEY)?.[0]).toMatchObject({
      id: 5,
      so_luong_hien_co: 3,
    })
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ASSIGNED_KEY,
        refetchType: "none",
      })
    )
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: CATEGORY_LIST_KEY,
        refetchType: "none",
      })
    )
    expect(fetchQuery).not.toHaveBeenCalled()
    expect(mockCallRpc).toHaveBeenCalledTimes(1)
  })

  it("leaves caches unchanged and reports the mutation error", async () => {
    const queryClient = createQueryClient()
    seedVisibleCaches(queryClient)
    const assignedBefore = queryClient.getQueryData(ASSIGNED_KEY)
    const categoriesBefore = queryClient.getQueryData(CATEGORY_LIST_KEY)
    mockCallRpc.mockRejectedValue(new Error("unlink denied"))

    const rendered = renderHook(() => useUnassignmentUnderTest(), {
      wrapper: createWrapper(queryClient),
    })

    await expect(
      act(async () => {
        await rendered.result.current.mutateAsync(VARIABLES)
      })
    ).rejects.toThrow("unlink denied")

    expect(queryClient.getQueryData(ASSIGNED_KEY)).toBe(assignedBefore)
    expect(queryClient.getQueryData(CATEGORY_LIST_KEY)).toBe(categoriesBefore)
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "unlink denied",
      })
    )
  })
})
