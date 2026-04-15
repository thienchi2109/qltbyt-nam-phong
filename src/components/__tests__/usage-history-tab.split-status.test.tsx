"use client"

import * as React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useIsMobile: vi.fn(),
  useEquipmentUsageLogs: vi.fn(),
  useEquipmentUsageLogsMore: vi.fn(),
  useDeleteUsageLog: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.useIsMobile(),
}))

vi.mock("@/hooks/use-usage-logs", () => ({
  useEquipmentUsageLogs: (...args: unknown[]) => mocks.useEquipmentUsageLogs(...args),
  useEquipmentUsageLogsMore: (...args: unknown[]) => mocks.useEquipmentUsageLogsMore(...args),
  useDeleteUsageLog: () => mocks.useDeleteUsageLog(),
}))

vi.mock("../usage-log-print", () => ({
  UsageLogPrint: () => <div data-testid="usage-log-print" />,
}))

vi.mock("../end-usage-dialog", () => ({
  EndUsageDialog: () => null,
}))

import { UsageHistoryTab } from "../usage-history-tab"

const usageLogs = [
  {
    id: 1,
    thiet_bi_id: 99,
    thoi_gian_bat_dau: "2026-04-15T01:00:00Z",
    thoi_gian_ket_thuc: "2026-04-15T02:00:00Z",
    trang_thai: "hoan_thanh" as const,
    created_at: "2026-04-15T01:00:00Z",
    updated_at: "2026-04-15T02:00:00Z",
    nguoi_su_dung_id: 7,
    tinh_trang_ban_dau: "Tốt",
    tinh_trang_ket_thuc: "Cần theo dõi",
    tinh_trang_thiet_bi: "Legacy",
    ghi_chu: "Có thay đổi nhẹ",
    nguoi_su_dung: { full_name: "Nguyễn Văn A" },
    thiet_bi: { ten_thiet_bi: "Monitor", ma_thiet_bi: "TB-99" },
  },
  {
    id: 2,
    thiet_bi_id: 99,
    thoi_gian_bat_dau: "2026-04-16T01:00:00Z",
    thoi_gian_ket_thuc: "2026-04-16T02:00:00Z",
    trang_thai: "hoan_thanh" as const,
    created_at: "2026-04-16T01:00:00Z",
    updated_at: "2026-04-16T02:00:00Z",
    nguoi_su_dung_id: 7,
    tinh_trang_ban_dau: null,
    tinh_trang_ket_thuc: null,
    tinh_trang_thiet_bi: "Fallback legacy",
    ghi_chu: null,
    nguoi_su_dung: { full_name: "Trần Thị B" },
    thiet_bi: { ten_thiet_bi: "Monitor", ma_thiet_bi: "TB-99" },
  },
]

describe("UsageHistoryTab split status", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: 7,
          role: "global",
        },
      },
    })

    mocks.useEquipmentUsageLogs.mockReturnValue({
      data: usageLogs,
      isLoading: false,
    })

    mocks.useEquipmentUsageLogsMore.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
    })

    mocks.useDeleteUsageLog.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
  })

  it("renders separate initial and final status columns on desktop with legacy fallback", () => {
    mocks.useIsMobile.mockReturnValue(false)

    render(
      <UsageHistoryTab
        equipment={{ id: 99, ten_thiet_bi: "Monitor", ma_thiet_bi: "TB-99" }}
      />
    )

    expect(screen.getByRole("columnheader", { name: "Tình trạng ban đầu" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Tình trạng kết thúc" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Xóa nhật ký sử dụng 1" })).toBeInTheDocument()
    expect(screen.getByText("Tốt")).toBeInTheDocument()
    expect(screen.getByText("Cần theo dõi")).toBeInTheDocument()
    expect(screen.getAllByText("Fallback legacy")).toHaveLength(2)
  })

  it("renders separate mobile labels for initial and final status", () => {
    mocks.useIsMobile.mockReturnValue(true)

    render(
      <UsageHistoryTab
        equipment={{ id: 99, ten_thiet_bi: "Monitor", ma_thiet_bi: "TB-99" }}
      />
    )

    expect(screen.getAllByText(/Tình trạng ban đầu:/)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Tình trạng kết thúc:/)[0]).toBeInTheDocument()
    expect(screen.getAllByText("Fallback legacy")).toHaveLength(2)
  })
})
