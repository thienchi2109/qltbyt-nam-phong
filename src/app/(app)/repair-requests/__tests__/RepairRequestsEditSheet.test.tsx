import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RepairRequestWithEquipment } from "../types"

const mocks = vi.hoisted(() => ({
  closeAllDialogs: vi.fn(),
  updateMutate: vi.fn(),
}))

function makeRepairRequest(): RepairRequestWithEquipment {
  return {
    id: 42,
    thiet_bi_id: 7,
    ngay_yeu_cau: "2026-05-01T00:00:00.000Z",
    trang_thai: "Chờ xử lý",
    mo_ta_su_co: "Máy không hoạt động",
    hang_muc_sua_chua: "Kiểm tra nguồn",
    ngay_mong_muon_hoan_thanh: "2026-05-03",
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
      ten_thiet_bi: "Máy siêu âm",
      ma_thiet_bi: "TB-EDIT",
      model: null,
      serial: null,
      khoa_phong_quan_ly: "Khoa Khám bệnh",
      facility_name: "Bệnh viện A",
      facility_id: 1,
    },
  }
}

const contextValue = {
  dialogState: {
    requestToEdit: makeRepairRequest(),
  },
  closeAllDialogs: mocks.closeAllDialogs,
  updateMutation: {
    mutate: mocks.updateMutate,
    isPending: false,
  },
  canSetRepairUnit: true,
}

vi.mock("../_hooks/useRepairRequestsContext", () => ({
  useRepairRequestsContext: () => contextValue,
}))

vi.mock("@/components/shared/SideSheetShell", () => ({
  SideSheetShell: ({
    bodyClassName,
    children,
    contentClassName,
    description,
    onOpenChange,
    open,
    title,
  }: {
    bodyClassName?: string
    children: React.ReactNode
    contentClassName?: string
    description?: React.ReactNode
    onOpenChange: (open: boolean) => void
    open: boolean
    title: React.ReactNode
  }) =>
    open ? (
      <section
        data-testid="edit-side-sheet"
        data-body-class={bodyClassName}
        data-content-class={contentClassName}
        data-open={open}
      >
        <h2>{title}</h2>
        <p>{description}</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          close edit sheet
        </button>
        {children}
      </section>
    ) : null,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div>calendar</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

import { RepairRequestsEditDialog } from "../_components/RepairRequestsEditDialog"

describe("RepairRequestsEditDialog side sheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the edit form in the shared side-sheet shell", async () => {
    const user = userEvent.setup()

    render(<RepairRequestsEditDialog />)

    const sheet = screen.getByTestId("edit-side-sheet")
    expect(sheet).toHaveAttribute("data-open", "true")
    expect(sheet).toHaveAttribute("data-content-class", "sm:max-w-lg")
    expect(sheet).toHaveAttribute("data-body-class", "mt-4 overflow-y-auto px-4 pb-4")
    expect(screen.getByText("Sửa yêu cầu sửa chữa")).toBeInTheDocument()
    expect(screen.getByText(/Máy siêu âm/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "close edit sheet" }))
    expect(mocks.closeAllDialogs).toHaveBeenCalledTimes(1)
  })

  it("submits the current edit payload through the existing update mutation", async () => {
    const user = userEvent.setup()

    render(<RepairRequestsEditDialog />)

    await user.clear(screen.getByLabelText("Mô tả sự cố"))
    await user.type(screen.getByLabelText("Mô tả sự cố"), "Mô tả đã cập nhật")
    await user.clear(screen.getByLabelText("Các hạng mục yêu cầu sửa chữa"))
    await user.type(screen.getByLabelText("Các hạng mục yêu cầu sửa chữa"), "Thay nguồn")
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    expect(mocks.updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 42,
        hang_muc_sua_chua: "Thay nguồn",
        mo_ta_su_co: "Mô tả đã cập nhật",
        ngay_mong_muon_hoan_thanh: "2026-05-03",
      }),
      { onSuccess: mocks.closeAllDialogs }
    )
  })
})
