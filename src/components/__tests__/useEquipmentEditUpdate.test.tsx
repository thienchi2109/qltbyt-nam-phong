import * as React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockToast = vi.fn()
const mockCallRpc = vi.fn()

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
