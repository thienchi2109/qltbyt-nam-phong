import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as React from "react"

import type { TransferRequest, UserSummary } from "@/types/database"

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/transfers/TransferStatusProgress", () => ({
  TransferStatusProgress: () => <div>Transfer progress</div>,
}))

import { callRpc } from "@/lib/rpc-client"
import { TransferDetailDialog } from "../transfer-detail-dialog"

const mockCallRpc = vi.mocked(callRpc)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function makeUser(overrides: Partial<UserSummary>): UserSummary {
  return {
    id: overrides.id ?? 1,
    username: overrides.username ?? "user",
    full_name: overrides.full_name ?? "Người dùng",
    role: overrides.role ?? "user",
    khoa_phong: overrides.khoa_phong ?? undefined,
    created_at: overrides.created_at ?? "2026-04-02T00:00:00.000Z",
  }
}

function makeTransferRow(overrides: Partial<TransferRequest> = {}): TransferRequest {
  const baseTransfer: TransferRequest = {
    id: overrides.id ?? 11,
    ma_yeu_cau: overrides.ma_yeu_cau ?? "LC-0011",
    thiet_bi_id: overrides.thiet_bi_id ?? 101,
    loai_hinh: overrides.loai_hinh ?? "noi_bo",
    trang_thai: overrides.trang_thai ?? "hoan_thanh",
    nguoi_yeu_cau_id: overrides.nguoi_yeu_cau_id ?? 1,
    ly_do_luan_chuyen: overrides.ly_do_luan_chuyen ?? "Điều phối thiết bị",
    khoa_phong_hien_tai: overrides.khoa_phong_hien_tai ?? "Khoa A",
    khoa_phong_nhan: overrides.khoa_phong_nhan ?? "Khoa B",
    muc_dich: overrides.muc_dich,
    don_vi_nhan: overrides.don_vi_nhan,
    dia_chi_don_vi: overrides.dia_chi_don_vi,
    nguoi_lien_he: overrides.nguoi_lien_he,
    so_dien_thoai: overrides.so_dien_thoai,
    ngay_du_kien_tra: overrides.ngay_du_kien_tra,
    ngay_ban_giao: overrides.ngay_ban_giao,
    ngay_hoan_tra: overrides.ngay_hoan_tra,
    ngay_hoan_thanh: overrides.ngay_hoan_thanh ?? "2026-04-02T00:00:00.000Z",
    nguoi_duyet_id: overrides.nguoi_duyet_id ?? 2,
    ngay_duyet: overrides.ngay_duyet ?? "2026-04-01T00:00:00.000Z",
    ghi_chu_duyet: overrides.ghi_chu_duyet,
    created_at: overrides.created_at ?? "2026-03-31T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-02T00:00:00.000Z",
    created_by: overrides.created_by,
    updated_by: overrides.updated_by,
    thiet_bi: overrides.thiet_bi ?? {
      id: 101,
      ten_thiet_bi: "Máy siêu âm",
      ma_thiet_bi: "TB-101",
      model: "Model X",
      serial: "SER-101",
      serial_number: "SER-101",
      khoa_phong_quan_ly: "Khoa A",
      don_vi: 1,
      tinh_trang: null,
      facility_name: "Bệnh viện A",
      facility_id: 1,
    },
    nguoi_yeu_cau: overrides.nguoi_yeu_cau,
    nguoi_duyet: overrides.nguoi_duyet,
    created_by_user: overrides.created_by_user,
    updated_by_user: overrides.updated_by_user,
  }

  return {
    ...baseTransfer,
    ...overrides,
  }
}

describe("TransferDetailDialog related people", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches transfer detail on open and renders requester and approver for a completed transfer row with ids only", async () => {
    const requester = makeUser({ id: 1, full_name: "Nguyễn Văn Yêu Cầu" })
    const approver = makeUser({ id: 2, full_name: "Trần Thị Duyệt", role: "to_qltb" })

    mockCallRpc.mockImplementation(async ({ fn }) => {
      if (fn === "transfer_request_get") {
        return makeTransferRow({
          nguoi_yeu_cau: requester,
          nguoi_duyet: approver,
        })
      }
      if (fn === "transfer_history_list") {
        return []
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    render(
      <TransferDetailDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransferRow({ nguoi_yeu_cau: undefined, nguoi_duyet: undefined })}
      />,
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: "transfer_request_get",
          args: { p_id: 11 },
        }),
      )
    })

    await waitFor(() => {
      expect(screen.getByText("Nguyễn Văn Yêu Cầu")).toBeInTheDocument()
      expect(screen.getByText("Trần Thị Duyệt")).toBeInTheDocument()
    })
  })

  it("renders requester without an empty approver row for a pending transfer", async () => {
    const requester = makeUser({ id: 10, full_name: "Lê Thị Yêu Cầu" })

    mockCallRpc.mockImplementation(async ({ fn }) => {
      if (fn === "transfer_request_get") {
        return makeTransferRow({
          trang_thai: "cho_duyet",
          nguoi_yeu_cau: requester,
          nguoi_duyet_id: undefined,
          nguoi_duyet: undefined,
          ngay_duyet: undefined,
        })
      }
      if (fn === "transfer_history_list") {
        return []
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    render(
      <TransferDetailDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransferRow({
          trang_thai: "cho_duyet",
          nguoi_duyet_id: undefined,
          nguoi_yeu_cau: undefined,
          nguoi_duyet: undefined,
          ngay_duyet: undefined,
          ngay_hoan_thanh: undefined,
        })}
      />,
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(screen.getByText("Lê Thị Yêu Cầu")).toBeInTheDocument()
    })

    expect(screen.queryByText("Người duyệt:")).not.toBeInTheDocument()
  })

  it("renders only resolvable related-person rows when one referenced user cannot be resolved", async () => {
    const approver = makeUser({ id: 22, full_name: "Phạm Văn Duyệt", role: "to_qltb" })

    mockCallRpc.mockImplementation(async ({ fn }) => {
      if (fn === "transfer_request_get") {
        return makeTransferRow({
          nguoi_yeu_cau: undefined,
          nguoi_duyet: approver,
        })
      }
      if (fn === "transfer_history_list") {
        return []
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    render(
      <TransferDetailDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransferRow({ nguoi_yeu_cau: undefined, nguoi_duyet: undefined })}
      />,
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(screen.getByText("Phạm Văn Duyệt")).toBeInTheDocument()
    })

    expect(screen.queryByText("Người yêu cầu:")).not.toBeInTheDocument()
    expect(screen.getByText("Người duyệt:")).toBeInTheDocument()
  })

  it("does not refetch transfer detail when the parent re-renders with the same transfer id", async () => {
    mockCallRpc.mockImplementation(async ({ fn }) => {
      if (fn === "transfer_request_get") {
        return makeTransferRow()
      }
      if (fn === "transfer_history_list") {
        return []
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    const { rerender } = render(
      <TransferDetailDialog open onOpenChange={vi.fn()} transfer={makeTransferRow()} />,
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(
        mockCallRpc.mock.calls.filter(([call]) => call.fn === "transfer_request_get"),
      ).toHaveLength(1)
    })

    rerender(
      <TransferDetailDialog
        open
        onOpenChange={vi.fn()}
        transfer={makeTransferRow({ updated_at: "2026-04-03T00:00:00.000Z" })}
      />,
    )

    expect(
      mockCallRpc.mock.calls.filter(([call]) => call.fn === "transfer_request_get"),
    ).toHaveLength(1)
  })

  it("reuses cached transfer detail and history when reopening the same transfer id", async () => {
    mockCallRpc.mockImplementation(async ({ fn }) => {
      if (fn === "transfer_request_get") {
        return makeTransferRow()
      }
      if (fn === "transfer_history_list") {
        return []
      }
      throw new Error(`Unexpected RPC: ${fn}`)
    })

    const transfer = makeTransferRow({ nguoi_yeu_cau: undefined, nguoi_duyet: undefined })

    const { rerender } = render(
      <TransferDetailDialog open onOpenChange={vi.fn()} transfer={transfer} />,
      { wrapper: createWrapper() },
    )

    await waitFor(() => {
      expect(
        mockCallRpc.mock.calls.filter(([call]) => call.fn === "transfer_request_get"),
      ).toHaveLength(1)
      expect(
        mockCallRpc.mock.calls.filter(([call]) => call.fn === "transfer_history_list"),
      ).toHaveLength(1)
    })

    rerender(<TransferDetailDialog open={false} onOpenChange={vi.fn()} transfer={transfer} />)
    rerender(<TransferDetailDialog open onOpenChange={vi.fn()} transfer={transfer} />)

    await waitFor(() => {
      expect(
        mockCallRpc.mock.calls.filter(([call]) => call.fn === "transfer_request_get"),
      ).toHaveLength(1)
      expect(
        mockCallRpc.mock.calls.filter(([call]) => call.fn === "transfer_history_list"),
      ).toHaveLength(1)
    })
  })
})
