"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useSession } from "next-auth/react"
import {
  EMPTY_APP_NOTIFICATION_COUNTS,
  type AppNotificationCounts,
} from "@/lib/app-notification-counts"
import { cn } from "@/lib/utils"

import { AppNotificationBadge } from "./app-notification-badge"
import {
  getMobileFooterMainNavItems,
  isAppNavItemActive,
} from "./app-navigation"

interface MobileFooterNavProps {
  notificationCounts?: AppNotificationCounts
}

/**
 * Renders the tablet/mobile bottom navigation for field-work routes.
 */
export function MobileFooterNav({
  notificationCounts = EMPTY_APP_NOTIFICATION_COUNTS,
}: Readonly<MobileFooterNavProps>) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as { role?: string } | undefined

  const mainNavItems = React.useMemo(() => getMobileFooterMainNavItems(user?.role), [user?.role])

  return (
    <div className="fixed inset-x-3 bottom-3 mobile-footer-z rounded-3xl border border-white/70 bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:hidden">
      <nav className="grid h-16 grid-cols-5 items-center px-1.5" aria-label="Điều hướng chính">
        {mainNavItems.map(({ href, icon: Icon, label, mobileLabel, badgeKey }) => {
          const isActive = isAppNavItemActive(pathname, href)
          const badgeCount = badgeKey ? notificationCounts[badgeKey] : 0
          const isQrAction = href.startsWith("/qr-scanner")
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-all duration-200 touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isQrAction
                  ? "-mt-7 min-h-[76px] text-white"
                  : "min-h-[56px]",
                isActive && !isQrAction
                  ? "bg-gradient-to-br from-primary to-primary/90 text-white shadow-lg shadow-primary/20"
                  : "text-slate-600 hover:bg-slate-50 active:bg-slate-100",
                isQrAction && "hover:bg-transparent active:bg-transparent"
              )}
              aria-label={mobileLabel ?? label}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "relative flex items-center justify-center rounded-2xl transition-all",
                  isQrAction
                    ? "size-16 border-4 border-white bg-gradient-to-br from-primary to-cyan-600 shadow-[0_12px_28px_rgba(8,145,178,0.35)]"
                    : "size-6"
                )}
              >
                <Icon className={cn(
                  "transition-colors",
                  isQrAction
                    ? "size-8 text-white"
                    : cn("size-5", isActive ? "text-white" : "text-slate-500")
                )} />
              </span>
              <AppNotificationBadge count={badgeCount} active={isActive} mode="floating" />
              <span className={cn(
                "text-[11px] font-medium leading-none transition-colors sm:text-xs",
                isQrAction ? "mt-0.5 text-primary" : "",
                isActive && !isQrAction ? "text-white" : "text-slate-600"
              )}>{mobileLabel ?? label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
