/**
 * TDD RED phase: Tests for the unified RepairRequestsDetailView shell.
 */
import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ChangeHistoryEntry } from "@/components/change-history/ChangeHistoryTypes"

import { RepairRequestsDetailView } from "../_components/RepairRequestsDetailView"
import type {
  RepairRequestChangeHistory,
  RepairRequestWithEquipment,
} from "../types"

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const mockUseRepairRequestHistory = vi.fn()
const mockMapRepairRequestHistoryEntries = vi.fn()
const mockDetailTabs = vi.fn()

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        don_vi: 10,
        role: "to_qltb",
        dia_ban_id: 20,
      },
    },
  }),
}))

vi.mock("../_hooks/useRepairRequestHistory", () => ({
  useRepairRequestHistory: (options: unknown) => mockUseRepairRequestHistory(options),
}))

vi.mock("../_lib/repairRequestHistoryAdapter", () => ({
  mapRepairRequestHistoryEntries: (history: RepairRequestChangeHistory[]) =>
    mockMapRepairRequestHistoryEntries(history),
}))

vi.mock("../_components/RepairRequestsDetailTabs", () => ({
  RepairRequestsDetailTabs: ({
    request,
    historyEntries,
    isLoadingHistory,
    isHistoryError,
    historyErrorMessage,
  }: {
    request: RepairRequestWithEquipment
    historyEntries: ChangeHistoryEntry[]
    isLoadingHistory: boolean
    isHistoryError: boolean
    historyErrorMessage: string | null
  }) => {
    mockDetailTabs({
      request,
      historyEntries,
      isLoadingHistory,
      isHistoryError,
      historyErrorMessage,
    })
    return (
      <div data-testid="detail-tabs">
        tabs for {request.thiet_bi?.ten_thiet_bi ?? "unknown"} / {historyEntries.length} /{" "}
        {String(isLoadingHistory)} / {String(isHistoryError)} / {historyErrorMessage ?? "none"}
      </div>
    )
  },
}))

const mockHistory: RepairRequestChangeHistory[] = [
  {
    id: 101,
    action_type: "repair_request_create",
    admin_username: "admin-a",
    admin_full_name: "Nguyễn Văn A",
    action_details: { trang_thai: "Chờ xử lý" },
    created_at: "2026-04-05T08:00:00.000Z",
  },
]

const mappedEntries: ChangeHistoryEntry[] = [
  {
    id: "101",
    occurredAt: "2026-04-05T08:00:00.000Z",
    actionLabel: "Tạo yêu cầu sửa chữa",
    actorName: "Nguyễn Văn A",
    details: [{ label: "Trạng thái", value: "Chờ xử lý" }],
  },
]

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

describe("RepairRequestsDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseRepairRequestHistory.mockReturnValue({
      data: mockHistory,
      isLoading: false,
      isError: false,
      error: null,
    })
    mockMapRepairRequestHistoryEntries.mockReturnValue(mappedEntries)
  })

  it("renders nothing when requestToView is null", () => {
    const { container } = render(
      <RepairRequestsDetailView requestToView={null} onClose={vi.fn()} />,
    )

    expect(container.innerHTML).toBe("")
  })

  it("renders a unified Sheet shell with responsive sizing and mapped history tabs", () => {
    render(<RepairRequestsDetailView requestToView={mockRequest} onClose={vi.fn()} />)

    expect(screen.getByText("Chi tiết yêu cầu sửa chữa")).toBeInTheDocument()
    expect(
      screen.getByText("Thông tin chi tiết và lịch sử của yêu cầu sửa chữa thiết bị"),
    ).toBeInTheDocument()
    expect(screen.getByTestId("detail-tabs")).toHaveTextContent(
      "tabs for Test Device / 1 / false / false / none",
    )

    const dialogEl = screen.getByRole("dialog")
    expect(dialogEl.className).toContain("inset-y-0")
    expect(dialogEl.className).toContain("sm:max-w-xl")
    expect(dialogEl.className).toContain("md:max-w-2xl")
    expect(dialogEl.className).toContain("lg:max-w-3xl")
    expect(dialogEl.className).not.toContain("translate-x-")

    expect(mockUseRepairRequestHistory).toHaveBeenCalledWith({
      requestId: 1,
      effectiveTenantKey: 10,
      userRole: "to_qltb",
      userDiaBanId: 20,
      hasUser: true,
    })
    expect(mockMapRepairRequestHistoryEntries).toHaveBeenCalledWith(mockHistory)
    expect(mockDetailTabs).toHaveBeenCalledWith({
      request: mockRequest,
      historyEntries: mappedEntries,
      isLoadingHistory: false,
      isHistoryError: false,
      historyErrorMessage: null,
    })
  })

  it("forwards query errors to the tabs instead of coercing them to an empty history state", () => {
    mockUseRepairRequestHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("RPC repair_request_change_history_list failed (500)"),
    })

    render(<RepairRequestsDetailView requestToView={mockRequest} onClose={vi.fn()} />)

    expect(mockMapRepairRequestHistoryEntries).not.toHaveBeenCalled()
    expect(mockDetailTabs).toHaveBeenCalledWith({
      request: mockRequest,
      historyEntries: [],
      isLoadingHistory: false,
      isHistoryError: true,
      historyErrorMessage: "RPC repair_request_change_history_list failed (500)",
    })
  })

  it("calls onClose when the close button is clicked", async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    render(<RepairRequestsDetailView requestToView={mockRequest} onClose={onClose} />)

    await user.click(screen.getByRole("button", { name: /đóng/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
