import * as React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ logs: vi.fn(), session: vi.fn() }))
vi.mock("next-auth/react", () => ({ useSession: () => mocks.session() }))
vi.mock("@/hooks/use-usage-logs", () => ({ useActiveUsageLogs: () => ({ data: mocks.logs() }) }))
vi.mock("../start-usage-dialog", () => ({
  StartUsageDialog: ({ open }: { open: boolean }) => (open ? <div>Phiên mới</div> : null),
}))
vi.mock("../end-usage-dialog", () => ({
  EndUsageDialog: ({ open }: { open: boolean }) => (open ? <div>Đóng phiên hiện tại</div> : null),
}))
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
import { MobileUsageActions } from "../mobile-usage-actions"
const equipment = {
  id: 99,
  ma_thiet_bi: "EQ-99",
  ten_thiet_bi: "Monitor",
  tinh_trang_hien_tai: "Thanh lý nội bộ",
}
describe("mobile lifecycle usage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.session.mockReturnValue({ data: { user: { id: 7, role: "to_qltb" } } })
    mocks.logs.mockReturnValue([])
  })
  it("disables start entry without removing an existing session close path", () => {
    const view = render(<MobileUsageActions equipment={equipment} {...{ startDisabled: true }} />)
    expect(screen.getByRole("button", { name: "Bắt đầu sử dụng thiết bị" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu sử dụng thiết bị" }))
    expect(screen.queryByText("Phiên mới")).not.toBeInTheDocument()
    mocks.logs.mockReturnValue([
      {
        id: 1,
        thiet_bi_id: 99,
        trang_thai: "dang_su_dung",
        nguoi_su_dung_id: 7,
        thoi_gian_bat_dau: "2026-04-15T01:00:00Z",
      },
    ])
    view.rerender(<MobileUsageActions equipment={equipment} {...{ startDisabled: true }} />)
    const close = screen.getByRole("button", { name: "Kết thúc sử dụng" })
    expect(close).toBeEnabled()
    fireEvent.click(close)
    expect(screen.getByText("Đóng phiên hiện tại")).toBeInTheDocument()
  })
  it("retains regional-leader permission denial even with operationally eligible metadata", () => {
    mocks.session.mockReturnValue({ data: { user: { id: 7, role: "regional_leader" } } })
    render(<MobileUsageActions equipment={equipment} {...{ startDisabled: false }} />)
    expect(screen.getByRole("button", { name: "Bắt đầu sử dụng thiết bị" })).toBeDisabled()
  })
})
