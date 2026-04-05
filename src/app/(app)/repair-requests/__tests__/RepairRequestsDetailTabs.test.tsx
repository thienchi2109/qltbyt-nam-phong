import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { ChangeHistoryEntry } from "@/components/change-history/ChangeHistoryTypes"

import { RepairRequestsDetailTabs } from "../_components/RepairRequestsDetailTabs"
import type { RepairRequestWithEquipment } from "../types"

vi.mock("../_components/RepairRequestsDetailContent", () => ({
  RepairRequestsDetailContent: ({ request }: { request: RepairRequestWithEquipment }) => (
    <div data-testid="detail-content">
      detail for {request.thiet_bi?.ten_thiet_bi ?? "unknown"}
    </div>
  ),
}))

vi.mock("@/components/change-history/ChangeHistoryTab", () => ({
  ChangeHistoryTab: ({
    entries,
    isLoading,
  }: {
    entries: ChangeHistoryEntry[]
    isLoading: boolean
  }) => (
    <div data-testid="history-tab">
      history count {entries.length} / loading {String(isLoading)}
    </div>
  ),
}))

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
  AlertTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockRequest: RepairRequestWithEquipment = {
  id: 1,
  thiet_bi_id: 100,
  ngay_yeu_cau: "2026-01-01T00:00:00.000Z",
  trang_thai: "Chờ xử lý",
  mo_ta_su_co: "Broken screen",
  hang_muc_sua_chua: "Thay màn hình",
  ngay_mong_muon_hoan_thanh: null,
  nguoi_yeu_cau: "Nguyễn Văn B",
  ngay_duyet: null,
  ngay_hoan_thanh: null,
  nguoi_duyet: null,
  nguoi_xac_nhan: null,
  don_vi_thuc_hien: "noi_bo",
  ten_don_vi_thue: null,
  ket_qua_sua_chua: null,
  ly_do_khong_hoan_thanh: null,
  thiet_bi: {
    ten_thiet_bi: "Test Device",
    ma_thiet_bi: "TB-100",
    model: "Model X",
    serial: "SN-100",
    khoa_phong_quan_ly: "Khoa A",
    facility_name: "Hospital A",
    facility_id: 10,
  },
}

const historyEntries: ChangeHistoryEntry[] = [
  {
    id: "101",
    occurredAt: "2026-04-05T08:00:00.000Z",
    actionLabel: "Tạo yêu cầu sửa chữa",
    actorName: "Nguyễn Văn A",
    details: [{ label: "Trạng thái", value: "Chờ xử lý" }],
  },
]

describe("RepairRequestsDetailTabs", () => {
  it("renders the details tab by default", () => {
    render(
      <RepairRequestsDetailTabs
        request={mockRequest}
        historyEntries={historyEntries}
        isLoadingHistory={false}
        isHistoryError={false}
        historyErrorMessage={null}
      />,
    )

    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("data-state", "active")
    expect(screen.getByTestId("detail-content")).toHaveTextContent("detail for Test Device")
    expect(screen.queryByTestId("history-tab")).not.toBeInTheDocument()
  })

  it("switches to the history tab with user-event", async () => {
    const user = userEvent.setup()

    render(
      <RepairRequestsDetailTabs
        request={mockRequest}
        historyEntries={historyEntries}
        isLoadingHistory={true}
        isHistoryError={false}
        historyErrorMessage={null}
      />,
    )

    await user.click(screen.getByRole("tab", { name: "History" }))

    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("data-state", "active")
    expect(screen.getByTestId("history-tab")).toHaveTextContent("history count 1 / loading true")
    expect(screen.queryByTestId("detail-content")).not.toBeInTheDocument()
  })

  it("shows an error alert instead of the empty history state when the query fails", async () => {
    const user = userEvent.setup()

    render(
      <RepairRequestsDetailTabs
        request={mockRequest}
        historyEntries={[]}
        isLoadingHistory={false}
        isHistoryError={true}
        historyErrorMessage="RPC repair_request_change_history_list failed (500)"
      />,
    )

    await user.click(screen.getByRole("tab", { name: "History" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải lịch sử thay đổi")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "RPC repair_request_change_history_list failed (500)",
    )
    expect(screen.queryByTestId("history-tab")).not.toBeInTheDocument()
  })
})
