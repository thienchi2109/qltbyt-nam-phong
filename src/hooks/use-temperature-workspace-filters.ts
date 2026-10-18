"use client"

import { useState } from "react"
import { format, subDays } from "date-fns"
import { useTemperatureWorkspace } from "@/hooks/use-temperature-monitoring"
import {
  TEMPERATURE_SLOT_STATUSES,
  TEMPERATURE_DEVIATION_STATUSES,
} from "@/lib/temperature-monitoring"

/** Translate independent filters to the existing bounded RPC contract. */
function workspaceArguments({
  tab,
  range,
  entryDate,
  equipment,
  historyDeviations,
  status,
  historyKind,
  deviationStatus,
  shift,
  cursor,
}: {
  tab: string
  range: { from: string; to: string }
  entryDate: string
  equipment: number | null
  historyDeviations: boolean
  status: string
  historyKind: string
  deviationStatus: string
  shift: string
  cursor: Record<string, unknown> | null
}) {
  return {
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
  }
}

/** Keep current/history filters, paging and their server query together. */
export function useTemperatureWorkspaceFilters(
  params: URLSearchParams,
  equipment: number | null,
  onReset: () => void
) {
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
  const [cursor, setCursor] = useState<Record<string, unknown> | null>(null)
  const validRange =
    range.from <= range.to && (Date.parse(range.to) - Date.parse(range.from)) / 86400000 < 90
  const query = useTemperatureWorkspace(
    workspaceArguments({
      tab,
      range,
      entryDate,
      equipment,
      historyDeviations,
      status,
      historyKind,
      deviationStatus,
      shift,
      cursor,
    }),
    tab === "current" || validRange
  )
  const rows = query.data?.items ?? []
  const setPreset = (days: string) => {
    if (days !== "custom")
      setRange({
        from: format(subDays(new Date(), Number(days) - 1), "yyyy-MM-dd"),
        to: format(new Date(), "yyyy-MM-dd"),
      })
    setCursor(null)
    onReset()
  }
  return {
    tab,
    setTab,
    range,
    setRange,
    status,
    setStatus,
    historyKind,
    historyDeviations,
    deviationStatus,
    setDeviationStatus,
    shift,
    setShift,
    entryDate,
    setEntryDate,
    cursor,
    setCursor,
    query,
    rows,
    validRange,
    setPreset,
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
  }
}
