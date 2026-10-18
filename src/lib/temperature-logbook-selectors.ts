import {
  currentTemperatureSlot,
  TEMPERATURE_DEVIATION_ACTIONS,
  temperatureLocalTime,
} from "@/lib/temperature-monitoring"
import type { TemperatureReading, TemperatureSlot } from "@/types/temperature-monitoring"

/** Describe the actual measurement time field shared by logbook forms. */
export const TEMPERATURE_CAPTURE_INPUT = {
  name: "captured",
  type: "datetime-local",
  required: true,
  step: "1",
} as const

/** Describe the optional explanation and note fields for original readings. */
export const TEMPERATURE_READING_TEXT_FIELDS = [
  { name: "reason", label: "Lý do không đo được" },
  { name: "note", label: "Ghi chú" },
]

/** Describe explanation and audit-reason fields for review forms. */
export const TEMPERATURE_REVIEW_TEXT_FIELDS = [
  { name: "unableReason", label: "Lý do không đo được", required: false },
  { name: "reason", label: "Lý do thao tác", required: true },
]

/** Map immutable reading event types to user-facing labels. */
export const TEMPERATURE_EVENT_LABELS: Record<string, string> = {
  reading_created: "Ghi số đo",
  deviation_created: "Mở sai lệch",
  amendment_proposed: "Đề xuất sửa",
  amendment_approved: "Duyệt đề xuất",
  amendment_rejected: "Từ chối đề xuất",
  reading_confirmed: "Xác nhận số đo",
  reading_reopened: "Mở lại xét duyệt",
}

type TemperatureQueryError = { error: unknown; refetch: () => unknown }

/** Select failed record queries with safe labels and their retry controls. */
export function temperatureQueryErrors(
  readingQuery: TemperatureQueryError,
  deviationQuery: TemperatureQueryError,
  events: TemperatureQueryError
) {
  return [
    { query: readingQuery, label: "số đo" },
    { query: deviationQuery, label: "xử lý sai lệch" },
    { query: events, label: "nhật ký" },
  ].filter(({ query }) => query.error)
}

/** Identify a slot consistently across refetch and sheet lifecycle changes. */
export function temperatureSlotKey(slot: TemperatureSlot | null) {
  return slot ? `${slot.equipment_id}:${slot.monitoring_date}:${slot.shift_id}` : ""
}

/** Keep the selected deviation operation within current role and status limits. */
export function temperatureDeviationSelection(
  manager: boolean,
  status: string | undefined,
  chosen: string
) {
  const deviationActions = TEMPERATURE_DEVIATION_ACTIONS.filter(
    (action) =>
      (manager || !action.manager) &&
      !["Đã đóng", "Đã hủy"].includes(status ?? "") &&
      (!action.statuses || action.statuses.includes(status ?? ""))
  )
  const deviationAction = deviationActions.some((action) => action.value === chosen)
    ? chosen
    : "update_action"
  return { deviationActions, deviationAction }
}

/** Keep independent-review capability and legal actions in one place. */
export function temperatureReviewActions(
  manager: boolean,
  actor: number,
  reading: TemperatureReading | undefined
) {
  const independent =
    manager &&
    !!reading &&
    actor !== reading.reading.operator_user_id &&
    actor !== reading.effective.author_user_id &&
    actor !== reading.pending_amendment?.author_user_id
  const reviewActions = []
  if (!reading?.pending_amendment)
    reviewActions.push({ value: "amend", label: "Đề xuất sửa số đo" })
  if (independent) {
    if (reading?.pending_amendment)
      reviewActions.push(
        { value: "approve_amendment", label: "Duyệt đề xuất" },
        { value: "reject_amendment", label: "Từ chối đề xuất" }
      )
    else
      reviewActions.push({
        value: reading?.review_required ? "confirm" : "reopen",
        label: reading?.review_required ? "Xác nhận số đo gốc" : "Mở lại xét duyệt",
      })
  }
  return { independent, reviewActions }
}

/** Select a deep-linked reading or an unambiguous active slot. */
export function automaticTemperatureSlot(
  equipment: number | null,
  dismissed: boolean,
  cursor: Record<string, unknown> | null,
  params: URLSearchParams,
  tab: string,
  rows: TemperatureSlot[],
  serverNow: string
) {
  let automatic: TemperatureSlot | null = null
  if (equipment && !dismissed && !cursor) {
    if (params.has("reading"))
      automatic = rows.find((row) => row.reading_id === params.get("reading")) ?? null
    else if (tab === "current") automatic = currentTemperatureSlot(rows, serverNow)
  }
  return automatic
}

/** Default capture time only for the authoritative active slot. */
export function temperatureCaptureDefault(
  slot: TemperatureSlot | null,
  serverNow: string | undefined
) {
  const captureDefault =
    slot && serverNow && currentTemperatureSlot([slot], serverNow)
      ? temperatureLocalTime(serverNow, slot.display_timezone ?? "Asia/Ho_Chi_Minh")
      : ""
  return captureDefault
}
