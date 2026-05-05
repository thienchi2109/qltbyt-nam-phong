import * as React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const mockUseSession = vi.fn()
const mockUseEquipmentAttentionPaginated = vi.fn()
const mockUseMaintenancePlans = vi.fn()
const mockUseCalendarData = vi.fn()
const mockGetEquipmentAttentionHrefForRole = vi.fn()

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

vi.mock("@/hooks/use-dashboard-stats", () => ({
  useEquipmentAttentionPaginated: (...args: unknown[]) =>
    mockUseEquipmentAttentionPaginated(...args),
}))

vi.mock("@/hooks/use-cached-maintenance", () => ({
  useMaintenancePlans: (...args: unknown[]) => mockUseMaintenancePlans(...args),
}))

vi.mock("@/hooks/use-calendar-data", () => ({
  useCalendarData: (...args: unknown[]) => mockUseCalendarData(...args),
}))

vi.mock("@/lib/equipment-attention-preset", () => ({
  getEquipmentAttentionHrefForRole: (...args: unknown[]) =>
    mockGetEquipmentAttentionHrefForRole(...args),
}))

import { DashboardTabs } from "@/components/dashboard/dashboard-tabs"

describe("DashboardTabs", () => {
  it("keeps the equipment tab constrained on narrow screens when device names are very long", () => {
    const longDeviceName =
      "Monitor-da-thong-so-sieu-dai-khong-co-khoang-trang-lam-vo-layout-dashboard-tren-man-hinh-hep"

    mockUseSession.mockReturnValue({
      data: { user: { role: "global" } },
    })
    mockGetEquipmentAttentionHrefForRole.mockReturnValue("/equipment")
    mockUseEquipmentAttentionPaginated.mockReturnValue({
      data: {
        data: [
          {
            id: 101,
            ten_thiet_bi: longDeviceName,
            ma_thiet_bi: "TB-101",
            model: null,
            tinh_trang_hien_tai: "Chờ sửa chữa",
            vi_tri_lap_dat: "Khoa Cấp cứu",
            ngay_bt_tiep_theo: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        hasMore: false,
      },
      isLoading: false,
      isFetching: false,
      error: null,
    })
    mockUseMaintenancePlans.mockReturnValue({
      data: { data: [], total: 0, page: 1, pageSize: 10 },
      isLoading: false,
      isFetching: false,
      error: null,
    })
    mockUseCalendarData.mockReturnValue({
      data: { events: [], stats: { total: 0, completed: 0, pending: 0, byType: {} } },
      isLoading: false,
      isFetching: false,
      error: null,
    })

    vi.stubGlobal("React", React)
    const { container } = render(<DashboardTabs />)

    const card = screen.getByText("Thông tin chi tiết").closest(".xl\\:col-span-3")
    const deviceName = screen.getByText(longDeviceName)
    const deviceRow = deviceName.closest(".border-l-4")
    const deviceContentColumn = deviceName.parentElement

    expect(card).toHaveClass("min-w-0", "overflow-hidden")
    expect(deviceRow).toHaveClass("min-w-0", "overflow-hidden")
    expect(deviceContentColumn).toHaveClass("min-w-0", "overflow-hidden")
    expect(deviceName).toHaveClass("block", "max-w-full")
    expect(container.firstChild).not.toBeNull()

    vi.unstubAllGlobals()
  })
})
