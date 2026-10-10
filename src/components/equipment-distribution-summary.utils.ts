import {
  STATUS_COLORS,
  STATUS_LABELS,
  type EquipmentDistributionData,
  type EquipmentDistributionItem,
} from "@/hooks/use-equipment-distribution"
import { EQUIPMENT_STATUS_LEGACY_KEYS, type EquipmentStatusRow } from "@/lib/equipment-status"

export type StatusPercentageItem = {
  key: string
  label: string
  count: number
  percentage: number
  color: string
}

export type DonutDatum = {
  key: string
  name: string
  value: number
  percent: number
  color: string
}

/** Converts status percentages into chart donut data. */
export function buildStatusDonutData(items: StatusPercentageItem[]): DonutDatum[] {
  return items
    .filter((item) => item.count > 0)
    .map((item) => ({
      key: item.key,
      name: item.label,
      value: item.count,
      percent: item.percentage,
      color: item.color,
    }))
}
/** Returns status counts, deriving them from department rows when needed. */
export function getEquipmentDistributionStatusCounts(
  data: EquipmentDistributionData
): Record<string, number> {
  if (data.statusCounts) return data.statusCounts
  const counts: Record<string, number> = {}
  for (const department of data.byDepartment) {
    for (const [key, value] of Object.entries(department)) {
      if (key !== "total" && typeof value === "number") counts[key] = (counts[key] ?? 0) + value
    }
  }
  return counts
}

/** Builds catalog-ordered distribution rows with percentages and colors. */
export function buildEquipmentDistributionStatusRows(
  catalog: readonly EquipmentStatusRow[],
  counts: Record<string, number>,
  total: number
): StatusPercentageItem[] {
  const ordered = [...catalog].sort(
    (left, right) =>
      Number(left.is_liquidation) - Number(right.is_liquidation) ||
      left.display_order - right.display_order
  )
  const represented = new Set<string>()
  const rows = ordered.map((row) => {
    const legacyKey = EQUIPMENT_STATUS_LEGACY_KEYS[row.status_value]
    const key = legacyKey && legacyKey in counts ? legacyKey : row.status_value
    represented.add(key)
    represented.add(row.status_value)
    return {
      key,
      label: row.status_value,
      count: counts[key] ?? 0,
      liquidation: row.is_liquidation,
    }
  })
  const historicalRows = Object.keys(counts)
    .filter((key) => !represented.has(key))
    .map((key) => ({
      key,
      label: key === "khac" ? "Khác" : (STATUS_LABELS[key as keyof typeof STATUS_LABELS] ?? key),
      count: counts[key],
      liquidation: false,
    }))
  return [
    ...rows.filter((row) => !row.liquidation),
    ...historicalRows,
    ...rows.filter((row) => row.liquidation),
  ].map((row) => ({
    key: row.key,
    label: row.label,
    count: row.count,
    percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
    color: row.liquidation
      ? "#1f2937"
      : (STATUS_COLORS[row.key as keyof typeof STATUS_COLORS] ?? "#6b7280"),
  }))
}

/** Extracts numeric status counts from one department group. */
export function getEquipmentDistributionGroupCounts(
  group: EquipmentDistributionItem
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(group).filter(
      (entry): entry is [string, number] => entry[0] !== "total" && typeof entry[1] === "number"
    )
  )
}
