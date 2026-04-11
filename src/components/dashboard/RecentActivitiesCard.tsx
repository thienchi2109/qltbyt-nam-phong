"use client"

/**
 * Dashboard widget showing recent notable activities.
 * Adapts RPC response → ChangeHistoryEntry[] and reuses shared timeline.
 * @module components/dashboard/RecentActivitiesCard
 */

import React from "react"
import { Activity } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { ChangeHistoryErrorState } from "@/components/change-history/ChangeHistoryErrorState"
import { ChangeHistoryTimeline } from "@/components/change-history/ChangeHistoryTimeline"
import { ChangeHistoryLoadingState } from "@/components/change-history/ChangeHistoryLoadingState"
import { ChangeHistoryEmptyState } from "@/components/change-history/ChangeHistoryEmptyState"
import type { ChangeHistoryEntry } from "@/components/change-history/ChangeHistoryTypes"
import {
  useRecentActivities,
  type RecentActivity,
} from "@/hooks/use-recent-activities"

/** Icon mapping for action types */
const ACTION_ICONS: Record<string, string> = {
  repair_request_create: "🔧",
  repair_request_update: "🔧",
  repair_request_approve: "✅",
  repair_request_complete: "✔️",
  transfer_request_create: "📦",
  transfer_request_update: "📦",
  transfer_request_update_status: "🔄",
  transfer_request_complete: "✔️",
  maintenance_plan_create: "📋",
  maintenance_plan_approve: "✅",
  equipment_create: "➕",
}

/** Adapt RPC response to shared ChangeHistoryEntry contract */
function toChangeHistoryEntries(
  activities: RecentActivity[],
): ChangeHistoryEntry[] {
  return activities.map((a) => {
    const icon = ACTION_ICONS[a.action_type] ?? "📌"
    const details: { label: string; value: string }[] = []

    if (a.entity_label) {
      details.push({ label: "Mã:", value: a.entity_label })
    }
    if (a.facility_name) {
      details.push({ label: "Đơn vị:", value: a.facility_name })
    }

    return {
      id: String(a.activity_id),
      occurredAt: a.occurred_at,
      actionLabel: `${icon} ${a.action_label}`,
      actorName: a.actor_name,
      details,
    }
  })
}

interface RecentActivitiesCardProps {
  className?: string
}

export function RecentActivitiesCard({ className }: RecentActivitiesCardProps) {
  const { toast } = useToast()
  const { data, error, isError, isLoading } = useRecentActivities(15)

  const entries = React.useMemo(
    () => (data ? toChangeHistoryEntries(data) : []),
    [data],
  )

  React.useEffect(() => {
    if (!isError || !error) {
      return
    }

    console.error("RecentActivitiesCard: failed to load recent activities", error)
    toast({
      variant: "destructive",
      title: "Lỗi tải dữ liệu",
      description: error.message || "Không thể tải hoạt động gần đây.",
    })
  }, [error, isError, toast])

  return (
    <Card className={className}>
      <CardHeader className="pb-4 md:p-8 md:pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Hoạt động gần đây
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Các thao tác đáng chú ý trong 30 ngày qua
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="md:p-8 md:pt-0">
        {isLoading ? (
          <ChangeHistoryLoadingState />
        ) : isError ? (
          <ChangeHistoryErrorState
            title="Không thể tải hoạt động gần đây"
            description="Vui lòng thử lại sau."
          />
        ) : entries.length === 0 ? (
          <ChangeHistoryEmptyState />
        ) : (
          <ScrollArea className="h-[500px] xl:h-[600px]">
            <ChangeHistoryTimeline
              entries={entries}
              timeFormat="relative"
            />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
