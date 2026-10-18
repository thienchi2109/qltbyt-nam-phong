"use client"

import { useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { format, subDays } from "date-fns"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  useTemperatureMutation,
  useTemperatureQuery,
  useTemperatureWorkspace,
} from "@/hooks/use-temperature-monitoring"
import { isGlobalRole } from "@/lib/rbac"
import {
  currentTemperatureSlot,
  validateTemperatureCapture,
  temperatureLocalTime,
  temperatureDeviationFields,
  TEMPERATURE_DEVIATION_ACTIONS,
  TEMPERATURE_SLOT_STATUSES,
  TEMPERATURE_DEVIATION_STATUSES,
  TEMPERATURE_EMPTY_MESSAGES,
  temperatureCardMeta,
  temperatureDeviationArguments,
  focusTemperatureField,
  temperatureReadingDetails,
} from "@/lib/temperature-monitoring"
import type {
  TemperatureSlot,
  TemperatureReading,
  TemperatureDeviation,
  TemperatureStaff,
} from "@/types/temperature-monitoring"

/** Manage scoped logbook persistence and accessible interaction state. */
export function useTemperatureLogbook() {
  const params = useSearchParams()
  const { data: session } = useSession()
  const role = session?.user?.role
  const actor = Number(session?.user?.id)
  const manager = isGlobalRole(role) || role === "to_qltb"
  const writer = manager || ["user", "technician", "qltb_khoa"].includes(role ?? "")
  const mobile = useIsMobile()
  const equipment = Number(params.get("equipment")) || null
  const [tab, setTab] = useState(() =>
    params.has("date") || params.has("kind") ? "history" : "current"
  )
  const [range, setRange] = useState(() => ({
    from: params.get("date") ?? params.get("from") ?? format(subDays(new Date(), 29), "yyyy-MM-dd"),
    to: params.get("date") ?? params.get("to") ?? format(new Date(), "yyyy-MM-dd"),
  }))
  const [status, setStatus] = useState("")
  const [historyKind, setHistoryKind] = useState(() => params.get("kind") ?? "readings")
  const historyDeviations = ["deviations", "open_deviations"].includes(historyKind)
  const [deviationStatus, setDeviationStatus] = useState("")
  const [shift, setShift] = useState("")
  const [entryDate, setEntryDate] = useState("")
  const [chosenDeviationAction, setDeviationAction] = useState("update_action")
  const [cursor, setCursor] = useState<Record<string, unknown> | null>(null)
  const [selected, setSelected] = useState<TemperatureSlot | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [message, setMessage] = useState("")
  const [eventCursor, setEventCursor] = useState<string | null>(null)
  const [showEvents, setShowEvents] = useState(false)
  const mutation = useTemperatureMutation()
  const requestRef = useRef({ key: "", id: "" })
  const triggerRef = useRef<HTMLElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const validRange =
    range.from <= range.to && (Date.parse(range.to) - Date.parse(range.from)) / 86400000 < 90
  const query = useTemperatureWorkspace(
    {
      ...(tab === "history"
        ? { p_from_date: range.from, p_to_date: range.to }
        : entryDate
          ? { p_from_date: entryDate, p_to_date: entryDate }
          : {}),
      p_equipment_id: equipment,
      p_status:
        tab === "current" && !entryDate
          ? "current"
          : tab === "history" && !historyDeviations
            ? status || null
            : null,
      p_kind: tab === "history" ? historyKind : "readings",
      p_deviation_status: tab === "history" && historyDeviations ? deviationStatus || null : null,
      p_shift_codes: shift ? [shift] : null,
      p_cursor: cursor,
      p_limit: 50,
    },
    tab === "current" || validRange
  )
  const rows = query.data?.items ?? []
  let automatic: TemperatureSlot | null = null
  if (equipment && !dismissed && !cursor) {
    if (params.has("reading"))
      automatic = rows.find((row) => row.reading_id === params.get("reading")) ?? null
    else if (tab === "current")
      automatic = currentTemperatureSlot(rows, query.data?.server_now ?? "")
  }
  const slot = selected ?? automatic
  const readingQuery = useTemperatureQuery<TemperatureReading>(
    "temperature_monitoring_reading_get",
    { p_reading_id: slot?.reading_id },
    !!slot?.reading_id
  )
  const reading = readingQuery.data
  const deviationQuery = useTemperatureQuery<{ deviation: TemperatureDeviation | null }>(
    "temperature_monitoring_deviation_get",
    { p_reading_id: slot?.reading_id },
    !!slot?.reading_id
  )
  const deviation = deviationQuery.data?.deviation
  const [staffCursor, setStaffCursor] = useState<number | null>(null)
  const staff = useTemperatureQuery<TemperatureStaff>(
    "temperature_monitoring_staff_choices",
    { p_equipment_id: slot?.equipment_id, p_cursor: staffCursor, p_limit: 100 },
    manager && !!slot
  )
  const captureDefault =
    slot && query.data && currentTemperatureSlot([slot], query.data.server_now)
      ? temperatureLocalTime(query.data.server_now, slot.display_timezone ?? "Asia/Ho_Chi_Minh")
      : ""
  const captureInput = {
    name: "captured",
    type: "datetime-local",
    required: true,
    step: "1",
    defaultValue: captureDefault,
  }
  const readingTextFields = [
    { name: "reason", label: "Lý do không đo được" },
    { name: "note", label: "Ghi chú" },
  ]
  const deviationActions = TEMPERATURE_DEVIATION_ACTIONS.filter(
    (action) =>
      (manager || !action.manager) &&
      !["Đã đóng", "Đã hủy"].includes(deviation?.status ?? "") &&
      (!action.statuses || action.statuses.includes(deviation?.status ?? ""))
  )
  const deviationAction = deviationActions.some((action) => action.value === chosenDeviationAction)
    ? chosenDeviationAction
    : "update_action"
  const deviationFields = temperatureDeviationFields(deviation, deviationAction)
  const eventLabels: Record<string, string> = {
    reading_created: "Ghi số đo",
    deviation_created: "Mở sai lệch",
    amendment_proposed: "Đề xuất sửa",
    amendment_approved: "Duyệt đề xuất",
    amendment_rejected: "Từ chối đề xuất",
    reading_confirmed: "Xác nhận số đo",
    reading_reopened: "Mở lại xét duyệt",
  }
  const events = useTemperatureQuery<{
    events: {
      id: string
      event_type: string
      reason: string | null
      created_at: string
      actor_user_id: number
    }[]
    next_cursor: string | null
  }>(
    "temperature_monitoring_reading_history",
    {
      p_equipment_id: slot?.equipment_id,
      p_from_date: slot?.monitoring_date,
      p_to_date: slot?.monitoring_date,
      p_cursor: eventCursor,
    },
    !!slot && showEvents
  )
  const independent =
    manager &&
    !!reading &&
    actor !== reading.reading.operator_user_id &&
    actor !== reading.effective.author_user_id &&
    actor !== reading.pending_amendment?.author_user_id
  const queryErrors = [
    { query: readingQuery, label: "số đo" },
    { query: deviationQuery, label: "xử lý sai lệch" },
    { query: events, label: "nhật ký" },
  ]
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
  const timestamp = (value: string | null, zone = slot?.display_timezone) =>
    value ? new Date(value).toLocaleString("vi-VN", { timeZone: zone }) : "—"
  const openSlot = (row: TemperatureSlot) => {
    dirtyRef.current = false
    triggerRef.current = document.activeElement as HTMLElement | null
    setSelected(row)
    setMessage("")
    setShowEvents(false)
    setEventCursor(null)
  }
  const closeSheet = () => {
    if (savingRef.current || mutation.isPending) {
      setMessage("Đang lưu, vui lòng đợi.")
      return
    }
    if (dirtyRef.current && !window.confirm("Dữ liệu chưa lưu. Đóng và bỏ thay đổi?")) return
    dirtyRef.current = false
    setSelected(null)
    setDismissed(true)
    setMessage("")
  }
  const restoreFocus = (event: Event) => {
    const target = triggerRef.current?.isConnected ? triggerRef.current : headingRef.current
    if (target) {
      event.preventDefault()
      target.focus()
    }
  }
  const resetPage = () => {
    setCursor(null)
    setSelected(null)
    setDismissed(false)
  }
  const setPreset = (days: string) => {
    if (days !== "custom")
      setRange({
        from: format(subDays(new Date(), Number(days) - 1), "yyyy-MM-dd"),
        to: format(new Date(), "yyyy-MM-dd"),
      })
    resetPage()
  }
  const run = async (fn: string, args: Record<string, unknown>) => {
    setMessage("")
    savingRef.current = true
    try {
      const result = await mutation.mutateAsync({ fn, args })
      if (result.outcome !== "conflict") dirtyRef.current = false
      setMessage(
        result.outcome === "conflict"
          ? "Dữ liệu đã thay đổi. Đã tải lại; kiểm tra trước khi gửi lại."
          : "Đã lưu."
      )
      return result
    } catch (error) {
      setMessage("Không lưu được. Kiểm tra quyền và dữ liệu rồi thử lại; dữ liệu nhập vẫn còn.")
      return null
    } finally {
      savingRef.current = false
    }
  }
  const submitReading = async (form: FormData) => {
    if (!slot) return
    let invalidName = form.get("unable") === "on" ? "reason" : "value"
    try {
      const unable = form.get("unable") === "on"
      const value = String(form.get("value") ?? "")
      const reason = String(form.get("reason") ?? "").trim()
      if ((!unable && !value) || (unable && !reason))
        throw new Error("Nhập nhiệt độ hoặc lý do không đo được.")
      invalidName = "captured"
      const result = await run("temperature_monitoring_measurement_create", {
        p_equipment_id: slot.equipment_id,
        p_monitoring_date: slot.monitoring_date,
        p_shift_id: slot.shift_id,
        p_value_c: unable ? null : Number(value),
        p_unable_reason: unable ? reason : null,
        p_captured_at: validateTemperatureCapture(
          slot,
          String(form.get("captured") ?? ""),
          new Date(
            Date.parse(query.data?.server_now ?? "") + Date.now() - query.dataUpdatedAt
          ).toISOString()
        ),
        p_note: String(form.get("note") ?? "") || null,
      })
      if (result && "reading" in result) {
        setSelected({ ...slot, reading_id: result.reading.id })
        if (
          result.effective?.value_c != null &&
          (result.effective.value_c < slot.lower_c || result.effective.value_c > slot.upper_c)
        )
          setMessage("Đã lưu số đo bất thường. Ghi xử lý ngay bên dưới hoặc chọn Để sau.")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kiểm tra dữ liệu nhập."
      setMessage(message)
      focusTemperatureField(sheetRef.current, invalidName, message)
    }
  }
  const submitReview = (form: FormData) => {
    if (!slot || !reading) return
    const action = String(form.get("action"))
    if (
      action === "amend" &&
      form.get("unable") !== "on" &&
      !String(form.get("value") ?? "").trim()
    ) {
      setMessage("Nhập số đo đề xuất hoặc chọn không đo được.")
      focusTemperatureField(
        sheetRef.current,
        "value",
        "Nhập số đo đề xuất hoặc chọn không đo được."
      )
      return
    }
    const common = {
      p_reading_id: slot.reading_id,
      p_expected_revision: reading.revision,
      p_reason: String(form.get("reason")),
    }
    return action === "amend"
      ? run("temperature_monitoring_amendment_create", {
          ...common,
          p_value_c: form.get("unable") === "on" ? null : Number(form.get("value")),
          p_unable_reason: form.get("unable") === "on" ? String(form.get("unableReason")) : null,
        })
      : run("temperature_monitoring_reading_review", {
          ...common,
          p_action: action,
          p_amendment_id: action.includes("amendment") ? reading.pending_amendment?.id : null,
        })
  }
  const submitDeviation = (form: FormData) => {
    if (!deviation) return
    try {
      const args = temperatureDeviationArguments(deviation, form)
      const key = JSON.stringify(args)
      if (requestRef.current.key !== key) requestRef.current = { key, id: crypto.randomUUID() }
      return run("temperature_monitoring_deviation_update", {
        ...args,
        p_request_id: requestRef.current.id,
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kiểm tra dữ liệu nhập.")
      if (error instanceof Error && error.message === "Nhập lý do thao tác.")
        focusTemperatureField(sheetRef.current, "reason", error.message)
    }
  }
  return {
    reviewTextFields: [
      { name: "unableReason", label: "Lý do không đo được", required: false },
      { name: "reason", label: "Lý do thao tác", required: true },
    ],
    sheetRef,
    selectedLoading: !!slot?.reading_id && (readingQuery.isPending || deviationQuery.isPending),
    headingRef,
    markDirty: () => {
      dirtyRef.current = true
      sheetRef.current
        ?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
          "input,textarea,select"
        )
        .forEach((field) => field.setCustomValidity(""))
    },
    cardMeta: temperatureCardMeta,
    emptyMessage: query.data?.empty_reason
      ? TEMPERATURE_EMPTY_MESSAGES[query.data.empty_reason]
      : "Không có kết quả.",
    historyFilters: [
      {
        label: "Loại lịch sử",
        value: historyKind,
        set: setHistoryKind,
        options: [
          { value: "readings", label: "Ô đo" },
          { value: "deviations", label: "Sai lệch" },
          { value: "review_queue", label: "Chờ xác nhận độc lập" },
          { value: "open_deviations", label: "Sai lệch mở" },
        ],
      },
      {
        label: "Trạng thái",
        value: historyDeviations ? deviationStatus : status,
        set: historyDeviations ? setDeviationStatus : setStatus,
        options: [
          "",
          ...(historyDeviations ? TEMPERATURE_DEVIATION_STATUSES : TEMPERATURE_SLOT_STATUSES),
        ].map((value) => ({ value, label: value || "Tất cả" })),
      },
    ],
    readingDetails: temperatureReadingDetails(reading, timestamp),
    openSlot,
    closeSheet,
    restoreFocus,
    deviationActions,
    reviewActions,
    captureInput,
    readingTextFields,
    queryErrors,
    captureDefault,
    entryDate,
    setEntryDate,
    deviationAction,
    setDeviationAction,
    setPreset,
    deviationFields,
    eventLabels,
    staff,
    staffCursor,
    setStaffCursor,
    tab,
    setTab,
    range,
    setRange,
    status,
    setStatus,
    shift,
    setShift,
    cursor,
    setCursor,
    setSelected,
    setDismissed,
    message,
    setMessage,
    eventCursor,
    setEventCursor,
    showEvents,
    setShowEvents,
    mutation,
    validRange,
    query,
    rows,
    slot,
    readingQuery,
    reading,
    deviationQuery,
    deviation,
    events,
    independent,
    timestamp,
    resetPage,
    submitReading,
    submitReview,
    submitDeviation,
    writer,
    manager,
    mobile,
  }
}
