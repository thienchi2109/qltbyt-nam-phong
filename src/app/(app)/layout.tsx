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
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { ChangePasswordDialog } from "@/components/change-password-dialog"
import { NotificationBellDialog } from "@/components/notification-bell-dialog"
import { RealtimeStatus } from "@/components/realtime-status"
import { MobileFooterNav } from "@/components/mobile-footer-nav"
import { USER_ROLES } from "@/types/database"
import { supabase } from "@/lib/supabase"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarOpen, setSidebarOpen] = React.useState(true)
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false)
  const { user, logout, isInitialized } = useAuth()

  // Simple data fetching for notifications
  const [repairRequests, setRepairRequests] = React.useState<any[]>([])
  const [transferRequests, setTransferRequests] = React.useState<any[]>([])

  React.useEffect(() => {
    if (!supabase || !user) return;
    
    // Fetch repair requests with simple query - use ngay_yeu_cau for ordering
    const fetchRepairRequests = async () => {
      try {
        console.log('Fetching repair requests...');
        const { data, error } = await supabase!
          .from('yeu_cau_sua_chua')
          .select('*')
          .order('ngay_yeu_cau', { ascending: false });
        
        console.log('Repair requests result:', { data, error });
        if (!error && data) {
          console.log('Setting repair requests:', data);
          setRepairRequests(data);
        } else if (error) {
          console.error('Repair requests error:', error);
        }
      } catch (err) {
        console.error('Error fetching repair requests:', err);
      }
    };

    // Fetch transfer requests with simple query - use created_at for ordering
    const fetchTransferRequests = async () => {
      try {
        console.log('Fetching transfer requests...');
        const { data, error } = await supabase!
          .from('yeu_cau_luan_chuyen')
          .select('*')
          .order('created_at', { ascending: false });
        
        console.log('Transfer requests result:', { data, error });
        if (!error && data) {
          console.log('Setting transfer requests:', data);
          setTransferRequests(data);
        } else if (error) {
          console.error('Transfer requests error:', error);
        }
      } catch (err) {
        console.error('Error fetching transfer requests:', err);
      }
    };

    fetchRepairRequests();
    fetchTransferRequests();
  }, [user]);

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

    // Add admin-only pages
    if (user?.role === 'admin') {
      baseItems.push({ href: "/users", icon: Users, label: "Người dùng" })
    }

    return baseItems
  }, [user?.role])

  React.useEffect(() => {
    if (isInitialized && !user) {
      router.push('/')
    }
  }, [user, isInitialized, router])

  if (!isInitialized || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-4">
              <Logo />
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
      <div className={cn("grid min-h-screen w-full transition-all pt-14 pb-20 md:pt-0 md:pb-0", isSidebarOpen ? "md:grid-cols-[220px_1fr]" : "md:grid-cols-[72px_1fr]")}>
        <div className="hidden border-r bg-muted/40 md:block">
          <div className="flex h-full max-h-screen flex-col">
            <div className="flex h-auto flex-col items-center gap-4 border-b p-4">
              <Link href="/" className="flex flex-col items-center gap-3 font-semibold text-primary">
                <Logo />
                {isSidebarOpen && <span className="text-center text-base font-semibold">QUẢN LÝ TBYT - CDC</span>}
              </Link>
            </div>
            <div className="flex-1 overflow-auto py-4">
              <nav className={cn("grid items-start text-sm font-medium", isSidebarOpen ? "px-4" : "justify-items-center")}>
                {navItems.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={label}
                    href={href}
                    className={cn(
                      "flex items-center rounded-lg py-3 transition-all hover:text-primary",
                      pathname === href || pathname.startsWith(href) ? "bg-muted text-primary" : "text-muted-foreground",
                      isSidebarOpen ? "px-3 gap-3" : "h-12 w-12 justify-center"
                    )}
                    title={!isSidebarOpen ? label : ""}
                    aria-label={label}
                  >
                    <Icon className="h-5 w-5" />
                    {isSidebarOpen && <span>{label}</span>}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 md:relative md:z-auto fixed top-0 left-0 right-0 z-40 backdrop-blur-sm bg-muted/90 md:bg-muted/40 md:backdrop-blur-none">
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
            <div className="w-full flex-1">
              {/* Can add a search bar here if needed */}
            </div>
            
            {/* Realtime Status */}
            <RealtimeStatus variant="icon" />

            {/* Notification Bell */}
            <NotificationBellDialog
              allRepairRequests={repairRequests}
              allTransferRequests={transferRequests}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full touch-target">
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
                        {USER_ROLES[user.role]}
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
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4 pb-24 md:pb-4 lg:gap-6 lg:p-6 bg-background">
            <MainContentTransition>
              {children}
            </MainContentTransition>
          </main>

          {/* Mobile Footer Navigation - replaces offcanvas sidebar on mobile */}
          <MobileFooterNav />

          {/* Desktop Footer - hidden on mobile when footer nav is active */}
          <footer className="hidden md:flex flex-col items-center gap-1 p-4 text-center caption-responsive border-t bg-muted/40">
            <div className="flex items-center gap-1">
              <span>Hệ thống quản lý thiết bị y tế</span>
              <Copyright className="h-3 w-3" />
            </div>
            <span>Phát triển bởi Nguyễn Thiện Chí</span>
            <span>2025</span>
          </footer>
        </div>
      </div>
    </>
  )
}

