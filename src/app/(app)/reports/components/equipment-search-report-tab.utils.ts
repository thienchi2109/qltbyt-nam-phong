import type { EquipmentAggregateSearchRow } from "../hooks/use-equipment-aggregate-search.types"
import type { EquipmentAggregateSearchQuotaStatus } from "../hooks/use-equipment-aggregate-search.types"

export interface EquipmentSearchQuotaContext {
  quotaDisplay: string
  statusLabel: string
  notesText: string
}

const QUOTA_STATUS_LABELS: Record<Exclude<EquipmentAggregateSearchQuotaStatus, "mixed">, string> = {
  within_limit: "Trong giới hạn định mức",
  below_minimum: "Dưới mức tối thiểu",
  over_limit: "Vượt giới hạn định mức",
  no_active_quota: "Chưa có định mức",
  unassigned_category: "Chưa gán danh mục định mức",
  not_in_unit_quota: "Chưa được gán vào định mức của đơn vị",
}

const MIXED_QUOTA_STATUS_PRIORITY: Exclude<EquipmentAggregateSearchQuotaStatus, "mixed">[] = [
  "unassigned_category",
  "not_in_unit_quota",
  "no_active_quota",
  "over_limit",
  "below_minimum",
  "within_limit",
]

const MIXED_QUOTA_NOTE = "Gồm nhiều nhóm định mức"

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

function formatQuotaNumber(value: number): string {
  return value.toLocaleString("vi-VN")
}

function getQuotaDisplay(row: EquipmentAggregateSearchRow): string {
  if (typeof row.quotaCurrentCount !== "number") {
    return "-"
  }

  if (typeof row.quotaMinCount === "number" && typeof row.quotaMaxCount === "number") {
    return `${formatQuotaNumber(row.quotaCurrentCount)}/${formatQuotaNumber(
      row.quotaMinCount
    )}-${formatQuotaNumber(row.quotaMaxCount)}`
  }

  if (typeof row.quotaMaxCount === "number") {
    return `${formatQuotaNumber(row.quotaCurrentCount)}/${formatQuotaNumber(row.quotaMaxCount)}`
  }

  return "-"
}

function isQuotaStatus(
  value: string
): value is Exclude<EquipmentAggregateSearchQuotaStatus, "mixed"> {
  return Object.prototype.hasOwnProperty.call(QUOTA_STATUS_LABELS, value)
}

function translateQuotaNote(note: string): string {
  return isQuotaStatus(note) ? QUOTA_STATUS_LABELS[note] : note
}

function getStatusLabel(row: EquipmentAggregateSearchRow): string {
  if (row.quotaStatus && row.quotaStatus !== "mixed") {
    return QUOTA_STATUS_LABELS[row.quotaStatus]
  }

  const notes = row.quotaNotes ?? []
  const primaryStatus = MIXED_QUOTA_STATUS_PRIORITY.find((status) =>
    notes.some((note) => note === status || note === QUOTA_STATUS_LABELS[status])
  )

  return primaryStatus ? QUOTA_STATUS_LABELS[primaryStatus] : "-"
}

function getNotesText(row: EquipmentAggregateSearchRow): string {
  const translatedNotes = (row.quotaNotes ?? [])
    .map(translateQuotaNote)
    .filter((note) => note.trim().length > 0)
  const shouldPrependMixedNote =
    row.quotaStatus === "mixed" ||
    translatedNotes.filter((note) => note !== MIXED_QUOTA_NOTE).length > 1

  const notes = shouldPrependMixedNote
    ? [MIXED_QUOTA_NOTE, ...translatedNotes.filter((note) => note !== MIXED_QUOTA_NOTE)]
    : translatedNotes

  return notes.length > 0 ? notes.join("; ") : "-"
}

/** Builds read-only quota context for a facility aggregate row. */
export function getEquipmentSearchQuotaContext(
  row: EquipmentAggregateSearchRow
): EquipmentSearchQuotaContext {
  if (row.groupType !== "facility") {
    return {
      quotaDisplay: "-",
      statusLabel: "Đếm theo khu vực",
      notesText: "-",
    }
  }

  return {
    quotaDisplay: getQuotaDisplay(row),
    statusLabel: getStatusLabel(row),
    notesText: getNotesText(row),
  }
}

/** Returns quota cells for facility-mode tables, including safe placeholders for unexpected row types. */
export function getEquipmentSearchTableQuotaContext(
  row: EquipmentAggregateSearchRow
): EquipmentSearchQuotaContext {
  return row.groupType === "facility"
    ? getEquipmentSearchQuotaContext(row)
    : { quotaDisplay: "-", statusLabel: "-", notesText: "-" }
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
