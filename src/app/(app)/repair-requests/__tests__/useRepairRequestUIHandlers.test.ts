import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("../request-sheet", () => ({
  buildRepairRequestSheetHtml: vi.fn(),
}))

import { useRepairRequestUIHandlers } from "../_hooks/useRepairRequestUIHandlers"
import { buildRepairRequestSheetHtml } from "../request-sheet"

const mockBuildRepairRequestSheetHtml = vi.mocked(buildRepairRequestSheetHtml)

describe("useRepairRequestUIHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("toasts the request-sheet generation error message for plain objects", () => {
    mockBuildRepairRequestSheetHtml.mockImplementation(() => {
      throw { message: "Thiếu thông tin thiết bị" }
    })

    const { result } = renderHook(() =>
      useRepairRequestUIHandlers({
        branding: null,
        toast: mocks.toast,
      })
    )

    act(() => {
      result.current.handleGenerateRequestSheet({
        id: 1,
        thiet_bi: { id: 2, ma_thiet_bi: "TB001", ten_thiet_bi: "Máy A" },
      } as never)
    })

    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "Thiếu thông tin thiết bị",
      })
    )
  })
})
