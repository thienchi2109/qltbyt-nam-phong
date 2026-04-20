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

  return (
    <Badge
      variant="destructive"
      className={cn(
        "border-transparent text-[11px] font-semibold leading-none",
        mode === "inline"
          ? "ml-auto h-5 min-w-[1.25rem] justify-center rounded-full px-1.5"
          : "absolute right-1 top-1 h-5 min-w-[1.25rem] justify-center rounded-full px-1.5",
        active ? "ring-2 ring-white/30" : null,
        className
      )}
    >
      {label}
    </Badge>
  )
}
