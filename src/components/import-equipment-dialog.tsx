"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"

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
import { callRpc } from "@/lib/rpc-client"
import { normalizeDateForImport } from "@/lib/date-utils"
import type { Equipment } from "@/lib/data"
import { equipmentStatusOptions } from "@/components/equipment/equipment-table-columns"
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

// Required fields for equipment validation
export const REQUIRED_FIELDS = {
  'khoa_phong_quan_ly': 'Khoa/phòng quản lý',
  'nguoi_dang_truc_tiep_quan_ly': 'Người sử dụng',
  'tinh_trang_hien_tai': 'Tình trạng',
  'vi_tri_lap_dat': 'Vị trí lắp đặt'
} as const;

// Valid status values - moved to module level to avoid recreation on each validation call
const VALID_STATUSES: Set<string> = new Set(equipmentStatusOptions);

// Validation function for equipment data
export const validateEquipmentData = (
  data: Partial<Equipment>[]
): ValidationResult<Partial<Equipment>> => {
  const errors: string[] = [];
  const validRecords: Partial<Equipment>[] = [];

  data.forEach((item, index) => {
    const missingFields: string[] = [];

    // Check each required field
    Object.entries(REQUIRED_FIELDS).forEach(([dbKey, displayName]) => {
      const value = item[dbKey as keyof Equipment];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        missingFields.push(displayName);
      }
    });

    // Validate status value if provided
    const status = item.tinh_trang_hien_tai;
    const hasInvalidStatus = Boolean(
      status &&
      typeof status === 'string' &&
      status.trim() !== '' &&
      !VALID_STATUSES.has(status.trim())
    )
    if (hasInvalidStatus) {
      errors.push(`Dòng ${index + 2}: Tình trạng "${status}" không hợp lệ. Phải là một trong: ${equipmentStatusOptions.join(', ')}`);
    }

    if (missingFields.length > 0) {
      errors.push(`Dòng ${index + 2}: Thiếu ${missingFields.join(', ')}`);
    }

    if (missingFields.length === 0 && !hasInvalidStatus) {
      validRecords.push(item)
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validRecords: errors.length === 0 ? data : validRecords
  };
};

// This mapping is crucial for converting Excel headers to database columns.
const headerToDbKeyMap: Record<string, string> = {
    'Mã thiết bị': 'ma_thiet_bi',
    'Tên thiết bị': 'ten_thiet_bi',
    'Model': 'model',
    'Serial': 'serial',
    'Số lưu hành': 'so_luu_hanh',
    'Cấu hình': 'cau_hinh_thiet_bi',
    'Phụ kiện kèm theo': 'phu_kien_kem_theo',
    'Hãng sản xuất': 'hang_san_xuat',
    'Nơi sản xuất': 'noi_san_xuat',
    'Năm sản xuất': 'nam_san_xuat',
    'Ngày nhập': 'ngay_nhap',
    'Ngày đưa vào sử dụng': 'ngay_dua_vao_su_dung',
    'Nguồn kinh phí': 'nguon_kinh_phi',
    'Giá gốc': 'gia_goc',
    'Năm tính hao mòn': 'nam_tinh_hao_mon',
    'Tỷ lệ hao mòn theo TT23': 'ty_le_hao_mon',
    'Hạn bảo hành': 'han_bao_hanh',
    'Vị trí lắp đặt': 'vi_tri_lap_dat',
    'Người sử dụng': 'nguoi_dang_truc_tiep_quan_ly',
    'Khoa/phòng quản lý': 'khoa_phong_quan_ly',
    'Tình trạng': 'tinh_trang_hien_tai',
    'Ghi chú': 'ghi_chu',
    'Chu kỳ BT định kỳ (ngày)': 'chu_ky_bt_dinh_ky',
    'Ngày BT tiếp theo': 'ngay_bt_tiep_theo',
    'Chu kỳ HC định kỳ (ngày)': 'chu_ky_hc_dinh_ky',
    'Ngày HC tiếp theo': 'ngay_hc_tiep_theo',
    'Chu kỳ KĐ định kỳ (ngày)': 'chu_ky_kd_dinh_ky',
    'Ngày KĐ tiếp theo': 'ngay_kd_tiep_theo',
    'Phân loại theo NĐ98': 'phan_loai_theo_nd98',
};

function normalizeInt(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? Math.trunc(val) : null;
  const cleaned = String(val).replace(/\D+/g, '');
  if (!cleaned) return null;
  const num = parseInt(cleaned, 10);
  return Number.isFinite(num) ? num : null;
}

function normalizeNumber(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const cleaned = String(val).replace(/[,\s]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeClassification(val: unknown): string | null {
  if (val === undefined || val === null || val === '') return null;
  const s = String(val).trim().toUpperCase();
  if (['A','B','C','D'].includes(s)) return s;
  return s || null;
}

const dateFields = new Set<string>([
  'ngay_nhap','ngay_dua_vao_su_dung','han_bao_hanh','ngay_bt_tiep_theo','ngay_hc_tiep_theo','ngay_kd_tiep_theo'
]);
const intFields = new Set<string>(['nam_san_xuat','chu_ky_bt_dinh_ky','chu_ky_hc_dinh_ky','chu_ky_kd_dinh_ky','nam_tinh_hao_mon']);
const numberFields = new Set<string>(['gia_goc']);


interface ImportEquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ImportEquipmentDialog({ open, onOpenChange, onSuccess }: ImportEquipmentDialogProps) {
  const { toast } = useToast()
  const [rejectedDatesCount, setRejectedDatesCount] = React.useState(0)
  const rejectedDatesRef = React.useRef(0)

  const transformRow = React.useCallback((raw: Record<string, unknown>): Partial<Equipment> => {
    const newRow: Partial<Equipment> = {}

    Object.entries(raw).forEach(([key, rawVal]) => {
      let value: unknown = rawVal
      if (dateFields.has(key)) {
        const dateResult = normalizeDateForImport(rawVal)
        value = dateResult.value
        if (dateResult.rejected) {
          rejectedDatesRef.current += 1
        }
      } else if (intFields.has(key)) {
        value = normalizeInt(rawVal)
      } else if (numberFields.has(key)) {
        value = normalizeNumber(rawVal)
      } else if (key === 'phan_loai_theo_nd98') {
        value = normalizeClassification(rawVal)
      } else if (typeof rawVal === 'string') {
        value = rawVal.trim() === '' ? null : rawVal.trim()
      }
      newRow[key as keyof Equipment] = value as never
    })

    return newRow
  }, [])

  const validateData = React.useCallback((data: Partial<Equipment>[]) => {
    return validateEquipmentData(data)
  }, [])

  const {
    state,
    fileInputRef,
    handleFileChange,
    resetState,
    setSubmitting,
    setSuccess,
    setSubmitError,
  } = useBulkImportState<Partial<Equipment>, Partial<Equipment>>({
    headerMap: headerToDbKeyMap,
    transformRow,
    validateData,
    acceptedExtensions: '.xlsx, .xls, .csv',
  })

  const { status, selectedFile, parsedData, parseError, validationErrors } = state
  const isSubmitting = status === 'submitting'

  const resetAll = React.useCallback(() => {
    rejectedDatesRef.current = 0
    setRejectedDatesCount(0)
    resetState()
  }, [resetState])

  const handleFileChangeWithWarnings = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    rejectedDatesRef.current = 0
    await handleFileChange(event)
    setRejectedDatesCount(rejectedDatesRef.current)
  }, [handleFileChange])

  const handleClose = React.useCallback(() => {
    resetAll()
    onOpenChange(false)
  }, [resetAll, onOpenChange])

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
      // Clean undefined keys for RPC payloads.
      const dataToInsert = parsedData.map((item) => {
        const entries = Object.entries(item) as Array<[
          keyof Equipment,
          Equipment[keyof Equipment] | undefined
        ]>
        const filtered = entries.filter(([, value]) => value !== undefined)
        return Object.fromEntries(filtered) as Partial<Equipment>
      })

      const result = await callRpc<BulkImportRpcResult>({
        fn: 'equipment_bulk_import',
        args: { p_items: dataToInsert }
      })

      const toastMessage = buildImportToastMessage({
        inserted: result?.inserted ?? parsedData.length,
        failed: result?.failed ?? 0,
        total: result?.total ?? parsedData.length,
        details: result?.details ?? [],
        entityName: 'thiet bi'
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : ''
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể nhập dữ liệu. " + errorMessage,
      })
      setSubmitError(errorMessage)
    }
  }, [parsedData, validationErrors, toast, onSuccess, handleClose, setSubmitting, setSuccess, setSubmitError])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" onInteractOutside={(e) => e.preventDefault()} onCloseAutoFocus={resetAll}>
        <DialogHeader>
          <DialogTitle>Nhập thiết bị từ file Excel</DialogTitle>
          <DialogDescription>
            Chọn file Excel (.xlsx) theo đúng định dạng mẫu để nhập hàng loạt.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <BulkImportFileInput
            id="excel-file"
            fileInputRef={fileInputRef}
            onFileChange={handleFileChangeWithWarnings}
            disabled={isSubmitting || status === 'parsing'}
            accept=".xlsx, .xls, .csv"
            label="Chọn file"
          />
          <BulkImportErrorAlert error={parseError} />
          <BulkImportValidationErrors errors={validationErrors} />
          {rejectedDatesCount > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  <strong>{rejectedDatesCount}</strong> ngày có định dạng không hợp lệ (trước năm 1970) đã bị bỏ qua.
                  Các trường ngày này sẽ được để trống.
                </span>
              </div>
            </div>
          )}
          {selectedFile && !parseError && validationErrors.length === 0 && parsedData.length > 0 && (
            <BulkImportSuccessMessage
              fileName={selectedFile.name}
              recordCount={parsedData.length}
            />
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <BulkImportSubmitButton
            isSubmitting={isSubmitting}
            disabled={isSubmitting || !selectedFile || parseError !== null || parsedData.length === 0 || validationErrors.length > 0}
            recordCount={parsedData.length}
            labelSingular="thiet bi"
            labelPlural="thiet bi"
            onClick={handleImport}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
