"use client"

import { useEffect, useRef, useState } from "react"
import { readBoundedBody } from "@/lib/ai/bff-broker/BoundedBody"
import {
  TEMPERATURE_EXPORT_MAX_BYTES,
  temperatureExportSchema,
} from "@/lib/temperature-monitoring-export-contract"

/** Fetch only the completed binary; the browser never receives observation pages. */
export function useTemperatureExport(initial: { from: string; to: string }) {
  const [range, setRange] = useState(initial)
  const [status, setStatus] = useState("")
  const [phase, setPhase] = useState<"idle" | "preparing" | "downloading">("idle")
  const [message, setMessage] = useState("")
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  const parsed = temperatureExportSchema.safeParse({ ...range, ...(status ? { status } : {}) })
  async function download(equipment: number | null, shift: string) {
    if (active.current) return
    const filter = temperatureExportSchema.safeParse({
      ...range,
      equipment,
      ...(shift ? { shift } : {}),
      ...(status ? { status } : {}),
    })
    if (!filter.success) {
      setMessage("Chọn ngày hợp lệ trong cùng một năm. Các năm khác xuất riêng.")
      return
    }
    const controller = new AbortController()
    active.current = controller
    setPhase("preparing")
    setMessage("")
    try {
      const response = await fetch("/api/temperature-monitoring/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter.data),
        signal: controller.signal,
      })
      if (!response.ok) {
        const text = new TextDecoder().decode(
          await readBoundedBody(response.body, 4096, controller.signal)
        )
        const error: unknown = JSON.parse(text)
        throw new Error(
          error && typeof error === "object" && "error" in error && typeof error.error === "string"
            ? error.error
            : "Không thể xuất Excel."
        )
      }
      if (
        !response.headers
          .get("content-type")
          ?.startsWith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      )
        throw new Error("File Excel không hợp lệ.")
      setPhase("downloading")
      const bytes = await readBoundedBody(
        response.body,
        TEMPERATURE_EXPORT_MAX_BYTES,
        controller.signal
      )
      controller.signal.throwIfAborted()
      const length = Number(response.headers.get("content-length"))
      if (!bytes.length || (length && length !== bytes.length))
        throw new Error("Tải file chưa hoàn tất. Vui lòng thử lại.")
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes)], { type: response.headers.get("content-type")! })
      )
      const link = document.createElement("a")
      link.href = url
      link.download = `temperature-${range.from}-${range.to}.xlsx`
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage("Đã tải file Excel.")
    } catch (error) {
      setMessage(
        controller.signal.aborted
          ? "Đã hủy xuất Excel."
          : error instanceof Error
            ? error.message
            : "Không thể xuất Excel. Vui lòng thử lại."
      )
    } finally {
      active.current = null
      setPhase("idle")
    }
  }
  return {
    range,
    setRange,
    status,
    setStatus,
    phase,
    message,
    valid: parsed.success,
    download,
    cancel: () => active.current?.abort(),
  }
}
