import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
  toast: vi.fn(),
  useSession: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/hooks/use-debounce", () => ({
  useSearchDebounce: (value: string) => value,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
    disabled?: boolean
  }) => (
    <select
      disabled={disabled}
      value={value ?? ""}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{typeof children === "string" ? children : value}</option>
  ),
}))

import { AddTransferDialog } from "@/components/add-transfer-dialog"

describe("AddTransferDialog payload shaping", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "42",
          role: "to_qltb",
        },
      },
      status: "authenticated",
    })
  })

  it("drops stale external fields after switching from external to internal transfer", async () => {
    mocks.callRpc.mockImplementation(async ({ fn }: { fn: string }) => {
      if (fn === "departments_list") {
        return [{ name: "Khoa A" }, { name: "Khoa B" }]
      }

      if (fn === "equipment_list_enhanced") {
        return {
          data: [
            {
              id: 11,
              ma_thiet_bi: "TB-11",
              ten_thiet_bi: "Máy siêu âm",
              khoa_phong_quan_ly: "Khoa A",
            },
          ],
        }
      }

      if (fn === "transfer_request_create") {
        return { id: 501 }
      }

      return []
    })

    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()

    render(
      <AddTransferDialog open onOpenChange={onOpenChange} onSuccess={onSuccess} />,
    )

    await user.type(screen.getByLabelText(/Thiết bị/), "Máy")
    await user.click(await screen.findByText("Máy siêu âm (TB-11)"))

    let selects = screen.getAllByRole("combobox")
    await user.selectOptions(selects[0], "ben_ngoai")

    selects = screen.getAllByRole("combobox")
    await user.selectOptions(selects[1], "sua_chua")

    await user.type(screen.getByLabelText(/Đơn vị nhận/), " Đơn vị B ")
    await user.type(screen.getByLabelText(/Địa chỉ đơn vị/), " 12 Nguyễn Trãi ")
    await user.type(screen.getByLabelText(/Người liên hệ/), " Nguyễn Văn B ")
    await user.type(screen.getByLabelText(/Số điện thoại/), " 0900000000 ")
    await user.type(screen.getByLabelText(/Ngày dự kiến trả về/), "2026-05-01")
    await user.type(screen.getByLabelText(/Lý do/), "  Điều phối ")

    selects = screen.getAllByRole("combobox")
    await user.selectOptions(selects[0], "noi_bo")

    selects = screen.getAllByRole("combobox")
    await user.selectOptions(selects[2], "Khoa B")

    await user.click(screen.getByRole("button", { name: "Tạo yêu cầu" }))

    await waitFor(() => {
      expect(mocks.callRpc).toHaveBeenCalledWith({
        fn: "transfer_request_create",
        args: {
          p_data: {
            thiet_bi_id: 11,
            loai_hinh: "noi_bo",
            ly_do_luan_chuyen: "Điều phối",
            nguoi_yeu_cau_id: 42,
            created_by: 42,
            updated_by: 42,
            khoa_phong_hien_tai: "Khoa A",
            khoa_phong_nhan: "Khoa B",
            muc_dich: null,
            don_vi_nhan: null,
            dia_chi_don_vi: null,
            nguoi_lien_he: null,
            so_dien_thoai: null,
            ngay_du_kien_tra: null,
          },
        },
      })
    })

    expect(onSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
