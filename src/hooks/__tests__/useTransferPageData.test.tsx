import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callRpc: vi.fn(),
}))

const mockOverdueItem = {
  id: 88,
  ma_yeu_cau: "LC-0088",
  thiet_bi_id: 22,
  loai_hinh: "ben_ngoai",
  trang_thai: "da_ban_giao",
  nguoi_yeu_cau_id: 1,
  ly_do_luan_chuyen: "Smoke overdue",
  khoa_phong_hien_tai: null,
  khoa_phong_nhan: null,
  muc_dich: "cho_muon",
  don_vi_nhan: "External A",
  dia_chi_don_vi: null,
  nguoi_lien_he: null,
  so_dien_thoai: null,
  ngay_du_kien_tra: "2026-04-01T00:00:00.000Z",
  ngay_ban_giao: null,
  ngay_hoan_tra: null,
  ngay_hoan_thanh: null,
  nguoi_duyet_id: null,
  ngay_duyet: null,
  ghi_chu_duyet: null,
  created_at: "2026-03-30T00:00:00.000Z",
  updated_at: "2026-03-30T00:00:00.000Z",
  created_by: 1,
  updated_by: null,
  equipment_is_deleted: true,
  days_difference: -3,
  thiet_bi: {
    ten_thiet_bi: "Máy thở",
    ma_thiet_bi: "MT-001",
    model: null,
    serial: null,
    khoa_phong_quan_ly: "Khoa A",
    facility_name: "Bệnh viện A",
    facility_id: 7,
    is_deleted: true,
  },
}

vi.mock("@/lib/rpc-client", () => ({
  callRpc: mocks.callRpc,
}))

import { useTransferPageData } from "../useTransferDataGrid"

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: Readonly<{ children: React.ReactNode }>) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe("useTransferPageData", () => {
  beforeEach(() => {
    mocks.callRpc.mockReset()
  })

  it("calls the combined page-data RPC with table filters", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      viewMode: "table",
      list: {
        data: [],
        total: 0,
        page: 2,
        pageSize: 20,
      },
      counts: {
        totalCount: 0,
        columnCounts: {
          cho_duyet: 0,
          da_duyet: 0,
          dang_luan_chuyen: 0,
          da_ban_giao: 0,
          hoan_thanh: 0,
        },
      },
      kanban: null,
      overdue_summary: {
        total: 2,
        overdue: 1,
        due_today: 0,
        due_soon: 1,
        items: [mockOverdueItem],
      },
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(
      () =>
        useTransferPageData(
          {
            q: "may tho",
            statuses: ["da_duyet", "cho_duyet"],
            types: ["noi_bo"],
            page: 2,
            pageSize: 20,
            facilityId: 7,
            dateFrom: "2026-04-01",
            dateTo: "2026-04-30",
            assigneeIds: [5, 3],
          },
          { viewMode: "table", enabled: true },
        ),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.data?.viewMode).toBe("table"))
    expect(result.current.data?.overdue_summary).toEqual({
      total: 2,
      overdue: 1,
      due_today: 0,
      due_soon: 1,
      items: [mockOverdueItem],
    })

    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "transfer_request_page_data",
      args: {
        p_q: "may tho",
        p_statuses: ["cho_duyet", "da_duyet"],
        p_types: ["noi_bo"],
        p_page: 2,
        p_page_size: 20,
        p_don_vi: 7,
        p_date_from: "2026-04-01",
        p_date_to: "2026-04-30",
        p_assignee_ids: [3, 5],
        p_view_mode: "table",
        p_per_column_limit: 30,
        p_exclude_completed: false,
        p_include_counts: true,
      },
      signal: expect.any(AbortSignal),
    })
  })

  it("can skip counts when only page data is needed", async () => {
    mocks.callRpc.mockResolvedValueOnce({
      viewMode: "table",
      list: {
        data: [],
        total: 20,
        page: 2,
        pageSize: 20,
      },
      counts: null,
      kanban: null,
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    const { result } = renderHook(
      () =>
        useTransferPageData(
          {
            types: ["noi_bo"],
            page: 2,
            pageSize: 20,
          },
          { viewMode: "table", enabled: true, includeCounts: false },
        ),
      { wrapper: createWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.data?.counts).toBeNull())
    expect(result.current.data?.overdue_summary).toEqual({
      total: 0,
      overdue: 0,
      due_today: 0,
      due_soon: 0,
      items: [],
    })

    expect(mocks.callRpc).toHaveBeenCalledWith({
      fn: "transfer_request_page_data",
      args: expect.objectContaining({
        p_include_counts: false,
      }),
      signal: expect.any(AbortSignal),
    })
  })

  it("does not call the combined RPC when disabled", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    renderHook(() => useTransferPageData({}, { viewMode: "kanban", enabled: false }), {
      wrapper: createWrapper(queryClient),
    })

    await Promise.resolve()

    expect(mocks.callRpc).not.toHaveBeenCalled()
  })
})
