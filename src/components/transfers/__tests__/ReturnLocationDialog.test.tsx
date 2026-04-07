import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TransferListItem } from "@/types/transfers-data-grid"

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

import { callRpc } from "@/lib/rpc-client"
import { ReturnLocationDialog } from "@/components/transfers/ReturnLocationDialog"

const mockCallRpc = vi.mocked(callRpc)

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  )
}

function makeTransferListItem(
  overrides: Partial<TransferListItem> = {},
): TransferListItem {
  return {
    id: overrides.id ?? 7,
    ma_yeu_cau: overrides.ma_yeu_cau ?? "LC-0007",
    thiet_bi_id: overrides.thiet_bi_id ?? 99,
    loai_hinh: overrides.loai_hinh ?? "ben_ngoai",
    trang_thai: overrides.trang_thai ?? "da_ban_giao",
    nguoi_yeu_cau_id: overrides.nguoi_yeu_cau_id ?? 1,
    ly_do_luan_chuyen: overrides.ly_do_luan_chuyen ?? "Điều phối",
    khoa_phong_hien_tai: overrides.khoa_phong_hien_tai ?? "Khoa A",
    khoa_phong_nhan: overrides.khoa_phong_nhan ?? null,
    muc_dich: overrides.muc_dich ?? null,
    don_vi_nhan: overrides.don_vi_nhan ?? "Bệnh viện B",
    dia_chi_don_vi: overrides.dia_chi_don_vi ?? null,
    nguoi_lien_he: overrides.nguoi_lien_he ?? null,
    so_dien_thoai: overrides.so_dien_thoai ?? null,
    ngay_du_kien_tra: overrides.ngay_du_kien_tra ?? null,
    ngay_ban_giao: overrides.ngay_ban_giao ?? null,
    ngay_hoan_tra: overrides.ngay_hoan_tra ?? null,
    ngay_hoan_thanh: overrides.ngay_hoan_thanh ?? null,
    nguoi_duyet_id: overrides.nguoi_duyet_id ?? null,
    ngay_duyet: overrides.ngay_duyet ?? null,
    ghi_chu_duyet: overrides.ghi_chu_duyet ?? null,
    created_at: overrides.created_at ?? "2026-04-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-01T00:00:00.000Z",
    created_by: overrides.created_by ?? 1,
    updated_by: overrides.updated_by ?? 1,
    thiet_bi: overrides.thiet_bi ?? {
      ten_thiet_bi: "Máy siêu âm",
      ma_thiet_bi: "TB-99",
      model: "Model X",
      serial: "SER-99",
      khoa_phong_quan_ly: "Khoa A",
      facility_name: "Bệnh viện A",
      facility_id: 1,
    },
  }
}

describe("ReturnLocationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(max-width: 767px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as typeof window.matchMedia
  })

  it("loads suggestions for the current transfer request", async () => {
    mockCallRpc.mockResolvedValueOnce([
      { vi_tri: "Phòng 501" },
      { vi_tri: "Phòng 502" },
    ])

    renderWithClient(
      <ReturnLocationDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransferListItem({ id: 17 })}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "get_equipment_location_suggestions",
        args: { p_transfer_request_id: 17 },
      })
    })

    expect(await screen.findByText("Phòng 501")).toBeInTheDocument()
    expect(screen.getByText("Phòng 502")).toBeInTheDocument()
  })

  it("rejects empty input", async () => {
    mockCallRpc.mockResolvedValueOnce([])
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    renderWithClient(
      <ReturnLocationDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransferListItem()}
        onConfirm={onConfirm}
      />,
    )

    await user.click(await screen.findByRole("button", { name: "Xác nhận hoàn trả" }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(await screen.findByText("Vui lòng nhập vị trí hoàn trả.")).toBeInTheDocument()
  })

  it('rejects the forbidden "Đang luân chuyển bên ngoài" value', async () => {
    mockCallRpc.mockResolvedValueOnce([])
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    renderWithClient(
      <ReturnLocationDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransferListItem()}
        onConfirm={onConfirm}
      />,
    )

    await user.type(
      await screen.findByLabelText("Vị trí hoàn trả"),
      "Đang luân chuyển bên ngoài",
    )
    await user.click(screen.getByRole("button", { name: "Xác nhận hoàn trả" }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      await screen.findByText('Vị trí hoàn trả không được là "Đang luân chuyển bên ngoài".'),
    ).toBeInTheDocument()
  })

  it("calls onConfirm with a valid free-text location", async () => {
    mockCallRpc.mockResolvedValueOnce([{ vi_tri: "Phòng 501" }])
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    renderWithClient(
      <ReturnLocationDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransferListItem()}
        onConfirm={onConfirm}
      />,
    )

    await user.type(await screen.findByLabelText("Vị trí hoàn trả"), "Phòng 601")
    await user.click(screen.getByRole("button", { name: "Xác nhận hoàn trả" }))

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("Phòng 601")
    })
  })

  it("uses a suggestion when the user clicks it", async () => {
    mockCallRpc.mockResolvedValueOnce([{ vi_tri: "Phòng 501" }])
    const onConfirm = vi.fn()
    const user = userEvent.setup()

    renderWithClient(
      <ReturnLocationDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransferListItem()}
        onConfirm={onConfirm}
      />,
    )

    await user.click(await screen.findByRole("button", { name: "Phòng 501" }))
    await user.click(screen.getByRole("button", { name: "Xác nhận hoàn trả" }))

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("Phòng 501")
    })
  })
})
