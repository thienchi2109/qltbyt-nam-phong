import * as React from "react"

import type { ChartTooltipProps } from "@/lib/chart-utils"
import { buildKeyedTooltipEntries } from "@/lib/runtime-list-keys"
import { STATUS_LABELS } from "@/hooks/use-equipment-distribution"

type TooltipPayloadEntry = NonNullable<ChartTooltipProps<number, string>["payload"]>[number]

function getTooltipCategoryName(entry: TooltipPayloadEntry): string | null {
  const row = entry.payload
  if (!row || typeof row !== "object" || !("name" in row)) return null

  const name = (row as Record<string, unknown>).name
  return typeof name === "string" && name.trim() ? name : null
}

export const EquipmentChartTooltip = React.memo(function EquipmentChartTooltip({
  active,
  payload,
  label,
}: ChartTooltipProps<number, string>) {
  const tooltipEntries = payload ?? []

  if (!active || tooltipEntries.length === 0) return null

  const total = tooltipEntries.reduce(
    (sum, entry) => sum + (typeof entry.value === "number" ? entry.value : 0),
    0,
  )
  const keyedPayload = buildKeyedTooltipEntries<TooltipPayloadEntry>(tooltipEntries)
  const categoryName = tooltipEntries.map(getTooltipCategoryName).find(Boolean) ?? label

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[200px]">
      <p className="font-medium mb-2">{categoryName}</p>
      <div className="space-y-1">
        {keyedPayload.map(({ key, entry }) => (
          <div key={key} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded" style={{ backgroundColor: entry.color }} />
              <span>{STATUS_LABELS[entry.dataKey as keyof typeof STATUS_LABELS]}</span>
            </div>
            <span className="font-medium">{entry.value}</span>
          </div>
        ))}
        <div className="border-t pt-1 mt-2">
          <div className="flex items-center justify-between font-medium">
            <span>Tổng:</span>
            <span>{total}</span>
          </div>
        </div>
      </div>
    </div>
  )
})
