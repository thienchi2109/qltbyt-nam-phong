import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TransfersKanbanView } from "@/components/transfers/TransfersKanbanView"
import type {
  TransferKanbanResponse,
  TransferListFilters,
  TransferListItem,
  TransferStatus,
} from "@/types/transfers-data-grid"

const mocks = vi.hoisted(() => ({
  fetchNextPage: vi.fn(),
  renderColumn: vi.fn(),
  useTransferColumnInfiniteScroll: vi.fn(),
  useTransfersKanban: vi.fn(),
}))

vi.mock("@/hooks/useTransferDataGrid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useTransferDataGrid")>()

  return {
    ...actual,
    useTransferColumnInfiniteScroll: mocks.useTransferColumnInfiniteScroll,
    useTransfersKanban: mocks.useTransfersKanban,
  }
})

interface MockKanbanColumnProps {
  status: TransferStatus
  tasks: TransferListItem[]
  total: number
  hasMore: boolean
  onLoadMore?: () => void
}

vi.mock("@/components/transfers/TransfersKanbanColumn", () => ({
  TransfersKanbanColumn: ({
    status,
    tasks,
    total,
  hasMore,
  onLoadMore,
}: MockKanbanColumnProps) => (
    mocks.renderColumn({ status, tasks, total, hasMore, onLoadMore }) ?? (
      <section data-testid={`kanban-column-${status}`}>
        <div data-testid={`kanban-total-${status}`}>{total}</div>
        {tasks.map((task) => (
          <div key={task.id}>{task.ma_yeu_cau}</div>
        ))}
        <button
          type="button"
          data-testid={`load-more-${status}`}
          disabled={!hasMore}
          onClick={onLoadMore}
        >
          Load more
        </button>
      </section>
    )
  ),
}))

function makeTransferItem(
  overrides: Partial<TransferListItem> = {},
): TransferListItem {
  return {
    id: overrides.id ?? 1,
    ma_yeu_cau: overrides.ma_yeu_cau ?? "LC-0001",
    thiet_bi_id: overrides.thiet_bi_id ?? 1,
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
      ma_thiet_bi: "TB-001",
      model: "Model",
      serial: "SER-001",
      khoa_phong_quan_ly: "Dept A",
      facility_name: "Facility",
      facility_id: 1,
    },
  }
}

function makeKanbanResponse(tasks: TransferListItem[]): TransferKanbanResponse {
  return {
    columns: {
      cho_duyet: { tasks, total: tasks.length + 1, hasMore: true },
      da_duyet: { tasks: [], total: 0, hasMore: false },
      dang_luan_chuyen: { tasks: [], total: 0, hasMore: false },
      da_ban_giao: { tasks: [], total: 0, hasMore: false },
      hoan_thanh: { tasks: [], total: 0, hasMore: false },
    },
    totalCount: tasks.length + 1,
  }
}

function makeInitialPageTasks(): TransferListItem[] {
  return Array.from({ length: 30 }, (_, index) =>
    makeTransferItem({
      id: index + 1,
      ma_yeu_cau: `LC-PAGE-1-${index + 1}`,
    }),
  )
}

function renderKanbanView(filters: TransferListFilters = { types: ["noi_bo"] }) {
  return render(
    <TransfersKanbanView
      filters={filters}
      initialData={null}
      onViewTransfer={vi.fn()}
      renderRowActions={() => null}
      statusCounts={undefined}
      userRole="to_qltb"
    />,
  )
}

describe("TransfersKanbanView infinite scroll", () => {
  beforeEach(() => {
    mocks.fetchNextPage.mockReset()
    mocks.renderColumn.mockReset()
    mocks.useTransferColumnInfiniteScroll.mockReset()
    mocks.useTransfersKanban.mockReset()
    mocks.useTransfersKanban.mockReturnValue({
      data: makeKanbanResponse(makeInitialPageTasks()),
      isFetching: false,
      isLoading: false,
    })
    mocks.useTransferColumnInfiniteScroll.mockReturnValue({
      data: undefined,
      fetchNextPage: mocks.fetchNextPage,
      hasNextPage: undefined,
      isFetchingNextPage: false,
    })
  })

  it("fetches page 2 on the first load-more trigger without enabling auto-fetch", async () => {
    const user = userEvent.setup()

    renderKanbanView()

    expect(mocks.useTransferColumnInfiniteScroll).toHaveBeenCalledWith(
      expect.objectContaining({ types: ["noi_bo"] }),
      "cho_duyet",
      false,
    )

    await user.click(screen.getAllByTestId("load-more-cho_duyet")[0])

    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1)
    expect(mocks.useTransferColumnInfiniteScroll).not.toHaveBeenCalledWith(
      expect.anything(),
      "cho_duyet",
      true,
    )
  })

  it("merges initial kanban tasks with page 2 tasks without duplicating page 1", () => {
    const page2Task = makeTransferItem({
      id: 31,
      ma_yeu_cau: "LC-PAGE-2-1",
    })
    mocks.useTransferColumnInfiniteScroll.mockImplementation(
      (_filters: TransferListFilters, status: TransferStatus) => ({
        data:
          status === "cho_duyet"
            ? { pages: [{ data: [page2Task], hasMore: false }] }
            : undefined,
        fetchNextPage: mocks.fetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
      }),
    )

    renderKanbanView()

    const choDuyetColumn = mocks.renderColumn.mock.calls
      .map((call) => call[0] as MockKanbanColumnProps)
      .find((props) => props.status === "cho_duyet")

    expect(choDuyetColumn).toBeDefined()
    const taskCodes = choDuyetColumn?.tasks.map((task) => task.ma_yeu_cau) ?? []

    expect(taskCodes).toContain("LC-PAGE-1-1")
    expect(taskCodes).toContain("LC-PAGE-2-1")
    expect(taskCodes.filter((code) => code === "LC-PAGE-1-1")).toHaveLength(1)
    expect(taskCodes).toHaveLength(31)
  })
})
