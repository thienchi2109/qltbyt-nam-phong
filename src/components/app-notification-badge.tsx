import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { formatNotificationBadgeCount } from "@/lib/app-notification-counts"
import { cn } from "@/lib/utils"

interface AppNotificationBadgeProps {
  count: number
  active?: boolean
  mode?: "inline" | "floating"
  className?: string
}

/** Renders an app notification count badge for navigation and header alerts. */
export function AppNotificationBadge({
  count,
  active = false,
  mode = "inline",
  className,
}: Readonly<AppNotificationBadgeProps>): React.JSX.Element | null {
  const label = formatNotificationBadgeCount(count)

  if (!label) {
    return null
  }

  const isLongFloatingBadge = mode === "floating" && label.length >= 3

  return (
    <Badge
      variant="destructive"
      className={cn(
        "shrink-0 whitespace-nowrap border-transparent text-[11px] font-semibold leading-none tabular-nums",
        mode === "inline"
          ? "ml-auto h-5 min-w-[1.25rem] justify-center rounded-full px-1.5"
          : "absolute right-1 top-1 h-5 min-w-[1.25rem] justify-center rounded-full px-1.5",
        isLongFloatingBadge ? "px-1 text-[10px]" : null,
        active ? "ring-2 ring-white/30" : null,
        className
      )}
    >
      {label}
    </Badge>
  )
}
