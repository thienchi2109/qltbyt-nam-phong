"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import { Copyright, KeyRound, LogOut, Menu, User } from "lucide-react"

import { MainContentTransition } from "@/components/page-transition-wrapper"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/icons"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { TenantLogo } from "@/components/tenant-logo"
import { TenantName } from "@/components/tenant-name"
import { cn } from "@/lib/utils"
import { ChangePasswordDialog } from "@/components/change-password-dialog"
import { NotificationBellDialog } from "@/components/notification-bell-dialog"
import { RealtimeStatus } from "@/components/realtime-status"
import { MobileFooterNav } from "@/components/mobile-footer-nav"
import { HelpButton } from "@/components/onboarding/HelpButton"
import { USER_ROLES } from "@/types/database"
import { TenantSelectionProvider, useTenantSelection } from "@/contexts/TenantSelectionContext"
import { EquipmentFilterProvider, clearAllEquipmentFilters } from "@/contexts/EquipmentFilterContext"
import { AppSidebarNav } from "@/components/app-sidebar-nav"
import { getAppNavigationItems } from "@/components/app-navigation"
import { useAppNotificationCounts } from "@/hooks/useAppNotificationCounts"
import { signOutWithReason } from "@/lib/auth-signout"

const AssistantTriggerButton = dynamic(
  () => import("@/components/assistant/AssistantTriggerButton").then(m => m.AssistantTriggerButton),
  { ssr: false },
)
const AssistantPanel = dynamic(
  () => import("@/components/assistant/AssistantPanel").then(m => m.AssistantPanel),
  { ssr: false },
)

type AppLayoutUser = {
  role?: string
  full_name?: string | null
  username?: string | null
  khoa_phong?: string | null
}

type AppLayoutShellProps = {
  children: React.ReactNode
  user: AppLayoutUser
}

export function AppLayoutShell({ children, user }: AppLayoutShellProps) {
  return (
    <TenantSelectionProvider>
      <EquipmentFilterProvider>
        <AppLayoutShellContent user={user}>{children}</AppLayoutShellContent>
      </EquipmentFilterProvider>
    </TenantSelectionProvider>
  )
}

function AppLayoutShellContent({ children, user }: AppLayoutShellProps) {
  const pathname = usePathname()
  const { status, update } = useSession()
  const { selectedFacilityId, shouldFetchData } = useTenantSelection()
  const hasHandledSessionExitRef = React.useRef(false)
  const [isSidebarOpen, setSidebarOpen] = React.useState(true)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = React.useState(false)
  const branding = useTenantBranding()
  const { counts: notificationCounts } = useAppNotificationCounts({
    enabled: shouldFetchData,
    facilityId: selectedFacilityId,
  })

  const tourAttributes: Record<string, string> = {
    "/dashboard": "sidebar-nav-dashboard",
    "/equipment": "sidebar-nav-equipment",
    "/repair-requests": "sidebar-nav-repairs",
    "/maintenance": "sidebar-nav-maintenance",
    "/transfers": "sidebar-nav-transfers",
    "/device-quota": "sidebar-nav-device-quota",
    "/reports": "sidebar-nav-reports",
    "/qr-scanner": "sidebar-nav-qr",
  }

  const navItems = React.useMemo(() => {
    return getAppNavigationItems(user.role)
  }, [user.role])

  const redirectToSignedOutHome = React.useCallback(() => {
    if (hasHandledSessionExitRef.current) {
      return
    }

    hasHandledSessionExitRef.current = true
    clearAllEquipmentFilters()
    void signOut({ callbackUrl: "/" })
  }, [])

  const handleSignOut = React.useCallback(() => {
    if (hasHandledSessionExitRef.current) {
      return
    }

    hasHandledSessionExitRef.current = true
    clearAllEquipmentFilters()
    void signOutWithReason({
      updateSession: update,
      reason: "user_initiated",
    })
  }, [update])

  React.useEffect(() => {
    if (status === "unauthenticated") {
      redirectToSignedOutHome()
      return
    }

    if (status === "authenticated") {
      hasHandledSessionExitRef.current = false
    }
  }, [redirectToSignedOutHome, status])

  return (
    <>
          <ChangePasswordDialog
            open={isChangePasswordOpen}
            onOpenChange={setIsChangePasswordOpen}
          />
          <div
            className={cn(
              "grid min-h-screen w-full transition-all pt-14 pb-20 md:pt-0 md:pb-0",
              isSidebarOpen ? "md:grid-cols-[220px_1fr]" : "md:grid-cols-[72px_1fr]"
            )}
          >
            <div className="hidden border-r border-slate-200 bg-white md:block shadow-[2px_0_8px_rgba(0,0,0,0.04)]">
              <div className="flex h-full max-h-screen flex-col">
                <div className="flex h-auto flex-col items-center gap-4 border-b border-slate-200 p-4">
                  <Link href="/" className="flex flex-col items-center gap-3 font-semibold text-primary" data-tour="sidebar-logo">
                    {branding.isLoading ? (
                      <Skeleton className={isSidebarOpen ? "h-16 w-16" : "h-8 w-8"} />
                    ) : (
                      <TenantLogo src={branding.data?.logo_url ?? null} name={branding.data?.name ?? null} size={isSidebarOpen ? 64 : 32} className={isSidebarOpen ? "" : "mt-2"} />
                    )}
                  </Link>
                </div>
                <div className="flex-1 overflow-auto py-4">
                  <AppSidebarNav
                    items={navItems}
                    pathname={pathname}
                    isSidebarOpen={isSidebarOpen}
                    notificationCounts={notificationCounts}
                    tourAttributes={tourAttributes}
                    className={cn("px-3", !isSidebarOpen && "justify-items-center px-0")}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col">
              <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center gap-4 bg-white px-4 shadow-md md:relative md:z-auto lg:h-[60px] lg:px-6">
                <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="hidden shrink-0 touch-target"
                      style={{ display: "none" }}
                    >
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="flex flex-col bg-white p-0">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Menu Điều Hướng</SheetTitle>
                    </SheetHeader>
                    <div className="flex h-auto flex-col items-center gap-4 border-b border-slate-200 p-4">
                      <Link
                        href="/"
                        className="flex flex-col items-center gap-3 font-semibold text-primary"
                        onClick={() => setIsMobileSheetOpen(false)}
                      >
                        <Logo />
                        <span className="text-center heading-responsive-h3">QUẢN LÝ TBYT - CDC</span>
                      </Link>
                    </div>
                    <AppSidebarNav
                      items={navItems}
                      pathname={pathname}
                      isSidebarOpen
                      notificationCounts={notificationCounts}
                      variant="sheet"
                      className="p-3"
                      onNavigate={() => setIsMobileSheetOpen(false)}
                    />
                  </SheetContent>
                </Sheet>
                <Button
                  variant="outline"
                  size="icon"
                  className="hidden shrink-0 touch-target md:flex"
                  onClick={() => setSidebarOpen(prev => !prev)}
                  data-tour="sidebar-toggle"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle sidebar</span>
                </Button>
                <div className="flex w-full flex-1 items-center">
                  <div className="flex items-center gap-3">
                    {branding.isLoading ? (
                      <Skeleton className="h-7 w-7 rounded-full" />
                    ) : (
                      <TenantLogo src={branding.data?.logo_url ?? null} name={branding.data?.name ?? null} size={28} />
                    )}
                    {branding.isLoading ? (
                      <Skeleton className="h-5 w-48" />
                    ) : (
                      <TenantName
                        name={branding.data?.name ?? null}
                        className="max-w-[calc(100vw-120px)] truncate text-sm sm:max-w-[400px] sm:text-base md:max-w-none lg:text-lg"
                      />
                    )}
                  </div>
                </div>

                <RealtimeStatus variant="icon" className="hidden md:flex" />
                <HelpButton className="hidden md:flex" />

                <NotificationBellDialog
                  repairCount={notificationCounts.repair}
                  transferCount={notificationCounts.transfer}
                  maintenanceCount={notificationCounts.maintenance}
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="rounded-full touch-target"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <User className="h-5 w-5" />
                      <span className="sr-only">Toggle user menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="pb-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.full_name || user.username}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {USER_ROLES[user.role as keyof typeof USER_ROLES]}
                          </Badge>
                        </div>
                        {user.khoa_phong ? (
                          <p className="text-xs leading-none text-muted-foreground">{user.khoa_phong}</p>
                        ) : null}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)}>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Thay đổi mật khẩu
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Đăng xuất
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </header>
              <main className="flex flex-1 flex-col gap-4 bg-background p-4 pb-24 md:pb-4 lg:gap-8 lg:p-8">
                <MainContentTransition>{children}</MainContentTransition>
              </main>

              <MobileFooterNav notificationCounts={notificationCounts} />

              <AssistantTriggerButton
                isOpen={isAssistantOpen}
                onToggle={() => setIsAssistantOpen(prev => !prev)}
              />
              {isAssistantOpen ? (
                <AssistantPanel isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
              ) : null}

              <footer className="hidden flex-col items-center gap-1 border-t border-slate-200 bg-slate-50 p-4 text-center caption-responsive md:flex">
                <div className="flex items-center gap-1 text-slate-600">
                  <span>Hệ thống quản lý thiết bị y tế CVMEMS</span>
                  <Copyright className="h-3 w-3" />
                </div>
              </footer>
            </div>
          </div>
    </>
  )
}
