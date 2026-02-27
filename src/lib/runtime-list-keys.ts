import type { ChartData } from '@/lib/chart-utils'
import { toKeyedTexts } from '@/lib/list-key-utils'

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
