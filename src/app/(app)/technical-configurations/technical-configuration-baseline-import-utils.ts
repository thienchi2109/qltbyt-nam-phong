/** MIME type used for baseline workbook downloads. */
export const BASELINE_WORKBOOK_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** Returns an actionable import error while preserving a stable fallback. */
export function getBaselineImportErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback
  return error.message
}
