import * as React from "react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

function seedDashboardTabsMocks() {
  mockUseSession.mockReturnValue({
    data: { user: { role: "global" } },
  })
  mockGetEquipmentAttentionHrefForRole.mockReturnValue("/equipment")
  mockUseEquipmentAttentionPaginated.mockReturnValue({
    data: {
      data: [
        {
          id: 101,
          ten_thiet_bi:
            "Monitor-da-thong-so-sieu-dai-khong-co-khoang-trang-lam-vo-layout-dashboard-tren-man-hinh-hep",
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
    data: {
      data: [
        {
          id: 25,
          ten_ke_hoach: "Kế hoạch bảo trì máy xét nghiệm huyết học",
          nam: 2026,
          khoa_phong: "Khoa Xét nghiệm",
          loai_cong_viec: "Bảo trì",
          trang_thai: "Đã duyệt",
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
  mockUseCalendarData.mockReturnValue({
    data: {
      events: [
        {
          id: "done-1",
          title: "Hoàn tất hiệu chuẩn monitor sản khoa",
          type: "Hiệu chuẩn",
          isCompleted: true,
          equipmentCode: "TB-202",
          department: "Khoa Sản",
        },
      ],
      stats: { total: 1, completed: 1, pending: 0, byType: { "Hiệu chuẩn": 1 } },
    },
    isLoading: false,
    isFetching: false,
    error: null,
  })
}

describe("DashboardTabs", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React)
    seedDashboardTabsMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it("keeps the DashboardTabs shell below the source file ceiling", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/dashboard/dashboard-tabs.tsx"), "utf8")

    expect(source.split(/\r?\n/).length).toBeLessThan(450)
  })

  it("only enables the default equipment tab query on first render", () => {
    render(<DashboardTabs />)

    expect(mockUseEquipmentAttentionPaginated).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      enabled: true,
    })
    expect(mockUseMaintenancePlans).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 10 },
      { enabled: false }
    )
    expect(mockUseCalendarData).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.any(Number),
      { enabled: false }
    )
  })

  it("advances equipment pagination through the server paginated hook", async () => {
    const user = userEvent.setup()
    mockUseEquipmentAttentionPaginated.mockImplementation(
      (options?: { page?: number; pageSize?: number; enabled?: boolean }) => ({
        data: {
          data: [
            {
              id: 101,
              ten_thiet_bi: "Monitor cần sửa chữa",
              ma_thiet_bi: "TB-101",
              model: null,
              tinh_trang_hien_tai: "Chờ sửa chữa",
              vi_tri_lap_dat: "Khoa Cấp cứu",
              ngay_bt_tiep_theo: null,
            },
          ],
          total: 20,
          page: options?.page ?? 1,
          pageSize: options?.pageSize ?? 10,
          hasMore: (options?.page ?? 1) < 2,
        },
        isLoading: false,
        isFetching: false,
        error: null,
      })
    )

    render(<DashboardTabs />)
    await user.click(screen.getByRole("button", { name: /sau/i }))

    expect(mockUseEquipmentAttentionPaginated).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 10,
      enabled: true,
    })
  })

  it("enables plan and monthly queries only when their tabs are selected", async () => {
    const user = userEvent.setup()
    render(<DashboardTabs />)

    await user.click(screen.getByRole("tab", { name: /kế hoạch|kh/i }))
    expect(mockUseMaintenancePlans).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 10 },
      { enabled: true }
    )

    await user.click(screen.getByRole("tab", { name: /tháng này|t\d+/i }))
    expect(mockUseCalendarData).toHaveBeenLastCalledWith(
      expect.any(Number),
      expect.any(Number),
      { enabled: true }
    )
  })

  it("keeps the equipment tab constrained on narrow screens when device names are very long", () => {
    const longDeviceName =
      "Monitor-da-thong-so-sieu-dai-khong-co-khoang-trang-lam-vo-layout-dashboard-tren-man-hinh-hep"
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
  })

  it("uses a subtler accent than border-l-4 for maintenance plan cards", async () => {
    const user = userEvent.setup()
    render(<DashboardTabs />)

    await user.click(screen.getByRole("tab", { name: /kế hoạch|kh/i }))

    const planCard = screen
      .getByText("Kế hoạch bảo trì máy xét nghiệm huyết học")
      .closest(".rounded-xl")

    expect(planCard).not.toHaveClass("border-l-4")
    expect(planCard).toHaveClass("border", "border-blue-200/60")
  })

  it("uses a subtler accent than border-l-4 for completed monthly task cards", async () => {
    const user = userEvent.setup()
    render(<DashboardTabs />)

    await user.click(screen.getByRole("tab", { name: /tháng này|t\\d+/i }))

    const completedCard = screen
      .getByText("Hoàn tất hiệu chuẩn monitor sản khoa")
      .closest(".rounded-xl")

    expect(completedCard).not.toHaveClass("border-l-4")
    expect(completedCard).toHaveClass("border", "border-green-200/60")
  })
})
