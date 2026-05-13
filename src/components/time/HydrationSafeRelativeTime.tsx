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

  queueMicrotask(onStoreChange)
  const intervalId = window.setInterval(onStoreChange, 60_000)
  return () => window.clearInterval(intervalId)
}

function getClientTimeSnapshot(): boolean {
  return typeof window !== "undefined"
}

function getServerTimeSnapshot(): boolean {
  return false
}

export function useHydrationSafeNow(): number | null {
  const isClientReady = React.useSyncExternalStore(
    subscribeToClientTime,
    getClientTimeSnapshot,
    getServerTimeSnapshot
  )

  return isClientReady ? Date.now() : null
}

function getTimestamp(value: RelativeTimeValue): number | null {
  if (value === null || value === undefined || value === "") return null

  const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value))
  return Number.isNaN(timestamp) ? null : timestamp
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
