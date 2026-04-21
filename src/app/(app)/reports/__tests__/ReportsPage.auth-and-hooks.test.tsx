import * as React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  sessionStatus: "authenticated" as "loading" | "unauthenticated" | "authenticated",
  sessionData: { user: { role: "to_qltb", don_vi: 1 } } as unknown,
  selectedFacilityId: undefined as number | null | undefined,
  showSelector: false,
  shouldFetchData: false,
}))

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
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
  }),
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

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode; value: string }) => (
    <button type="button">{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode; value: string }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props} />,
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
})
