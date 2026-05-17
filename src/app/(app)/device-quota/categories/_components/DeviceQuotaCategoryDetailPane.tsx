"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { CategoryListItem } from "../_types/categories"
import {
  CLASSIFICATION_STYLES,
  type AggregatedQuota,
} from "./category-tree-utils"
import { DeviceQuotaCategoryAssignedEquipment } from "./DeviceQuotaCategoryAssignedEquipment"
import { QuotaProgressBar } from "./QuotaProgressBar"

interface DeviceQuotaCategoryDetailPaneProps {
  category: CategoryListItem | null
  allCategories: CategoryListItem[]
  aggregatedCount: number
  aggregatedQuota: AggregatedQuota | undefined
  donViId: number | null
}

function buildCategoryPath(
  category: CategoryListItem,
  allCategories: CategoryListItem[]
) {
  const byId = new Map(allCategories.map((item) => [item.id, item]))
  const path: CategoryListItem[] = []
  let current: CategoryListItem | undefined = category

  while (current) {
    path.unshift(current)
    current = current.parent_id === null ? undefined : byId.get(current.parent_id)
  }

  return path
}

export function DeviceQuotaCategoryDetailPane({
  category,
  allCategories,
  aggregatedCount,
  aggregatedQuota,
  donViId,
}: DeviceQuotaCategoryDetailPaneProps) {
  if (!category) {
    return (
      <Card
        data-testid="device-quota-category-detail-pane"
        className="h-full"
      >
        <CardContent className="flex min-h-[18rem] items-center justify-center text-sm text-muted-foreground">
          Chọn một danh mục để xem thiết bị được gán
        </CardContent>
      </Card>
    )
  }

  const classStyle = CLASSIFICATION_STYLES[category.phan_loai || ""] ?? null
  const quotaMax = aggregatedQuota?.hasUnknown
    ? null
    : (aggregatedQuota?.total ?? category.so_luong_toi_da)
  const categoryPath = buildCategoryPath(category, allCategories)
  const parentPath = categoryPath.slice(0, -1)

  return (
    <Card
      data-testid="device-quota-category-detail-pane"
      className="h-full overflow-hidden"
    >
      <CardHeader className="space-y-3 pb-4">
        <CardDescription className="line-clamp-1">
          {parentPath.length > 0
            ? parentPath.map((item) => item.ten_nhom).join(" / ")
            : "Danh mục gốc"}
        </CardDescription>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {category.ma_nhom}
            </Badge>
            {classStyle && (
              <Badge
                variant="outline"
                className={cn("text-xs font-medium", classStyle.className)}
              >
                {classStyle.label}
              </Badge>
            )}
          </div>
          <CardTitle
            role="heading"
            aria-level={2}
            className="line-clamp-3 text-xl leading-snug"
            title={category.ten_nhom}
          >
            {category.ten_nhom}
          </CardTitle>
          {category.mo_ta && (
            <p
              className="line-clamp-2 text-sm text-muted-foreground"
              title={category.mo_ta}
            >
              {category.mo_ta}
            </p>
          )}
        </div>
        <div className="max-w-sm">
          <QuotaProgressBar current={aggregatedCount} max={quotaMax} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <DeviceQuotaCategoryAssignedEquipment
          nhomId={category.id}
          donViId={donViId}
          variant="panel"
        />
      </CardContent>
    </Card>
  )
}
