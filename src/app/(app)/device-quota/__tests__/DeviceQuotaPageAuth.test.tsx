import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockUseSession, mockRouterPush } = vi.hoisted(() => ({
  mockUseSession: vi.fn(),
  mockRouterPush: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

vi.mock("@/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext", () => ({
  DeviceQuotaCategoryProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="categories-provider">{children}</div>
  ),
}))

vi.mock("@/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryToolbar", () => ({
  DeviceQuotaCategoryToolbar: () => <div data-testid="categories-toolbar">Toolbar</div>,
}))

vi.mock("@/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree", () => ({
  DeviceQuotaCategoryTree: () => <div data-testid="categories-tree">Tree</div>,
}))

vi.mock("@/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryDialog", () => ({
  DeviceQuotaCategoryDialog: () => <div data-testid="categories-dialog">Dialog</div>,
}))

vi.mock("@/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryDeleteDialog", () => ({
  DeviceQuotaCategoryDeleteDialog: () => <div data-testid="categories-delete-dialog">Delete</div>,
}))

vi.mock("@/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryImportDialog", () => ({
  DeviceQuotaCategoryImportDialog: () => <div data-testid="categories-import-dialog">Import</div>,
}))

vi.mock("@/app/(app)/device-quota/dashboard/_components/DeviceQuotaDashboardContext", () => ({
  DeviceQuotaDashboardProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-provider">{children}</div>
  ),
}))

vi.mock("@/app/(app)/device-quota/dashboard/_components/DeviceQuotaComplianceCards", () => ({
  DeviceQuotaComplianceCards: () => <div data-testid="dashboard-compliance-cards">Compliance</div>,
}))

vi.mock("@/app/(app)/device-quota/dashboard/_components/DeviceQuotaUnassignedAlert", () => ({
  DeviceQuotaUnassignedAlert: () => <div data-testid="dashboard-unassigned-alert">Alert</div>,
}))

vi.mock("@/app/(app)/device-quota/dashboard/_components/DeviceQuotaActiveDecision", () => ({
  DeviceQuotaActiveDecision: () => <div data-testid="dashboard-active-decision">Decision</div>,
}))

vi.mock("@/app/(app)/device-quota/dashboard/_components/DeviceQuotaReportDialog", () => ({
  DeviceQuotaReportDialog: () => <div data-testid="dashboard-report-dialog">Dialog</div>,
}))

vi.mock("@/app/(app)/device-quota/dashboard/_hooks/useDeviceQuotaDashboardContext", () => ({
  useDeviceQuotaDashboardContext: () => ({
    complianceSummary: null,
  }),
}))

vi.mock("@/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionsContext", () => ({
  DeviceQuotaDecisionsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decisions-provider">{children}</div>
  ),
}))

vi.mock("@/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionsToolbar", () => ({
  DeviceQuotaDecisionsToolbar: () => <div data-testid="decisions-toolbar">Toolbar</div>,
}))

vi.mock("@/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionsTable", () => ({
  DeviceQuotaDecisionsTable: () => <div data-testid="decisions-table">Table</div>,
}))

vi.mock("@/app/(app)/device-quota/decisions/_components/DeviceQuotaDecisionDialog", () => ({
  DeviceQuotaDecisionDialog: () => <div data-testid="decisions-dialog">Dialog</div>,
}))

vi.mock("@/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingContext", () => ({
  DeviceQuotaMappingProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mapping-provider">{children}</div>
  ),
}))

vi.mock("@/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingSplitView", () => ({
  DeviceQuotaMappingSplitView: () => <div data-testid="mapping-split-view">Split view</div>,
}))

vi.mock("@/app/(app)/device-quota/mapping/_components/DeviceQuotaUnassignedList", () => ({
  DeviceQuotaUnassignedList: () => <div data-testid="mapping-unassigned-list">Unassigned</div>,
}))

vi.mock("@/app/(app)/device-quota/mapping/_components/DeviceQuotaCategoryTree", () => ({
  DeviceQuotaCategoryTree: () => <div data-testid="mapping-category-tree">Tree</div>,
}))

vi.mock("@/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingActions", () => ({
  DeviceQuotaMappingActions: () => <div data-testid="mapping-actions">Actions</div>,
}))

vi.mock("@/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingGuide", () => ({
  DeviceQuotaMappingGuide: () => <div data-testid="mapping-guide">Guide</div>,
}))

vi.mock("@/components/shared/TenantSelector", () => ({
  TenantSelector: () => <div data-testid="tenant-selector">Tenant selector</div>,
}))

import DeviceQuotaCategoriesPage from "@/app/(app)/device-quota/categories/page"
import DeviceQuotaDashboardPage from "@/app/(app)/device-quota/dashboard/page"
import DeviceQuotaDecisionsPage from "@/app/(app)/device-quota/decisions/page"
import DeviceQuotaMappingPage from "@/app/(app)/device-quota/mapping/page"

type SessionState = {
  status: "loading" | "unauthenticated" | "authenticated"
  data: { user: { role: string; don_vi?: string } } | null
}

const authenticatedAdminSession: SessionState = {
  status: "authenticated",
  data: {
    user: {
      role: "admin",
      don_vi: "1",
    },
  },
}

const pageCases = [
  {
    name: "categories",
    Page: DeviceQuotaCategoriesPage,
    protectedTestId: "categories-toolbar",
    fallbackTestId: "authenticated-page-spinner-fallback",
  },
  {
    name: "dashboard",
    Page: DeviceQuotaDashboardPage,
    protectedTestId: "dashboard-compliance-cards",
    fallbackTestId: "authenticated-page-spinner-fallback",
  },
  {
    name: "decisions",
    Page: DeviceQuotaDecisionsPage,
    protectedTestId: "decisions-table",
    fallbackTestId: "device-quota-decisions-auth-fallback",
  },
  {
    name: "mapping",
    Page: DeviceQuotaMappingPage,
    protectedTestId: "mapping-split-view",
    fallbackTestId: "authenticated-page-spinner-fallback",
  },
] as const

describe("DeviceQuota page auth wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(pageCases)(
    "renders only the fallback for $name while the session is loading",
    ({ Page, protectedTestId, fallbackTestId }) => {
      mockUseSession.mockReturnValue({
        status: "loading",
        data: null,
      })

      render(<Page />)

      expect(screen.getByTestId(fallbackTestId)).toBeInTheDocument()
      expect(screen.queryByTestId(protectedTestId)).not.toBeInTheDocument()
      expect(mockRouterPush).not.toHaveBeenCalled()
    }
  )

  it.each(pageCases)(
    "renders only the fallback for $name when unauthenticated",
    ({ Page, protectedTestId, fallbackTestId }) => {
      mockUseSession.mockReturnValue({
        status: "unauthenticated",
        data: null,
      })

      render(<Page />)

      expect(screen.getByTestId(fallbackTestId)).toBeInTheDocument()
      expect(screen.queryByTestId(protectedTestId)).not.toBeInTheDocument()
      expect(mockRouterPush).not.toHaveBeenCalled()
    }
  )

  it.each(pageCases)(
    "renders protected content for $name when authenticated",
    ({ Page, protectedTestId, fallbackTestId }) => {
      mockUseSession.mockReturnValue(authenticatedAdminSession)

      render(<Page />)

      expect(screen.getByTestId(protectedTestId)).toBeInTheDocument()
      expect(screen.queryByTestId(fallbackTestId)).not.toBeInTheDocument()
      expect(mockRouterPush).not.toHaveBeenCalled()
    }
  )
})
