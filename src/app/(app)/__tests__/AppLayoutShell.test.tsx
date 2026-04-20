import * as React from "react"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  clearAllEquipmentFilters: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
  usePathname: vi.fn(),
  useTenantBranding: vi.fn(),
  useAppNotificationCounts: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.usePathname(),
}))

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mocks.signOut(...args),
  useSession: () => mocks.useSession(),
}))

vi.mock("next/dynamic", () => ({
  default: () => function DynamicStub() {
    return null
  },
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  TenantSelectionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/contexts/EquipmentFilterContext", () => ({
  EquipmentFilterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  clearAllEquipmentFilters: () => mocks.clearAllEquipmentFilters(),
}))

vi.mock("@/hooks/use-tenant-branding", () => ({
  useTenantBranding: () => mocks.useTenantBranding(),
}))

vi.mock("@/hooks/useAppNotificationCounts", () => ({
  useAppNotificationCounts: (...args: unknown[]) => mocks.useAppNotificationCounts(...args),
}))

vi.mock("@/components/page-transition-wrapper", () => ({
  MainContentTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>,
}))

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
  }) => <button onClick={onClick}>{children}</button>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

vi.mock("@/components/icons", () => ({
  Logo: () => <div>Logo</div>,
}))

vi.mock("@/components/tenant-logo", () => ({
  TenantLogo: () => <div>TenantLogo</div>,
}))

vi.mock("@/components/tenant-name", () => ({
  TenantName: ({ name }: { name: string | null }) => <div>{name}</div>,
}))

vi.mock("@/components/change-password-dialog", () => ({
  ChangePasswordDialog: () => null,
}))

vi.mock("@/components/notification-bell-dialog", () => ({
  NotificationBellDialog: () => null,
}))

vi.mock("@/components/realtime-status", () => ({
  RealtimeStatus: () => null,
}))

vi.mock("@/components/mobile-footer-nav", () => ({
  MobileFooterNav: () => null,
}))

vi.mock("@/components/onboarding/HelpButton", () => ({
  HelpButton: () => null,
}))

vi.mock("@/components/app-sidebar-nav", () => ({
  AppSidebarNav: () => null,
}))

vi.mock("@/components/app-navigation", () => ({
  getAppNavigationItems: () => [],
}))

import { AppLayoutShell } from "@/app/(app)/_components/AppLayoutShell"

describe("AppLayoutShell", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    })
    mocks.usePathname.mockReturnValue("/dashboard")
    mocks.useTenantBranding.mockReturnValue({
      isLoading: false,
      data: { name: "CDC", logo_url: null },
    })
    mocks.useAppNotificationCounts.mockReturnValue({
      counts: {
        repair: 0,
        transfer: 0,
        maintenance: 0,
      },
    })
  })

  it("clears equipment filters before signing out from the user menu", async () => {
    const user = userEvent.setup()

    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    await user.click(screen.getByRole("button", { name: /đăng xuất/i }))

    expect(mocks.clearAllEquipmentFilters).toHaveBeenCalledTimes(1)
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    expect(mocks.clearAllEquipmentFilters.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]
    )
  })

  it("clears equipment filters when the session becomes unauthenticated", () => {
    const sessionState = {
      data: { user: { id: "u1" } },
      status: "authenticated",
    }
    mocks.useSession.mockImplementation(() => sessionState)

    const { rerender } = render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    vi.clearAllMocks()

    sessionState.data = null
    sessionState.status = "unauthenticated"

    rerender(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    expect(mocks.clearAllEquipmentFilters).toHaveBeenCalledTimes(1)
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it("keeps a header skeleton while tenant branding is loading", () => {
    mocks.useTenantBranding.mockReturnValue({
      isLoading: true,
      data: null,
    })

    render(
      <AppLayoutShell
        user={{
          role: "global",
          full_name: "Test User",
          username: "tester",
          khoa_phong: "IT",
        }}
      >
        <div>Child Content</div>
      </AppLayoutShell>
    )

    expect(screen.getAllByTestId("skeleton")).toHaveLength(3)
    expect(screen.queryByText("CVMEMS")).not.toBeInTheDocument()
  })
})
