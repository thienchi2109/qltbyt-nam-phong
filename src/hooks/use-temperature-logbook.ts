"use client"

import * as temperatureSelectors from "@/lib/temperature-logbook-selectors"
import { createElement, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useTemperatureWorkspaceFilters } from "@/hooks/use-temperature-workspace-filters"
import { useIsMobile } from "@/hooks/use-mobile"
import { useTemperatureMutation, useTemperatureQuery } from "@/hooks/use-temperature-monitoring"
import { isGlobalRole } from "@/lib/rbac"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import {
  validateTemperatureCapture,
  temperatureDeviationFields,
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
  const [chosenDeviationAction, setDeviationAction] = useState("update_action")
  const [selected, setSelected] = useState<TemperatureSlot | null>(null)
  const [conflictReadingId, setConflictReadingId] = useState<string | null>(null)
  const [conflictViewed, setConflictViewed] = useState(false)
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
  const closePromptRef = useRef<{
    id: string
    generation: number
    slotKey: string
    actor: number
    dismiss: () => void
  } | null>(null)
  const closePromptGenerationRef = useRef(0)
  const actorRef = useRef(actor)
  const { toast } = useToast()
  const filters = useTemperatureWorkspaceFilters(params, equipment, () => {
    setSelected(null)
    setDismissed(false)
  })
  const { tab, cursor, setCursor, query, rows } = filters
  const slot =
    selected ??
    temperatureSelectors.automaticTemperatureSlot(
      equipment,
      dismissed,
      cursor,
      params,
      tab,
      rows,
      query.data?.server_now ?? ""
    )
  const slotKey = temperatureSelectors.temperatureSlotKey(slot)
  const liveIdentityRef = useRef({ slotKey, actor })
  useLayoutEffect(() => {
    liveIdentityRef.current = { slotKey, actor }
  }, [slotKey, actor])
  const activeReadingId = slot?.reading_id ?? (conflictViewed ? conflictReadingId : null)
  const readingQuery = useTemperatureQuery<TemperatureReading>(
    "temperature_monitoring_reading_get",
    { p_reading_id: activeReadingId },
    !!activeReadingId
  )
  const reading = readingQuery.data
  const deviationQuery = useTemperatureQuery<{ deviation: TemperatureDeviation | null }>(
    "temperature_monitoring_deviation_get",
    { p_reading_id: activeReadingId },
    !!activeReadingId
  )
  const deviation = deviationQuery.data?.deviation
  const [staffCursor, setStaffCursor] = useState<number | null>(null)
  const staff = useTemperatureQuery<TemperatureStaff>(
    "temperature_monitoring_staff_choices",
    { p_equipment_id: slot?.equipment_id, p_cursor: staffCursor, p_limit: 100 },
    manager && !!slot
  )
  const captureDefault = temperatureSelectors.temperatureCaptureDefault(
    slot,
    query.data?.server_now
  )
  const captureInput = {
    ...temperatureSelectors.TEMPERATURE_CAPTURE_INPUT,
    defaultValue: captureDefault,
  }
  const readingTextFields = temperatureSelectors.TEMPERATURE_READING_TEXT_FIELDS
  const { deviationActions, deviationAction } = temperatureSelectors.temperatureDeviationSelection(
    manager,
    deviation?.status,
    chosenDeviationAction
  )
  const deviationFields = temperatureDeviationFields(deviation, deviationAction)
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
  const queryErrors = temperatureSelectors.temperatureQueryErrors(
    readingQuery,
    deviationQuery,
    events
  )
  const { independent, reviewActions } = temperatureSelectors.temperatureReviewActions(
    manager,
    actor,
    reading
  )
  const clearClosePrompt = () => {
    const prompt = closePromptRef.current
    closePromptRef.current = null
    closePromptGenerationRef.current += 1
    prompt?.dismiss()
  }
  const resetSheetDraft = () => {
    clearClosePrompt()
    dirtyRef.current = false
    setConflictReadingId(null)
    setConflictViewed(false)
  }
  const closeSheetNow = (wasDismissed: boolean) => {
    resetSheetDraft()
    setSelected(null)
    setDismissed(wasDismissed)
  }
  useEffect(() => {
    if (!Object.is(actorRef.current, actor)) {
      actorRef.current = actor
      closeSheetNow(false)
      setMessage("")
      return
    }
    const prompt = closePromptRef.current
    if (prompt && (prompt.slotKey !== slotKey || prompt.actor !== actor)) clearClosePrompt()
  }, [slotKey, actor])
  useEffect(
    () => () => {
      closePromptRef.current?.dismiss()
      closePromptRef.current = null
    },
    []
  )
  const timestamp = (value: string | null, zone = slot?.display_timezone) =>
    value ? new Date(value).toLocaleString("vi-VN", { timeZone: zone }) : "—"
  const openSlot = (row: TemperatureSlot) => {
    resetSheetDraft()
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
    if (dirtyRef.current) {
      clearClosePrompt()
      const generation = ++closePromptGenerationRef.current
      setMessage("Bản nháp vẫn được giữ. Xác nhận bỏ thay đổi để đóng sổ nhiệt độ.")
      const onDiscard = () => {
        const active = closePromptRef.current
        if (
          !active ||
          active.generation !== generation ||
          active.slotKey !== liveIdentityRef.current.slotKey ||
          active.actor !== liveIdentityRef.current.actor
        )
          return
        if (savingRef.current || mutation.isPending) {
          setMessage("Đang lưu, vui lòng đợi.")
          clearClosePrompt()
          return
        }
        closeSheetNow(true)
        setMessage("")
      }
      const action = createElement(
        ToastAction,
        { altText: "Bỏ thay đổi và đóng sổ nhiệt độ", className: "mt-3 h-11", onClick: onDiscard },
        "Bỏ thay đổi và đóng"
      )
      const prompt = toast({
        title: "Thay đổi chưa lưu",
        description:
          "Bản nháp chưa lưu vẫn được giữ. Chọn bỏ thay đổi để đóng và xóa dữ liệu đã nhập.",
        action: sheetRef.current ? createPortal(action, sheetRef.current) : action,
        onOpenChange: (open) => {
          if (open) return
          const active = closePromptRef.current
          if (active?.generation === generation) {
            closePromptRef.current = null
            closePromptGenerationRef.current += 1
            setMessage("")
          }
        },
      })
      closePromptRef.current = {
        id: prompt.id,
        generation,
        slotKey,
        actor,
        dismiss: prompt.dismiss,
      }
      return
    }
    closeSheetNow(true)
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
    closeSheetNow(false)
    setCursor(null)
  }
  const run = async (fn: string, args: Record<string, unknown>) => {
    setMessage("")
    savingRef.current = true
    try {
      const result = await mutation.mutateAsync({ fn, args })
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
        if (result.outcome === "conflict") {
          dirtyRef.current = true
          setSelected(slot)
          setConflictReadingId(result.reading.id)
          setConflictViewed(false)
          setMessage("Bản nháp chưa được lưu. Xem bản ghi hiện tại trước khi đề xuất điều chỉnh.")
          return
        }
        dirtyRef.current = false
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
      p_reading_id: activeReadingId,
      p_expected_revision: reading.revision,
      p_reason: String(form.get("reason")),
    }
    const result =
      action === "amend"
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
    return result?.then((value) => {
      if (!conflictReadingId && value?.outcome !== "conflict") dirtyRef.current = false
      return value
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
      }).then((result) => {
        if (!conflictReadingId && result?.outcome !== "conflict") dirtyRef.current = false
        return result
      })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kiểm tra dữ liệu nhập.")
      if (error instanceof Error && error.message === "Nhập lý do thao tác.")
        focusTemperatureField(sheetRef.current, "reason", error.message)
    }
  }
  return {
    ...filters,
    reviewTextFields: temperatureSelectors.TEMPERATURE_REVIEW_TEXT_FIELDS,
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
    deviationAction,
    setDeviationAction,
    deviationFields,
    eventLabels: temperatureSelectors.TEMPERATURE_EVENT_LABELS,
    staff,
    staffCursor,
    setStaffCursor,
    setSelected,
    setDismissed,
    message,
    setMessage,
    eventCursor,
    setEventCursor,
    showEvents,
    setShowEvents,
    mutation,
    slot,
    conflictReadingId,
    conflictViewed,
    viewConflictReading: () => setConflictViewed(true),
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
