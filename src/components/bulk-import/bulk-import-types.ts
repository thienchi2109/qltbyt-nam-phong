/**
 * Shared types for bulk import functionality
 *
 * Used by DeviceQuotaImportDialog, ImportEquipmentDialog, and future import dialogs.
 */

/**
 * Standard RPC result shape for bulk import operations
 */
export interface BulkImportRpcResult<TDetail = BulkImportDetailItem> {
  success: boolean
  inserted: number
  updated?: number
  failed: number
  total: number
  details: TDetail[]
}

/**
 * State machine for bulk import workflow
 */
export interface BulkImportState<TRow> {
  status: 'idle' | 'parsing' | 'parsed' | 'submitting' | 'success' | 'error'
  selectedFile: File | null
  parsedData: TRow[]
  parseError: string | null
  validationErrors: string[]
}

/**
 * Result of client-side validation before submission
 */
export interface ValidationResult<TRow> {
  isValid: boolean
  errors: string[]
  validRecords: TRow[]
}

/**
 * Individual item result from bulk import RPC
 */
export interface BulkImportDetailItem {
  index: number
  success: boolean
  error?: string
  [key: string]: unknown
}
