"use client"

import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createReactQueryWrapper, createTestQueryClient } from "@/test-utils/react-query"

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
    const historicalPage = [historicalLog]

    mocks.useEquipmentUsageLogsMore.mockImplementation((_equipmentId: string, offset: number) => ({
      data: offset > 0 ? historicalPage : EMPTY_MORE_USAGE_LOGS,
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

  describe("with real usage queries and mutations", () => {
    const mockFetch = vi.fn<typeof fetch>()
    let queryClient: ReturnType<typeof createTestQueryClient>
    let backendLogs: ReturnType<typeof createUsageLog>[]
    let rejectDelete: boolean

    beforeEach(async () => {
      const hooks =
        await vi.importActual<typeof import("@/hooks/use-usage-logs")>("@/hooks/use-usage-logs")
      mocks.useEquipmentUsageLogs.mockImplementation(hooks.useEquipmentUsageLogs)
      mocks.useEquipmentUsageLogsMore.mockImplementation(hooks.useEquipmentUsageLogsMore)
      mocks.useDeleteUsageLog.mockImplementation(hooks.useDeleteUsageLog)
      queryClient = createTestQueryClient()
      rejectDelete = false
      backendLogs = Array.from({ length: 201 }, (_, index) =>
        createUsageLog(index + 1, {
          thiet_bi_id: 42,
          thoi_gian_bat_dau: new Date(Date.now() - (index + 2) * 60_000).toISOString(),
          thoi_gian_ket_thuc: index === 0 ? null : new Date(Date.now() - 60_000).toISOString(),
          trang_thai: index === 0 ? "dang_su_dung" : "hoan_thanh",
          nguoi_su_dung: { full_name: `Loaded User ${index + 1}` },
        })
      )
      mockFetch.mockReset()
      mockFetch.mockImplementation(async (url, options) => {
        const args: Record<string, unknown> = JSON.parse(String(options?.body))
        if (url === "/api/rpc/usage_log_delete") {
          if (rejectDelete) {
            return new Response(JSON.stringify({ error: "Delete denied" }), { status: 403 })
          }
          backendLogs = backendLogs.filter((log) => log.id !== args.p_usage_log_id)
          return new Response("null", { status: 200 })
        }
        if (url !== "/api/rpc/usage_log_list") throw new Error(`Unexpected RPC: ${url}`)
        const offset = Number(args.p_offset)
        return new Response(
          JSON.stringify(backendLogs.slice(offset, offset + Number(args.p_limit))),
          {
            status: 200,
          }
        )
      })
      vi.stubGlobal("fetch", mockFetch)
    })

    afterEach(() => {
      queryClient.clear()
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    async function loadAccumulatedHistory() {
      render(
        <UsageHistoryTab
          equipment={{ id: 42, ten_thiet_bi: "Test Equipment", ma_thiet_bi: "TB-001" }}
          equipmentDataset="placed"
        />,
        { wrapper: createReactQueryWrapper(queryClient) }
      )
      fireEvent.click(await screen.findByRole("button", { name: "Tải thêm lịch sử" }))
      await screen.findByText("Loaded User 101")
      fireEvent.click(await screen.findByRole("button", { name: "Tải thêm lịch sử" }))
      await screen.findByText("Loaded User 151")
    }

    it("removes an earlier accumulated row while refetching the active page", async () => {
      await loadAccumulatedHistory()
      fireEvent.click(screen.getByRole("button", { name: "Xóa nhật ký sử dụng 101" }))
      fireEvent.click(await screen.findByRole("button", { name: "Xóa" }))

      // Row 201 enters the active page only after the backend deletion shifts its offset.
      await screen.findByText("Loaded User 201")
      await waitFor(() => expect(screen.queryByText("Loaded User 101")).toBeNull())
      expect(screen.getByText("Loaded User 102")).toBeInTheDocument()
      expect(screen.getByText("Loaded User 1")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Kết thúc sử dụng" })).toBeInTheDocument()
      expect(backendLogs.some((log) => log.id === 101)).toBe(false)

      const historyRequests = mockFetch.mock.calls
        .filter(([url]) => url === "/api/rpc/usage_log_list")
        .map(([, options]) => JSON.parse(String(options?.body)) as Record<string, unknown>)
      expect(historyRequests.filter((args) => args.p_offset === 100)).toHaveLength(1)
      expect(historyRequests.filter((args) => args.p_offset === 150)).toHaveLength(2)
      expect(historyRequests.every((args) => args.p_equipment_dataset === "placed")).toBe(true)
    })

    it("preserves accumulated rows and the active session when deletion fails", async () => {
      rejectDelete = true
      vi.spyOn(console, "error").mockImplementation(() => {})
      await loadAccumulatedHistory()
      fireEvent.click(screen.getByRole("button", { name: "Xóa nhật ký sử dụng 101" }))
      fireEvent.click(await screen.findByRole("button", { name: "Xóa" }))

      await waitFor(() => {
        const mutation = queryClient.getMutationCache().getAll()[0]
        expect(mutation?.state.status).toBe("error")
        expect(mutation?.state.error).toEqual(new Error("Delete denied"))
      })
      expect(screen.getByText("Loaded User 101")).toBeInTheDocument()
      expect(screen.getByText("Loaded User 102")).toBeInTheDocument()
      expect(screen.getByText("Loaded User 151")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Kết thúc sử dụng" })).toBeInTheDocument()
      expect(backendLogs.some((log) => log.id === 101)).toBe(true)
      expect(
        mockFetch.mock.calls.filter(([url]) => url === "/api/rpc/usage_log_list")
      ).toHaveLength(3)
    })
  })
})
