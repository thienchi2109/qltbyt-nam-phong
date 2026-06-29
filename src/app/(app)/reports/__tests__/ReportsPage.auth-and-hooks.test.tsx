import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  sessionStatus: "authenticated" as "loading" | "unauthenticated" | "authenticated",
  sessionData: { user: { role: "to_qltb", don_vi: 1 } } as unknown,
  selectedFacilityId: undefined as number | null | undefined,
  showSelector: false,
  shouldFetchData: false,
  searchParams: new URLSearchParams(),
  pathname: "/reports",
  tabsValue: "inventory",
  tabsOnValueChange: undefined as ((value: string) => void) | undefined,
  equipmentSearchInstanceCount: 0,
}))

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn((url: string) => {
    const query = url.split("?")[1] ?? ""
    state.searchParams = new URLSearchParams(query)
  }),
  useTenantSelection: vi.fn(() => ({
    selectedFacilityId: state.selectedFacilityId,
    showSelector: state.showSelector,
    shouldFetchData: state.shouldFetchData,
  })),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: state.sessionStatus,
    data: state.sessionData,
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
  usePathname: () => state.pathname,
  useSearchParams: () => state.searchParams,
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  useTenantSelection: mocks.useTenantSelection,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <div data-testid="tenant-selector" />,
}))

vi.mock("@/app/(app)/reports/components/tenant-selection-tip", () => ({
  TenantSelectionTip: () => <div data-testid="tenant-selection-tip" />,
}))

vi.mock("../components/equipment-search-report-tab", () => ({
  EquipmentSearchReportTab: ({ initialQuery }: { initialQuery: string }) => {
    const [instanceId] = React.useState(() => {
      state.equipmentSearchInstanceCount += 1
      return state.equipmentSearchInstanceCount
    })

    return (
      <div data-instance-id={instanceId} data-testid="equipment-search-report-tab">
        {initialQuery}
      </div>
    )
  },
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({
    children,
    className,
    value,
    onValueChange,
  }: {
    children: React.ReactNode
    className?: string
    value: string
    onValueChange: (value: string) => void
  }) => {
    state.tabsValue = value
    state.tabsOnValueChange = onValueChange
    return <div className={className}>{children}</div>
  },
  TabsList: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="reports-tabs-list" className={className}>
      {children}
    </div>
  ),
  TabsTrigger: ({
    children,
    className,
    value,
  }: {
    children: React.ReactNode
    value: string
    className?: string
  }) => (
    <button
      type="button"
      data-state={state.tabsValue === value ? "active" : "inactive"}
      className={className}
      onClick={() => state.tabsOnValueChange?.(value)}
    >
      {children}
    </button>
  ),
  TabsContent: ({
    children,
    className,
    value,
  }: {
    children: React.ReactNode
    value: string
    className?: string
  }) => (state.tabsValue === value ? <div className={className}>{children}</div> : null),
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="skeleton" {...props} />
  ),
}))

import ReportsPage from "../page"

describe("ReportsPage auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.sessionStatus = "authenticated"
    state.sessionData = { user: { role: "to_qltb", don_vi: 1 } }
    state.selectedFacilityId = undefined
    state.showSelector = false
    state.shouldFetchData = false
    state.searchParams = new URLSearchParams()
    state.pathname = "/reports"
    state.tabsValue = "inventory"
    state.tabsOnValueChange = undefined
    state.equipmentSearchInstanceCount = 0
  })

  it("shows the loading skeleton without redirecting unauthenticated users", () => {
    state.sessionStatus = "unauthenticated"
    state.sessionData = null

    render(<ReportsPage />)

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0)
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("does not read tenant selection when user is unauthenticated", () => {
    state.sessionStatus = "unauthenticated"
    state.sessionData = null

    render(<ReportsPage />)

    expect(mocks.useTenantSelection).not.toHaveBeenCalled()
  })

  it("renders reports heading for authenticated users", () => {
    render(<ReportsPage />)

    expect(screen.getByText("Báo cáo")).toBeInTheDocument()
  })

  it("uses a desktop-safe content wrapper and scrollable report tabs", () => {
    render(<ReportsPage />)

    expect(screen.getByTestId("reports-page-content")).toHaveClass("min-w-0")
    expect(screen.getByTestId("reports-page-content").className).not.toContain("md:p-8")
    expect(screen.getByTestId("reports-tabs-scroll-container")).toHaveClass("overflow-x-auto")
    expect(screen.getByTestId("reports-tabs-list")).toHaveClass("w-max", "min-w-max")
  })

  it("shows the Reports tab skeleton while the equipment search tab loads", () => {
    state.sessionData = {
      user: { role: "admin", don_vi: null, dia_ban_id: null },
    }
    state.shouldFetchData = true
    state.searchParams = new URLSearchParams("tab=equipment-search&q=monitor")

    render(<ReportsPage />)

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0)
  })

  it("activates the equipment search tab and hydrates the query from the Reports URL", async () => {
    state.sessionData = {
      user: { role: "admin", don_vi: null, dia_ban_id: null },
    }
    state.shouldFetchData = true
    state.searchParams = new URLSearchParams("tab=equipment-search&q=monitor")

    render(<ReportsPage />)

    expect(screen.getByRole("button", { name: "Tìm kiếm thiết bị" })).toHaveAttribute(
      "data-state",
      "active"
    )
    expect(await screen.findByTestId("equipment-search-report-tab")).toHaveTextContent("monitor")
  })

  it("updates equipment search query props without remounting the tab component", async () => {
    state.sessionData = {
      user: { role: "admin", don_vi: null, dia_ban_id: null },
    }
    state.shouldFetchData = true
    state.searchParams = new URLSearchParams("tab=equipment-search&q=monitor")

    const { rerender } = render(<ReportsPage />)

    const instanceId = (await screen.findByTestId("equipment-search-report-tab")).getAttribute(
      "data-instance-id"
    )

    state.searchParams = new URLSearchParams("tab=equipment-search&q=máy thở")
    rerender(<ReportsPage />)

    await waitFor(() =>
      expect(screen.getByTestId("equipment-search-report-tab")).toHaveTextContent("máy thở")
    )
    expect(screen.getByTestId("equipment-search-report-tab")).toHaveAttribute(
      "data-instance-id",
      instanceId
    )
  })

  it("does not render inactive tab content in the Reports tab mock", () => {
    state.sessionData = {
      user: { role: "admin", don_vi: null, dia_ban_id: null },
    }
    state.shouldFetchData = true

    render(<ReportsPage />)

    expect(screen.getByRole("button", { name: "Xuất-Nhập-Tồn" })).toHaveAttribute(
      "data-state",
      "active"
    )
    expect(screen.queryByTestId("equipment-search-report-tab")).not.toBeInTheDocument()
  })

  it("keeps Reports tab changes in URL query state", () => {
    state.sessionData = {
      user: { role: "admin", don_vi: null, dia_ban_id: null },
    }
    state.shouldFetchData = true

    render(<ReportsPage />)

    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm thiết bị" }))

    expect(mocks.replace).toHaveBeenCalledWith("/reports?tab=equipment-search", {
      scroll: false,
    })
  })
})
