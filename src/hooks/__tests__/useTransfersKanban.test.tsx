import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { TransferKanbanResponse, TransferListItem } from "@/types/transfers-data-grid"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import {
  transferKanbanKeys,
  useTransferColumnInfiniteScroll,
  useTransfersKanban,
} from "../useTransfersKanban"

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  })
}

function makeKanbanResponse(totalCount: number): TransferKanbanResponse {
  return {
    columns: {
      cho_duyet: { tasks: [], total: totalCount, hasMore: false },
      da_duyet: { tasks: [], total: 0, hasMore: false },
      dang_luan_chuyen: { tasks: [], total: 0, hasMore: false },
      da_ban_giao: { tasks: [], total: 0, hasMore: false },
      hoan_thanh: { tasks: [], total: 0, hasMore: false },
    },
    totalCount,
  }
}

function makeTransferListItem(
  overrides: Partial<TransferListItem> = {},
): TransferListItem {
  return {
    id: overrides.id ?? 42,
    ma_yeu_cau: overrides.ma_yeu_cau ?? "LC-0042",
    thiet_bi_id: overrides.thiet_bi_id ?? 7,
    loai_hinh: overrides.loai_hinh ?? "noi_bo",
    trang_thai: overrides.trang_thai ?? "cho_duyet",
    nguoi_yeu_cau_id: overrides.nguoi_yeu_cau_id ?? 1,
    ly_do_luan_chuyen: overrides.ly_do_luan_chuyen ?? "Transfer",
    khoa_phong_hien_tai: overrides.khoa_phong_hien_tai ?? "Dept A",
    khoa_phong_nhan: overrides.khoa_phong_nhan ?? "Dept B",
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
    created_at: overrides.created_at ?? "2026-05-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? null,
    created_by: overrides.created_by ?? 1,
    updated_by: overrides.updated_by ?? null,
    thiet_bi: overrides.thiet_bi ?? {
      ten_thiet_bi: "Device",
      ma_thiet_bi: "TB-007",
      model: "Model",
      serial: "SER-007",
      khoa_phong_quan_ly: "Dept A",
      facility_name: "Facility",
      facility_id: 7,
    },
  }
}

describe("useTransfersKanban", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
  })

  it("uses initial page data without disabling background refresh", async () => {
    mocks.callRpc.mockResolvedValue(makeKanbanResponse(2))

    const queryClient = createQueryClient()
    const filters = { types: ["noi_bo"] as const, facilityId: 7 }
    const { result } = renderHook(
      () =>
        useTransfersKanban(
          filters,
          {
            initialData: makeKanbanResponse(1),
            perColumnLimit: 30,
            userRole: "to_qltb",
          },
        ),
      { wrapper: createWrapper(queryClient) },
    )

    expect(result.current.data?.totalCount).toBe(1)

    const query = queryClient.getQueryCache().find({
      queryKey: transferKanbanKeys.filtered(filters, {
        excludeCompleted: true,
        perColumnLimit: 30,
      }),
    })

    expect(query?.options.refetchInterval).toBe(60_000)
    expect(mocks.callRpc).not.toHaveBeenCalled()
  })

  it("fetches page 2 first when column infinite scroll is triggered manually", async () => {
    mocks.callRpc.mockResolvedValue({
      data: [makeTransferListItem()],
      total: 31,
      page: 2,
      pageSize: 30,
    })

    const queryClient = createQueryClient()
    const filters = { types: ["noi_bo"] as const, facilityId: 7 }
    const { result } = renderHook(
      () => useTransferColumnInfiniteScroll(filters, "cho_duyet", false),
      { wrapper: createWrapper(queryClient) },
    )

    expect(mocks.callRpc).not.toHaveBeenCalled()

    await result.current.fetchNextPage()

    await waitFor(() => {
      expect(mocks.callRpc).toHaveBeenCalledWith({
        fn: "transfer_request_list",
        args: expect.objectContaining({
          p_page: 2,
          p_page_size: 30,
          p_statuses: ["cho_duyet"],
          p_view_mode: "table",
        }),
      })
    })
  })
})
