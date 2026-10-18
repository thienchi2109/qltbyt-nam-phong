import type { TemperatureSlot, TemperatureWorkspace } from "@/types/temperature-monitoring"

/** Keep the complete table and selected-point detail labels aligned. */
export const TEMPERATURE_TREND_HEADERS = [
  "Ngày theo dõi",
  "Thời gian đo",
  "Ca",
  "Giá trị hiệu lực",
  "Trạng thái ô",
  "Giới hạn dưới",
  "Giới hạn trên",
  "Người ghi",
  "Ghi chú gốc",
  "Sai lệch",
] as const

/** Collect every filtered cursor page, rejecting partial or cancelled loads. */
export async function fetchTemperatureTrendPages(
  fetchPage: (args: Record<string, unknown>, signal?: AbortSignal) => Promise<TemperatureWorkspace>,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<TemperatureSlot[]> {
  const rows: TemperatureSlot[] = []
  const seenCursors = new Set<string>()
  let cursor: Record<string, unknown> | null = null

  while (true) {
    signal?.throwIfAborted()
    const page = await fetchPage({ ...args, p_cursor: cursor, p_limit: 200 }, signal)
    signal?.throwIfAborted()
    rows.push(...page.items)

    if (!page.next_cursor) return sortTemperatureTrendRows(rows)

    const cursorKey = JSON.stringify(page.next_cursor)
    if (seenCursors.has(cursorKey)) {
      throw new Error("Temperature trend cursor did not advance")
    }
    seenCursors.add(cursorKey)
    cursor = page.next_cursor
  }
}

/** Order readings by capture time and empty slots by scheduled start, with stable ties. */
export function sortTemperatureTrendRows(rows: TemperatureSlot[]): TemperatureSlot[] {
  return [...rows].sort((left, right) => {
    const leftTime = Date.parse(left.captured_at ?? left.slot_start)
    const rightTime = Date.parse(right.captured_at ?? right.slot_start)
    const timeDifference = leftTime - rightTime
    if (Number.isFinite(timeDifference) && timeDifference !== 0) return timeDifference

    const leftId =
      left.reading_id ??
      `${left.equipment_id}:${left.monitoring_date}:${left.shift_id}:${left.slot_start}`
    const rightId =
      right.reading_id ??
      `${right.equipment_id}:${right.monitoring_date}:${right.shift_id}:${right.slot_start}`
    return leftId.localeCompare(rightId)
  })
}

export type TrendChartPoint = {
  x: number
  slot: TemperatureSlot | null
  value_c: number | null
  lower_c: number | null
  upper_c: number | null
  thresholdBoundary: boolean
}

export type TrendDotProps = { cx?: number; cy?: number; payload?: unknown }

const DAY_MS = 86_400_000

/** Resolve inability metadata from the workspace projection or effective reading state. */
export function unableReason(row: TemperatureSlot): string | null {
  return row.unable_reason?.reason ?? row.state?.effective.unable_reason?.reason ?? null
}

/** Preserve linked deviations even after an approved value returns within its limits. */
export function isAbnormal(row: TemperatureSlot): boolean {
  return (
    row.deviation !== null ||
    row.status === "Bất thường" ||
    (row.value_c !== null && (row.value_c < row.lower_c || row.value_c > row.upper_c))
  )
}

/** Describe numeric, unable, and unrecorded observations without coercing null to zero. */
export function temperatureLabel(row: TemperatureSlot): string {
  if (row.value_c !== null) return String(row.value_c) + " °C"
  return unableReason(row) ? "Không đo được: " + unableReason(row) : row.status
}

/** Validate real ISO calendar dates and an inclusive range of at most 90 days. */
export function validDateRange(from: unknown, to: unknown): from is string {
  if (typeof from !== "string" || typeof to !== "string") return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return false
  const start = Date.parse(from + "T00:00:00Z")
  const end = Date.parse(to + "T00:00:00Z")
  const days = (end - start) / DAY_MS + 1
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    new Date(start).toISOString().slice(0, 10) === from &&
    new Date(end).toISOString().slice(0, 10) === to &&
    days >= 1 &&
    days <= 90
  )
}

/** Retain raw values and insert limit-series gaps at snapshot configuration changes. */
export function buildChartPoints(rows: TemperatureSlot[]): TrendChartPoint[] {
  const points: TrendChartPoint[] = []
  let previous: TemperatureSlot | null = null
  for (const row of rows) {
    const time = Date.parse(row.captured_at ?? row.slot_start)
    const numeric = row.value_c !== null && Number.isFinite(time)
    const previousNumeric = previous !== null && previous.value_c !== null
    const sameThreshold =
      previous?.configuration_version_id === row.configuration_version_id &&
      previous?.lower_c === row.lower_c &&
      previous?.upper_c === row.upper_c
    const thresholdBoundary = numeric && (!previousNumeric || !sameThreshold)
    if (numeric && previousNumeric && !sameThreshold && previous) {
      points.push({
        x: Date.parse(previous.captured_at ?? previous.slot_start),
        slot: null,
        value_c: previous.value_c,
        lower_c: null,
        upper_c: null,
        thresholdBoundary: false,
      })
    }
    points.push({
      x: time,
      slot: row,
      value_c: numeric ? row.value_c : null,
      lower_c: numeric ? row.lower_c : null,
      upper_c: numeric ? row.upper_c : null,
      thresholdBoundary,
    })
    previous = row
  }
  return points
}

/** Format a numeric chart timestamp using the monitoring display timezone. */
export function axisTime(value: number | string, timezone: string): string {
  const date = new Date(Number(value))
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: timezone,
      }).format(date)
}

/** Format the original capture time in its own recorded display timezone. */
export function capturedTime(row: TemperatureSlot): string {
  if (!row.captured_at) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: row.display_timezone,
  }).format(new Date(row.captured_at))
}

/** Identify either a persisted reading or its unrecorded scheduled slot. */
export function slotIdentity(row: TemperatureSlot): string {
  return (
    row.reading_id ??
    [row.equipment_id, row.monitoring_date, row.shift_id, row.slot_start].join("-")
  )
}

/** Map one observation to the shared table and selected-point metadata fields. */
export function tableValues(row: TemperatureSlot): string[] {
  return [
    row.monitoring_date,
    capturedTime(row) + " (" + row.display_timezone + ")",
    row.shift_name,
    temperatureLabel(row),
    row.status + (isAbnormal(row) ? " · Bất thường" : ""),
    row.lower_c + " °C",
    row.upper_c + " °C",
    row.operator_user_id === null ? "—" : "#" + row.operator_user_id,
    row.note || "—",
    deviationLabel(row),
  ]
}

/** Expose deviation identity, lifecycle status, and severity as text. */
export function deviationLabel(row: TemperatureSlot): string {
  return row.deviation
    ? row.deviation.id + " · " + row.deviation.status + " · " + row.deviation.severity
    : "Không có sai lệch liên kết"
}

/** Name a focusable chart point with its value, abnormal state, and keyboard actions. */
export function trendPointAriaLabel(row: TemperatureSlot): string {
  const outOfBounds =
    row.value_c !== null && (row.value_c < row.lower_c || row.value_c > row.upper_c)
  const summary = outOfBounds
    ? "vượt giới hạn"
    : row.deviation
      ? "bất thường liên kết với sai lệch"
      : row.status === "Bất thường"
        ? "trạng thái bất thường"
        : "trong giới hạn"
  return `${row.monitoring_date}; ${row.shift_name}; ${temperatureLabel(row)}; ${summary}. Enter để xem, Escape để đóng.`
}
