import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useRepairRequestUIHandlers } from "../_hooks/useRepairRequestUIHandlers"
import { buildRepairRequestSheetHtml } from "../request-sheet"
import type { RepairRequestWithEquipment } from "../types"

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("../request-sheet", () => ({
  buildRepairRequestSheetHtml: vi.fn(),
}))

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

  it("passes requester prefill options to the print template builder", () => {
    mockBuildRepairRequestSheetHtml.mockReturnValue("<html><body>print</body></html>")

    const documentMock = {
      close: vi.fn(),
      open: vi.fn(),
      write: vi.fn(),
    }
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockReturnValue({ document: documentMock } as unknown as Window)
    const request = { id: 7 } as RepairRequestWithEquipment

    const { result } = renderHook(() =>
      useRepairRequestUIHandlers({
        branding: {
          name: "CDC Cần Thơ",
          logo_url: "https://example.com/logo.png",
        },
        toast: mocks.toast,
      })
    )

    result.current.handleGenerateRequestSheet(request, { prefillRequesterName: false })

    expect(mockBuildRepairRequestSheetHtml).toHaveBeenCalledWith(
      request,
      {
        organizationName: "CDC Cần Thơ",
        logoUrl: "https://example.com/logo.png",
      },
      { prefillRequesterName: false }
    )
    expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank")
    expect(documentMock.write).toHaveBeenCalledWith("<html><body>print</body></html>")
  })
})
