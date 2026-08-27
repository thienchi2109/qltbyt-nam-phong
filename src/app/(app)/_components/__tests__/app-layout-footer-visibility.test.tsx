import * as React from "react"
import "@testing-library/jest-dom"
import { readFileSync } from "node:fs"
import path from "node:path"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppLayoutFooter } from "@/app/(app)/_components/AppLayoutFooter"
import { AppLayoutShell } from "@/app/(app)/_components/AppLayoutShell"
import { FooterVisibilityProvider } from "@/app/(app)/_components/AppLayoutFooterVisibility"
import { TechnicalConfigurationWorkspaceShell } from "@/app/(app)/technical-configurations/_components/TechnicalConfigurationWorkspaceShell"
import type { TechnicalConfigurationDossierWire } from "@/app/(app)/technical-configurations/types"

vi.mock("next/navigation", () => ({
  usePathname: () => "/technical-configurations",
}))

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
  useSession: () => ({ status: "authenticated", update: vi.fn() }),
}))

vi.mock("next/dynamic", () => ({
  default: () =>
    function AssistantPanelMock() {
      return <button type="button">Trợ lý AI</button>
    },
}))

vi.mock("@/components/page-transition-wrapper", () => ({
  MainContentTransition: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock("@/app/(app)/_components/AuthenticatedPageFallbacks", () => ({
  AuthenticatedPageSpinnerFallback: () => <div>Đang tải ứng dụng</div>,
}))

vi.mock("@/components/ui/use-deferred-dropdown-action", () => ({
  useDeferredDropdownAction: () => (action: () => void) => action(),
}))

vi.mock("@/hooks/use-tenant-branding", () => ({
  useTenantBranding: () => ({
    isLoading: false,
    data: { logo_url: null, name: "CVMEMS" },
  }),
}))

vi.mock("@/components/tenant-logo", () => ({
  TenantLogo: () => <span>Biểu trưng</span>,
}))

vi.mock("@/components/tenant-name", () => ({
  TenantName: ({ name }: { name?: string | null }) => <span>{name}</span>,
}))

vi.mock("@/lib/rbac", () => ({
  isTechnicalConfigurationExpertRole: () => false,
}))

vi.mock("@/components/change-password-dialog", () => ({
  ChangePasswordDialog: () => null,
}))

vi.mock("@/components/notification-bell-dialog", () => ({
  NotificationBellDialog: () => <button type="button">Thông báo</button>,
}))

vi.mock("@/components/realtime-status", () => ({
  RealtimeStatus: () => <button type="button">Trạng thái thời gian thực</button>,
}))

vi.mock("@/components/mobile-footer-nav", () => ({
  MobileFooterNav: () => <button type="button">Điều hướng di động</button>,
}))

vi.mock("@/components/onboarding/HelpButton", () => ({
  HelpButton: () => <button type="button">Trợ giúp</button>,
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  TenantSelectionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTenantSelection: () => ({ selectedFacilityId: null, shouldFetchData: true }),
}))

vi.mock("@/contexts/EquipmentFilterContext", () => ({
  EquipmentFilterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  clearAllEquipmentFilters: vi.fn(),
}))

vi.mock("@/components/app-sidebar-nav", () => ({
  AppSidebarNav: () => <button type="button">Điều hướng bên</button>,
}))

vi.mock("@/components/app-navigation", () => ({
  getAppNavigationItems: () => [],
}))

vi.mock("@/hooks/useAppNotificationCounts", () => ({
  useAppNotificationCounts: () => ({
    counts: { repair: 0, transfer: 0, maintenance: 0 },
  }),
}))

vi.mock("@/lib/auth-signout", () => ({
  signOutWithReason: vi.fn(() => Promise.resolve()),
}))

vi.mock("@/components/shared/floating-actions", () => ({
  MobileFloatingActionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/app/(app)/_components/AppMobileFloatingActions", () => ({
  AppMobileFloatingActions: ({ onAssistantToggle }: { onAssistantToggle: () => void }) => (
    <button type="button" onClick={onAssistantToggle}>
      Tác vụ nổi
    </button>
  ),
}))

vi.mock("@/app/(app)/_components/HeaderEquipmentSearchEntry", () => ({
  HeaderEquipmentSearchEntry: () => <button type="button">Tìm thiết bị</button>,
}))

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineTab",
  () => ({
    TechnicalConfigurationBaselineTab: ({
      isFocusMode,
      onToggleFocusMode,
    }: {
      isFocusMode: boolean
      onToggleFocusMode: () => void
    }) => (
      <div>
        <span>{isFocusMode ? "Đang tập trung chỉnh sửa" : "Bố cục mặc định"}</span>
        <button type="button" onClick={onToggleFocusMode}>
          {isFocusMode ? "Thu nhỏ vùng chỉnh sửa" : "Mở rộng vùng chỉnh sửa"}
        </button>
      </div>
    ),
  })
)

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationBaselineEvidence",
  () => ({
    TechnicalConfigurationBaselineEvidence: () => <div>Tài liệu kiểm thử</div>,
  })
)

vi.mock(
  "@/app/(app)/technical-configurations/_components/TechnicalConfigurationReferenceProducts",
  () => ({
    TechnicalConfigurationReferenceProducts: () => <div>Sản phẩm tham chiếu kiểm thử</div>,
  })
)

vi.mock("@/app/(app)/technical-configurations/_components/TechnicalConfigurationSuppliers", () => ({
  TechnicalConfigurationSuppliers: () => <div>Phương án kiểm thử</div>,
}))

vi.mock(
  "@/app/(app)/technical-configurations/_components/comparison/TechnicalConfigurationComparisonTab",
  () => ({
    TechnicalConfigurationComparisonTab: () => <div>So sánh kiểm thử</div>,
  })
)

const dossier: TechnicalConfigurationDossierWire = {
  id: "dossier-1",
  device_type_name: "Máy lọc thận",
  name: "Cấu hình máy lọc thận",
  description: null,
  revision: 3,
  archived_at: null,
  archived_by: null,
  created_at: "2026-07-13T00:00:00.000Z",
  created_by: 1,
  updated_at: "2026-07-13T00:00:00.000Z",
  updated_by: 1,
}

function WorkspaceFooterHarness({ showWorkspace }: { showWorkspace: boolean }) {
  return (
    <>
      {showWorkspace ? (
        <TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={vi.fn()} />
      ) : null}
      <AppLayoutFooter />
    </>
  )
}

describe("app layout footer visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("registers suppression with a layout effect", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(app)/_components/AppLayoutFooterVisibility.tsx"),
      "utf8"
    )

    expect(source).toMatch(/function useLayoutSuppression[\s\S]*React\.useLayoutEffect\(\(\) =>/)
  })

  it("hides the footer for the real workspace mount and restores it on unmount", () => {
    const { rerender } = render(
      <FooterVisibilityProvider>
        <WorkspaceFooterHarness showWorkspace />
      </FooterVisibilityProvider>
    )

    expect(screen.queryByText("Hệ thống quản lý thiết bị y tế CVMEMS")).not.toBeInTheDocument()

    rerender(
      <FooterVisibilityProvider>
        <WorkspaceFooterHarness showWorkspace={false} />
      </FooterVisibilityProvider>
    )

    expect(screen.getByText("Hệ thống quản lý thiết bị y tế CVMEMS")).toBeInTheDocument()
  })

  it("isolates focus mode from every focusable app-shell sibling without remounting main", async () => {
    const user = userEvent.setup()
    render(
      <AppLayoutShell user={{ role: "to_qltb", full_name: "Quản trị thiết bị" }}>
        <TechnicalConfigurationWorkspaceShell dossier={dossier} onBack={vi.fn()} />
      </AppLayoutShell>
    )

    expect(screen.getByTestId("app-header-actions")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Điều hướng bên" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Điều hướng di động" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tác vụ nổi" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Tác vụ nổi" }))
    expect(screen.getByRole("button", { name: "Trợ lý AI" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mở rộng vùng chỉnh sửa" }))

    expect(screen.queryByTestId("app-header-actions")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Điều hướng bên" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Điều hướng di động" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Tác vụ nổi" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Trợ lý AI" })).not.toBeInTheDocument()
    expect(screen.queryByText("Hệ thống quản lý thiết bị y tế CVMEMS")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Thu nhỏ vùng chỉnh sửa" }))

    expect(screen.getByTestId("app-header-actions")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Điều hướng bên" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Điều hướng di động" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tác vụ nổi" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Trợ lý AI" })).toBeInTheDocument()
  })
})
