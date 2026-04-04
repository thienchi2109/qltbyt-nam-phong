import * as React from "react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

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
  useTransferList: vi.fn(),
  useTransferCounts: vi.fn(),
  useTransferActions: vi.fn(),
  useTransferSearch: vi.fn(),
  useServerPagination: vi.fn(),
  useIsMobile: vi.fn(),
  KpiStatusBar: vi.fn(),
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

vi.mock("@/hooks/useTransferDataGrid", () => ({
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
  OverdueTransfersAlert: () => null,
}))

vi.mock("@/components/shared/DataTablePagination", () => ({
  DataTablePagination: () => <div data-testid="transfer-pagination" />,
}))

vi.mock("@/components/transfer-detail-dialog", () => ({
  TransferDetailDialog: () => null,
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
  TransfersTableView: () => <div data-testid="transfers-table-view" />,
}))

vi.mock("@/components/transfers/TransfersKanbanView", () => ({
  TransfersKanbanView: () => <div data-testid="transfers-kanban-view" />,
}))

vi.mock("@/components/transfers/TransfersViewToggle", () => ({
  TransfersViewToggle: () => <div data-testid="transfers-view-toggle" />,
  useTransfersViewMode: () => ["table", vi.fn()],
}))

vi.mock("@/components/transfers/TransfersTenantSelectionPlaceholder", () => ({
  TransfersTenantSelectionPlaceholder: () => <div data-testid="tenant-placeholder" />,
}))

import TransfersPage from "@/app/(app)/transfers/page"

describe("Transfers KPI", () => {
  beforeEach(() => {
    vi.clearAllMocks()

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

    mocks.useTransferSearch.mockReturnValue({
      searchTerm: "",
      setSearchTerm: vi.fn(),
      debouncedSearch: "",
      clearSearch: vi.fn(),
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

    mocks.KpiStatusBar.mockImplementation(
      ({ counts, loading }: { counts?: unknown; loading?: boolean }) => (
        <div
          data-testid="transfers-kpi-bar"
          data-counts={JSON.stringify(counts ?? null)}
          data-loading={String(Boolean(loading))}
        />
      ),
    )
  })

  it("renders KpiStatusBar above Card", () => {
    render(<TransfersPage />)

    const kpiBar = screen.getByTestId("transfers-kpi-bar")
    const cardTitle = screen.getByText("Luân chuyển thiết bị")

    expect(kpiBar).toBeInTheDocument()
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
    mocks.useTransferCounts.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(<TransfersPage />)

    expect(mocks.KpiStatusBar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        loading: true,
      }),
    )
  })

  it("handles undefined statusCounts", () => {
    mocks.useTransferCounts.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    render(<TransfersPage />)

    expect(mocks.KpiStatusBar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        counts: undefined,
      }),
    )
  })
})
