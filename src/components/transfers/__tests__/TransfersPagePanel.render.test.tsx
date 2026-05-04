import * as React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Table as ReactTable } from "@tanstack/react-table"

import { TransfersPagePanel } from "@/app/(app)/transfers/_components/TransfersPagePanel"
import type {
  TransferListFilters,
  TransferListItem,
  TransferType,
} from "@/types/transfers-data-grid"

// --- Heavy children: replaced with simple sentinels ---------------------

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <div data-testid="tenant-selector" />,
}))

vi.mock("@/components/shared/SearchInput", () => ({
  SearchInput: ({
    value,
    onChange,
    onClear,
  }: {
    value: string
    onChange: (v: string) => void
    onClear: () => void
  }) => (
    <div data-testid="search-input">
      <input
        aria-label="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" onClick={onClear}>
        clear
      </button>
    </div>
  ),
}))

vi.mock("@/components/shared/DataTablePagination", () => ({
  DataTablePagination: () => <div data-testid="data-table-pagination" />,
}))

vi.mock("@/components/transfers/TransferCard", () => ({
  TransferCard: ({ transfer }: { transfer: TransferListItem }) => (
    <div data-testid={`transfer-card-${transfer.id}`}>{transfer.ma_yeu_cau}</div>
  ),
}))

vi.mock("@/components/transfers/FilterChips", () => ({
  FilterChips: () => <div data-testid="filter-chips" />,
}))

vi.mock("@/components/transfers/TransferTypeTabs", () => ({
  TransferTypeTabs: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="transfer-type-tabs">{children}</div>
  ),
}))

vi.mock("@/components/transfers/TransfersKanbanView", () => ({
  TransfersKanbanView: ({
    initialData,
  }: {
    initialData: unknown
  }) => (
    <div
      data-testid="transfers-kanban-view"
      data-initial={initialData === null ? "null" : "data"}
    />
  ),
}))

vi.mock("@/components/transfers/TransfersSearchParamsBoundary", () => ({
  TransfersSearchParamsBoundary: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="search-params-boundary">{children}</div>
  ),
}))

vi.mock("@/components/transfers/TransfersTableView", () => ({
  TransfersTableView: () => <div data-testid="transfers-table-view" />,
}))

vi.mock("@/components/transfers/TransfersTenantSelectionPlaceholder", () => ({
  TransfersTenantSelectionPlaceholder: () => (
    <div data-testid="tenant-placeholder" />
  ),
}))

vi.mock("@/components/transfers/TransfersViewToggle", () => ({
  TransfersViewToggle: () => <div data-testid="view-toggle" />,
}))

// --- Helpers ------------------------------------------------------------

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
    ly_do_luan_chuyen: overrides.ly_do_luan_chuyen ?? "Reason",
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

type PanelProps = React.ComponentProps<typeof TransfersPagePanel>

function buildProps(overrides: Partial<PanelProps> = {}): PanelProps {
  const filters: TransferListFilters = { types: ["noi_bo"] }
  const tableStub = {} as unknown as ReactTable<TransferListItem>
  const RowActions: PanelProps["RowActions"] = () => null

  const base: PanelProps = {
    activeTab: "noi_bo" as TransferType,
    onTabChange: vi.fn(),
    transferCounts: null,
    totalCount: 0,
    activeFilterCount: 0,
    onOpenFilterModal: vi.fn(),
    onOpenAddDialog: vi.fn(),
    permissions: {
      showFacilityFilter: false,
      isRegionalLeader: false,
    },
    dataState: {
      shouldFetch: true,
      isLoading: false,
      isFetching: false,
    },
    filterChipsValue: {} as PanelProps["filterChipsValue"],
    onRemoveFilter: vi.fn(),
    onClearAllFilters: vi.fn(),
    searchTerm: "",
    onSearchTermChange: vi.fn(),
    onClearSearch: vi.fn(),
    viewMode: "table",
    tableData: [],
    referenceDate: new Date("2026-05-01T00:00:00.000Z"),
    onViewTransfer: vi.fn(),
    RowActions,
    renderRowActions: () => null,
    filters,
    kanbanData: null,
    userRole: "to_qltb",
    columns: [],
    pagination: { pageIndex: 0, pageSize: 10 },
    onPaginationChange: vi.fn(),
    pageCount: 1,
    table: tableStub,
    transferEntity: { singular: "yêu cầu" },
    transferDisplayFormat: () => null,
  }

  return { ...base, ...overrides }
}

function renderPanel(overrides: Partial<PanelProps> = {}) {
  return render(<TransfersPagePanel {...buildProps(overrides)} />)
}

// --- Tests --------------------------------------------------------------

describe("TransfersPagePanel grouped props", () => {
  it("renders TenantSelector when permissions.showFacilityFilter=true", () => {
    renderPanel({
      permissions: { showFacilityFilter: true, isRegionalLeader: false },
    })
    expect(screen.getByTestId("tenant-selector")).toBeInTheDocument()
  })

  it("hides TenantSelector when permissions.showFacilityFilter=false", () => {
    renderPanel()
    expect(screen.queryByTestId("tenant-selector")).not.toBeInTheDocument()
  })

  it("hides 'Tạo yêu cầu mới' when permissions.isRegionalLeader=true", () => {
    renderPanel({
      permissions: { showFacilityFilter: false, isRegionalLeader: true },
    })
    expect(screen.queryByRole("button", { name: /Tạo yêu cầu mới/ })).toBeNull()
  })

  it("invokes onOpenAddDialog when create button is clicked (non-regional leader)", async () => {
    const onOpenAddDialog = vi.fn()
    renderPanel({ onOpenAddDialog })
    await userEvent.setup().click(
      screen.getByRole("button", { name: /Tạo yêu cầu mới/ }),
    )
    expect(onOpenAddDialog).toHaveBeenCalledTimes(1)
  })

  it("renders tenant placeholder when dataState.shouldFetch=false (table mode)", () => {
    renderPanel({
      viewMode: "table",
      dataState: { shouldFetch: false, isLoading: false, isFetching: false },
    })
    expect(screen.getByTestId("tenant-placeholder")).toBeInTheDocument()
    expect(screen.queryByTestId("transfers-table-view")).not.toBeInTheDocument()
    expect(screen.queryByTestId("data-table-pagination")).not.toBeInTheDocument()
  })

  it("renders tenant placeholder when dataState.shouldFetch=false (kanban mode)", () => {
    renderPanel({
      viewMode: "kanban",
      dataState: { shouldFetch: false, isLoading: false, isFetching: false },
    })
    expect(screen.getByTestId("tenant-placeholder")).toBeInTheDocument()
    expect(screen.queryByTestId("transfers-kanban-view")).not.toBeInTheDocument()
  })

  it("renders kanban view with initialData=null while isFetching is true", () => {
    renderPanel({
      viewMode: "kanban",
      dataState: { shouldFetch: true, isLoading: false, isFetching: true },
      kanbanData: { columns: {}, totalCount: 0 } as PanelProps["kanbanData"],
    })
    const kanban = screen.getByTestId("transfers-kanban-view")
    expect(kanban).toHaveAttribute("data-initial", "null")
  })

  it("renders kanban view with provided kanbanData when not fetching", () => {
    renderPanel({
      viewMode: "kanban",
      dataState: { shouldFetch: true, isLoading: false, isFetching: false },
      kanbanData: { columns: {}, totalCount: 0 } as PanelProps["kanbanData"],
    })
    expect(screen.getByTestId("transfers-kanban-view")).toHaveAttribute(
      "data-initial",
      "data",
    )
  })

  it("renders table view + footer pagination in table mode when shouldFetch=true", () => {
    renderPanel({
      viewMode: "table",
      dataState: { shouldFetch: true, isLoading: false, isFetching: false },
      tableData: [makeTransferItem()],
    })
    expect(screen.getByTestId("transfers-table-view")).toBeInTheDocument()
    expect(screen.getByTestId("data-table-pagination")).toBeInTheDocument()
  })

  it("shows mobile loading indicator when dataState.isLoading=true", () => {
    renderPanel({
      viewMode: "table",
      dataState: { shouldFetch: true, isLoading: true, isFetching: false },
    })
    expect(screen.getByText(/Đang tải dữ liệu/)).toBeInTheDocument()
  })

  it("shows sync indicator when isFetching=true and isLoading=false", () => {
    renderPanel({
      dataState: { shouldFetch: true, isLoading: false, isFetching: true },
    })
    expect(screen.getByText(/Đang đồng bộ dữ liệu/)).toBeInTheDocument()
  })

  it("renders activeFilterCount badge when greater than zero", () => {
    renderPanel({ activeFilterCount: 3 })
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("invokes onOpenFilterModal when filter button is clicked", async () => {
    const onOpenFilterModal = vi.fn()
    renderPanel({ onOpenFilterModal })
    await userEvent.setup().click(
      screen.getByRole("button", { name: /Bộ lọc/ }),
    )
    expect(onOpenFilterModal).toHaveBeenCalledTimes(1)
  })
})
