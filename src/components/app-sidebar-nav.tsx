import * as React from "react"
import Link from "next/link"

import type { AppNotificationCounts } from "@/lib/app-notification-counts"
import { cn } from "@/lib/utils"

import { AppNotificationBadge } from "./app-notification-badge"
import { isAppNavItemActive, type AppNavItem } from "./app-navigation"

const EMPTY_TOUR_ATTRIBUTES: Record<string, string> = {}

interface AppSidebarNavProps {
  items: AppNavItem[]
  pathname: string
  isSidebarOpen: boolean
  notificationCounts: AppNotificationCounts
  tourAttributes?: Record<string, string>
  variant?: "sidebar" | "sheet"
  className?: string
  onNavigate?: () => void
}

export function AppSidebarNav({
  items,
  pathname,
  isSidebarOpen,
  notificationCounts,
  tourAttributes = EMPTY_TOUR_ATTRIBUTES,
  variant = "sidebar",
  className,
  onNavigate,
}: Readonly<AppSidebarNavProps>): React.JSX.Element {
  const isSheetVariant = variant === "sheet"

  return (
    <nav
      className={cn(
        isSheetVariant
          ? "grid gap-1 body-responsive font-medium"
          : "grid items-start text-sm font-medium gap-1",
        className
      )}
    >
      {items.map(({ href, icon: Icon, label, badgeKey }) => {
        const isActive = isAppNavItemActive(pathname, href)
        const badgeCount = badgeKey ? notificationCounts[badgeKey] : 0
        const usesFloatingBadge = !isSheetVariant && !isSidebarOpen

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-xl transition-all duration-200",
              isSheetVariant
                ? "flex items-center gap-3 px-3 py-2.5 mobile-interactive touch-target"
                : "flex items-center py-2.5",
              isActive
                ? "bg-gradient-to-r from-primary to-primary/90 text-white font-semibold shadow-lg shadow-primary/25"
                : "text-slate-600 hover:bg-slate-50 hover:text-primary",
              !isSheetVariant && isSidebarOpen ? "px-3 gap-3" : null,
              !isSheetVariant && !isSidebarOpen ? "relative h-11 w-11 justify-center" : null
            )}
            title={!isSheetVariant && !isSidebarOpen ? label : ""}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            data-tour={tourAttributes[href]}
            onClick={onNavigate}
          >
            <Icon
              className={cn(
                "h-5 w-5 transition-colors",
                isActive ? "text-white" : "text-slate-500"
              )}
            />
            {(isSheetVariant || isSidebarOpen) && <span>{label}</span>}
            <AppNotificationBadge
              count={badgeCount}
              active={isActive}
              mode={usesFloatingBadge ? "floating" : "inline"}
            />
          </Link>
        )
      })}
    </nav>
  )
}
