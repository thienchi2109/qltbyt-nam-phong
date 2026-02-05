"use client"

import * as React from 'react'
import { Loader2, FileCheck, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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

export function BulkImportErrorAlert({ error }: BulkImportErrorAlertProps): JSX.Element | null {
  if (!error) return null

  return (
    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
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

export function BulkImportValidationErrors({
  errors,
  maxHeight = '10rem'
}: BulkImportValidationErrorsProps): JSX.Element | null {
  if (errors.length === 0) return null

  return (
    <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="font-medium">Du lieu khong hop le:</span>
      </div>
      <ul
        className="list-disc list-inside space-y-1 ml-6 overflow-y-auto"
        style={{ maxHeight }}
      >
        {errors.map((validationError, index) => (
          <li key={index}>{validationError}</li>
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

export function BulkImportSuccessMessage({
  fileName,
  recordCount
}: BulkImportSuccessMessageProps): JSX.Element {
  return (
    <div
      className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-md"
      role="status"
      aria-live="polite"
    >
      <FileCheck className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>
        Da doc file <strong>{fileName}</strong>. Tim thay <strong>{recordCount}</strong> ban ghi hop le.
      </span>
    </div>
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

export function BulkImportSubmitButton({
  isSubmitting,
  disabled,
  recordCount,
  labelSingular = 'ban ghi',
  labelPlural = 'ban ghi',
  onClick
}: BulkImportSubmitButtonProps): JSX.Element {
  const label = recordCount === 1 ? labelSingular : labelPlural

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {isSubmitting ? 'Dang nhap...' : `Nhap ${recordCount} ${label}`}
    </Button>
  )
}
