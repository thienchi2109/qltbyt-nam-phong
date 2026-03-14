import type { UIMessage } from 'ai'

export interface EquipmentLookupHints {
  verbatimIdentifiers: string[]
}

function trimToken(raw: string): string {
  return raw.replace(/^[`"'([{<]+|[`"',.;:!?)\]}>]+$/g, '')
}

function normalizeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function isLikelyEquipmentIdentifier(token: string): boolean {
  const trimmed = token.trim()
  if (trimmed.length < 8 || trimmed.length > 80 || /\s/.test(trimmed)) {
    return false
  }

  const digitCount = (trimmed.match(/\d/g) ?? []).length
  const hasLetter = /[a-zA-Z]/.test(trimmed)
  const hasStructure = /[()./_-]/.test(trimmed)

  return digitCount >= 4 && hasLetter && hasStructure
}

function getLatestUserText(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'user' || !Array.isArray(message.parts)) {
      continue
    }

    const text = message.parts
      .map(part => {
        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          part.type === 'text' &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          return part.text
        }

        return ''
      })
      .filter(Boolean)
      .join(' ')
      .trim()

    if (text) {
      return text
    }
  }

  return ''
}

function resolveVerbatimIdentifier(
  candidate: string | undefined,
  identifiers: string[],
): string | null {
  if (!candidate) {
    return null
  }

  const trimmed = candidate.trim()
  if (!trimmed) {
    return null
  }

  const normalizedCandidate = normalizeIdentifier(trimmed)
  if (normalizedCandidate.length < 6) {
    return null
  }

  const matches = identifiers.filter(identifier => {
    const normalizedIdentifier = normalizeIdentifier(identifier)
    return (
      normalizedIdentifier === normalizedCandidate ||
      normalizedIdentifier.startsWith(normalizedCandidate) ||
      normalizedCandidate.startsWith(normalizedIdentifier)
    )
  })

  return matches.length === 1 ? matches[0] : null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function extractEquipmentLookupHints(messages: UIMessage[]): EquipmentLookupHints {
  const latestUserText = getLatestUserText(messages)
  if (!latestUserText) {
    return { verbatimIdentifiers: [] }
  }

  const verbatimIdentifiers = Array.from(
    new Set(
      latestUserText
        .split(/\s+/)
        .map(trimToken)
        .filter(isLikelyEquipmentIdentifier),
    ),
  )

  return { verbatimIdentifiers }
}

export function normalizeEquipmentLookupArgs(
  input: Record<string, unknown>,
  hints?: EquipmentLookupHints,
): Record<string, unknown> {
  const verbatimIdentifiers = hints?.verbatimIdentifiers ?? []
  if (verbatimIdentifiers.length === 0) {
    return input
  }

  const nextFilters = isPlainObject(input.filters) ? { ...input.filters } : undefined
  const rawEquipmentCode =
    typeof nextFilters?.equipmentCode === 'string' ? nextFilters.equipmentCode : undefined
  const resolvedFromFilter =
    resolveVerbatimIdentifier(rawEquipmentCode, verbatimIdentifiers) ?? rawEquipmentCode?.trim()

  const rawQuery = typeof input.query === 'string' ? input.query.trim() : undefined
  const resolvedFromQuery = resolveVerbatimIdentifier(rawQuery, verbatimIdentifiers)

  const exactEquipmentCode = resolvedFromFilter ?? resolvedFromQuery
  const nextInput: Record<string, unknown> = { ...input }

  if (rawQuery && resolvedFromQuery) {
    nextInput.query = exactEquipmentCode
  }

  if (nextFilters || exactEquipmentCode) {
    nextInput.filters = {
      ...(nextFilters ?? {}),
      ...(exactEquipmentCode ? { equipmentCode: exactEquipmentCode } : {}),
    }
  }

  return nextInput
}
