import { differenceInMinutes } from "date-fns"

import { getUsageLogFinalStatus, getUsageLogInitialStatus } from "@/lib/usage-log-status"
import { type Equipment, type UsageLog } from "@/types/database"

export type PrintableEquipment = Pick<Equipment, "ma_thiet_bi" | "ten_thiet_bi"> & Partial<Equipment>

export interface BuildUsageLogPrintHtmlArgs {
  equipment: PrintableEquipment
  filteredLogs: UsageLog[]
  tenantName: string
  tenantLogoUrl: string
  dateFrom: string
  dateTo: string
  now: Date
}

export interface BuildUsageLogCsvArgs {
  equipment: PrintableEquipment
  filteredLogs: UsageLog[]
  now: Date
}

export function escapeHtml(str: string | null | undefined): string {
  if (str == null) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function escapeUrl(url: string | null | undefined): string {
  if (url == null) return ""
  const trimmed = String(url).trim()

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return escapeHtml(trimmed)
  }

  const safeDataImagePattern = /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/]+=*$/i
  if (safeDataImagePattern.test(trimmed)) {
    return escapeHtml(trimmed)
  }

  return ""
}

export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? "" : String(value)
  const sanitized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${sanitized.replace(/"/g, '""')}"`
}

export function parseDateInputAsLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function formatDateInputForPrint(dateString: string): string {
  const [year, month, day] = dateString.split("-")
  return `${day}/${month}/${year}`
}

export function formatUsageDuration(startTime: string, endTime?: string, now = new Date()) {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : now
  const minutes = differenceInMinutes(end, start)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours > 0) {
    return `${hours} giờ ${mins} phút`
  }
  return `${mins} phút`
}

export function getPrintableInitialStatus(log: UsageLog): string {
  return getUsageLogInitialStatus(log) || ""
}

export function getPrintableFinalStatus(log: UsageLog): string {
  return getUsageLogFinalStatus(log) || ""
}
