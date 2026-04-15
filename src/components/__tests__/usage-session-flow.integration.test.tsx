import * as React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { StartUsageDialog } from "../start-usage-dialog"
import { UsageHistoryTab } from "../usage-history-tab"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useToast: vi.fn(),
  useIsMobile: vi.fn(),
  useEquipmentUsageLogs: vi.fn(),
  useEquipmentUsageLogsMore: vi.fn(),
  useDeleteUsageLog: vi.fn(),
  useStartUsageSession: vi.fn(),
  useEndUsageSession: vi.fn(),
}))

type UsageLogRecord = {
  id: number
  thiet_bi_id: number
  nguoi_su_dung_id: number
  thoi_gian_bat_dau: string
  thoi_gian_ket_thuc?: string
  trang_thai: "dang_su_dung" | "hoan_thanh"
  created_at: string
  updated_at: string
  tinh_trang_thiet_bi?: string | null
  tinh_trang_ban_dau?: string | null
  tinh_trang_ket_thuc?: string | null
  ghi_chu?: string | null
  nguoi_su_dung?: { full_name: string }
  thiet_bi?: { id: number; ten_thiet_bi: string; ma_thiet_bi: string }
}

const equipment = {
  id: 99,
  ten_thiet_bi: "Monitor xét nghiệm",
  ma_thiet_bi: "TB-99",
  tinh_trang_hien_tai: "Sẵn sàng",
}

let usageLogsState: UsageLogRecord[] = []
let notifyStoreChange: (() => void) | null = null

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => mocks.useToast(),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.useIsMobile(),
}))

vi.mock("@/hooks/use-usage-logs", () => ({
  useEquipmentUsageLogs: (...args: unknown[]) => mocks.useEquipmentUsageLogs(...args),
  useEquipmentUsageLogsMore: (...args: unknown[]) => mocks.useEquipmentUsageLogsMore(...args),
  useDeleteUsageLog: () => mocks.useDeleteUsageLog(),
  useStartUsageSession: () => mocks.useStartUsageSession(),
  useEndUsageSession: () => mocks.useEndUsageSession(),
}))

vi.mock("../usage-log-print", () => ({
  UsageLogPrint: () => <div data-testid="usage-log-print" />,
}))

function UsageSessionFlowHarness() {
  const [isStartDialogOpen, setIsStartDialogOpen] = React.useState(false)
  const [, forceRender] = React.useState(0)

  React.useEffect(() => {
    notifyStoreChange = () => {
      forceRender((value) => value + 1)
    }

    return () => {
      notifyStoreChange = null
    }
  }, [])

  return (
    <div>
      <button type="button" onClick={() => setIsStartDialogOpen(true)}>
        Mở bắt đầu sử dụng
      </button>
      <StartUsageDialog
        open={isStartDialogOpen}
        onOpenChange={setIsStartDialogOpen}
        equipment={equipment}
      />
      <UsageHistoryTab equipment={equipment} />
    </div>
  )
}

describe("usage session flow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usageLogsState = []
    notifyStoreChange = null

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "(max-width: 767px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: 7,
          role: "to_qltb",
          full_name: "Nguyễn Văn A",
        },
      },
    })

    mocks.useToast.mockReturnValue({ toast: vi.fn() })
    mocks.useIsMobile.mockReturnValue(false)

    mocks.useEquipmentUsageLogs.mockImplementation(() => ({
      data: usageLogsState,
      isLoading: false,
    }))

    mocks.useEquipmentUsageLogsMore.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    })

    mocks.useDeleteUsageLog.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })

    mocks.useStartUsageSession.mockReturnValue({
      mutateAsync: vi.fn(async (payload: {
        thiet_bi_id: number
        nguoi_su_dung_id: number
        tinh_trang_thiet_bi?: string
        tinh_trang_ban_dau?: string
        ghi_chu?: string
      }) => {
        usageLogsState = [
          {
            id: 1,
            thiet_bi_id: payload.thiet_bi_id,
            nguoi_su_dung_id: payload.nguoi_su_dung_id,
            thoi_gian_bat_dau: "2026-04-15T05:00:00Z",
            trang_thai: "dang_su_dung",
            created_at: "2026-04-15T05:00:00Z",
            updated_at: "2026-04-15T05:00:00Z",
            tinh_trang_thiet_bi: payload.tinh_trang_thiet_bi ?? null,
            tinh_trang_ban_dau: payload.tinh_trang_ban_dau ?? null,
            tinh_trang_ket_thuc: null,
            ghi_chu: payload.ghi_chu ?? "",
            nguoi_su_dung: { full_name: "Nguyễn Văn A" },
            thiet_bi: {
              id: equipment.id,
              ten_thiet_bi: equipment.ten_thiet_bi,
              ma_thiet_bi: equipment.ma_thiet_bi,
            },
          },
        ]
        notifyStoreChange?.()

        return usageLogsState[0]
      }),
      isPending: false,
    })

    mocks.useEndUsageSession.mockReturnValue({
      mutateAsync: vi.fn(async (payload: {
        id: number
        tinh_trang_thiet_bi?: string
        tinh_trang_ket_thuc?: string
        ghi_chu?: string
      }) => {
        usageLogsState = usageLogsState.map((log) =>
          log.id === payload.id
            ? {
                ...log,
                thoi_gian_ket_thuc: "2026-04-15T06:30:00Z",
                trang_thai: "hoan_thanh",
                updated_at: "2026-04-15T06:30:00Z",
                tinh_trang_thiet_bi: payload.tinh_trang_thiet_bi ?? log.tinh_trang_thiet_bi ?? null,
                tinh_trang_ket_thuc: payload.tinh_trang_ket_thuc ?? null,
                ghi_chu: payload.ghi_chu ?? log.ghi_chu ?? "",
              }
            : log
        )
        notifyStoreChange?.()

        return usageLogsState[0]
      }),
      isPending: false,
    })
  })

  it("lets the user start and then end usage while history shows split statuses", async () => {
    const user = userEvent.setup()

    render(<UsageSessionFlowHarness />)

    expect(screen.getByText("Chưa có lịch sử sử dụng")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mở bắt đầu sử dụng" }))
    await user.clear(screen.getByLabelText("Tình trạng ban đầu"))
    await user.type(screen.getByLabelText("Tình trạng ban đầu"), "Hoạt động ổn định")
    await user.click(screen.getByRole("button", { name: "Bắt đầu sử dụng" }))

    await waitFor(() => {
      expect(screen.getByText(/Bạn đang sử dụng thiết bị này từ/i)).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: "Kết thúc sử dụng" })).toBeInTheDocument()
    expect(screen.getAllByText("Hoạt động ổn định")).toHaveLength(2)

    await user.click(screen.getByRole("button", { name: "Kết thúc sử dụng" }))

    const endDialog = await screen.findByRole("dialog")
    await user.clear(within(endDialog).getByLabelText("Tình trạng kết thúc"))
    await user.type(within(endDialog).getByLabelText("Tình trạng kết thúc"), "Cần vệ sinh")
    await user.click(within(endDialog).getByRole("button", { name: "Kết thúc sử dụng" }))

    await waitFor(() => {
      expect(screen.getByText("Cần vệ sinh")).toBeInTheDocument()
    })

    expect(screen.queryByText(/Bạn đang sử dụng thiết bị này từ/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Kết thúc sử dụng" })).not.toBeInTheDocument()
    expect(screen.getByText("Hoàn thành")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Tình trạng ban đầu" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Tình trạng kết thúc" })).toBeInTheDocument()
  })
})
