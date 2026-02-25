export type KeyedText = { key: string; text: string }

/**
 * Converts a string array into keyed rows with deterministic, unique keys.
 * Duplicate strings receive an incrementing suffix in first-seen order:
 *   ['error', 'error'] → [{key:'error-1',...}, {key:'error-2',...}]
 */
export function toKeyedTexts(strings: string[]): KeyedText[] {
  const counts = new Map<string, number>()
  return strings.map((text) => {
    const n = (counts.get(text) ?? 0) + 1
    counts.set(text, n)
    return { key: `${text}-${n}`, text }
  })
}
