"use client"

/**
 * DeviceQuotaImportDialog - Excel import for device quotas
 *
 * Allows bulk importing of device quota definitions from Excel files.
 * Follows the same pattern as ImportEquipmentDialog with validation and error handling.
 *
 * @example
 * ```tsx
 * import { DeviceQuotaImportDialog } from "@/app/(app)/device-quota/decisions/_components/DeviceQuotaImportDialog"
 *
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false)
 *   const categories = ... // Fetch from RPC
 *
 *   return (
 *     <DeviceQuotaImportDialog
 *       open={isOpen}
 *       onOpenChange={setIsOpen}
 *       quyetDinhId={123}
 *       categories={categories}
 *       onSuccess={() => {
 *         // Refetch quota details
 *       }}
 *     />
 *   )
 * }
 * ```
 *
 * @see ImportEquipmentDialog - Reference implementation
 * @see generateDeviceQuotaImportTemplate - Template generator
 */

import * as React from "react"
import { callRpc } from "@/lib/rpc-client"
import type { NhomThietBiForTemplate } from "@/lib/device-quota-excel"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  useBulkImportState,
  BulkImportFileInput,
  BulkImportErrorAlert,
  BulkImportValidationErrors,
  BulkImportSuccessMessage,
  BulkImportSubmitButton,
  buildImportToastMessage,
} from "@/components/bulk-import"
import type { BulkImportRpcResult, ValidationResult } from "@/components/bulk-import"

// ============================================
// Types
// ============================================

interface DeviceQuotaImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quyetDinhId: number
  categories: NhomThietBiForTemplate[]
  onSuccess: () => void
}

interface ParsedQuotaRow {
  ma_nhom: string
  so_luong_dinh_muc: number
  so_luong_toi_thieu: number | null
  ghi_chu: string | null
}

// ============================================
// Column Mapping
// ============================================

// Map Vietnamese Excel headers to database field names
const HEADER_TO_DB_MAP: Record<string, string> = {
  'Mã nhóm thiết bị': 'ma_nhom',
  'Mã nhóm': 'ma_nhom',
  'Số lượng định mức': 'so_luong_dinh_muc',
  'Định mức': 'so_luong_dinh_muc',
  'Số lượng tối thiểu': 'so_luong_toi_thieu',
  'Tối thiểu': 'so_luong_toi_thieu',
  'Ghi chú': 'ghi_chu',
}

// ============================================
// Validation
// ============================================

/**
 * Normalize value to integer.
 * Returns null for empty/undefined values.
 * Returns { error: string } for invalid formats (negative, decimal, non-numeric).
 * Returns the integer value for valid inputs.
 */
function normalizeInt(val: unknown): number | null | { error: string } {
  if (val === undefined || val === null || val === '') return null

  // Handle numeric values directly
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { error: 'không phải số hợp lệ' }
    // Reject decimals - must be a whole number
    if (!Number.isInteger(val)) return { error: 'phải là số nguyên (không có phần thập phân)' }
    return val
  }

  // Handle string values - must be a valid positive integer format
  const str = String(val).trim()
  if (!str) return null

  // Reject negative numbers explicitly
  if (str.startsWith('-')) {
    return { error: 'không được là số âm' }
  }

  // Reject decimal formats explicitly (1.5, 1,5, etc.)
  if (/[.,]/.test(str)) {
    return { error: 'phải là số nguyên (không có phần thập phân)' }
  }

  // Only allow digits (optionally with leading/trailing whitespace already trimmed)
  if (!/^\d+$/.test(str)) {
    return { error: 'chứa ký tự không hợp lệ' }
  }

  const num = parseInt(str, 10)
  if (!Number.isFinite(num)) return { error: 'không phải số hợp lệ' }
  return num
}

/**
 * Validate and transform Excel data to quota records
 */
function validateQuotaData(
  data: Record<string, unknown>[],
  validCategoryCodes: Set<string>
): ValidationResult<ParsedQuotaRow> {
  const errors: string[] = []
  const validRecords: ParsedQuotaRow[] = []

  data.forEach((row, index) => {
    const rowNum = index + 2 // Excel row number (header is row 1)

    // Extract and normalize fields
    // Coerce ma_nhom to string - Excel may store numeric codes as numbers
    const rawMaNhom = row.ma_nhom
    const maNhom = rawMaNhom === undefined || rawMaNhom === null
      ? ''
      : String(rawMaNhom).trim()
    const soLuongDinhMucResult = normalizeInt(row.so_luong_dinh_muc)
    const soLuongToiThieuResult = normalizeInt(row.so_luong_toi_thieu)
    const ghiChu = row.ghi_chu ? String(row.ghi_chu).trim() : null

    // Required field validation: ma_nhom
    if (!maNhom) {
      errors.push(`Dòng ${rowNum}: Thiếu mã nhóm thiết bị`)
      return
    }

    // Check if category code exists in valid categories
    if (!validCategoryCodes.has(maNhom)) {
      errors.push(`Dòng ${rowNum}: Không tìm thấy mã nhóm "${maNhom}" trong danh mục`)
      return
    }

    // Validate so_luong_dinh_muc format
    if (soLuongDinhMucResult !== null && typeof soLuongDinhMucResult === 'object' && 'error' in soLuongDinhMucResult) {
      errors.push(`Dòng ${rowNum}: Số lượng định mức ${soLuongDinhMucResult.error}`)
      return
    }
    const soLuongDinhMuc = soLuongDinhMucResult as number | null

    // Required field validation: so_luong_dinh_muc
    if (soLuongDinhMuc === null) {
      errors.push(`Dòng ${rowNum}: Thiếu số lượng định mức`)
      return
    }

    // Validate so_luong_dinh_muc > 0
    if (soLuongDinhMuc <= 0) {
      errors.push(`Dòng ${rowNum}: Số lượng định mức phải lớn hơn 0`)
      return
    }

    // Validate so_luong_toi_thieu format
    if (soLuongToiThieuResult !== null && typeof soLuongToiThieuResult === 'object' && 'error' in soLuongToiThieuResult) {
      errors.push(`Dòng ${rowNum}: Số lượng tối thiểu ${soLuongToiThieuResult.error}`)
      return
    }
    const soLuongToiThieu = soLuongToiThieuResult as number | null

    // Validate so_luong_toi_thieu if provided
    if (soLuongToiThieu !== null) {
      if (soLuongToiThieu < 0) {
        errors.push(`Dòng ${rowNum}: Số lượng tối thiểu phải >= 0`)
        return
      }
      if (soLuongToiThieu > soLuongDinhMuc) {
        errors.push(`Dòng ${rowNum}: Số lượng tối thiểu không được lớn hơn số lượng định mức`)
        return
      }
    }

    // All validations passed
    validRecords.push({
      ma_nhom: maNhom,
      so_luong_dinh_muc: soLuongDinhMuc,
      so_luong_toi_thieu: soLuongToiThieu,
      ghi_chu: ghiChu && ghiChu.length > 0 ? ghiChu : null,
    })
  })

  return {
    isValid: errors.length === 0,
    errors,
    validRecords,
  }
}

// ============================================
// Component
// ============================================

export function DeviceQuotaImportDialog({
  open,
  onOpenChange,
  quyetDinhId,
  categories,
  onSuccess,
}: DeviceQuotaImportDialogProps) {
  const { toast } = useToast()

  // Build set of valid category codes for O(1) lookup
  const validCategoryCodes = React.useMemo(() => {
    return new Set(categories.map(cat => cat.ma_nhom))
  }, [categories])

  const transformRow = React.useCallback((raw: Record<string, unknown>) => {
    return raw
  }, [])

  const validateData = React.useCallback((data: Record<string, unknown>[]) => {
    return validateQuotaData(data, validCategoryCodes)
  }, [validCategoryCodes])

  const {
    state,
    fileInputRef,
    handleFileChange,
    resetState,
    setSubmitting,
    setSuccess,
    setSubmitError,
  } = useBulkImportState<Record<string, unknown>, ParsedQuotaRow>({
    headerMap: HEADER_TO_DB_MAP,
    transformRow,
    validateData,
  })

  const { status, selectedFile, parsedData, parseError, validationErrors } = state
  const isSubmitting = status === 'submitting'

  const handleClose = React.useCallback(() => {
    resetState()
    onOpenChange(false)
  }, [resetState, onOpenChange])

  const handleImport = React.useCallback(async () => {
    if (parsedData.length === 0) {
      toast({
        variant: "destructive",
        title: "Không có dữ liệu",
        description: "Không có dữ liệu hợp lệ để nhập.",
      })
      return
    }

    if (validationErrors.length > 0) {
      toast({
        variant: "destructive",
        title: "Dữ liệu không hợp lệ",
        description: "Vui lòng kiểm tra và sửa các lỗi trước khi nhập dữ liệu."
      })
      return
    }

    setSubmitting()
    try {
      const result = await callRpc<BulkImportRpcResult>({
        fn: 'dinh_muc_chi_tiet_bulk_import',
        args: {
          p_quyet_dinh_id: quyetDinhId,
          p_items: parsedData
        }
      })

      const toastMessage = buildImportToastMessage({
        inserted: result?.inserted ?? 0,
        updated: result?.updated ?? 0,
        failed: result?.failed ?? 0,
        total: result?.total ?? parsedData.length,
        details: result?.details ?? [],
        entityName: 'dinh muc'
      })

      toast({
        variant: toastMessage.variant,
        title: toastMessage.title,
        description: toastMessage.description,
        duration: toastMessage.duration,
      })

      setSuccess()
      onSuccess()
      handleClose()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi không xác định'
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể nhập dữ liệu. " + errorMessage,
      })
      setSubmitError(errorMessage)
    }
  }, [parsedData, validationErrors, quyetDinhId, toast, onSuccess, handleClose, setSubmitting, setSuccess, setSubmitError])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={resetState}
      >
        <DialogHeader>
          <DialogTitle>Nhập định mức từ file Excel</DialogTitle>
          <DialogDescription>
            Chọn file Excel (.xlsx) theo đúng định dạng mẫu để nhập hàng loạt.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <BulkImportFileInput
            id="quota-excel-file"
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            disabled={isSubmitting}
            accept=".xlsx, .xls"
            label="Chọn file"
          />

          <BulkImportErrorAlert error={parseError} />

          <BulkImportValidationErrors errors={validationErrors} />

          {selectedFile && !parseError && validationErrors.length === 0 && parsedData.length > 0 && (
            <BulkImportSuccessMessage
              fileName={selectedFile.name}
              recordCount={parsedData.length}
            />
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <BulkImportSubmitButton
            isSubmitting={isSubmitting}
            disabled={isSubmitting || !selectedFile || parseError !== null || parsedData.length === 0 || validationErrors.length > 0}
            recordCount={parsedData.length}
            labelSingular="dinh muc"
            labelPlural="dinh muc"
            onClick={handleImport}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
