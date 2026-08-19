import { TechnicalConfigurationRpcError } from "./technical-configuration-rpc"

/** MIME type used for baseline workbook downloads. */
export const BASELINE_WORKBOOK_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** Returns an actionable import error while preserving a stable fallback. */
export function getBaselineImportErrorMessage(error: unknown, fallback: string): string {
  if (
    error instanceof TechnicalConfigurationRpcError &&
    error.message === "template_mismatch" &&
    error.details === "template metadata does not match the target"
  ) {
    return 'Workbook thuộc hồ sơ khác. Hãy dùng "Sao chép từ hồ sơ khác" thay vì nhập Excel.'
  }
  if (!(error instanceof Error) || !error.message) return fallback
  return error.message
}
