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
import { Loader2, FileCheck, AlertTriangle } from "lucide-react"
import { readExcelFile, worksheetToJson } from "@/lib/excel-utils"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

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
): {
  isValid: boolean
  errors: string[]
  validRecords: ParsedQuotaRow[]
} {
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

/**
 * Translate PostgreSQL errors to Vietnamese
 */
function translateError(error: string): string {
  if (!error) return 'Lỗi không xác định'

  // Category not found
  if (error.includes('Category not found') || error.includes('nhom_thiet_bi')) {
    return 'Không tìm thấy mã nhóm trong danh mục'
  }

  // Parent category (not a leaf)
  if (error.includes('is a parent category') || error.includes('là nhóm cha')) {
    return 'Mã nhóm là nhóm cha, chỉ được nhập nhóm lá (nhóm không có nhóm con)'
  }

  // Quantity validation
  if (error.includes('must be greater than 0') || error.includes('phải lớn hơn 0')) {
    return 'Số lượng định mức phải lớn hơn 0'
  }

  if (error.includes('must be greater than or equal to 0')) {
    return 'Số lượng tối thiểu phải >= 0'
  }

  if (error.includes('minimum quantity cannot exceed quota')) {
    return 'Số lượng tối thiểu không được lớn hơn số lượng định mức'
  }

  // Duplicate entries
  if (error.includes('duplicate key') || error.includes('already exists')) {
    return 'Mã nhóm đã tồn tại trong quyết định này'
  }

  // Permission errors
  if (error.toLowerCase().includes('permission denied')) {
    return 'Không có quyền thực hiện'
  }

  // Decision status errors
  if (error.includes('can only import for draft decisions')) {
    return 'Chỉ được nhập cho quyết định ở trạng thái nháp'
  }

  // Return truncated error if no translation found
  return error.length > 80 ? error.substring(0, 80) + '...' : error
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
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [parsedData, setParsedData] = React.useState<ParsedQuotaRow[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [validationErrors, setValidationErrors] = React.useState<string[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Build set of valid category codes for O(1) lookup
  const validCategoryCodes = React.useMemo(() => {
    return new Set(categories.map(cat => cat.ma_nhom))
  }, [categories])

  // Reset state when dialog closes
  const resetState = React.useCallback(() => {
    setIsSubmitting(false)
    setSelectedFile(null)
    setParsedData([])
    setError(null)
    setValidationErrors([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  // Handle file selection and parsing
  const handleFileChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      resetState()
      return
    }

    // Validate file extension (Excel only - XLSX/XLS)
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError("File không hợp lệ. Vui lòng chọn file Excel (.xlsx, .xls).")
      setSelectedFile(null)
      setParsedData([])
      setValidationErrors([])
      return
    }

    setSelectedFile(file)
    setError(null)

    try {
      // Read Excel file
      const workbook = await readExcelFile(file)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const json = await worksheetToJson(worksheet)

      if (json.length === 0) {
        setError("File không có dữ liệu. Vui lòng kiểm tra lại file của bạn.")
        setParsedData([])
        return
      }

      // Transform headers to database field names
      const transformedData = json.map(row => {
        const newRow: Record<string, unknown> = {}
        for (const header in row) {
          if (Object.prototype.hasOwnProperty.call(HEADER_TO_DB_MAP, header)) {
            const dbKey = HEADER_TO_DB_MAP[header]
            const rawVal = row[header]
            let value: unknown = (rawVal === "" || rawVal === undefined) ? null : rawVal

            // Trim string values
            if (typeof rawVal === 'string') {
              value = rawVal.trim() === '' ? null : rawVal.trim()
            }

            newRow[dbKey] = value
          }
        }
        return newRow
      })

      // Validate the transformed data
      const validation = validateQuotaData(transformedData, validCategoryCodes)

      if (!validation.isValid) {
        setValidationErrors(validation.errors)
        setParsedData([])
      } else {
        setValidationErrors([])
        setParsedData(validation.validRecords)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi không xác định'
      setError("Đã có lỗi xảy ra khi đọc file: " + errorMessage)
      setParsedData([])
    }
  }, [resetState, validCategoryCodes])

  // Handle dialog close
  const handleClose = React.useCallback(() => {
    resetState()
    onOpenChange(false)
  }, [resetState, onOpenChange])

  // Handle import submission
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

    setIsSubmitting(true)
    try {
      // Call bulk import RPC
      const result = await callRpc<{
        success: boolean
        inserted: number
        updated: number
        failed: number
        total: number
        details: Array<{ index: number; success: boolean; error?: string; ma_nhom?: string }>
      }>({
        fn: 'dinh_muc_chi_tiet_bulk_import',
        args: {
          p_quyet_dinh_id: quyetDinhId,
          p_items: parsedData
        }
      })

      const inserted = result?.inserted ?? 0
      const updated = result?.updated ?? 0
      const failed = result?.failed ?? 0
      const total = result?.total ?? parsedData.length

      // Extract error details for failed records
      const failedDetails = (result?.details ?? [])
        .filter(d => !d.success && d.error)
        .slice(0, 5) // Show first 5 errors max

      if (failed > 0 && failedDetails.length > 0) {
        // Build detailed error message with Vietnamese translations
        const errorSummary = failedDetails
          .map((d) => `Dòng ${d.index + 2}: ${translateError(d.error ?? '')}`)
          .join('\n')

        const moreErrors = failed > 5 ? `\n...và ${failed - 5} lỗi khác` : ''

        toast({
          variant: "destructive",
          title: `Nhập hoàn tất với ${failed} lỗi`,
          description: `Đã nhập ${inserted} mới, cập nhật ${updated}/${total} định mức.\n\nChi tiết lỗi:\n${errorSummary}${moreErrors}`,
          duration: 10000, // Show longer for error details
        })
      } else if (failed > 0) {
        toast({
          variant: "destructive",
          title: "Nhập hoàn tất với một số lỗi",
          description: `Đã nhập ${inserted} mới, cập nhật ${updated}/${total} định mức. ${failed} bản ghi lỗi.`,
        })
      } else {
        toast({
          title: "Thành công",
          description: `Đã nhập ${inserted} mới, cập nhật ${updated} định mức.`,
        })
      }

      onSuccess()
      handleClose()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi không xác định'
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể nhập dữ liệu. " + errorMessage,
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [parsedData, validationErrors, quyetDinhId, toast, onSuccess, handleClose])

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
          <div className="grid w-full items-center gap-2">
            <Label htmlFor="quota-excel-file">Chọn file</Label>
            <Input
              id="quota-excel-file"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              ref={fileInputRef}
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="font-medium">Dữ liệu không hợp lệ:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-6 max-h-40 overflow-y-auto">
                {validationErrors.map((validationError, index) => (
                  <li key={index}>{validationError}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedFile && !error && validationErrors.length === 0 && parsedData.length > 0 && (
            <div
              className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-3 rounded-md"
              role="status"
              aria-live="polite"
            >
              <FileCheck className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>
                Đã đọc file <strong>{selectedFile.name}</strong>. Tìm thấy <strong>{parsedData.length}</strong> bản ghi hợp lệ.
              </span>
            </div>
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
          <Button
            type="button"
            onClick={handleImport}
            disabled={isSubmitting || !selectedFile || error !== null || parsedData.length === 0 || validationErrors.length > 0}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {isSubmitting ? "Đang nhập…" : `Nhập ${parsedData.length} định mức`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
