/**
 * Bulk Import Infrastructure
 *
 * Shared components and utilities for Excel bulk import dialogs.
 * Used by DeviceQuotaImportDialog, ImportEquipmentDialog, and future import dialogs.
 *
 * @example
 * ```tsx
 * import {
 *   useBulkImportState,
 *   BulkImportFileInput,
 *   BulkImportErrorAlert,
 *   BulkImportValidationErrors,
 *   BulkImportSuccessMessage,
 *   BulkImportSubmitButton,
 *   buildImportToastMessage
 * } from '@/components/bulk-import'
 * ```
 */

// Types
export type {
  BulkImportRpcResult,
  ValidationResult,
} from './bulk-import-types'

// State management hook
export { useBulkImportState } from './useBulkImportState'

// UI components
export {
  BulkImportFileInput,
  BulkImportErrorAlert,
  BulkImportValidationErrors,
  BulkImportSuccessMessage,
  BulkImportSubmitButton
} from "./BulkImportDialogParts"

// Error utilities
export {
  buildImportToastMessage
} from "./bulk-import-error-utils"
