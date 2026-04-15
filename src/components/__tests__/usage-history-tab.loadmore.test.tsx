"use client"

import * as React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useIsMobile: vi.fn(),
  useEquipmentUsageLogs: vi.fn(),
  useEquipmentUsageLogsMore: vi.fn(),
  useDeleteUsageLog: vi.fn(),
}))

const EMPTY_MORE_USAGE_LOGS: unknown[] = []

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

function createUsageLog(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    thoi_gian_bat_dau: `2026-03-${String((id % 28) + 1).padStart(2, "0")}T08:00:00Z`,
    thoi_gian_ket_thuc: null,
    trang_thai: "dang_su_dung",
    nguoi_su_dung_id: 99,
    nguoi_su_dung: {
      full_name: "Test User",
    },
    thiet_bi: {
      ten_thiet_bi: "Test Equipment",
      ma_thiet_bi: "TB-001",
    },
    ...overrides,
  }
}

describe("UsageHistoryTab load more", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: 99,
          role: "global",
        },
      },
    })

    mocks.useIsMobile.mockReturnValue(false)

    const recentUsageLogs = Array.from({ length: 50 }, (_, index) => createUsageLog(index + 1))

    mocks.useEquipmentUsageLogs.mockReturnValue({
      data: recentUsageLogs,
      isLoading: false,
    })

    mocks.useEquipmentUsageLogsMore.mockImplementation((_equipmentId: string, offset: number) => ({
      data: EMPTY_MORE_USAGE_LOGS,
      isLoading: false,
      isFetching: false,
      offset,
    }))

    mocks.useDeleteUsageLog.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
  })

  it("advances the historical offset from the previous state across rapid clicks", async () => {
    render(
      <UsageHistoryTab
        equipment={{ id: 42, ten_thiet_bi: "Test Equipment", ma_thiet_bi: "TB-001" }}
      />
    )

    const button = await screen.findByRole("button", { name: "Tải thêm lịch sử" })

    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
    })

    const lastOffset = mocks.useEquipmentUsageLogsMore.mock.calls.at(-1)?.[1]
    expect(lastOffset).toBe(150)
  })

  it("removes deleted historical logs from accumulated pages", async () => {
    const deleteUsageLog = vi.fn().mockResolvedValue(undefined)
    const historicalLog = createUsageLog(51, {
      trang_thai: "hoan_thanh",
      thoi_gian_ket_thuc: "2026-03-24T09:00:00Z",
      nguoi_su_dung: {
        full_name: "Loaded User 51",
      },
    })

    mocks.useEquipmentUsageLogsMore.mockImplementation((_equipmentId: string, offset: number) => ({
      data: offset > 0 ? [historicalLog] : EMPTY_MORE_USAGE_LOGS,
      isLoading: false,
      isFetching: false,
      offset,
    }))
    mocks.useDeleteUsageLog.mockReturnValue({
      mutateAsync: deleteUsageLog,
      isPending: false,
    })

    render(
      <UsageHistoryTab
        equipment={{ id: 42, ten_thiet_bi: "Test Equipment", ma_thiet_bi: "TB-001" }}
      />
    )

    fireEvent.click(await screen.findByRole("button", { name: "Tải thêm lịch sử" }))

    expect(await screen.findByText("Loaded User 51")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Xóa nhật ký sử dụng 51" }))
    fireEvent.click(await screen.findByRole("button", { name: "Xóa" }))

    await waitFor(() => {
      expect(deleteUsageLog).toHaveBeenCalledWith(51)
    })
    await waitFor(() => {
      expect(screen.queryByText("Loaded User 51")).toBeNull()
    })
  })
})
