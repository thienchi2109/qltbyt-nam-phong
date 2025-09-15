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
    <div className="fixed bottom-0 left-0 right-0 mobile-footer-z border-t bg-background/95 backdrop-blur-sm md:hidden lg:hidden">
      <nav
        className="grid h-20 grid-cols-4 items-center px-1"
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
                "mobile-footer-nav-item mobile-nav-transition",
                isActive ? "active" : "inactive"
              )}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn("h-5 w-5 transition-transform duration-200", isActive && "scale-110")} />
              <span className="truncate max-w-[60px] text-center">{label}</span>
            </Link>
          )
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "mobile-footer-nav-item mobile-nav-transition h-full",
                isMoreActive ? "active" : "inactive"
              )}
              aria-label="Thêm tùy chọn"
              aria-expanded="false"
            >
              <div className="relative">
                <MoreHorizontal className={cn("h-5 w-5 transition-transform duration-200", isMoreActive && "scale-110")} />
                {isMoreActive && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-2 w-2 p-0 bg-primary animate-pulse"
                    aria-hidden="true"
                  />
                )}
              </div>
              <span className="truncate max-w-[60px] text-center">Thêm</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="mb-2 min-w-[180px] mobile-nav-transition"
            sideOffset={8}
          >
            {moreNavItems.map(({ href, icon: Icon, label }) => {
              const isActive = isItemActive(href)
              return (
                <DropdownMenuItem key={label} asChild>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 w-full touch-target-sm mobile-nav-transition",
                      isActive && "bg-primary/10 text-primary font-medium"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
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
