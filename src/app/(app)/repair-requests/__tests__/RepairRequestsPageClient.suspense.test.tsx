import * as React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const pendingSearchParams = new Promise<never>(() => {})

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useTenantSelection: vi.fn(),
  useQueryClient: vi.fn(),
  toast: vi.fn(),
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  deepLinkHandler: vi.fn(),
  layoutProps: vi.fn(),
  columnOptions: vi.fn(),
  pageDialogsProps: vi.fn(),
  openPrintOptionsDialog: vi.fn(),
  handleGenerateRequestSheet: vi.fn(),
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.useQueryClient(),
  useQuery: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mocks.useSession(),
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: () => mocks.useTenantSelection(),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("@/hooks/use-tenant-branding", () => ({
  useTenantBranding: () => ({ data: null }),
}))

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.useRouter(),
  usePathname: () => "/repair-requests",
  useSearchParams: () => mocks.useSearchParams(),
}))

vi.mock("../_components/RepairRequestsContext", () => ({
  RepairRequestsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("../_hooks/useRepairRequestsContext", () => ({
  useRepairRequestsContext: () => ({
    isRegionalLeader: false,
    dialogState: { requestToView: null },
    openEditDialog: vi.fn(),
    openDeleteDialog: vi.fn(),
    openApproveDialog: vi.fn(),
    openCompleteDialog: vi.fn(),
    openViewDialog: vi.fn(),
    openPrintOptionsDialog: mocks.openPrintOptionsDialog,
    openCreateSheet: vi.fn(),
    closeAllDialogs: vi.fn(),
    applyAssistantDraft: vi.fn(),
  }),
}))

vi.mock("../_hooks/useRepairRequestUIHandlers", () => ({
  useRepairRequestUIHandlers: () => ({
    handleGenerateRequestSheet: mocks.handleGenerateRequestSheet,
  }),
}))

vi.mock("../_hooks/useRepairRequestShortcuts", () => ({
  useRepairRequestShortcuts: vi.fn(),
}))

vi.mock("../_hooks/useRepairRequestsData", () => ({
  useRepairRequestsData: () => ({
    requests: [],
    isLoading: false,
    isFetching: false,
    statusCounts: undefined,
    statusCountsLoading: false,
    totalRequests: 0,
    repairPagination: {
      pageCount: 0,
      pagination: { pageIndex: 0, pageSize: 20 },
      setPagination: vi.fn(),
    },
  }),
}))

vi.mock("../_hooks/useRepairRequestsDeepLink", () => ({
  useRepairRequestsDeepLink: vi.fn(),
}))

vi.mock("../_components/RepairRequestsDeepLinkHandler", () => ({
  RepairRequestsDeepLinkHandler: (props: unknown) => mocks.deepLinkHandler(props) ?? null,
}))

vi.mock("../_hooks/useRepairRequestsSummary", () => ({
  useRepairRequestsSummary: () => ({ summaryItems: [] }),
}))

vi.mock("../_components/RepairRequestsColumns", () => ({
  useRepairRequestColumns: (options: unknown) => {
    mocks.columnOptions(options)
    return []
  },
}))

vi.mock("../_components/RepairRequestsEditDialog", () => ({
  RepairRequestsEditDialog: () => null,
}))

vi.mock("../_components/RepairRequestsDeleteDialog", () => ({
  RepairRequestsDeleteDialog: () => null,
}))

vi.mock("../_components/RepairRequestsApproveDialog", () => ({
  RepairRequestsApproveDialog: () => null,
}))

vi.mock("../_components/RepairRequestsCompleteDialog", () => ({
  RepairRequestsCompleteDialog: () => null,
}))

vi.mock("../_components/RepairRequestsDetailView", () => ({
  RepairRequestsDetailView: () => null,
}))

vi.mock("../_components/RepairRequestsPageDialogs", () => ({
  RepairRequestsPageDialogs: (props: unknown) => {
    mocks.pageDialogsProps(props)
    return null
  },
}))

vi.mock("../_components/RepairRequestsPageLayout", () => ({
  RepairRequestsPageLayout: (props: { filterState: { isFiltered: boolean } }) => {
    mocks.layoutProps(props)
    return (
      <div
        data-testid="repair-requests-page-layout"
        data-is-filtered={String(props.filterState.isFiltered)}
      />
    )
  },
}))

vi.mock("@/components/error-boundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="repair-requests-skeleton" data-classname={className} />
  ),
}))

import RepairRequestsPage from "../page"
import RepairRequestsPageClient from "../_components/RepairRequestsPageClient"

describe("RepairRequestsPage Suspense boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deepLinkHandler.mockReturnValue(null)
    globalThis.localStorage.clear()
  })

  it("renders the loading skeletons when deep-link handling suspends", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: 1,
          role: "global",
          don_vi: null,
          dia_ban_id: null,
          name: "Global Admin",
        },
      },
      status: "authenticated",
    })

    mocks.useTenantSelection.mockReturnValue({
      selectedFacilityId: undefined,
      setSelectedFacilityId: vi.fn(),
      facilities: [],
      showSelector: false,
      shouldFetchData: false,
      isLoading: false,
    })

    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    })

    mocks.useRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
    })

    mocks.deepLinkHandler.mockImplementation(() => {
      throw pendingSearchParams
    })

    render(<RepairRequestsPage />)

    const skeletons = await screen.findAllByTestId("repair-requests-skeleton")
    expect(skeletons).toHaveLength(2)
    expect(skeletons[0]).toHaveAttribute("data-classname", "h-8 w-32 mx-auto")
    expect(skeletons[1]).toHaveAttribute("data-classname", "h-4 w-48 mx-auto")
  })

  it.each([
    {
      name: "status filter",
      selectedFacilityId: undefined,
      storedFilters: { status: ["Chờ xử lý"], dateRange: null },
    },
    {
      name: "facility filter",
      selectedFacilityId: 1,
      storedFilters: { status: [], dateRange: null },
    },
  ])("marks the page filtered for an active $name", ({ selectedFacilityId, storedFilters }) => {
    globalThis.localStorage.setItem("rr_filter_state", JSON.stringify(storedFilters))

    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: 1,
          role: "global",
          don_vi: null,
          dia_ban_id: null,
          name: "Global Admin",
        },
      },
      status: "authenticated",
    })

    mocks.useTenantSelection.mockReturnValue({
      selectedFacilityId,
      setSelectedFacilityId: vi.fn(),
      facilities: [{ id: 1, name: "Bệnh viện A" }],
      showSelector: true,
      shouldFetchData: true,
      isLoading: false,
    })

    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    })

    mocks.useRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
    })

    mocks.useSearchParams.mockReturnValue(new URLSearchParams())

    render(<RepairRequestsPageClient />)

    expect(screen.getByTestId("repair-requests-page-layout")).toHaveAttribute(
      "data-is-filtered",
      "true",
    )
  })

  it("routes print action through the prefill choice dialog before generating the sheet", () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: 1,
          role: "global",
          don_vi: null,
          dia_ban_id: null,
          name: "Global Admin",
        },
      },
      status: "authenticated",
    })

    mocks.useTenantSelection.mockReturnValue({
      selectedFacilityId: undefined,
      setSelectedFacilityId: vi.fn(),
      facilities: [],
      showSelector: false,
      shouldFetchData: true,
      isLoading: false,
    })

    mocks.useQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    })

    mocks.useRouter.mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
    })

    mocks.useSearchParams.mockReturnValue(new URLSearchParams())

    render(<RepairRequestsPageClient />)

    expect(mocks.columnOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        onGenerateSheet: mocks.openPrintOptionsDialog,
      }),
    )
    expect(mocks.pageDialogsProps).toHaveBeenCalledWith({
      onGenerateSheet: mocks.handleGenerateRequestSheet,
    })
  })
})
