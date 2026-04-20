"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  MoreHorizontal,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import {
  EMPTY_APP_NOTIFICATION_COUNTS,
  sumNotificationBadgeCounts,
  type AppNotificationCounts,
} from "@/lib/app-notification-counts"
import { cn } from "@/lib/utils"

import { AppNotificationBadge } from "./app-notification-badge"
import {
  getMobileFooterMainNavItems,
  getMobileFooterMoreNavItems,
  isAppNavItemActive,
} from "./app-navigation"

interface MobileFooterNavProps {
  notificationCounts?: AppNotificationCounts
}

export function MobileFooterNav({
  notificationCounts = EMPTY_APP_NOTIFICATION_COUNTS,
}: Readonly<MobileFooterNavProps>) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as { role?: string } | undefined

  const mainNavItems = React.useMemo(() => getMobileFooterMainNavItems(user?.role), [user?.role])
  const moreNavItems = React.useMemo(() => getMobileFooterMoreNavItems(user?.role), [user?.role])

  // Check if any item in "More" dropdown is active
  const isMoreActive = React.useMemo(() => {
    return moreNavItems.some((item) => isAppNavItemActive(pathname, item.href))
  }, [pathname, moreNavItems])

  const moreBadgeCount = React.useMemo(
    () =>
      sumNotificationBadgeCounts(
        moreNavItems
          .map((item) => item.badgeKey)
          .filter((badgeKey): badgeKey is keyof AppNotificationCounts => Boolean(badgeKey)),
        notificationCounts
      ),
    [moreNavItems, notificationCounts]
  )

  return (
    <div className="fixed bottom-0 left-0 right-0 mobile-footer-z border-t border-slate-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.08)] md:hidden lg:hidden">
      <nav className="grid h-16 grid-cols-4 items-center px-2" aria-label="Điều hướng chính">
        {mainNavItems.map(({ href, icon: Icon, label, mobileLabel, badgeKey }) => {
          const isActive = isAppNavItemActive(pathname, href)
          const badgeCount = badgeKey ? notificationCounts[badgeKey] : 0
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-xl mx-1 py-2 transition-all duration-200 touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive
                  ? "bg-gradient-to-br from-primary to-primary/90 text-white shadow-lg shadow-primary/20"
                  : "text-slate-600 hover:bg-slate-50 active:bg-slate-100"
              )}
              aria-label={mobileLabel ?? label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn(
                "h-5 w-5 transition-colors",
                isActive ? "text-white" : "text-slate-500"
              )} />
              <AppNotificationBadge count={badgeCount} active={isActive} mode="floating" />
              <span className={cn(
                "text-xs font-medium transition-colors",
                isActive ? "text-white" : "text-slate-600"
              )}>{mobileLabel ?? label}</span>
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
              <AppNotificationBadge count={moreBadgeCount} active={isMoreActive} mode="floating" />
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
            {moreNavItems.map(({ href, icon: Icon, label, mobileLabel, badgeKey }) => {
              const isActive = isAppNavItemActive(pathname, href)
              const badgeCount = badgeKey ? notificationCounts[badgeKey] : 0
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
                    <span className="text-sm">{mobileLabel ?? label}</span>
                    <AppNotificationBadge count={badgeCount} active={isActive} />
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
