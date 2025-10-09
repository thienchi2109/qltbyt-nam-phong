"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { MainContentTransition } from "@/components/page-transition-wrapper"
import {
  Bell,
  HardHat,
  Home,
  LineChart,
  ListOrdered,
  LogOut,
  Package,
  QrCode,
  Settings,
  User,
  Users,
  Wrench,
  Menu,
  Copyright,
  KeyRound,
  ArrowLeftRight,
  BarChart3,
  Activity,
} from "lucide-react"

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
import { Logo } from "@/components/icons"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { TenantLogo } from "@/components/tenant-logo"
import { TenantName } from "@/components/tenant-name"
import { cn } from "@/lib/utils"
import { useSession, signOut } from "next-auth/react"
import { Skeleton } from "@/components/ui/skeleton"
import { ChangePasswordDialog } from "@/components/change-password-dialog"
import { NotificationBellDialog } from "@/components/notification-bell-dialog"
import { RealtimeStatus } from "@/components/realtime-status"
import { MobileFooterNav } from "@/components/mobile-footer-nav"
import { USER_ROLES } from "@/types/database"
import { callRpc } from "@/lib/rpc-client"
// Tenant switcher removed in favor of per-page tenant filters

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarOpen, setSidebarOpen] = React.useState(true)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false)
  const { data: session, status } = useSession()
  const user = session?.user as any
  const branding = useTenantBranding()

  // Header notification counts (tenant-scoped via RPC)
  const [repairCount, setRepairCount] = React.useState<number>(0)
  const [transferCount, setTransferCount] = React.useState<number>(0)

  React.useEffect(() => {
    let cancelled = false
    const fetchSummary = async () => {
      try {
        if (!user) return
        const summary = await callRpc<{ pending_repairs: number; pending_transfers: number }, { p_don_vi?: number | null }>({
          fn: 'header_notifications_summary',
          args: { p_don_vi: null },
        })
        if (!cancelled) {
          setRepairCount(summary?.pending_repairs || 0)
          setTransferCount(summary?.pending_transfers || 0)
        }
      } catch (err) {
        console.error('Header notifications error:', err)
      }
    }
    fetchSummary()
    return () => { cancelled = true }
  }, [user])

  // Dynamic nav items based on user role
  const navItems = React.useMemo(() => {
    const baseItems = [
      { href: "/dashboard", icon: Home, label: "Tổng quan" },
      { href: "/equipment", icon: Package, label: "Thiết bị" },
      { href: "/repair-requests", icon: Wrench, label: "Yêu cầu sửa chữa" },
      { href: "/maintenance", icon: HardHat, label: "Bảo trì" },
      { href: "/transfers", icon: ArrowLeftRight, label: "Luân chuyển" },
      { href: "/reports", icon: BarChart3, label: "Báo cáo" },
      { href: "/qr-scanner", icon: QrCode, label: "Quét QR" },
    ]

    // Add admin/global-only pages
    if (user?.role === 'global' || user?.role === 'admin') {
      baseItems.push({ href: "/users", icon: Users, label: "Người dùng" })
      baseItems.push({ href: "/activity-logs", icon: Activity, label: "Nhật ký hoạt động" })
    }

    return baseItems
  }, [user?.role])

  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  if (status === 'loading' || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
              <Logo size={96} className="w-24 h-24" />
              <Skeleton className="h-8 w-48" />
          </div>
      </div>
    )
  }

  return (
    <>
      <ChangePasswordDialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
      />
      <div className={cn('grid min-h-screen w-full transition-all pt-14 pb-20 md:pt-0 md:pb-0', isSidebarOpen ? 'md:grid-cols-[240px_1fr]' : 'md:grid-cols-[72px_1fr]')}>
        <div className="hidden md:flex flex-col h-screen bg-gradient-to-b from-blue-100 via-purple-100 to-pink-100 shadow-xl">
            {/* Header section */}
            <div className="flex h-auto flex-col items-center gap-4 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 p-5 shadow-lg">
              <Link href="/" className="flex flex-col items-center gap-3 font-semibold text-white">
                {/* Tenant-only logo in sidebar */}
                {branding.isLoading ? (
                  <Skeleton className={isSidebarOpen ? "h-16 w-16" : "h-8 w-8"} />
                ) : (
                  <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                    <TenantLogo src={branding.data?.logo_url ?? null} name={branding.data?.name ?? null} size={isSidebarOpen ? 64 : 32} className={isSidebarOpen ? "" : "mt-2"} />
                  </div>
                )}
                {isSidebarOpen && (
                  <span className="text-sm font-bold text-white/90">
                    Nền tảng QLTBYT
                  </span>
                )}
              </Link>
            </div>
            {/* Navigation section */}
            <div className="flex-1 overflow-y-auto">
              <nav className={cn("grid items-start text-sm font-medium py-4", isSidebarOpen ? "px-3 gap-2" : "justify-items-center gap-2")}>
                {navItems.map(({ href, icon: Icon, label }) => {
                  const isActive = pathname === href || pathname.startsWith(href);
                  return (
                    <Link
                      key={label}
                      href={href}
                      className={cn(
                        "group relative flex items-center rounded-xl transition-all duration-200",
                        isActive 
                          ? "bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white shadow-lg scale-105" 
                          : "hover:bg-white/70 backdrop-blur-sm hover:shadow-md",
                        isSidebarOpen ? "px-4 py-3 gap-3 mx-1" : "h-12 w-12 justify-center mx-auto"
                      )}
                      title={!isSidebarOpen ? label : ""}
                      aria-label={label}
                    >
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-xl blur-sm" />
                      )}
                      <div className={cn(
                        "relative flex items-center justify-center",
                        isActive ? "" : "p-2 rounded-lg bg-white/50 group-hover:bg-white/80"
                      )}>
                        <Icon className={cn(
                          "h-5 w-5 transition-all",
                          isActive 
                            ? "text-white drop-shadow-sm" 
                            : "text-gray-700 group-hover:text-blue-600"
                        )} />
                      </div>
                      {isSidebarOpen && (
                        <span className={cn(
                          "relative font-medium transition-all",
                          isActive 
                            ? "text-white drop-shadow-sm" 
                            : "text-gray-700 group-hover:text-gray-900"
                        )}>
                          {label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
            {/* Sidebar Footer - Always visible */}
            <div className="border-t border-purple-200/50 p-4 bg-gradient-to-t from-white/80 to-purple-50/60 backdrop-blur-sm">
              {isSidebarOpen ? (
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold text-purple-700">Phiên bản</p>
                  <p className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">v2.0.1</p>
                  <p className="text-xs text-purple-600 font-medium">© 2024 CVMEMS</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-xs font-bold text-purple-600">v2.0.1</p>
                </div>
              )}
            </div>
        </div>
        <div className="flex flex-col h-screen overflow-hidden">
          <header className="flex h-14 items-center gap-4 border-b bg-white/95 backdrop-blur-lg shadow-sm px-4 lg:h-[60px] lg:px-6 md:relative md:z-auto fixed top-0 left-0 right-0 z-40">
            {/* Hide mobile sheet trigger since we're using footer navigation on mobile */}
            <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 hidden touch-target"
                  style={{ display: 'none' }}
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col p-0">
                 <SheetHeader className="sr-only">
                   <SheetTitle>Menu Điều Hướng</SheetTitle>
                 </SheetHeader>
                 <div className="flex h-auto flex-col items-center gap-4 border-b p-4">
                  <Link
                    href="/"
                    className="flex flex-col items-center gap-3 font-semibold text-primary"
                    onClick={() => setIsMobileSheetOpen(false)}
                  >
                    <Logo />
                    <span className="text-center heading-responsive-h3">QUẢN LÝ TBYT - CDC</span>
                  </Link>
                </div>
                <nav className="grid gap-2 body-responsive font-medium p-4">
                   {navItems.map(({ href, icon: Icon, label }) => (
                      <Link
                        key={label}
                        href={href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg mobile-interactive transition-all hover:text-primary touch-target",
                          pathname === href || pathname.startsWith(href) ? "bg-muted text-primary" : "text-muted-foreground"
                        )}
                        onClick={() => setIsMobileSheetOpen(false)}
                      >
                        <Icon className="h-5 w-5" />
                        {label}
                      </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              size="icon"
              className="hidden shrink-0 md:flex touch-target"
              onClick={() => setSidebarOpen(!isSidebarOpen)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
            <div className="w-full flex-1 flex items-center">
              {/* Header highlights tenant name prominently */}
              <div className="flex items-center gap-3">
                {branding.isLoading ? (
                  <Skeleton className="h-7 w-7 rounded-full" />
                ) : (
                  <TenantLogo src={branding.data?.logo_url ?? null} name={branding.data?.name ?? null} size={28} />
                )}
                {branding.isLoading ? (
                  <Skeleton className="h-5 w-48" />
                ) : (
                  <TenantName name={branding.data?.name ?? null} className="text-base lg:text-lg" />
                )}
              </div>
            </div>
            
            {/* Realtime Status */}
            <RealtimeStatus variant="icon" />

            {/* Tenant switcher removed */}

            {/* Notification Bell */}
            <NotificationBellDialog
              repairCount={repairCount}
              transferCount={transferCount}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full touch-target"
                  onClick={(e) => e.stopPropagation()}
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
                    {user.khoa_phong && (
                      <p className="text-xs leading-none text-muted-foreground">{user.khoa_phong}</p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Thay đổi mật khẩu
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="flex flex-col gap-4 p-4 pb-24 md:pb-4 lg:gap-8 lg:p-8">
              <MainContentTransition>
                {children}
              </MainContentTransition>
            </div>
          </main>

          {/* Mobile Footer Navigation - replaces offcanvas sidebar on mobile */}
          <MobileFooterNav />

          {/* Desktop Footer - hidden on mobile when footer nav is active */}
          <footer className="hidden md:flex flex-col items-center gap-1 p-4 text-center caption-responsive border-t bg-muted/40">
            <div className="flex items-center gap-1">
              <span>Hệ thống quản lý thiết bị y tế CVMEMS</span>
              <Copyright className="h-3 w-3" />
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}

