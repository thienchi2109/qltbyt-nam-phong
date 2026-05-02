import * as React from "react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const mockColumnCounts = {
  cho_duyet: 2,
  da_duyet: 3,
  dang_luan_chuyen: 4,
  da_ban_giao: 5,
  hoan_thanh: 6,
}

const mocks = vi.hoisted(() => ({
  kpiConfigs: [
    { key: "cho_duyet", label: "Chờ duyệt", tone: "warning", icon: null },
    { key: "da_duyet", label: "Đã duyệt", tone: "muted", icon: null },
    { key: "dang_luan_chuyen", label: "Đang luân chuyển", tone: "default", icon: null },
    { key: "da_ban_giao", label: "Đã bàn giao", tone: "muted", icon: null },
    { key: "hoan_thanh", label: "Hoàn thành", tone: "success", icon: null },
  ],
  useSession: vi.fn(),
  useRouter: vi.fn(),
  useQueryClient: vi.fn(),
  useTenantSelection: vi.fn(),
  rawViewMode: "table" as "table" | "kanban",
  useTransferPageData: vi.fn(),
  useTransferList: vi.fn(),
  useTransferCounts: vi.fn(),
  useTransferActions: vi.fn(),
  useTransferSearch: vi.fn(),
  useTransfersFilters: vi.fn(),
  useServerPagination: vi.fn(),
  useIsMobile: vi.fn(),
  KpiStatusBar: vi.fn(),
  OverdueTransfersAlert: vi.fn(),
  TransferDetailDialog: vi.fn(),
  TransfersTableView: vi.fn(),
  TransfersKanbanView: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.useRouter(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.useQueryClient(),
}))

vi.mock("@tanstack/react-table", () => ({
  flexRender: vi.fn(),
  getCoreRowModel: () => vi.fn(),
  getPaginationRowModel: () => vi.fn(),
  getSortedRowModel: () => vi.fn(),
  useReactTable: () => ({}),
}))

vi.mock("@/hooks/useServerPagination", () => ({
  useServerPagination: (...args: unknown[]) => mocks.useServerPagination(...args),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => mocks.useTenantSelection(),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mocks.useIsMobile(),
}))

vi.mock("@/hooks/useTransferActions", () => ({
  useTransferActions: () => mocks.useTransferActions(),
}))

vi.mock("@/hooks/useTransferSearch", () => ({
  useTransferSearch: () => mocks.useTransferSearch(),
}))

vi.mock("@/app/(app)/transfers/_components/useTransfersFilters", () => ({
  useTransfersFilters: () => mocks.useTransfersFilters(),
}))

vi.mock("@/hooks/useTransferDataGrid", () => ({
  useTransferPageData: (...args: unknown[]) => mocks.useTransferPageData(...args),
  useTransferList: (...args: unknown[]) => mocks.useTransferList(...args),
  useTransferCounts: (...args: unknown[]) => mocks.useTransferCounts(...args),
  transferDataGridKeys: {
    all: ["transfer-data-grid"],
  },
}))

vi.mock("@/components/kpi", () => ({
  TRANSFER_STATUS_CONFIGS: mocks.kpiConfigs,
  KpiStatusBar: mocks.KpiStatusBar,
}))

vi.mock("@/components/add-transfer-dialog", () => ({
  AddTransferDialog: () => null,
}))

vi.mock("@/components/edit-transfer-dialog", () => ({
  EditTransferDialog: () => null,
}))

vi.mock("@/components/handover-preview-dialog", () => ({
  HandoverPreviewDialog: () => null,
}))

vi.mock("@/components/overdue-transfers-alert", () => ({
  OverdueTransfersAlert: (props: unknown) => mocks.OverdueTransfersAlert(props),
}))

vi.mock("@/components/shared/DataTablePagination", () => ({
  DataTablePagination: () => <div data-testid="transfer-pagination" />,
}))

vi.mock("@/components/transfer-detail-dialog", () => ({
  TransferDetailDialog: (props: unknown) => mocks.TransferDetailDialog(props),
}))

vi.mock("@/components/transfers/TransferCard", () => ({
  TransferCard: () => <div data-testid="transfer-card-view" />,
}))

vi.mock("@/components/transfers/TransferTypeTabs", () => ({
  TransferTypeTabs: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="transfer-type-tabs">{children}</div>
  ),
  useTransferTypeTab: () => ["noi_bo", vi.fn()],
}))

vi.mock("@/components/transfers/columnDefinitions", () => ({
  getColumnsForType: () => [],
}))

vi.mock("@/components/transfers/FilterModal", () => ({
  FilterModal: () => null,
}))

vi.mock("@/components/transfers/FilterChips", () => ({
  FilterChips: () => null,
}))

vi.mock("@/components/transfers/TransferRowActions", () => ({
  TransferRowActions: () => null,
}))

vi.mock("@/components/shared/SearchInput", () => ({
  SearchInput: () => null,
}))

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <div data-testid="tenant-selector" />,
}))

vi.mock("@/components/transfers/TransfersTableView", () => ({
  TransfersTableView: (props: unknown) => {
    mocks.TransfersTableView(props)
    return <div data-testid="transfers-table-view" />
  },
}))

vi.mock("@/components/transfers/TransfersKanbanView", () => ({
  TransfersKanbanView: (props: unknown) => {
    mocks.TransfersKanbanView(props)
    return <div data-testid="transfers-kanban-view" />
  },
}))

vi.mock("@/components/transfers/TransfersViewToggle", () => ({
  TransfersViewToggle: () => <div data-testid="transfers-view-toggle" />,
  useTransfersViewMode: () => [mocks.rawViewMode, vi.fn()],
}))

vi.mock("@/components/transfers/TransfersTenantSelectionPlaceholder", () => ({
  TransfersTenantSelectionPlaceholder: () => <div data-testid="tenant-placeholder" />,
}))

import TransfersPage from "@/app/(app)/transfers/page"

describe("Transfers KPI", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rawViewMode = "table"

    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          role: "global",
          don_vi: null,
          dia_ban_id: null,
          name: "Global Admin",
        },
      },
      status: "authenticated",
    })

    mocks.useRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
    })

    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    })

    mocks.useTenantSelection.mockReturnValue({
      selectedFacilityId: null,
      setSelectedFacilityId: vi.fn(),
      facilities: [],
      showSelector: false,
      shouldFetchData: true,
    })

    mocks.useServerPagination.mockReturnValue({
      page: 1,
      pageSize: 10,
      pagination: {
        pageIndex: 0,
        pageSize: 10,
      },
      setPagination: vi.fn(),
      pageCount: 1,
    })

    mocks.useTransfersFilters.mockReturnValue({
      searchTerm: "",
      setSearchTerm: vi.fn(),
      debouncedSearch: "",
      clearSearch: vi.fn(),
      statusFilter: [],
      setStatusFilter: vi.fn(),
      dateRange: null,
      setDateRange: vi.fn(),
      isFilterModalOpen: false,
      setIsFilterModalOpen: vi.fn(),
      handleClearAllFilters: vi.fn(),
      handleRemoveFilter: vi.fn(),
      activeFilterCount: 0,
    })

    mocks.useTransferPageData.mockReturnValue({
      data: {
        list: {
          data: [],
          total: 20,
          page: 1,
          pageSize: 10,
        },
        counts: {
          totalCount: 20,
          columnCounts: mockColumnCounts,
        },
        kanban: null,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
    })

    mocks.useTransferList.mockReturnValue({
      data: {
        data: [],
        total: 20,
      },
      isLoading: false,
      isFetching: false,
    })

    mocks.useTransferCounts.mockReturnValue({
      data: {
        totalCount: 20,
        columnCounts: mockColumnCounts,
      },
      isLoading: false,
      isError: false,
    })

    mocks.useTransferActions.mockReturnValue({
      approveTransfer: vi.fn(),
      startTransfer: vi.fn(),
      handoverToExternal: vi.fn(),
      returnFromExternal: vi.fn(),
      completeTransfer: vi.fn(),
      confirmDelete: vi.fn(),
      canEditTransfer: vi.fn(() => true),
      canDeleteTransfer: vi.fn(() => true),
      mapToTransferRequest: vi.fn(),
      isRegionalLeader: false,
      isTransferCoreRole: true,
    })

    mocks.useIsMobile.mockReturnValue(false)

    mocks.OverdueTransfersAlert.mockImplementation(
      ({ onViewTransfer }: { onViewTransfer: (transfer: Record<string, unknown>) => void }) => (
        <button
          type="button"
          data-testid="overdue-transfer-action"
          onClick={() =>
            onViewTransfer({
              id: 88,
              ma_yeu_cau: "LC-0088",
              thiet_bi_id: 22,
              loai_hinh: "noi_bo",
              trang_thai: "cho_duyet",
              nguoi_yeu_cau_id: 1,
              ly_do_luan_chuyen: "Điều phối",
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-01T00:00:00.000Z",
              created_by: 1,
              updated_by: 1,
              thiet_bi: null,
            })
          }
        >
          Open overdue transfer
        </button>
      ),
    )

    mocks.TransferDetailDialog.mockImplementation(
      ({ open, transfer }: { open?: boolean; transfer?: { ma_yeu_cau?: string } | null }) =>
        open ? (
          <div data-testid="transfer-detail-dialog">{transfer?.ma_yeu_cau ?? "missing-transfer"}</div>
        ) : null,
    )

    mocks.KpiStatusBar.mockImplementation(
      ({ counts, loading, error }: { counts?: unknown; loading?: boolean; error?: boolean }) => (
        <div
          data-testid="transfers-kpi-bar"
          data-counts={JSON.stringify(counts ?? null)}
          data-loading={String(Boolean(loading))}
          data-error={String(Boolean(error))}
        />
      ),
    )
  })

  it("renders page title above KpiStatusBar and card content", () => {
    render(<TransfersPage />)

    const pageTitle = screen.getByText("Luân chuyển thiết bị")
    const kpiBar = screen.getByTestId("transfers-kpi-bar")
    const cardTitle = screen.getByText("Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình")

    expect(pageTitle).toBeInTheDocument()
    expect(kpiBar).toBeInTheDocument()
    expect(
      Boolean(pageTitle.compareDocumentPosition(kpiBar) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true)
    expect(
      Boolean(kpiBar.compareDocumentPosition(cardTitle) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true)
  })

  it("passes TRANSFER_STATUS_CONFIGS + columnCounts", () => {
    render(<TransfersPage />)

    expect(
      mocks.KpiStatusBar.mock.calls.some(([props]) =>
        props?.configs === mocks.kpiConfigs && props?.counts === mockColumnCounts,
      ),
    ).toBe(true)
  })

  it("passes loading state", () => {
    mocks.useTransferPageData.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
      isError: false,
    })

    render(<TransfersPage />)

    expect(mocks.KpiStatusBar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        loading: true,
      }),
    )
  })

  it("handles undefined statusCounts", () => {
    mocks.useTransferPageData.mockReturnValue({
      data: {
        list: {
          data: [],
          total: 0,
          page: 1,
          pageSize: 10,
        },
        counts: undefined,
        kanban: null,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
    })

    render(<TransfersPage />)

    expect(mocks.KpiStatusBar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        counts: undefined,
      }),
    )
  })

  it("passes error state when transfer counts query fails", () => {
    mocks.useTransferPageData.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
    })

    render(<TransfersPage />)

    expect(mocks.KpiStatusBar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        error: true,
      }),
    )
  })

  it("renders tenant placeholder when facility selection is required", () => {
    mocks.useTenantSelection.mockReturnValue({
      selectedFacilityId: null,
      setSelectedFacilityId: vi.fn(),
      facilities: [],
      showSelector: true,
      shouldFetchData: false,
    })

    render(<TransfersPage />)

    expect(screen.getByTestId("tenant-selector")).toBeInTheDocument()
    expect(screen.getByTestId("tenant-placeholder")).toBeInTheDocument()
    expect(screen.queryByTestId("transfers-table-view")).not.toBeInTheDocument()
    expect(screen.queryByTestId("transfers-kanban-view")).not.toBeInTheDocument()
    expect(screen.queryByTestId("transfer-pagination")).not.toBeInTheDocument()
  })

  it("does not pass interactive sorting props to the desktop transfers table", () => {
    render(<TransfersPage />)

    expect(mocks.TransfersTableView).toHaveBeenCalled()
    const tableProps = mocks.TransfersTableView.mock.calls[0]?.[0] as Record<string, unknown>
    expect(tableProps).not.toHaveProperty("sorting")
    expect(tableProps).not.toHaveProperty("onSortingChange")
  })

  it("uses the combined page-data query instead of separate list and count queries", () => {
    render(<TransfersPage />)

    expect(mocks.useTransferPageData).toHaveBeenCalledWith(
      expect.objectContaining({
        types: ["noi_bo"],
        page: 1,
        pageSize: 10,
      }),
      expect.objectContaining({
        viewMode: "table",
        enabled: true,
        includeCounts: true,
      }),
    )
    expect(mocks.useTransferList).not.toHaveBeenCalled()
    expect(mocks.useTransferCounts).not.toHaveBeenCalled()
  })

  it("skips page-invariant counts when only table pagination changes", () => {
    mocks.useServerPagination
      .mockReturnValueOnce({
        page: 1,
        pageSize: 10,
        pagination: {
          pageIndex: 0,
          pageSize: 10,
        },
        setPagination: vi.fn(),
        pageCount: 2,
      })
      .mockReturnValueOnce({
        page: 2,
        pageSize: 10,
        pagination: {
          pageIndex: 1,
          pageSize: 10,
        },
        setPagination: vi.fn(),
        pageCount: 2,
      })

    const { rerender } = render(<TransfersPage />)
    rerender(<TransfersPage />)

    expect(mocks.useTransferPageData).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ page: 1, pageSize: 10 }),
      expect.objectContaining({ includeCounts: true }),
    )
    expect(mocks.useTransferPageData).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ page: 2, pageSize: 10 }),
      expect.objectContaining({ includeCounts: false }),
    )
  })

  it("does not fire the table list query when kanban is the active view", () => {
    mocks.rawViewMode = "kanban"
    mocks.useTransferPageData.mockReturnValue({
      data: {
        list: null,
        counts: {
          totalCount: 20,
          columnCounts: mockColumnCounts,
        },
        kanban: {
          totalCount: 20,
          columns: {},
        },
      },
      isLoading: false,
      isFetching: false,
      isError: false,
    })

    render(<TransfersPage />)

    expect(screen.getByTestId("transfers-kanban-view")).toBeInTheDocument()
    expect(mocks.TransfersKanbanView).toHaveBeenCalledWith(
      expect.objectContaining({
        initialData: {
          totalCount: 20,
          columns: {},
        },
      }),
    )
    expect(mocks.useTransferPageData).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        viewMode: "kanban",
        enabled: true,
      }),
    )
    expect(mocks.useTransferList).not.toHaveBeenCalled()
    expect(mocks.useTransferCounts).not.toHaveBeenCalled()
  })

  it("does not seed kanban initial data from a fetching page-data placeholder", () => {
    mocks.rawViewMode = "kanban"
    mocks.useTransferPageData.mockReturnValue({
      data: {
        list: null,
        counts: {
          totalCount: 20,
          columnCounts: mockColumnCounts,
        },
        kanban: {
          totalCount: 20,
          columns: {},
        },
      },
      isLoading: false,
      isFetching: true,
      isError: false,
    })

    render(<TransfersPage />)

    expect(mocks.TransfersKanbanView).toHaveBeenCalledWith(
      expect.objectContaining({
        initialData: null,
      }),
    )
  })

  it("propagates the selected date range into the combined page-data filters", () => {
    mocks.useTransfersFilters.mockReturnValue({
      searchTerm: "",
      setSearchTerm: vi.fn(),
      debouncedSearch: "",
      clearSearch: vi.fn(),
      statusFilter: [],
      setStatusFilter: vi.fn(),
      dateRange: {
        from: new Date(2026, 3, 2),
        to: new Date(2026, 3, 5),
      },
      setDateRange: vi.fn(),
      isFilterModalOpen: false,
      setIsFilterModalOpen: vi.fn(),
      handleClearAllFilters: vi.fn(),
      handleRemoveFilter: vi.fn(),
      activeFilterCount: 1,
    })

    render(<TransfersPage />)

    expect(mocks.useTransferPageData).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: "2026-04-02",
        dateTo: "2026-04-05",
      }),
      expect.objectContaining({
        viewMode: "table",
        enabled: true,
      }),
    )
  })

  it("opens the detail dialog when the overdue alert requests transfer details", () => {
    render(<TransfersPage />)

    fireEvent.click(screen.getByTestId("overdue-transfer-action"))

    expect(screen.getByTestId("transfer-detail-dialog")).toHaveTextContent("LC-0088")
  })
})
