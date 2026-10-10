import * as React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { readyStatusCatalog } from "@/hooks/__tests__/equipment-status-catalog-fixtures"

const mockToast = vi.fn()
const mockCallRpc = vi.fn()
const mockCatalog = vi.fn()
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => mockCatalog(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: (args: unknown) => mockCallRpc(args),
}))

import { useEquipmentEditUpdate } from "../equipment-edit/useEquipmentEditUpdate"

const specialToast = {
  title: "Đã chuyển thiết bị",
  description:
    "Thiết bị đã được chuyển về cuối danh sách vì đang Ngưng sử dụng và thuộc Kho thanh lý.",
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe("useEquipmentEditUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCatalog.mockReturnValue(readyStatusCatalog)
  })

  it.each(["paused", "fetching", "error"])(
    "rejects a previously obtained update after catalog becomes %s",
    async (state) => {
      const { result, rerender } = renderHook(() => useEquipmentEditUpdate(), {
        wrapper: createWrapper(),
      })
      const update = result.current.updateEquipment
      mockCatalog.mockReturnValue({
        ...readyStatusCatalog,
        isSuccess: state !== "error",
        fetchStatus: state === "error" ? "idle" : state,
      })
      rerender()
      await expect(update({ id: 15, patch: { ten_thiet_bi: "Metadata mới" } })).rejects.toThrow()
      expect(mockCallRpc).not.toHaveBeenCalled()
    }
  )

  it("rejects new entry after deactivation but allows unchanged known inactive metadata", async () => {
    const catalog = {
      ...readyStatusCatalog,
      data: readyStatusCatalog.data.map((row) => ({ ...row, is_active: false })),
      activeValues: [],
      canWrite: false,
    }
    mockCatalog.mockReturnValue(catalog)
    const { result, rerender } = renderHook(
      ({ currentStatus }) => useEquipmentEditUpdate({ ...{ currentStatus } }),
      {
        initialProps: { currentStatus: "Chờ bảo trì" },
        wrapper: createWrapper(),
      }
    )
    await expect(
      result.current.updateEquipment({ id: 15, patch: { tinh_trang_hien_tai: "Hoạt động" } })
    ).rejects.toThrow()
    expect(mockCallRpc).not.toHaveBeenCalled()
    rerender({ currentStatus: "Hoạt động" })
    mockCallRpc.mockResolvedValueOnce(undefined)
    await expect(
      result.current.updateEquipment({
        id: 15,
        patch: { tinh_trang_hien_tai: "Hoạt động", ghi_chu: "Metadata mới" },
      })
    ).resolves.toMatchObject({ ghi_chu: "Metadata mới" })
  })

  it("rejects explicit unknown status without canonicalizing the raw value", async () => {
    const { result } = renderHook(
      () => useEquipmentEditUpdate({ ...{ currentStatus: "  Giá trị lịch sử  " } }),
      { wrapper: createWrapper() }
    )
    await expect(
      result.current.updateEquipment({
        id: 15,
        patch: { tinh_trang_hien_tai: "  Giá trị lịch sử  " },
      })
    ).rejects.toThrow()
    expect(mockCallRpc).not.toHaveBeenCalled()
  })

  it("submits equipment_update with the patch and shows one success toast", async () => {
    mockCallRpc.mockResolvedValueOnce(undefined)
    const onSuccess = vi.fn()

    const { result } = renderHook(
      () =>
        useEquipmentEditUpdate({
          successMessage: "Đã cập nhật thông tin thiết bị.",
          onSuccess,
        }),
      { wrapper: createWrapper() }
    )

    const patch = {
      ten_thiet_bi: "Máy siêu âm A",
      tinh_trang_hien_tai: "Hoạt động",
    }

    await result.current.updateEquipment({ id: 15, patch })

    expect(mockCallRpc).toHaveBeenCalledWith({
      fn: "equipment_update",
      args: {
        p_id: 15,
        p_patch: patch,
      },
    })
    expect(onSuccess).toHaveBeenCalledWith(patch)
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith({
      title: "Thành công",
      description: "Đã cập nhật thông tin thiết bị.",
    })
  })

  it("replaces the generic toast with one per-mutation success toast", async () => {
    mockCallRpc.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useEquipmentEditUpdate(), {
      wrapper: createWrapper(),
    })

    await result.current.updateEquipment({
      id: 16,
      patch: { ten_thiet_bi: "Máy theo dõi" },
      successToast: specialToast,
    })

    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith(specialToast)
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Thành công" }))
  })

  it("shows one normalized error toast and preserves the hook error state", async () => {
    mockCallRpc.mockRejectedValueOnce({ message: "Permission denied" })

    const { result } = renderHook(() => useEquipmentEditUpdate(), {
      wrapper: createWrapper(),
    })

    await expect(
      result.current.updateEquipment({
        id: 18,
        patch: { ten_thiet_bi: "Máy thở" },
      })
    ).rejects.toEqual({ message: "Permission denied" })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledTimes(1)
      expect(mockToast).toHaveBeenCalledWith({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể cập nhật thiết bị. Permission denied",
      })
      expect(result.current.error).toEqual({ message: "Permission denied" })
    })
  })
})
