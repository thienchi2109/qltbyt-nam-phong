import type { EquipmentAggregateSearchRow } from "../hooks/use-equipment-aggregate-search.types"

/** Normalizes session region identifiers before passing them to the search RPC hook. */
export function normalizeEquipmentSearchRegionId(
  value: number | string | null | undefined
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

/** Formats the primary equipment count label for chart and table rows. */
export function formatEquipmentSearchCount(count: number): string {
  return `${count.toLocaleString("vi-VN")} thiết bị`
}

/** Builds the secondary facility or parent-region text for an aggregate row. */
export function getEquipmentSearchFacilityText(row: EquipmentAggregateSearchRow): string {
  if (row.groupType === "facility") {
    return row.parentRegionName ?? "Cơ sở"
  }

  const count = row.facilityCount ?? 0
  return `${count.toLocaleString("vi-VN")} cơ sở`
}

/** Builds the Phase 5 quota placeholder context without rendering detailed status labels. */
export function getEquipmentSearchQuotaContext(row: EquipmentAggregateSearchRow): string {
  if (row.groupType !== "facility") {
    return "Đếm theo khu vực"
  }

  if (row.quotaCurrentCount === null) {
    return "Chờ ngữ cảnh định mức"
  }

  const limits = [row.quotaMinCount, row.quotaMaxCount]
    .filter((value): value is number => typeof value === "number")
    .map((value) => value.toLocaleString("vi-VN"))
    .join(" - ")

  return limits ? `Định mức: ${limits}` : "Có dữ liệu định mức"
}

/** Computes the chart scale without spreading arbitrary row counts onto the call stack. */
export function getEquipmentSearchMaxCount(rows: EquipmentAggregateSearchRow[]): number {
  return rows.reduce((maxCount, row) => Math.max(maxCount, row.equipmentCount), 1)
}

/** Sorts aggregate rows by matching equipment count for count-first rendering. */
export function sortEquipmentSearchRows(
  rows: EquipmentAggregateSearchRow[]
): EquipmentAggregateSearchRow[] {
  return [...rows].sort((left, right) => right.equipmentCount - left.equipmentCount)
}
