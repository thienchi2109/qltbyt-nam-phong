"use client"

import * as React from "react"

import { ListPlus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { CategoryListItem } from "../_types/categories"
import { CLASSIFICATION_STYLES, type AggregatedQuota } from "./category-tree-utils"
import {
  DeviceQuotaCategoryAssignedEquipment,
  type DeviceQuotaCategoryUnassignmentRequest,
} from "./DeviceQuotaCategoryAssignedEquipment"
import { QuotaProgressBar } from "./QuotaProgressBar"

interface DeviceQuotaCategoryDetailPaneProps {
  category: CategoryListItem | null
  allCategories: CategoryListItem[]
  aggregatedCount: number
  aggregatedQuota: AggregatedQuota | undefined
  isLeaf: boolean
  donViId: number | null
  canAssign: boolean
  onStartAssignment: () => void
  reconciledEquipmentIds?: Set<number>
  canUnassign?: boolean
  onUnassign?: (request: DeviceQuotaCategoryUnassignmentRequest) => void | Promise<void>
}

function buildCategoryPath(category: CategoryListItem, allCategories: CategoryListItem[]) {
  const byId = new Map(allCategories.map((item) => [item.id, item]))
  const path: CategoryListItem[] = []
  let current: CategoryListItem | undefined = category

  while (current) {
    path.unshift(current)
    current = current.parent_id === null ? undefined : byId.get(current.parent_id)
  }

  return path
}

/** Shows quota metadata and assigned equipment for the selected category. */
export function DeviceQuotaCategoryDetailPane({
  category,
  allCategories,
  aggregatedCount,
  aggregatedQuota,
  isLeaf,
  donViId,
  canAssign,
  onStartAssignment,
  reconciledEquipmentIds,
  canUnassign = false,
  onUnassign,
}: DeviceQuotaCategoryDetailPaneProps) {
  const categoryHeadingRef = React.useRef<HTMLDivElement>(null)

  if (!category) {
    return (
      <Card data-testid="device-quota-category-detail-pane" className="h-full">
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
      className="h-full flex flex-col overflow-hidden"
    >
      <CardHeader className="shrink-0 space-y-3 pb-4">
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
              <Badge variant="outline" className={cn("text-xs font-medium", classStyle.className)}>
                {classStyle.label}
              </Badge>
            )}
          </div>
          <CardTitle
            ref={categoryHeadingRef}
            role="heading"
            aria-level={2}
            tabIndex={-1}
            className="line-clamp-3 text-xl leading-snug"
            title={category.ten_nhom}
          >
            {category.ten_nhom}
          </CardTitle>
          {category.mo_ta && (
            <p className="line-clamp-2 text-sm text-muted-foreground" title={category.mo_ta}>
              {category.mo_ta}
            </p>
          )}
        </div>
        <div className="max-w-sm">
          <QuotaProgressBar current={aggregatedCount} max={quotaMax} />
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto pt-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">
            {isLeaf ? "Thiết bị được gán" : "Thiết bị gán trực tiếp"}
          </h3>
          {canAssign && (
            <Button size="sm" onClick={onStartAssignment}>
              <ListPlus className="size-4" />
              Phân loại thiết bị
            </Button>
          )}
        </div>
        <DeviceQuotaCategoryAssignedEquipment
          nhomId={category.id}
          donViId={donViId}
          variant="panel"
          reconciledEquipmentIds={reconciledEquipmentIds}
          canUnassign={canUnassign}
          categoryName={category.ten_nhom}
          onUnassign={onUnassign}
          focusAfterSuccessRef={categoryHeadingRef}
        />
      </CardContent>
    </Card>
  )
}
