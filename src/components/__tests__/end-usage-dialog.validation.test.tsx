import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  mutateAsync: vi.fn(),
  useEndUsageSession: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/hooks/use-usage-logs", () => ({
  useEndUsageSession: () => mocks.useEndUsageSession(),
}))

import { EndUsageDialog } from "../end-usage-dialog"

describe("EndUsageDialog validation", () => {
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
    mocks.useEndUsageSession.mockReturnValue({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    })
  })

  it("blocks submit when the final status is empty", async () => {
    render(
      <EndUsageDialog
        open
        onOpenChange={vi.fn()}
        usageLog={{
          id: 1,
          thiet_bi_id: 99,
          thoi_gian_bat_dau: "2026-04-15T01:00:00Z",
          trang_thai: "dang_su_dung",
          created_at: "2026-04-15T01:00:00Z",
          updated_at: "2026-04-15T01:00:00Z",
          tinh_trang_thiet_bi: null,
          ghi_chu: null,
          thiet_bi: { ten_thiet_bi: "Monitor", ma_thiet_bi: "TB-99", id: 99 },
          nguoi_su_dung: { id: 7, username: "user", password: "", full_name: "Nguyễn Văn A", role: "to_qltb", created_at: "2026-04-15T01:00:00Z" },
        }}
      />
    )

    const input = screen.getByLabelText("Tình trạng kết thúc")
    fireEvent.change(input, { target: { value: " " } })
    fireEvent.click(screen.getByRole("button", { name: "Kết thúc sử dụng" }))

    await waitFor(() => {
      expect(screen.getByText("Vui lòng nhập tình trạng kết thúc")).toBeInTheDocument()
    })

    expect(mocks.mutateAsync).not.toHaveBeenCalled()
  })

  it("submits both final status fields when the input is valid", async () => {
    render(
      <EndUsageDialog
        open
        onOpenChange={vi.fn()}
        usageLog={{
          id: 1,
          thiet_bi_id: 99,
          thoi_gian_bat_dau: "2026-04-15T01:00:00Z",
          trang_thai: "dang_su_dung",
          created_at: "2026-04-15T01:00:00Z",
          updated_at: "2026-04-15T01:00:00Z",
          tinh_trang_thiet_bi: "Tốt",
          ghi_chu: "",
          thiet_bi: { ten_thiet_bi: "Monitor", ma_thiet_bi: "TB-99", id: 99 },
          nguoi_su_dung: { id: 7, username: "user", password: "", full_name: "Nguyễn Văn A", role: "to_qltb", created_at: "2026-04-15T01:00:00Z" },
        }}
      />
    )

    const input = screen.getByLabelText("Tình trạng kết thúc")
    fireEvent.change(input, { target: { value: "Cần bảo trì" } })
    fireEvent.click(screen.getByRole("button", { name: "Kết thúc sử dụng" }))

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        id: 1,
        tinh_trang_thiet_bi: "Cần bảo trì",
        tinh_trang_ket_thuc: "Cần bảo trì",
        ghi_chu: "",
      })
    })
  })
})
