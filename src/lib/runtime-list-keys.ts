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

/** Builds stable tooltip entry keys from data keys or names. */
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

function getPieSliceFill(entry: ChartData, index: number, colors: string[], colorKey: string) {
  if (colors.length > 0) return colors[index % colors.length]

  const fill = entry[colorKey]
  return typeof fill === 'string' && fill.length > 0 ? fill : '#000000'
}

/** Builds stable pie slice keys and fills for Recharts cells. */
export function buildPieSliceCells(
  data: ChartData[],
  nameKey: string,
  colors: string[] = [],
  colorKey = 'color',
): PieSliceCell[] {
  const labels = data.map((entry) => {
    const fromNameKey = normalizeKeyPart(entry?.[nameKey])
    return fromNameKey.length > 0 ? fromNameKey : UNKNOWN_KEY_LABEL
  })
  const keyedLabels = toKeyedTexts(labels)

  return keyedLabels.map((item, index) => ({
    key: item.key,
    fill: getPieSliceFill(data[index] ?? {}, index, colors, colorKey),
  }))
}
