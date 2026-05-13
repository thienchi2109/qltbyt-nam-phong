"use client"

import { Clock } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import type { UsageLog } from "@/types/database"

export function getUsageLogPageSignature(logs: UsageLog[]) {
  return logs.map((log) => [
    log.id,
    log.updated_at,
    log.trang_thai,
    log.thoi_gian_ket_thuc ?? "",
    log.tinh_trang_ban_dau ?? "",
    log.tinh_trang_ket_thuc ?? "",
    log.tinh_trang_thiet_bi ?? "",
    log.ghi_chu ?? "",
  ].join(":")).join("|")
}

export function formatUsageDuration(startTime: string, endTime: string | undefined, now: number | null) {
  const start = Date.parse(startTime)
  const end = endTime ? Date.parse(endTime) : now
  const minutes = Number.isFinite(start) && end !== null && Number.isFinite(end)
    ? Math.max(0, Math.floor((end - start) / 60_000))
    : 0

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export function UsageHistoryLoadingState() {
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

export function UsageHistoryEmptyState() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
      <p>Chưa có lịch sử sử dụng</p>
    </div>
  )
}
