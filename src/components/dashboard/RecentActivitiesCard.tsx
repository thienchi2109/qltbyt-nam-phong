"use client"

/**
 * Dashboard widget showing recent notable activities.
 * Adapts RPC response → ChangeHistoryEntry[] and reuses shared timeline.
 * @module components/dashboard/RecentActivitiesCard
 */

import React from "react"
import { Activity } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { ChangeHistoryErrorState } from "@/components/change-history/ChangeHistoryErrorState"
import { ChangeHistoryLoadingState } from "@/components/change-history/ChangeHistoryLoadingState"
import { ChangeHistoryEmptyState } from "@/components/change-history/ChangeHistoryEmptyState"
import {
  useRecentActivities,
  type RecentActivity,
} from "@/hooks/use-recent-activities"
import { formatDistanceToNow, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

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

type ActivityCategoryKey =
  | "repair"
  | "transfer"
  | "maintenance"
  | "equipment"
  | "other"

type ActivityCategoryConfig = {
  label: string
  badgeClassName: string
}

type RecentActivityViewModel = {
  id: string
  occurredAt: string
  actionLabel: string
  actorName: string
  details: { label: string; value: string }[]
  category: ActivityCategoryKey
}

const CATEGORY_CONFIG: Record<ActivityCategoryKey, ActivityCategoryConfig> = {
  repair: {
    label: "Sửa chữa",
    badgeClassName: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  },
  transfer: {
    label: "Luân chuyển",
    badgeClassName: "bg-sky-100 text-sky-800 hover:bg-sky-100",
  },
  maintenance: {
    label: "Bảo trì",
    badgeClassName: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  },
  equipment: {
    label: "Thiết bị",
    badgeClassName: "bg-violet-100 text-violet-800 hover:bg-violet-100",
  },
  other: {
    label: "Khác",
    badgeClassName: "bg-slate-100 text-slate-800 hover:bg-slate-100",
  },
}

function resolveActivityCategory(activity: RecentActivity): ActivityCategoryKey {
  switch (activity.entity_type) {
    case "repair_request":
      return "repair"
    case "transfer_request":
      return "transfer"
    case "maintenance_plan":
      return "maintenance"
    case "device":
      return "equipment"
    default:
      break
  }

  if (activity.action_type.startsWith("repair_request_")) {
    return "repair"
  }
  if (activity.action_type.startsWith("transfer_request_")) {
    return "transfer"
  }
  if (activity.action_type.startsWith("maintenance_plan_")) {
    return "maintenance"
  }
  if (activity.action_type.startsWith("equipment_")) {
    return "equipment"
  }

  return "other"
}

/** Adapt RPC response to dashboard-specific timeline contract */
function toRecentActivityViewModels(
  activities: RecentActivity[],
): RecentActivityViewModel[] {
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
      category: resolveActivityCategory(a),
    }
  })
}

function formatRelativeTimestamp(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: vi })
}

interface RecentActivitiesCardProps {
  className?: string
}

export function RecentActivitiesCard({ className }: RecentActivitiesCardProps) {
  const { toast } = useToast()
  const { data, error, isError, isLoading } = useRecentActivities(15)
  const [selectedCategory, setSelectedCategory] = React.useState<
    ActivityCategoryKey | "all"
  >("all")

  const activities = React.useMemo(
    () => (data ? toRecentActivityViewModels(data) : []),
    [data],
  )

  const availableCategories = React.useMemo(() => {
    const seen = new Set<ActivityCategoryKey>()
    for (const activity of activities) {
      seen.add(activity.category)
    }

    return (Object.keys(CATEGORY_CONFIG) as ActivityCategoryKey[]).filter((key) =>
      seen.has(key),
    )
  }, [activities])

  const filteredActivities = React.useMemo(() => {
    if (selectedCategory === "all") {
      return activities
    }

    return activities.filter((activity) => activity.category === selectedCategory)
  }, [activities, selectedCategory])

  React.useEffect(() => {
    if (selectedCategory === "all") {
      return
    }

    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory("all")
    }
  }, [availableCategories, selectedCategory])

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
        ) : activities.length === 0 ? (
          <ChangeHistoryEmptyState />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={selectedCategory === "all" ? "default" : "outline"}
                onClick={() => setSelectedCategory("all")}
              >
                Tất cả
              </Button>
              {availableCategories.map((category) => (
                <Button
                  key={category}
                  type="button"
                  size="sm"
                  variant={
                    selectedCategory === category ? "default" : "outline"
                  }
                  onClick={() => setSelectedCategory(category)}
                >
                  {CATEGORY_CONFIG[category].label}
                </Button>
              ))}
            </div>

            <ScrollArea className="h-[500px] xl:h-[600px]">
              <div className="relative pl-6 py-4 pr-4">
                <div className="absolute left-3 top-0 h-full w-0.5 bg-border" />

                {filteredActivities.map((activity) => (
                  <div key={activity.id} className="relative mb-8 last:mb-0">
                    <div className="absolute left-[-12px] top-1.5 size-3 rounded-full bg-primary ring-4 ring-background" />

                    <div className="pl-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-sm">
                            {activity.actionLabel}
                          </p>
                          <Badge
                            variant="secondary"
                            className={
                              CATEGORY_CONFIG[activity.category].badgeClassName
                            }
                          >
                            {CATEGORY_CONFIG[activity.category].label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTimestamp(activity.occurredAt)}
                        </p>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.actorName}
                      </p>

                      {activity.details.length > 0 ? (
                        <div className="mt-2 p-3 rounded-md bg-muted/50 border">
                          {activity.details.map((detail) => (
                            <div
                              key={`${activity.id}-${detail.label}-${detail.value}`}
                              className="flex items-baseline gap-2 text-sm"
                            >
                              <span className="text-muted-foreground shrink-0">
                                {detail.label}
                              </span>
                              <span>{detail.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
