import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RepairRequestsCompleteDialog } from "../_components/RepairRequestsCompleteDialog"
import type { RepairRequestWithEquipment } from "../types"

const mockMutate = vi.fn()
const mockCloseAllDialogs = vi.fn()

const mockContext = vi.hoisted(() => ({
  useRepairRequestsContext: vi.fn(),
}))

vi.mock("../_hooks/useRepairRequestsContext", () => ({
  useRepairRequestsContext: () => mockContext.useRepairRequestsContext(),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    variant?: string
  }) => (
    <button data-variant={variant} disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
  }: {
    children: React.ReactNode
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

const requestToComplete: RepairRequestWithEquipment = {
  id: 7,
  thiet_bi_id: 55,
  ngay_yeu_cau: "2026-01-01T00:00:00.000Z",
  trang_thai: "Đã duyệt",
  mo_ta_su_co: "Mất nguồn",
  hang_muc_sua_chua: "Nguồn cấp",
  ngay_mong_muon_hoan_thanh: null,
  nguoi_yeu_cau: "Nguyễn Văn A",
  ngay_duyet: "2026-01-02T00:00:00.000Z",
  ngay_hoan_thanh: null,
  nguoi_duyet: "Nguyễn Văn B",
  nguoi_xac_nhan: null,
  chi_phi_sua_chua: null,
  don_vi_thuc_hien: "noi_bo",
  ten_don_vi_thue: null,
  ket_qua_sua_chua: null,
  ly_do_khong_hoan_thanh: null,
  thiet_bi: {
    ten_thiet_bi: "Monitor",
    ma_thiet_bi: "TB-55",
    model: "M1",
    serial: "SN55",
    khoa_phong_quan_ly: "Khoa A",
    facility_name: "BV A",
    facility_id: 1,
  },
}

function setupContext(overrides?: Partial<ReturnType<typeof mockContext.useRepairRequestsContext>>) {
  mockContext.useRepairRequestsContext.mockReturnValue({
    dialogState: {
      requestToComplete,
      completionType: "Hoàn thành",
    },
    closeAllDialogs: mockCloseAllDialogs,
    completeMutation: {
      mutate: mockMutate,
      isPending: false,
    },
    ...overrides,
  })
}

describe("RepairRequestsCompleteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps Hoàn thành disabled for blank or whitespace-only repair results", async () => {
    const user = userEvent.setup()
    setupContext()

    render(<RepairRequestsCompleteDialog />)

    const confirmButton = screen.getByRole("button", { name: "Xác nhận hoàn thành" })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText("Kết quả sửa chữa"), "   ")
    expect(confirmButton).toBeDisabled()

    await user.click(confirmButton)
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it("enables Hoàn thành after a non-empty repair result and submits a trimmed payload", async () => {
    const user = userEvent.setup()
    setupContext()

    render(<RepairRequestsCompleteDialog />)

    await user.type(screen.getByLabelText("Kết quả sửa chữa"), "  Đã thay bộ nguồn  ")
    const confirmButton = screen.getByRole("button", { name: "Xác nhận hoàn thành" })

    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        completion: "Đã thay bộ nguồn",
        reason: null,
      }),
      { onSuccess: mockCloseAllDialogs }
    )
  })

  it("keeps Không HT disabled for blank or whitespace-only reasons", async () => {
    const user = userEvent.setup()
    setupContext({
      dialogState: {
        requestToComplete,
        completionType: "Không HT",
      },
    })

    render(<RepairRequestsCompleteDialog />)

    const confirmButton = screen.getByRole("button", { name: "Xác nhận không hoàn thành" })
    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText("Lý do không hoàn thành"), "   ")
    expect(confirmButton).toBeDisabled()

    await user.click(confirmButton)
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it("shows the optional repair cost field for Hoàn thành and submits a parsed numeric payload", async () => {
    const user = userEvent.setup()
    setupContext()

    render(<RepairRequestsCompleteDialog />)

    expect(screen.getByLabelText("Tổng chi phí sửa chữa")).toBeInTheDocument()
    expect(
      screen.getByText("Khuyến nghị nhập tổng chi phí để phục vụ thống kê và phân tích.")
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText("Kết quả sửa chữa"), "Đã thay bộ nguồn")
    const costInput = screen.getByLabelText("Tổng chi phí sửa chữa")
    await user.type(costInput, "1234567")

    expect(costInput).toHaveValue("1.234.567")

    await user.click(screen.getByRole("button", { name: "Xác nhận hoàn thành" }))

    expect(mockMutate).toHaveBeenCalledWith(
      {
        id: 7,
        completion: "Đã thay bộ nguồn",
        reason: null,
        repairCost: 1234567,
      },
      { onSuccess: mockCloseAllDialogs }
    )
  })

  it("submits a null repair cost when the field is left blank", async () => {
    const user = userEvent.setup()
    setupContext()

    render(<RepairRequestsCompleteDialog />)

    await user.type(screen.getByLabelText("Kết quả sửa chữa"), "Đã hiệu chỉnh")
    await user.click(screen.getByRole("button", { name: "Xác nhận hoàn thành" }))

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        repairCost: null,
      }),
      expect.any(Object)
    )
  })

  it("ignores oversized repair-cost input instead of crashing the dialog", async () => {
    setupContext()

    render(<RepairRequestsCompleteDialog />)

    const costInput = screen.getByLabelText("Tổng chi phí sửa chữa")

    expect(() => {
      fireEvent.change(costInput, { target: { value: "99999999999999999" } })
    }).not.toThrow()
    expect(costInput).toHaveValue("")
  })

  it("hides the repair cost field for Không HT", () => {
    setupContext({
      dialogState: {
        requestToComplete,
        completionType: "Không HT",
      },
    })

    render(<RepairRequestsCompleteDialog />)

    expect(screen.queryByLabelText("Tổng chi phí sửa chữa")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Lý do không hoàn thành")).toBeInTheDocument()
  })
})
