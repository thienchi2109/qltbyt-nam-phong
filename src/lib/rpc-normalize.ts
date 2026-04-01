/**
 * Shared runtime normalization primitives for unknown RPC payloads.
 * Eliminates duplicated type-guard helpers across hook modules.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

export function toNullableNumber(value: unknown): number | null {
  return toNumber(value) ?? null
}

export function toNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

export function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function getDateOnly(value: unknown): string | undefined {
  const raw = toStringValue(value)
  return raw ? raw.split('T')[0] : undefined
}

export function isWithinDateRange(value: unknown, fromDate: string, toDate: string): boolean {
  const dateOnly = getDateOnly(value)
  return !!dateOnly && dateOnly >= fromDate && dateOnly <= toDate
}
