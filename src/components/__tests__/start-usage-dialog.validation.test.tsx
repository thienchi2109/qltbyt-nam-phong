import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  mutateAsync: vi.fn(),
  useStartUsageSession: vi.fn(),
  useToast: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/hooks/use-usage-logs", () => ({
  useStartUsageSession: () => mocks.useStartUsageSession(),
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
  })

  it("blocks submit when the initial status is empty", async () => {
    render(
      <StartUsageDialog
        open
        onOpenChange={vi.fn()}
        equipment={{ id: 99, ten_thiet_bi: "Monitor", ma_thiet_bi: "TB-99", tinh_trang_hien_tai: null }}
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
    render(
      <StartUsageDialog
        open
        onOpenChange={vi.fn()}
        equipment={{ id: 99, ten_thiet_bi: "Monitor", ma_thiet_bi: "TB-99", tinh_trang_hien_tai: "Tốt" }}
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
    })
  })
})
