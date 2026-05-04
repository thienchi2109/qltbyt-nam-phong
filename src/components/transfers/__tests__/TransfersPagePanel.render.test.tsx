import * as React from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Table as ReactTable } from "@tanstack/react-table"

import { TransfersPagePanel } from "@/app/(app)/transfers/_components/TransfersPagePanel"
import { makeTransferItem } from "@/test-utils/transfers-fixtures"
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
      viewMode: "table",
      dataState: { shouldFetch: true, isLoading: false, isFetching: true },
    })
    expect(screen.getByText(/Đang đồng bộ dữ liệu/)).toBeInTheDocument()
  })

  it("renders activeFilterCount badge when greater than zero", () => {
    renderPanel({ viewMode: "table", activeFilterCount: 3 })
    const filterButton = screen.getByRole("button", { name: /Bộ lọc/ })
    expect(within(filterButton).getByText("3")).toBeInTheDocument()
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
