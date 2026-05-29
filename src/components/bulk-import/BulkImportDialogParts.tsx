"use client"

import * as React from 'react'
import { Loader2, FileCheck, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toKeyedTexts } from '@/lib/list-key-utils'

/**
 * File input with label for bulk import dialogs
 */
export interface BulkImportFileInputProps {
  id: string
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  accept?: string
  label?: string
}

/** Renders the file picker area for a bulk import dialog. */
export function BulkImportFileInput({
  id,
  fileInputRef,
  onFileChange,
  disabled = false,
  accept = '.xlsx, .xls',
  label = 'Chon file'
}: BulkImportFileInputProps): JSX.Element {
  return (
    <div className="grid w-full items-center gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="file"
        accept={accept}
        onChange={onFileChange}
        ref={fileInputRef}
        disabled={disabled}
      />
    </div>
  )
}

/**
 * Error alert with red background for parse errors
 */
export interface BulkImportErrorAlertProps {
  error: string | null
}

/** Renders a dismiss-free validation or parsing error alert. */
export function BulkImportErrorAlert({ error }: BulkImportErrorAlertProps): JSX.Element | null {
  if (!error) return null

  return (
    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
      <AlertTriangle className="size-4 flex-shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </div>
  )
}

/**
 * Validation errors list with red background and bullet list
 */
export interface BulkImportValidationErrorsProps {
  errors: string[]
  maxHeight?: string
}

/** Renders row-level validation errors for parsed bulk import records. */
export function BulkImportValidationErrors({
  errors,
  maxHeight = '10rem'
}: BulkImportValidationErrorsProps): JSX.Element | null {
  if (errors.length === 0) return null

  return (
    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="size-4 flex-shrink-0" aria-hidden="true" />
        <span className="font-medium">Dữ liệu không hợp lệ:</span>
      </div>
      <ul
        className="list-disc list-inside space-y-1 ml-6 overflow-y-auto"
        style={{ maxHeight }}
      >
        {toKeyedTexts(errors).map(({ key, text }) => (
          <li key={key}>{text}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Success message showing file name and record count
 */
export interface BulkImportSuccessMessageProps {
  fileName: string
  recordCount: number
}

/** Renders the successful bulk import file parsing summary. */
export function BulkImportSuccessMessage({
  fileName,
  recordCount
}: BulkImportSuccessMessageProps): JSX.Element {
  return (
    <output
      className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-md"
      aria-live="polite"
    >
      <FileCheck className="size-4 flex-shrink-0" aria-hidden="true" />
      <span>
        Đã đọc file <strong>{fileName}</strong>. Tìm thấy <strong>{recordCount}</strong> bản ghi hợp lệ.
      </span>
    </output>
  )
}

/**
 * Submit button with loading state for bulk import
 */
export interface BulkImportSubmitButtonProps {
  isSubmitting: boolean
  disabled: boolean
  recordCount: number
  labelSingular?: string
  labelPlural?: string
  onClick: () => void
}

/** Renders the submit button for parsed bulk import records. */
export function BulkImportSubmitButton({
  isSubmitting,
  disabled,
  recordCount,
  labelSingular = 'bản ghi',
  labelPlural = 'bản ghi',
  onClick
}: BulkImportSubmitButtonProps): JSX.Element {
  const label = recordCount === 1 ? labelSingular : labelPlural

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
      {isSubmitting ? 'Đang nhập...' : `Nhập ${recordCount} ${label}`}
    </Button>
  )
}
