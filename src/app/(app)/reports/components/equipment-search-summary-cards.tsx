import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"

import { formatEquipmentSearchCount } from "./equipment-search-report-tab.utils"

interface EquipmentSearchSummaryCardsProps {
  facilityCount: number
  regionCount: number
  totalEquipmentCount: number
}

/** Renders aggregate count summary cards for the Reports equipment search tab. */
export function EquipmentSearchSummaryCards({
  facilityCount,
  regionCount,
  totalEquipmentCount,
}: EquipmentSearchSummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card>
        <CardContent className="py-4">
          <div className="text-2xl font-semibold tabular-nums">
            {formatEquipmentSearchCount(totalEquipmentCount)} phù hợp
          </div>
          <p className="text-sm text-muted-foreground">với từ khóa</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4">
          <div className="text-2xl font-semibold tabular-nums">
            {regionCount.toLocaleString("vi-VN")}
          </div>
          <p className="text-sm text-muted-foreground">khu vực có kết quả</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4">
          <div className="text-2xl font-semibold tabular-nums">
            {facilityCount.toLocaleString("vi-VN")}
          </div>
          <p className="text-sm text-muted-foreground">cơ sở có kết quả</p>
        </CardContent>
      </Card>
    </div>
  )
}
