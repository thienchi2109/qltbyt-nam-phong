import type {
  TemperatureSlot,
  TemperatureDeviation,
  TemperatureReading,
} from "@/types/temperature-monitoring"

/** Associate validation errors with the control and focus it. */
export function focusTemperatureField(
  container: HTMLElement | null,
  name: string,
  message: string
) {
  const field = container?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)
  field?.setCustomValidity(message)
  field?.reportValidity()
  field?.focus()
}

/** Never silently choose one of several effective shifts. */
export function currentTemperatureSlot(rows: TemperatureSlot[], serverNow: string) {
  const now = Date.parse(serverNow)
  const current = rows.filter(
    (row) => Date.parse(row.slot_start) <= now && now < Date.parse(row.slot_end)
  )
  return current.length === 1 ? current[0] : null
}

/** Format an instant in the configured IANA timezone. */
export function temperatureLocalTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(value))
    .replace(" ", "T")
}

/** Resolve wall time with Intl; reject DST gaps/ambiguity rather than guessing. */
export function temperatureInstant(value: string, timeZone: string) {
  let captured = Date.parse(value)
  if (value && !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const local = value.length === 16 ? `${value}:00` : value
    const localEpoch = Date.parse(`${local}Z`)
    if (!Number.isFinite(localEpoch)) throw new Error("Giờ đo không hợp lệ.")
    const offsets = new Set(
      [-86400000, 0, 86400000].map(
        (delta) =>
          Date.parse(
            `${temperatureLocalTime(new Date(localEpoch + delta).toISOString(), timeZone)}Z`
          ) -
          localEpoch -
          delta
      )
    )
    const matches = [...offsets]
      .map((offset) => localEpoch - offset)
      .filter((time) => temperatureLocalTime(new Date(time).toISOString(), timeZone) === local)
    captured = matches.length === 1 ? matches[0] : NaN
  }
  if (!value || !Number.isFinite(captured)) throw new Error("Giờ không hợp lệ hoặc không duy nhất.")
  return new Date(captured).toISOString()
}

/** Validate observation time against the slot and server clock. */
export function validateTemperatureCapture(
  slot: TemperatureSlot,
  value: string,
  serverNow: string
) {
  if (!value) throw new Error("Chọn giờ đo thực tế.")
  const instant = temperatureInstant(value, slot.display_timezone ?? "Asia/Ho_Chi_Minh")
  const captured = Date.parse(instant)
  if (
    captured < Date.parse(slot.slot_start) ||
    captured >= Date.parse(slot.slot_end) ||
    captured > Date.parse(serverNow)
  ) {
    throw new Error("Chọn giờ đo thực tế trong ca đã bắt đầu, không vượt giờ máy chủ.")
  }
  return instant
}

/** Deviation operations with capability and transition constraints. */
export const TEMPERATURE_DEVIATION_ACTIONS = [
  { value: "update_action", label: "Ghi xử lý ngay / nguyên nhân / bằng chứng", manager: false },
  { value: "start", label: "Bắt đầu xử lý", manager: false, statuses: ["Mở"] },
  { value: "submit_verification", label: "Gửi xác minh", manager: false, statuses: ["Đang xử lý"] },
  { value: "assign", label: "Phân công và hạn xử lý", manager: true },
  { value: "severity", label: "Đổi mức độ", manager: true },
  { value: "close", label: "Xác minh và đóng", manager: true, statuses: ["Chờ xác minh"] },
  { value: "cancel", label: "Hủy sai lệch", manager: true, statuses: ["Mở", "Đang xử lý"] },
  { value: "link_repair", label: "Liên kết / bỏ liên kết yêu cầu sửa chữa", manager: true },
]

/** Slot lifecycle filter values. */
export const TEMPERATURE_SLOT_STATUSES = ["Chưa ghi", "Đã ghi", "Chờ xác nhận", "Bất thường"]
/** Separate deviation lifecycle filter values. */
export const TEMPERATURE_DEVIATION_STATUSES = [
  "Mở",
  "Đang xử lý",
  "Chờ xác minh",
  "Đã đóng",
  "Đã hủy",
]
/** Explanations for scoped server empty-result causes. */
export const TEMPERATURE_EMPTY_MESSAGES = {
  no_pending_work: "Không có việc đang chờ trong phạm vi này.",
  no_matches: "Không có kết quả khớp bộ lọc. Đổi trạng thái, ca hoặc khoảng ngày.",
  no_monitored_equipment: "Chưa có thiết bị bật theo dõi nhiệt độ trong phạm vi được phép.",
  no_eligible_slots:
    "Không có ca đủ điều kiện trong khoảng này. Kiểm tra ngày và cấu hình thiết bị.",
}

/** Describe snapshot values and independent review and breach flags. */
export function temperatureCardMeta(row: TemperatureSlot) {
  const value =
    row.value_c == null
      ? (row.state?.effective.unable_reason?.reason ?? "Chưa đo")
      : `${row.value_c} °C`
  const breach = row.value_c != null && (row.value_c < row.lower_c || row.value_c > row.upper_c)
  return `${value} · ${row.lower_c}–${row.upper_c} °C · ${row.recording_method_name}${row.state?.review_required ? " · Chờ xác nhận" : ""}${breach ? " · Ngoài giới hạn" : ""}`
}

/** Describe inputs for the selected deviation operation. */
export function temperatureDeviationFields(
  deviation: TemperatureDeviation | null | undefined,
  action: string
) {
  switch (action) {
    case "update_action":
      return [
        {
          name: "immediate",
          label: "Xử lý ngay",
          value: deviation?.immediate_action ?? "",
          type: "textarea",
          required: true,
        },
        {
          name: "cause",
          label: "Nguyên nhân",
          value: deviation?.cause ?? "",
          type: "textarea",
          required: false,
        },
        {
          name: "evidence",
          label: "Bằng chứng",
          value: deviation?.evidence ?? "",
          type: "textarea",
          required: false,
        },
      ]
    case "assign":
      return [
        {
          name: "due",
          label: "Hạn xử lý (giờ trình duyệt)",
          type: "datetime-local",
          value: "",
          required: false,
        },
      ]
    case "close":
      return [
        {
          name: "verification",
          label: "Kết quả xác minh",
          type: "textarea",
          value: "",
          required: true,
        },
      ]
    case "link_repair":
      return [
        {
          name: "repair",
          label: "ID yêu cầu sửa chữa (trống để bỏ liên kết)",
          type: "number",
          value: deviation?.repair_request_id ?? "",
          required: false,
        },
      ]
    default:
      return []
  }
}

/** Validate form data and construct deviation RPC arguments. */
export function temperatureDeviationArguments(deviation: TemperatureDeviation, form: FormData) {
  const action = String(form.get("action"))
  const text = (name: string) => String(form.get(name) ?? "").trim() || null
  const reassigned =
    action === "assign" &&
    deviation.owner_user_id !== null &&
    deviation.owner_user_id !== (text("owner") ? Number(text("owner")) : null)
  if ((reassigned || ["severity", "cancel"].includes(action)) && !text("reason")) {
    throw new Error("Nhập lý do thao tác.")
  }
  let fields: Record<string, unknown> = {}
  switch (action) {
    case "update_action":
      fields = {
        p_immediate_action: text("immediate"),
        p_cause: text("cause"),
        p_evidence: text("evidence"),
      }
      break
    case "assign":
      fields = {
        p_owner_user_id: text("owner") ? Number(text("owner")) : null,
        p_due_at: text("due") ? new Date(String(text("due"))).toISOString() : null,
      }
      break
    case "severity":
      fields = { p_severity: text("severity") }
      break
    case "close":
      fields = { p_verification_result: text("verification") }
      break
    case "link_repair":
      fields = { p_repair_request_id: text("repair") ? Number(text("repair")) : null }
      break
  }
  return {
    p_deviation_id: deviation.id,
    p_expected_revision: deviation.revision,
    p_action: action,
    p_reason: text("reason"),
    ...fields,
  }
}

/** Describe immutable original and effective readings. */
export function temperatureReadingDetails(
  reading: TemperatureReading | undefined,
  timestamp: (value: string) => string
) {
  return reading
    ? [
        ["Số đo gốc", reading.reading.value_c ?? reading.reading.unable_reason?.reason ?? "—"],
        [
          "Số đo hiệu lực",
          reading.effective.value_c ?? reading.effective.unable_reason?.reason ?? "—",
        ],
        ["Người ghi", `#${reading.reading.operator_user_id}`],
        [
          "Đo / Nhập",
          `${timestamp(reading.reading.captured_at)} / ${timestamp(reading.reading.created_at)}`,
        ],
        ["Trạng thái", reading.review_required ? "Chờ xác nhận" : "Đã xác nhận"],
        ...(reading.pending_amendment
          ? [
              [
                "Đề xuất",
                `${reading.pending_amendment.value_c ?? reading.pending_amendment.unable_reason?.reason} · ${reading.pending_amendment.reason}`,
              ],
            ]
          : []),
      ]
    : []
}
