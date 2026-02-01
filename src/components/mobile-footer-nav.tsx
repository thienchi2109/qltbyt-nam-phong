"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Package,
  Wrench,
  ArrowLeftRight,
  MoreHorizontal,
  HardHat,
  BarChart3,
  QrCode,
  Users,
  Activity,
  Calculator,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

export function MobileFooterNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as any

  // Primary navigation items for footer tabs
  const mainNavItems = [
    { href: "/dashboard", icon: Home, label: "Tổng quan" },
    { href: "/equipment", icon: Package, label: "Thiết bị" },
    { href: "/repair-requests", icon: Wrench, label: "Sửa chữa" },
  ]

  // Secondary navigation items for "More" dropdown
  const moreNavItems = React.useMemo(() => {
    const baseItems = [
      { href: "/transfers", icon: ArrowLeftRight, label: "Luân chuyển" },
      { href: "/maintenance", icon: HardHat, label: "Bảo trì" },
      { href: "/device-quota", icon: Calculator, label: "Định mức" },
      { href: "/reports", icon: BarChart3, label: "Báo cáo" },
      { href: "/qr-scanner", icon: QrCode, label: "Quét QR" },
    ]

    // Add admin-only items with role-based permissions
  if (user?.role === 'global' || user?.role === 'admin') {
      baseItems.push({ href: "/users", icon: Users, label: "Người dùng" })
      baseItems.push({ href: "/activity-logs", icon: Activity, label: "Nhật ký hoạt động" })
    }

    return baseItems
  }, [user?.role])

  // Check if any item in "More" dropdown is active
  const isMoreActive = React.useMemo(() => {
    return moreNavItems.some(item =>
      pathname === item.href || pathname.startsWith(item.href + '/')
    )
  }, [pathname, moreNavItems])

  // Enhanced active state detection for better UX
  const isItemActive = React.useCallback((href: string) => {
    if (href === "/dashboard") {
      return pathname === href
    }
    return pathname === href || pathname.startsWith(href + '/')
  }, [pathname])

  return (
    <div className="fixed bottom-0 left-0 right-0 mobile-footer-z border-t border-slate-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.08)] md:hidden lg:hidden">
      <nav
        className="grid h-16 grid-cols-4 items-center px-2"
        role="navigation"
        aria-label="Điều hướng chính"
      >
        {mainNavItems.map(({ href, icon: Icon, label }) => {
          const isActive = isItemActive(href)
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl mx-1 py-2 transition-all duration-200 touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive
                  ? "bg-gradient-to-br from-primary to-primary/90 text-white shadow-lg shadow-primary/20"
                  : "text-slate-600 hover:bg-slate-50 active:bg-slate-100"
              )}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn(
                "h-5 w-5 transition-colors",
                isActive ? "text-white" : "text-slate-500"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                isActive ? "text-white" : "text-slate-600"
              )}>{label}</span>
            </Link>
          )
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl mx-1 py-2 transition-all duration-200 touch-target h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isMoreActive
                  ? "bg-gradient-to-br from-primary to-primary/90 text-white shadow-lg shadow-primary/20"
                  : "text-slate-600 hover:bg-slate-50 active:bg-slate-100"
              )}
              aria-label="Thêm tùy chọn"
              aria-expanded="false"
            >
              <MoreHorizontal className={cn(
                "h-5 w-5 transition-colors",
                isMoreActive ? "text-white" : "text-slate-500"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                isMoreActive ? "text-white" : "text-slate-600"
              )}>Thêm</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="mb-3 min-w-[200px] bg-white border border-slate-200 shadow-xl rounded-xl p-2"
            sideOffset={12}
          >
            {moreNavItems.map(({ href, icon: Icon, label }) => {
              const isActive = isItemActive(href)
              return (
                <DropdownMenuItem key={label} asChild>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 w-full touch-target-sm rounded-xl px-3 py-2.5 transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-primary to-primary/90 text-white font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-white" : "text-slate-500"
                    )} />
                    <span className="text-sm">{label}</span>
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  )
}
