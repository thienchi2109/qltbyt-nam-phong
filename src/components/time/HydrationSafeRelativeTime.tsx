"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"

import { formatVietnamDateTime } from "@/lib/date-utils"

type RelativeTimeValue = string | number | Date | null | undefined

interface HydrationSafeRelativeTimeProps {
  value: RelativeTimeValue
  fallback?: string
  addSuffix?: boolean
  className?: string
}

function subscribeToClientTime(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {}

  const tick = () => {
    onStoreChange()
  }

  queueMicrotask(tick)
  const intervalId = window.setInterval(tick, 60_000)
  return () => window.clearInterval(intervalId)
}

function getClientTimeSnapshot(): number {
  return Math.floor(Date.now() / 60_000)
}

function getServerTimeSnapshot(): null {
  return null
}

export function useHydrationSafeNow(): number | null {
  const minuteSnapshot = React.useSyncExternalStore(
    subscribeToClientTime,
    getClientTimeSnapshot,
    getServerTimeSnapshot
  )

  return minuteSnapshot === null ? null : minuteSnapshot * 60_000
}

function getTimestamp(value: RelativeTimeValue): number | null {
  if (value === null || value === undefined || value === "") return null

  const timestamp =
    typeof value === "number"
      ? value
      : value instanceof Date
        ? value.getTime()
        : Date.parse(String(value))
  return Number.isFinite(timestamp) ? timestamp : null
}

export function HydrationSafeRelativeTime({
  value,
  fallback = "-",
  addSuffix = true,
  className,
}: HydrationSafeRelativeTimeProps) {
  const now = useHydrationSafeNow()
  const timestamp = getTimestamp(value)

  const label =
    now !== null && timestamp !== null
      ? formatDistanceToNow(timestamp, { addSuffix, locale: vi })
      : formatVietnamDateTime(value, fallback)

  return <span className={className}>{label}</span>
}
