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
 *   translateBulkImportError,
 *   buildImportToastMessage
 * } from '@/components/bulk-import'
 * ```
 */

// Types
export type {
  BulkImportRpcResult,
  BulkImportState,
  ValidationResult,
  BulkImportDetailItem
} from './bulk-import-types'

// State management hook
export { useBulkImportState } from './useBulkImportState'
export type {
  UseBulkImportStateOptions,
  UseBulkImportStateReturn
} from './useBulkImportState'

// UI components
export {
  BulkImportFileInput,
  BulkImportErrorAlert,
  BulkImportValidationErrors,
  BulkImportSuccessMessage,
  BulkImportSubmitButton
} from './BulkImportDialogParts'
export type {
  BulkImportFileInputProps,
  BulkImportErrorAlertProps,
  BulkImportValidationErrorsProps,
  BulkImportSuccessMessageProps,
  BulkImportSubmitButtonProps
} from './BulkImportDialogParts'

// Error utilities
export {
  translateBulkImportError,
  formatImportResultErrors,
  buildImportToastMessage
} from './bulk-import-error-utils'
export type {
  BuildImportToastParams,
  ImportToastMessage
} from './bulk-import-error-utils'
