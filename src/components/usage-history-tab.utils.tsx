"use client"

import type { ReactElement } from "react"
import { Clock } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { calculateUsageDurationMinutes } from "@/lib/usage-duration"
import type { UsageLog } from "@/types/database"

export function getUsageLogPageSignature(logs: UsageLog[]): string {
  return JSON.stringify(logs.map((log) => [
    log.id,
    log.updated_at,
    log.trang_thai,
    log.thoi_gian_ket_thuc ?? "",
    log.tinh_trang_ban_dau ?? "",
    log.tinh_trang_ket_thuc ?? "",
    log.tinh_trang_thiet_bi ?? "",
    log.ghi_chu ?? "",
  ]))
}

export function formatUsageDuration(startTime: string, endTime: string | undefined, now: number | null): string {
  const minutes = calculateUsageDurationMinutes(startTime, endTime ?? now)

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export function UsageHistoryLoadingState(): ReactElement {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </div>
  )
}

export function UsageHistoryEmptyState(): ReactElement {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>Chưa có lịch sử sử dụng</p>
    </div>
  )
}
