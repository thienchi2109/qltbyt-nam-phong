import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TransferRequest } from "@/types/database"

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

import { HandoverPreviewDialog } from "@/components/handover-preview-dialog"

function makeTransfer(overrides: Partial<TransferRequest> = {}): TransferRequest {
  return {
    id: 1,
    ma_yeu_cau: "LC-0001",
    thiet_bi_id: 10,
    loai_hinh: "noi_bo",
    trang_thai: "da_duyet",
    ly_do_luan_chuyen: "Bàn giao phục vụ khám bệnh",
    khoa_phong_hien_tai: "Khoa Cấp cứu",
    khoa_phong_nhan: "Khoa Nội",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    thiet_bi: {
      id: 10,
      ma_thiet_bi: "TB-001",
      ten_thiet_bi: "Máy thở",
      model: "M-100",
      serial_number: "SN-001",
      tinh_trang: "Hoạt động",
    },
    ...overrides,
  }
}

function createWindowOpenMock() {
  const fakeDocument = {
    open: vi.fn(),
    write: vi.fn(),
    close: vi.fn(),
  } as unknown as Document
  const fakeWindow = {
    document: fakeDocument,
    print: vi.fn(),
    onload: null,
  } as unknown as Window

  return {
    fakeDocument,
    fakeWindow,
    openSpy: vi.spyOn(window, "open").mockReturnValue(fakeWindow),
  }
}

describe("HandoverPreviewDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("opens a preview window with generated handover content", async () => {
    const { fakeDocument, openSpy } = createWindowOpenMock()

    render(
      <HandoverPreviewDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransfer()}
      />,
    )

    await screen.findByText("Xem trước phiếu bàn giao - LC-0001")
    fireEvent.click(screen.getByRole("button", { name: /Xem trước/ }))

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith("", "_blank")
    })
    expect(fakeDocument.write).toHaveBeenCalledWith(expect.stringContaining("LC-0001"))
    expect(fakeDocument.write).toHaveBeenCalledWith(expect.stringContaining("Máy thở"))
  })

  it("blocks printing and switches to editing when required fields are blank", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null)

    render(
      <HandoverPreviewDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransfer()}
      />,
    )

    await screen.findByText("Xem trước phiếu bàn giao - LC-0001")
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }))
    fireEvent.change(screen.getByLabelText("Lý do bàn giao"), { target: { value: " " } })
    fireEvent.click(screen.getByRole("button", { name: /In phiếu/ }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "⚠️ Thiếu thông tin bắt buộc",
        }),
      )
    })
    expect(openSpy).not.toHaveBeenCalled()
  })
})
