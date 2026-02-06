import type { BulkImportDetailItem } from './bulk-import-types'

/**
 * Translate common PostgreSQL/RPC errors to Vietnamese
 *
 * Consolidates error translation from DeviceQuotaImportDialog and ImportEquipmentDialog.
 */
export function translateBulkImportError(error: string): string {
  if (!error) return 'Loi khong xac dinh'

  // Duplicate key errors
  if (error.includes('duplicate key') && error.includes('ma_thiet_bi')) {
    return 'Ma thiet bi da ton tai (trung lap)'
  }
  if (error.includes('duplicate key') || error.includes('already exists')) {
    return 'Du lieu trung lap'
  }

  // Category not found
  if (error.includes('Category not found') || error.includes('nhom_thiet_bi')) {
    return 'Khong tim thay ma nhom trong danh muc'
  }

  // Parent category (not a leaf)
  if (error.includes('is a parent category') || error.includes('la nhom cha')) {
    return 'Ma nhom la nhom cha, chi duoc nhap nhom la (nhom khong co nhom con)'
  }

  // Quantity validation
  if (error.includes('must be greater than 0') || error.includes('phai lon hon 0')) {
    return 'So luong phai lon hon 0'
  }
  if (error.includes('must be greater than or equal to 0')) {
    return 'So luong phai >= 0'
  }
  if (error.includes('minimum quantity cannot exceed quota')) {
    return 'So luong toi thieu khong duoc lon hon so luong dinh muc'
  }

  // Permission errors
  if (error.toLowerCase().includes('permission denied')) {
    return 'Khong co quyen thuc hien'
  }

  // Decision status errors
  if (error.includes('can only import for draft decisions')) {
    return 'Chi duoc nhap cho quyet dinh o trang thai nhap'
  }

  // Null/required field errors
  if (error.includes('null value in column')) {
    const match = error.match(/null value in column "(\w+)"/)
    const field = match?.[1] || 'khong xac dinh'
    return `Thieu gia tri bat buoc: ${field}`
  }

  // Data type errors
  if (error.includes('invalid input syntax for type integer')) {
    return 'Dinh dang so khong hop le'
  }
  if (error.includes('invalid input syntax for type date')) {
    return 'Dinh dang ngay khong hop le (dung DD/MM/YYYY)'
  }
  if (error.includes('invalid input syntax for type numeric')) {
    return 'Dinh dang so thap phan khong hop le'
  }
  if (error.includes('invalid input syntax')) {
    return 'Dinh dang du lieu khong hop le'
  }

  // Constraint violations
  if (error.includes('violates check constraint')) {
    return 'Gia tri khong hop le theo rang buoc'
  }
  if (error.includes('violates foreign key constraint')) {
    return 'Tham chieu khong hop le'
  }

  // Return truncated error if no translation found
  return error.length > 80 ? error.substring(0, 80) + '...' : error
}

/**
 * Format import result errors for display
 *
 * @param details - Array of detail items from RPC result
 * @param maxErrors - Maximum number of errors to show (default: 5)
 * @returns Formatted error string with line numbers
 */
export function formatImportResultErrors(
  details: BulkImportDetailItem[],
  maxErrors: number = 5
): string {
  const failedDetails = details
    .filter(d => !d.success && d.error)
    .slice(0, maxErrors)

  if (failedDetails.length === 0) return ''

  const errorSummary = failedDetails
    .map(d => `Dong ${d.index + 2}: ${translateBulkImportError(d.error ?? '')}`)
    .join('\n')

  const totalFailed = details.filter(d => !d.success).length
  const moreErrors = totalFailed > maxErrors ? `\n...va ${totalFailed - maxErrors} loi khac` : ''

  return errorSummary + moreErrors
}

/**
 * Build toast message parameters from import result
 */
export interface BuildImportToastParams {
  inserted: number
  updated?: number
  failed: number
  total: number
  details?: BulkImportDetailItem[]
  entityName?: string
}

export interface ImportToastMessage {
  variant: 'default' | 'destructive'
  title: string
  description: string
  duration?: number
}

export function buildImportToastMessage(params: BuildImportToastParams): ImportToastMessage {
  const {
    inserted,
    updated = 0,
    failed,
    total,
    details = [],
    entityName = 'ban ghi'
  } = params

  // Success case
  if (failed === 0) {
    const updateText = updated > 0 ? `, cap nhat ${updated}` : ''
    return {
      variant: 'default',
      title: 'Thanh cong',
      description: `Da nhap ${inserted} moi${updateText} ${entityName}.`
    }
  }

  // Partial failure with details
  const errorDetails = formatImportResultErrors(details)
  if (errorDetails) {
    const updateText = updated > 0 ? `, cap nhat ${updated}` : ''
    return {
      variant: 'destructive',
      title: `Nhap hoan tat voi ${failed} loi`,
      description: `Da nhap ${inserted} moi${updateText}/${total} ${entityName}.\n\nChi tiet loi:\n${errorDetails}`,
      duration: 10000
    }
  }

  // Partial failure without details
  return {
    variant: 'destructive',
    title: 'Nhap hoan tat voi mot so loi',
    description: `Da nhap ${inserted}/${total} ${entityName}. ${failed} ban ghi loi.`
  }
}
