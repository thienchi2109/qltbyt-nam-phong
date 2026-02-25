export type KeyedText = { key: string; text: string }

export interface ToKeyedTextsOptions {
  getStableId?: (text: string, index: number) => string | number | null | undefined
}

/**
 * Converts a string array into keyed rows with deterministic, unique keys.
 * Duplicate strings receive an incrementing suffix in first-seen order:
 *   ['error', 'error'] → [{key:'error-1',...}, {key:'error-2',...}]
 */
export function toKeyedTexts(strings: string[], options: ToKeyedTextsOptions = {}): KeyedText[] {
  const { getStableId } = options
  const textCounts = new Map<string, number>()
  const stableKeyCounts = new Map<string, number>()

  return strings.map((text, index) => {
    const stableId = getStableId?.(text, index)
    const normalizedStableId =
      stableId === null || stableId === undefined
        ? ''
        : typeof stableId === 'string'
          ? stableId.trim()
          : String(stableId)

    if (normalizedStableId.length > 0) {
      const baseStableKey = `id-${normalizedStableId}`
      const n = (stableKeyCounts.get(baseStableKey) ?? 0) + 1
      stableKeyCounts.set(baseStableKey, n)
      return { key: n === 1 ? baseStableKey : `${baseStableKey}-${n}`, text }
    }

    const n = (textCounts.get(text) ?? 0) + 1
    textCounts.set(text, n)
    return { key: `${text}-${n}`, text }
  })
}
