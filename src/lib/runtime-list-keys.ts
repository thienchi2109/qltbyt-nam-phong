import type { ChartData } from '@/lib/chart-utils'
import { toKeyedTexts, type KeyedText } from '@/lib/list-key-utils'

export interface PerformanceAlertKeyInput {
  timestamp: string
  type: string
  message: string
}

export interface TooltipEntryLike {
  dataKey?: unknown
  name?: unknown
}

export interface KeyedTooltipEntry<T> {
  key: string
  entry: T
}

export interface PieSliceCell {
  key: string
  fill: string
}

const UNKNOWN_KEY_LABEL = 'unknown'

const normalizeKeyPart = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  return String(value).trim()
}

export function buildPerformanceAlertKey(alert: PerformanceAlertKeyInput): string {
  return `${alert.timestamp}-${alert.type}-${alert.message}`
}

export interface KeyedAlert<T> {
  key: string
  alert: T
}

export function buildKeyedAlerts<T extends PerformanceAlertKeyInput>(
  alerts: T[],
): KeyedAlert<T>[] {
  const rawKeys = alerts.map((a) => buildPerformanceAlertKey(a))
  const keyed = toKeyedTexts(rawKeys)
  return alerts.map((alert, index) => ({
    key: keyed[index].key,
    alert,
  }))
}

export function buildKeyedSuggestions(suggestions: string[]): KeyedText[] {
  return toKeyedTexts(suggestions)
}

export function buildKeyedTooltipEntries<T extends TooltipEntryLike>(
  entries: T[],
): KeyedTooltipEntry<T>[] {
  const rawKeys = entries.map((entry) => {
    const fromDataKey = normalizeKeyPart(entry.dataKey)
    if (fromDataKey.length > 0) return fromDataKey

    const fromName = normalizeKeyPart(entry.name)
    if (fromName.length > 0) return fromName

    return UNKNOWN_KEY_LABEL
  })

  const keyed = toKeyedTexts(rawKeys)
  return entries.map((entry, index) => ({
    key: keyed[index].key,
    entry,
  }))
}

export function buildPieSliceCells(data: ChartData[], nameKey: string, colors: string[]): PieSliceCell[] {
  const safeColors = colors.length > 0 ? colors : ['#000000']
  const labels = data.map((entry) => {
    const fromNameKey = normalizeKeyPart(entry?.[nameKey])
    return fromNameKey.length > 0 ? fromNameKey : UNKNOWN_KEY_LABEL
  })
  const keyedLabels = toKeyedTexts(labels)

  return keyedLabels.map((item, index) => ({
    key: item.key,
    fill: safeColors[index % safeColors.length],
  }))
}
