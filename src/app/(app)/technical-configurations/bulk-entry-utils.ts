export interface TechnicalConfigurationBulkEntryRow {
  sourceLine: number
  requirementText: string
  error: string | null
}

export interface TechnicalConfigurationBulkEntryPreview {
  rows: TechnicalConfigurationBulkEntryRow[]
  canAccept: boolean
}

const REQUIRED_TEXT_ERROR = "Nội dung yêu cầu là bắt buộc."

/** Removes whitespace and invisible separators only from text edges. */
export function normalizeTechnicalConfigurationBulkEntryText(input: string): string {
  return input.replace(/^[\s\u200B\u2060]+|[\s\u200B\u2060]+$/g, "")
}

/** Parses pasted criteria while preserving internal blank rows for validation. */
export function parseTechnicalConfigurationBulkEntry(
  input: string
): TechnicalConfigurationBulkEntryPreview {
  const sourceLines = input.replace(/\r\n?/g, "\n").split("\n")
  const firstContentIndex = sourceLines.findIndex(
    (line) => normalizeTechnicalConfigurationBulkEntryText(line).length > 0
  )

  if (firstContentIndex === -1) {
    return { rows: [], canAccept: false }
  }

  let lastContentIndex = sourceLines.length - 1
  while (
    lastContentIndex > firstContentIndex &&
    normalizeTechnicalConfigurationBulkEntryText(sourceLines[lastContentIndex]).length === 0
  ) {
    lastContentIndex -= 1
  }

  const rows = sourceLines
    .slice(firstContentIndex, lastContentIndex + 1)
    .map((line, index): TechnicalConfigurationBulkEntryRow => {
      const requirementText = normalizeTechnicalConfigurationBulkEntryText(line)
      return {
        sourceLine: firstContentIndex + index + 1,
        requirementText,
        error: requirementText ? null : REQUIRED_TEXT_ERROR,
      }
    })

  return {
    rows,
    canAccept: rows.length > 0 && rows.every((row) => row.error === null),
  }
}
