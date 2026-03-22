import * as React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const pendingSearchParams = new Promise<never>(() => {})

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useTenantSelection: vi.fn(),
  useQueryClient: vi.fn(),
  toast: vi.fn(),
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
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
    openCreateSheet: vi.fn(),
    closeAllDialogs: vi.fn(),
    applyAssistantDraft: vi.fn(),
  }),
}))

vi.mock("../_hooks/useRepairRequestUIHandlers", () => ({
  useRepairRequestUIHandlers: () => ({ handleGenerateRequestSheet: vi.fn() }),
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

vi.mock("../_hooks/useRepairRequestsSummary", () => ({
  useRepairRequestsSummary: () => ({ summaryItems: [] }),
}))

vi.mock("../_components/RepairRequestsColumns", () => ({
  useRepairRequestColumns: () => [],
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

vi.mock("../_components/RepairRequestsPageLayout", () => ({
  RepairRequestsPageLayout: () => null,
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

describe("RepairRequestsPage Suspense boundary", () => {
  it("renders the loading skeletons when useSearchParams suspends", async () => {
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

    mocks.useSearchParams.mockImplementation(() => {
      throw pendingSearchParams
    })

    render(<RepairRequestsPage />)

    const skeletons = await screen.findAllByTestId("repair-requests-skeleton")
    expect(skeletons).toHaveLength(2)
    expect(skeletons[0]).toHaveAttribute("data-classname", "h-8 w-32 mx-auto")
    expect(skeletons[1]).toHaveAttribute("data-classname", "h-4 w-48 mx-auto")
  })
})
