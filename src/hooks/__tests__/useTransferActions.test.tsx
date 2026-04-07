import * as React from "react"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { transferDataGridKeys } from "@/hooks/useTransferDataGrid"
import { transferKanbanKeys } from "@/hooks/useTransfersKanban"
import type { TransferListItem } from "@/types/transfers-data-grid"

vi.mock("@/lib/rpc-client", () => ({
  callRpc: vi.fn(),
}))

const mockToast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "2",
        role: "to_qltb",
        khoa_phong: "Khoa A",
      },
    },
  }),
}))

import { callRpc } from "@/lib/rpc-client"
import { useTransferActions } from "../useTransferActions"

const mockCallRpc = vi.mocked(callRpc)

function createQueryClient() {
  return new QueryClient({
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
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function makeTransferListItem(
  overrides: Partial<TransferListItem> = {},
): TransferListItem {
  return {
    id: overrides.id ?? 11,
    ma_yeu_cau: overrides.ma_yeu_cau ?? "LC-0011",
    thiet_bi_id: overrides.thiet_bi_id ?? 101,
    loai_hinh: overrides.loai_hinh ?? "noi_bo",
    trang_thai: overrides.trang_thai ?? "cho_duyet",
    nguoi_yeu_cau_id: overrides.nguoi_yeu_cau_id ?? 1,
    ly_do_luan_chuyen: overrides.ly_do_luan_chuyen ?? "Điều phối thiết bị",
    khoa_phong_hien_tai: overrides.khoa_phong_hien_tai ?? "Khoa A",
    khoa_phong_nhan: overrides.khoa_phong_nhan ?? "Khoa B",
    muc_dich: overrides.muc_dich ?? null,
    don_vi_nhan: overrides.don_vi_nhan ?? null,
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
    created_at: overrides.created_at ?? "2026-04-02T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-04-02T00:00:00.000Z",
    created_by: overrides.created_by ?? 1,
    updated_by: overrides.updated_by ?? 1,
    thiet_bi: overrides.thiet_bi ?? {
      ten_thiet_bi: "Máy siêu âm",
      ma_thiet_bi: "TB-101",
      model: "Model X",
      serial: "SER-101",
      khoa_phong_quan_ly: "Khoa A",
      facility_name: "Bệnh viện A",
      facility_id: 1,
    },
  }
}

describe("useTransferActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("invalidates transfer detail caches after approving a transfer", async () => {
    mockCallRpc.mockResolvedValue(undefined)

    const queryClient = createQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useTransferActions(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      result.current.approveTransfer(makeTransferListItem())
    })

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "transfer_request_update_status",
        args: {
          p_id: 11,
          p_status: "da_duyet",
          p_payload: { nguoi_duyet_id: 2 },
        },
      })
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: transferDataGridKeys.all,
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: transferKanbanKeys.all,
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["transfer_request_get"],
      })
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["transfer_change_history_list"],
      })
    })
  })

  it("sends vi_tri_hoan_tra when returning equipment from external transfer", async () => {
    mockCallRpc.mockResolvedValue(undefined)

    const queryClient = createQueryClient()
    const { result } = renderHook(() => useTransferActions(), {
      wrapper: createWrapper(queryClient),
    })

    await act(async () => {
      await result.current.returnFromExternal(
        makeTransferListItem({
          id: 19,
          loai_hinh: "ben_ngoai",
          trang_thai: "da_ban_giao",
        }),
        "Phòng 501",
      )
    })

    await waitFor(() => {
      expect(mockCallRpc).toHaveBeenCalledWith({
        fn: "transfer_request_complete",
        args: {
          p_id: 19,
          p_payload: expect.objectContaining({
            vi_tri_hoan_tra: "Phòng 501",
            ngay_hoan_tra: expect.any(String),
          }),
        },
      })
    })
  })
})
