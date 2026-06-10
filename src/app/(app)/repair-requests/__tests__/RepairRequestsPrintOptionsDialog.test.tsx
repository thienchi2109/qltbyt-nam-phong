import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { RepairRequestsPrintOptionsDialog } from "../_components/RepairRequestsPrintOptionsDialog"
import type { RepairRequestWithEquipment } from "../types"

const mockCloseAllDialogs = vi.fn()
const mockContext = vi.hoisted(() => ({
  useRepairRequestsContext: vi.fn(),
  handleGenerateRequestSheet: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("../_hooks/useRepairRequestsContext", () => ({
  useRepairRequestsContext: () => mockContext.useRepairRequestsContext(),
}))

vi.mock("../_hooks/useRepairRequestUIHandlers", () => ({
  useRepairRequestUIHandlers: () => ({
    handleGenerateRequestSheet: mockContext.handleGenerateRequestSheet,
  }),
}))

vi.mock("@/hooks/use-tenant-branding", () => ({
  useTenantBranding: () => ({
    data: {
      name: "CDC Cần Thơ",
      logo_url: "https://example.com/logo.png",
    },
  }),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockContext.toast }),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: {
    readonly children: React.ReactNode
    readonly onClick?: () => void
    readonly variant?: string
  }) => (
    <button data-variant={variant} onClick={onClick} type="button">
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    readonly children: React.ReactNode
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
  }) => (open ? <div data-testid="print-options-dialog">{children}</div> : null),
  DialogContent: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { readonly children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { readonly children: React.ReactNode }) => <h2>{children}</h2>,
}))

const requestToPrint: RepairRequestWithEquipment = {
  id: 7,
  thiet_bi_id: 55,
  ngay_yeu_cau: "2026-05-01",
  trang_thai: "Chờ xử lý",
  mo_ta_su_co: "Không lên nguồn",
  hang_muc_sua_chua: null,
  ngay_mong_muon_hoan_thanh: null,
  nguoi_yeu_cau: "Nguyễn Văn A",
  ngay_duyet: null,
  ngay_hoan_thanh: null,
  nguoi_duyet: null,
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

function setupContext(request: RepairRequestWithEquipment | null = requestToPrint) {
  mockContext.useRepairRequestsContext.mockReturnValue({
    dialogState: { requestToPrint: request },
    closeAllDialogs: mockCloseAllDialogs,
  })
}

describe("RepairRequestsPrintOptionsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("prints with requester name prefilled from the primary action", async () => {
    const user = userEvent.setup()
    mockContext.handleGenerateRequestSheet.mockReturnValue(true)
    setupContext()

    render(<RepairRequestsPrintOptionsDialog />)

    await user.click(screen.getByRole("button", { name: "Điền sẵn tên" }))

    expect(mockContext.handleGenerateRequestSheet).toHaveBeenCalledWith(requestToPrint, {
      prefillRequesterName: true,
    })
    expect(mockCloseAllDialogs).toHaveBeenCalledTimes(1)
  })

  it("prints with the requester signature name blank from the secondary action", async () => {
    const user = userEvent.setup()
    mockContext.handleGenerateRequestSheet.mockReturnValue(true)
    setupContext()

    render(<RepairRequestsPrintOptionsDialog />)

    await user.click(screen.getByRole("button", { name: "Bỏ trống tên" }))

    expect(mockContext.handleGenerateRequestSheet).toHaveBeenCalledWith(requestToPrint, {
      prefillRequesterName: false,
    })
    expect(mockCloseAllDialogs).toHaveBeenCalledTimes(1)
  })

  it("keeps the dialog open when sheet generation fails", async () => {
    const user = userEvent.setup()
    mockContext.handleGenerateRequestSheet.mockReturnValue(false)
    setupContext()

    render(<RepairRequestsPrintOptionsDialog />)

    await user.click(screen.getByRole("button", { name: "Điền sẵn tên" }))

    expect(mockContext.handleGenerateRequestSheet).toHaveBeenCalledWith(requestToPrint, {
      prefillRequesterName: true,
    })
    expect(mockCloseAllDialogs).not.toHaveBeenCalled()
  })

  it("does not render when no request is pending print", () => {
    setupContext(null)

    render(<RepairRequestsPrintOptionsDialog />)

    expect(screen.queryByTestId("print-options-dialog")).not.toBeInTheDocument()
  })
})
