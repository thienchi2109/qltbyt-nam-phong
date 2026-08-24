import * as React from "react"
import { vi } from "vitest"

const mocks = vi.hoisted(() => ({
  clearAllEquipmentFilters: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
  updateSession: vi.fn(),
  usePathname: vi.fn(),
  routerPush: vi.fn(),
  useTenantSelection: vi.fn(),
  tenantSelectionProviderProps: vi.fn(),
  useTenantBranding: vi.fn(),
  useAppNotificationCounts: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.usePathname(),
  useRouter: () => ({
    push: mocks.routerPush,
  }),
}))

vi.mock("next-auth/react", () => ({
  signOut: (...args: unknown[]) => mocks.signOut(...args),
  useSession: () => mocks.useSession(),
}))

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicStub() {
      return <div data-testid="assistant-panel" />
    },
}))

vi.mock("@/contexts/TenantSelectionContext", () => ({
  TenantSelectionProvider: ({
    children,
    enabled,
  }: {
    children: React.ReactNode
    enabled?: boolean
  }) => {
    mocks.tenantSelectionProviderProps({ enabled })
    return <>{children}</>
  },
  useTenantSelection: () => mocks.useTenantSelection(),
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

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
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
  ChangePasswordDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="change-password-dialog" /> : null,
}))

vi.mock("@/components/notification-bell-dialog", () => ({
  NotificationBellDialog: () => <div data-testid="notification-bell" />,
}))

vi.mock("@/components/realtime-status", () => ({
  RealtimeStatus: () => <div data-testid="realtime-status" />,
}))

vi.mock("@/components/mobile-footer-nav", () => ({
  MobileFooterNav: () => <nav aria-label="Điều hướng chính" data-testid="mobile-footer-nav" />,
}))

vi.mock("@/components/onboarding/HelpButton", () => ({
  HelpButton: () => <div data-testid="help-button" />,
}))

vi.mock("@/components/app-sidebar-nav", () => ({
  AppSidebarNav: ({
    items,
  }: {
    items: Array<{
      href: string
      label: string
    }>
  }) => (
    <nav data-testid="app-sidebar-nav">
      {items.map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  ),
}))

vi.mock("@/app/(app)/_components/AppMobileFloatingActions", () => ({
  AppMobileFloatingActions: () => <div data-testid="mobile-floating-actions" />,
}))

export function getAppLayoutShellMocks() {
  return mocks
}

export function resetAppLayoutShellMocks() {
  vi.clearAllMocks()
  mocks.updateSession.mockResolvedValue(undefined)
  mocks.useSession.mockReturnValue({
    data: { user: { id: "u1", role: "global", don_vi: 1 } },
    status: "authenticated",
    update: mocks.updateSession,
  })
  mocks.usePathname.mockReturnValue("/dashboard")
  mocks.useTenantSelection.mockReturnValue({
    selectedFacilityId: null,
    shouldFetchData: true,
  })
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
}
