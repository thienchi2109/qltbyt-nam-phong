import * as React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { UsageLog } from "@/types/database"
import { readyStatusCatalog } from "@/hooks/__tests__/equipment-status-catalog-fixtures"

const mocks = vi.hoisted(() => ({
  catalog: vi.fn(),
  retry: vi.fn(),
  start: vi.fn(),
  end: vi.fn(),
  session: vi.fn(),
}))
vi.mock("@/hooks/use-equipment-status-catalog", () => ({
  useEquipmentStatusCatalog: () => mocks.catalog(),
}))
vi.mock("@/hooks/use-usage-logs", () => ({
  useStartUsageSession: () => ({ mutateAsync: mocks.start, isPending: false }),
  useEndUsageSession: () => ({ mutateAsync: mocks.end, isPending: false }),
}))
vi.mock("next-auth/react", () => ({ useSession: () => mocks.session() }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { StartUsageDialog } from "../start-usage-dialog"
import { EndUsageDialog } from "../end-usage-dialog"
const activeValues = ["Hoạt động", "Thanh lý nội bộ", "Đang đánh giá kỹ thuật"]
const ready = () => ({ ...readyStatusCatalog, activeValues, canWrite: true, refetch: mocks.retry })
const usageLog = {
  id: 1,
  thiet_bi_id: 99,
  thoi_gian_bat_dau: "2026-04-15T01:00:00Z",
  tinh_trang_thiet_bi: "Tốt",
  ghi_chu: "",
} as UsageLog

describe("catalog usage condition suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.catalog.mockReturnValue(ready())
    mocks.start.mockResolvedValue({})
    mocks.end.mockResolvedValue({})
    mocks.session.mockReturnValue({ data: { user: { id: 7, role: "to_qltb", full_name: "A" } } })
  })
  it.each(["start", "end"])(
    "uses active catalog suggestions for %s without a static admission list",
    (kind) => {
      render(
        kind === "start" ? (
          <StartUsageDialog
            open
            onOpenChange={vi.fn()}
            equipment={{
              id: 99,
              ma_thiet_bi: "EQ-99",
              ten_thiet_bi: "Monitor",
              tinh_trang_hien_tai: "Tốt",
            }}
          />
        ) : (
          <EndUsageDialog open onOpenChange={vi.fn()} usageLog={usageLog} />
        )
      )
      const id = kind === "start" ? "start-usage-status-options" : "end-usage-status-options"
      expect(
        Array.from(document.querySelectorAll(`#${id} option`)).map((option) =>
          option.getAttribute("value")
        )
      ).toEqual(activeValues)
    }
  )
  it("keeps historical session close available with free text and retry during unavailable catalog", async () => {
    mocks.catalog.mockReturnValue({
      ...ready(),
      activeValues: [],
      canWrite: false,
      fetchStatus: "paused",
    })
    render(<EndUsageDialog open onOpenChange={vi.fn()} usageLog={usageLog} />)
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(mocks.retry).toHaveBeenCalledOnce()
    fireEvent.change(screen.getByLabelText("Tình trạng kết thúc"), {
      target: { value: "Cần bảo trì" },
    })
    expect(screen.getByRole("button", { name: "Kết thúc sử dụng" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Kết thúc sử dụng" }))
    await waitFor(() =>
      expect(mocks.end).toHaveBeenCalledWith(
        expect.objectContaining({
          tinh_trang_ket_thuc: "Cần bảo trì",
          tinh_trang_thiet_bi: "Cần bảo trì",
        })
      )
    )
  })
  it("preserves arbitrary free-text start conditions with ready equipment metadata", async () => {
    render(
      <StartUsageDialog
        open
        onOpenChange={vi.fn()}
        equipment={{
          id: 99,
          ma_thiet_bi: "EQ-99",
          ten_thiet_bi: "Monitor",
          tinh_trang_hien_tai: "Tốt",
        }}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu sử dụng" }))
    await waitFor(() =>
      expect(mocks.start).toHaveBeenCalledWith(
        expect.objectContaining({ tinh_trang_ban_dau: "Tốt", tinh_trang_thiet_bi: "Tốt" })
      )
    )
  })

  it.each(["paused", "fetching", "error", "pending", "blocked"])(
    "guards new start at button and native submission during %s",
    async (state) => {
      mocks.catalog.mockReturnValue({
        ...ready(),
        canWrite: false,
        isSuccess: state !== "error" && state !== "pending",
        fetchStatus: ["paused", "fetching"].includes(state) ? state : "idle",
        data: state === "pending" ? undefined : readyStatusCatalog.data,
      })
      render(
        <StartUsageDialog
          open
          onOpenChange={vi.fn()}
          equipment={{
            id: 99,
            ma_thiet_bi: "EQ-99",
            ten_thiet_bi: "Monitor",
            tinh_trang_hien_tai: state === "blocked" ? "Thanh lý nội bộ" : "Hoạt động",
          }}
        />
      )
      fireEvent.change(screen.getByLabelText("Tình trạng ban đầu"), {
        target: { value: "Mô tả tự do" },
      })
      const submit = screen.getByRole("button", { name: "Bắt đầu sử dụng" })
      expect(submit).toBeDisabled()
      fireEvent.submit(submit.closest("form")!)
      await waitFor(() => expect(mocks.start).not.toHaveBeenCalled())
    }
  )

  it("rechecks new start eligibility when catalog changes while the dialog stays open", async () => {
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      equipment: {
        id: 99,
        ma_thiet_bi: "EQ-99",
        ten_thiet_bi: "Monitor",
        tinh_trang_hien_tai: "Hoạt động",
      },
    }
    const view = render(<StartUsageDialog {...props} />)
    const form = screen.getByRole("button", { name: "Bắt đầu sử dụng" }).closest("form")!
    mocks.catalog.mockReturnValue({
      ...ready(),
      data: readyStatusCatalog.data.map((row) =>
        row.status_value === "Hoạt động" ? { ...row, blocks_operational_actions: true } : row
      ),
    })
    view.rerender(<StartUsageDialog {...props} />)
    fireEvent.submit(form)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Bắt đầu sử dụng" })).toBeDisabled()
    )
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it.each(["paused", "fetching", "error", "pending", "blocked"])(
    "rejects native form submission independently of disabled controls during %s",
    async (state) => {
      mocks.catalog.mockReturnValue({
        ...ready(),
        canWrite: false,
        isSuccess: state !== "error" && state !== "pending",
        fetchStatus: ["paused", "fetching"].includes(state) ? state : "idle",
        data: state === "pending" ? undefined : readyStatusCatalog.data,
      })
      render(
        <StartUsageDialog
          open
          onOpenChange={vi.fn()}
          equipment={{
            id: 99,
            ma_thiet_bi: "EQ-99",
            ten_thiet_bi: "Monitor",
            tinh_trang_hien_tai: state === "blocked" ? "Thanh lý nội bộ" : "Hoạt động",
          }}
        />
      )
      fireEvent.change(screen.getByLabelText("Tình trạng ban đầu"), {
        target: { value: "Mô tả tự do" },
      })
      await act(async () =>
        fireEvent.submit(screen.getByRole("button", { name: "Bắt đầu sử dụng" }).closest("form")!)
      )
      expect(mocks.start).not.toHaveBeenCalled()
    }
  )
})
