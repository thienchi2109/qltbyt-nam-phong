import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  mutateAsync: vi.fn(),
  useStartUsageSession: vi.fn(),
  useActiveUsageLogs: vi.fn(),
  refetch: vi.fn(),
  useToast: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/hooks/use-usage-logs", () => ({
  useStartUsageSession: () => mocks.useStartUsageSession(),
  useActiveUsageLogs: (options: unknown) => mocks.useActiveUsageLogs(options),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => mocks.useToast(),
}))

import { StartUsageDialog } from "../start-usage-dialog"

describe("StartUsageDialog validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    mocks.mutateAsync.mockResolvedValue({ id: 1, thiet_bi_id: 99 })
    mocks.useStartUsageSession.mockReturnValue({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    })
    mocks.useToast.mockReturnValue({ toast: vi.fn() })
    mocks.useActiveUsageLogs.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: mocks.refetch,
    })
  })

  it("blocks submit when the initial status is empty", async () => {
    render(
      <StartUsageDialog
        open
        onOpenChange={vi.fn()}
        equipment={{
          id: 99,
          ten_thiet_bi: "Monitor",
          ma_thiet_bi: "TB-99",
          tinh_trang_hien_tai: null,
        }}
      />
    )

    const input = screen.getByLabelText("Tình trạng ban đầu")
    fireEvent.change(input, { target: { value: "   " } })
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu sử dụng" }))

    await waitFor(() => {
      expect(screen.getByText("Vui lòng nhập tình trạng ban đầu")).toBeInTheDocument()
    })

    expect(mocks.mutateAsync).not.toHaveBeenCalled()
  })

  it("submits both initial status fields when the input is valid", async () => {
    const onSuccess = vi.fn()
    render(
      <StartUsageDialog
        open
        onOpenChange={vi.fn()}
        onSuccess={onSuccess}
        equipment={{
          id: 99,
          ten_thiet_bi: "Monitor",
          ma_thiet_bi: "TB-99",
          tinh_trang_hien_tai: "Tốt",
        }}
      />
    )

    const input = screen.getByLabelText("Tình trạng ban đầu")
    fireEvent.change(input, { target: { value: "Hoạt động tốt" } })
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu sử dụng" }))

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        thiet_bi_id: 99,
        nguoi_su_dung_id: 7,
        tinh_trang_thiet_bi: "Hoạt động tốt",
        tinh_trang_ban_dau: "Hoạt động tốt",
        ghi_chu: "",
      })
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it.each([7, 8])(
    "disables an already-open form when polling reports owner %s is using equipment",
    async (owner) => {
      const props = {
        open: true,
        onOpenChange: vi.fn(),
        equipment: {
          id: 99,
          ten_thiet_bi: "Monitor",
          ma_thiet_bi: "TB-99",
          tinh_trang_hien_tai: "Tốt",
          don_vi: 2,
          nguon_kinh_phi: "Mượn",
        },
      }
      const view = render(<StartUsageDialog {...props} />)
      expect(screen.getByRole("button", { name: "Bắt đầu sử dụng" })).toBeEnabled()
      mocks.useActiveUsageLogs.mockReturnValue({
        data: [{ id: 1, thiet_bi_id: 99, nguoi_su_dung_id: owner, trang_thai: "dang_su_dung" }],
        isPending: false,
        isError: false,
        refetch: mocks.refetch,
      })
      view.rerender(<StartUsageDialog {...props} />)
      expect(screen.getByRole("button", { name: "Bắt đầu sử dụng" })).toBeDisabled()
      expect(screen.getByText("Thiết bị đang được sử dụng.")).toBeInTheDocument()
      fireEvent.submit(screen.getByRole("button", { name: "Bắt đầu sử dụng" }).closest("form")!)
      await waitFor(() => expect(mocks.mutateAsync).not.toHaveBeenCalled())
      expect(mocks.useActiveUsageLogs).toHaveBeenLastCalledWith({
        enabled: true,
        tenantId: 2,
        equipmentDataset: "placed",
      })
    }
  )

  it.each(["loading", "error"])("keeps submit disabled while availability is %s", (state) => {
    mocks.useActiveUsageLogs.mockReturnValue({
      data: state === "error" ? [] : undefined,
      isPending: state === "loading",
      isError: state === "error",
      refetch: mocks.refetch,
    })
    render(
      <StartUsageDialog
        open
        onOpenChange={vi.fn()}
        equipment={{
          id: 99,
          ten_thiet_bi: "Monitor",
          ma_thiet_bi: "TB-99",
          tinh_trang_hien_tai: "Tốt",
        }}
      />
    )
    expect(screen.getByRole("button", { name: "Bắt đầu sử dụng" })).toBeDisabled()
    if (state === "error") {
      fireEvent.click(screen.getByRole("button", { name: "Thử lại trạng thái sử dụng" }))
      expect(mocks.refetch).toHaveBeenCalledOnce()
    } else expect(screen.getByText("Đang tải trạng thái sử dụng…")).toBeInTheDocument()
  })

  it("only enables the availability observer while an equipment dialog is open", () => {
    const { rerender } = render(
      <StartUsageDialog open={false} onOpenChange={vi.fn()} equipment={null} />
    )
    expect(mocks.useActiveUsageLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    )
    rerender(<StartUsageDialog open onOpenChange={vi.fn()} equipment={null} />)
    expect(mocks.useActiveUsageLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false })
    )
  })
})

vi.mock("@/hooks/use-equipment-status-catalog", async () => {
  const { readyStatusCatalog } = await import("@/hooks/__tests__/equipment-status-catalog-fixtures")
  return { useEquipmentStatusCatalog: () => readyStatusCatalog }
})
