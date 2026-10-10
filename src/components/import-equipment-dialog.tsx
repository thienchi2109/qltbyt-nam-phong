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
import { useEquipmentStatusCatalog } from "@/hooks/use-equipment-status-catalog"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { callRpc } from "@/lib/rpc-client"
import { normalizeDateForImport, normalizeFullDateForImport } from "@/lib/date-utils"
import type { Equipment } from "@/lib/data"
import {
  useBulkImportState,
  BulkImportFileInput,
  BulkImportErrorAlert,
  BulkImportValidationErrors,
  BulkImportSuccessMessage,
  BulkImportSubmitButton,
  buildImportToastMessage,
} from "@/components/bulk-import"
import type { BulkImportRpcResult } from "@/components/bulk-import"

import {
  validateEquipmentData,
  strictCommissionDateByRow,
  getStrictImportFullDate,
} from "./import-equipment-validation"
export { validateEquipmentData, REQUIRED_FIELDS } from "./import-equipment-validation"

// This mapping is crucial for converting Excel headers to database columns.
const headerToDbKeyMap: Record<string, string> = {
  "Mã thiết bị": "ma_thiet_bi",
  "Tên thiết bị": "ten_thiet_bi",
  Model: "model",
  Serial: "serial",
  "Số lưu hành": "so_luu_hanh",
  "Cấu hình": "cau_hinh_thiet_bi",
  "Phụ kiện kèm theo": "phu_kien_kem_theo",
  "Hãng sản xuất": "hang_san_xuat",
  "Nơi sản xuất": "noi_san_xuat",
  "Năm sản xuất": "nam_san_xuat",
  "Ngày nhập": "ngay_nhap",
  "Ngày đưa vào sử dụng": "ngay_dua_vao_su_dung",
  "Ngày ngừng sử dụng": "ngay_ngung_su_dung",
  "Nguồn kinh phí": "nguon_kinh_phi",
  "Giá gốc": "gia_goc",
  "Năm tính hao mòn": "nam_tinh_hao_mon",
  "Tỷ lệ hao mòn theo TT23": "ty_le_hao_mon",
  "Hạn bảo hành": "han_bao_hanh",
  "Vị trí lắp đặt": "vi_tri_lap_dat",
  "Người sử dụng": "nguoi_dang_truc_tiep_quan_ly",
  "Khoa/phòng quản lý": "khoa_phong_quan_ly",
  "Tình trạng": "tinh_trang_hien_tai",
  "Ghi chú": "ghi_chu",
  "Chu kỳ BT định kỳ (ngày)": "chu_ky_bt_dinh_ky",
  "Ngày BT tiếp theo": "ngay_bt_tiep_theo",
  "Chu kỳ HC định kỳ (ngày)": "chu_ky_hc_dinh_ky",
  "Ngày HC tiếp theo": "ngay_hc_tiep_theo",
  "Chu kỳ KĐ định kỳ (ngày)": "chu_ky_kd_dinh_ky",
  "Ngày KĐ tiếp theo": "ngay_kd_tiep_theo",
  "Phân loại theo NĐ98": "phan_loai_theo_nd98",
}

function normalizeInt(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null
  if (typeof val === "number") return Number.isFinite(val) ? Math.trunc(val) : null
  const cleaned = String(val).replace(/\D+/g, "")
  if (!cleaned) return null
  const num = parseInt(cleaned, 10)
  return Number.isFinite(num) ? num : null
}

function normalizeNumber(val: unknown): number | null {
  if (val === undefined || val === null || val === "") return null
  if (typeof val === "number") return Number.isFinite(val) ? val : null
  const cleaned = String(val).replace(/[,\s]/g, "")
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

function normalizeClassification(val: unknown): string | null {
  if (val === undefined || val === null || val === "") return null
  const s = String(val).trim().toUpperCase()
  if (["A", "B", "C", "D"].includes(s)) return s
  return s || null
}

const dateFields = new Set<string>([
  "ngay_nhap",
  "ngay_dua_vao_su_dung",
  "han_bao_hanh",
  "ngay_bt_tiep_theo",
  "ngay_hc_tiep_theo",
  "ngay_kd_tiep_theo",
])
const intFields = new Set<string>([
  "nam_san_xuat",
  "chu_ky_bt_dinh_ky",
  "chu_ky_hc_dinh_ky",
  "chu_ky_kd_dinh_ky",
  "nam_tinh_hao_mon",
])
const numberFields = new Set<string>(["gia_goc"])

interface ImportEquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

/** Renders and submits the equipment import dialog. */
export function ImportEquipmentDialog({
  open,
  onOpenChange,
  onSuccess,
}: ImportEquipmentDialogProps) {
  const { toast } = useToast()
  const statusCatalog = useEquipmentStatusCatalog()
  const [rejectedDatesCount, setRejectedDatesCount] = React.useState(0)
  const rejectedDatesRef = React.useRef(0)

  const transformRow = React.useCallback((raw: Record<string, unknown>): Partial<Equipment> => {
    const newRow: Partial<Equipment> = {}
    let strictUsageStartDate: string | null = null

    Object.entries(raw).forEach(([key, rawVal]) => {
      let value: unknown = rawVal
      if (key === "ngay_ngung_su_dung") {
        const dateResult = normalizeFullDateForImport(rawVal)
        value = dateResult.value ?? rawVal
      } else if (key === "ngay_dua_vao_su_dung") {
        strictUsageStartDate = getStrictImportFullDate(rawVal)
        const dateResult = normalizeDateForImport(rawVal)
        value = dateResult.value
        if (dateResult.rejected) {
          rejectedDatesRef.current += 1
        }
      } else if (dateFields.has(key)) {
        const dateResult = normalizeDateForImport(rawVal)
        value = dateResult.value
        if (dateResult.rejected) {
          rejectedDatesRef.current += 1
        }
      } else if (intFields.has(key)) {
        value = normalizeInt(rawVal)
      } else if (numberFields.has(key)) {
        value = normalizeNumber(rawVal)
      } else if (key === "phan_loai_theo_nd98") {
        value = normalizeClassification(rawVal)
      } else if (typeof rawVal === "string") {
        value = rawVal.trim() === "" ? null : rawVal.trim()
      }
      newRow[key as keyof Equipment] = value as never
    })

    strictCommissionDateByRow.set(newRow, strictUsageStartDate)
    return newRow
  }, [])

  const validateData = React.useCallback(
    (data: Partial<Equipment>[]) => {
      return validateEquipmentData(data, statusCatalog.activeValues)
    },
    [statusCatalog.activeValues]
  )

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
    acceptedExtensions: ".xlsx, .xls, .csv",
  })

  const { status, selectedFile, parsedData, parseError, validationErrors } = state
  const isSubmitting = status === "submitting"
  const activeStatuses = new Set(statusCatalog.activeValues)
  const parsedStatusesValid = parsedData.every(
    (item) =>
      typeof item.tinh_trang_hien_tai === "string" && activeStatuses.has(item.tinh_trang_hien_tai)
  )

  const resetAll = React.useCallback(() => {
    rejectedDatesRef.current = 0
    setRejectedDatesCount(0)
    resetState()
  }, [resetState])

  const handleFileChangeWithWarnings = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      rejectedDatesRef.current = 0
      await handleFileChange(event)
      setRejectedDatesCount(rejectedDatesRef.current)
    },
    [handleFileChange]
  )

  const handleClose = React.useCallback(() => {
    resetAll()
    onOpenChange(false)
  }, [resetAll, onOpenChange])

  const handleImport = React.useCallback(async () => {
    if (!statusCatalog.canWrite || !parsedStatusesValid) return
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
        description: "Vui lòng kiểm tra và sửa các lỗi trước khi nhập dữ liệu.",
      })
      return
    }

    setSubmitting()
    try {
      // Clean undefined keys for RPC payloads.
      const dataToInsert = parsedData.map((item) => {
        const entries = Object.entries(item) as Array<
          [keyof Equipment, Equipment[keyof Equipment] | undefined]
        >
        const filtered = entries.filter(([, value]) => value !== undefined)
        return Object.fromEntries(filtered) as Partial<Equipment>
      })

      const result = await callRpc<BulkImportRpcResult>({
        fn: "equipment_bulk_import",
        args: { p_items: dataToInsert },
      })

      const toastMessage = buildImportToastMessage({
        inserted: result?.inserted ?? parsedData.length,
        failed: result?.failed ?? 0,
        total: result?.total ?? parsedData.length,
        details: result?.details ?? [],
        entityName: "thiet bi",
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
      const errorMessage = getUnknownErrorMessage(error)
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: errorMessage
          ? `Không thể nhập dữ liệu. ${errorMessage}`
          : "Không thể nhập dữ liệu.",
      })
      setSubmitError(errorMessage)
    }
  }, [
    parsedData,
    validationErrors,
    toast,
    onSuccess,
    handleClose,
    setSubmitting,
    setSuccess,
    setSubmitError,
    statusCatalog.canWrite,
    parsedStatusesValid,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px]"
        onInteractOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={resetAll}
      >
        <DialogHeader>
          <DialogTitle>Nhập thiết bị từ file Excel</DialogTitle>
          <DialogDescription>
            Chọn file Excel (.xlsx) theo đúng định dạng mẫu để nhập hàng loạt.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {!statusCatalog.canWrite && (
            <div role="status" className="text-sm">
              Chưa tải được danh sách tình trạng.
              <Button type="button" variant="link" onClick={() => void statusCatalog.refetch()}>
                Thử lại
              </Button>
            </div>
          )}
          <BulkImportFileInput
            id="excel-file"
            fileInputRef={fileInputRef}
            onFileChange={handleFileChangeWithWarnings}
            disabled={isSubmitting || status === "parsing" || !statusCatalog.canWrite}
            accept=".xlsx, .xls, .csv"
            label="Chọn file"
          />
          <BulkImportErrorAlert error={parseError} />
          <BulkImportValidationErrors errors={validationErrors} />
          {rejectedDatesCount > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4" />
                <span>
                  <strong>{rejectedDatesCount}</strong> ngày có định dạng không hợp lệ (trước năm
                  1970) đã bị bỏ qua. Các trường ngày này sẽ được để trống.
                </span>
              </div>
            </div>
          )}
          {selectedFile &&
            !parseError &&
            validationErrors.length === 0 &&
            parsedData.length > 0 && (
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
            disabled={
              isSubmitting ||
              !selectedFile ||
              parseError !== null ||
              parsedData.length === 0 ||
              validationErrors.length > 0 ||
              !statusCatalog.canWrite ||
              !parsedStatusesValid
            }
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
