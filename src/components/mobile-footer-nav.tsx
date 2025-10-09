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
    <div className="fixed bottom-0 left-0 right-0 mobile-footer-z border-t border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden lg:hidden">
      <nav
        className="grid h-20 grid-cols-4 items-center px-2"
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
                "flex flex-col items-center justify-center gap-1.5 rounded-2xl mx-1 py-2 transition-all duration-300 touch-target",
                isActive
                  ? "bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 scale-105"
                  : "hover:bg-slate-100 active:scale-95"
              )}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className={cn(
                "rounded-xl p-2 transition-all duration-300",
                isActive
                  ? "bg-white/20 backdrop-blur-sm"
                  : "bg-transparent"
              )}>
                <Icon className={cn(
                  "h-5 w-5 transition-all duration-300",
                  isActive ? "text-white" : "text-slate-600"
                )} />
              </div>
              <span className={cn(
                "truncate max-w-[64px] text-center text-xs font-medium transition-colors duration-300",
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
                "flex flex-col items-center justify-center gap-1.5 rounded-2xl mx-1 py-2 transition-all duration-300 touch-target h-full",
                isMoreActive
                  ? "bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 scale-105"
                  : "hover:bg-slate-100 active:scale-95"
              )}
              aria-label="Thêm tùy chọn"
              aria-expanded="false"
            >
              <div className={cn(
                "rounded-xl p-2 transition-all duration-300 relative",
                isMoreActive
                  ? "bg-white/20 backdrop-blur-sm"
                  : "bg-transparent"
              )}>
                <MoreHorizontal className={cn(
                  "h-5 w-5 transition-all duration-300",
                  isMoreActive ? "text-white" : "text-slate-600"
                )} />
                {isMoreActive && (
                  <div
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-yellow-300 animate-pulse"
                    aria-hidden="true"
                  />
                )}
              </div>
              <span className={cn(
                "truncate max-w-[64px] text-center text-xs font-medium transition-colors duration-300",
                isMoreActive ? "text-white" : "text-slate-600"
              )}>Thêm</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="mb-3 min-w-[200px] bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-xl rounded-2xl p-2"
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
                        ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 font-semibold"
                        : "hover:bg-slate-100 text-slate-700"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <div className={cn(
                      "rounded-lg p-1.5 transition-colors duration-200",
                      isActive ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
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
