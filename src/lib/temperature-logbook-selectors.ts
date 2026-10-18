import { currentTemperatureSlot, temperatureLocalTime } from "@/lib/temperature-monitoring"
import type { TemperatureReading, TemperatureSlot } from "@/types/temperature-monitoring"

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
