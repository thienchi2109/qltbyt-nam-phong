"use client"

/**
 * DeviceQuotaCategoryImportDialog - Excel import for device categories + quotas.
 *
 * Zero-props dialog controlled via DeviceQuotaCategoryContext.
 * Allows bulk importing of device categories (nhom_thiet_bi) from Excel files.
 * If Excel has quota columns, auto-creates a draft decision and imports chi_tiet.
 */

import * as React from "react"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

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
import { callRpc } from "@/lib/rpc-client"
import { readExcelFile, worksheetToJson } from "@/lib/excel-utils"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { translateRpcError } from "@/lib/error-translations"
import {
  type ParsedCategoryRow,
  type ImportResult,
  validateParsedRows,
  transformExcelHeaders,
} from "@/lib/category-import-validation"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"
import { DeviceQuotaCategoryImportDialogAlerts } from "./DeviceQuotaCategoryImportDialogAlerts"
import {
  importDialogReducer,
  initialImportDialogState,
} from "./DeviceQuotaCategoryImportDialogState"

// ============================================
// Component
// ============================================

/** Renders the Excel import dialog for device quota categories and quota rows. */
export function DeviceQuotaCategoryImportDialog() {
  const { isImportDialogOpen, closeImportDialog, allCategories, donViId } =
    useDeviceQuotaCategoryContext()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [state, dispatch] = React.useReducer(importDialogReducer, initialImportDialogState)
  const { status, parsedRows, parseError, validationErrors, validationWarnings, importResult } = state

  // Existing category codes for duplicate detection
  const existingCodes = React.useMemo(() => {
    return new Set((allCategories ?? []).map((c) => c.ma_nhom))
  }, [allCategories])

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!isImportDialogOpen) {
      const timer = setTimeout(() => {
        dispatch({ type: "reset" })
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isImportDialogOpen])

  // File change handler
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    dispatch({ type: "parse-started" })

    try {
      const workbook = await readExcelFile(file)
      const sheetName = workbook.SheetNames[0]

      if (!sheetName) {
        throw new Error("File Excel khong co sheet nao")
      }

      const sheet = workbook.Sheets[sheetName]
      const jsonData = await worksheetToJson(sheet)

      if (jsonData.length === 0) {
        throw new Error("Khong tim thay du lieu trong file Excel")
      }

      // Transform headers to database field names (with diacritic normalization)
      const transformedData = transformExcelHeaders(jsonData)

      // Check if any rows have data (after transformation)
      const hasData = transformedData.some(
        (row) => row.ma_nhom !== undefined || row.ten_nhom !== undefined
      )

      if (!hasData) {
        throw new Error(
          "Khong nhan dang duoc cot du lieu. Hay kiem tra ten cot trong file Excel phai khop voi mau (VD: 'Ma nhom', 'Ten nhom')."
        )
      }

      const { validRows, errors, warnings } = validateParsedRows(transformedData, existingCodes)

      dispatch({
        type: "parse-succeeded",
        rows: validRows,
        errors,
        warnings,
      })
    } catch (error) {
      console.error("Failed to parse Excel file:", error)
      dispatch({
        type: "parse-failed",
        message: getUnknownErrorMessage(error, "Loi doc file Excel"),
      })
    }
  }

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (rows: ParsedCategoryRow[]) => {
      if (!donViId) {
        throw new Error("Thieu thong tin don vi")
      }

      const result = await callRpc<ImportResult>({
        fn: "dinh_muc_nhom_bulk_import",
        args: {
          p_items: rows,
          p_don_vi: donViId,
        },
      })

      return result
    },
    onSuccess: async (result) => {
      dispatch({ type: "import-started", result })

      // Check if any rows have quota data for unified import
      const quotaRows = parsedRows.filter(r => r.dinh_muc_toi_da !== null && r.dinh_muc_toi_da > 0)
      let quotaImportFailed = false

      if (quotaRows.length > 0 && donViId) {
        try {
          // Auto-create draft decision + import chi_tiet via unified RPC
          const quotaResult = await callRpc<{ success: boolean; inserted: number; failed: number; total: number }>({
            fn: "dinh_muc_unified_import",
            args: {
              p_items: quotaRows.map(r => ({
                ma_nhom: r.ma_nhom,
                so_luong_dinh_muc: r.dinh_muc_toi_da,
                so_luong_toi_thieu: r.toi_thieu ?? 0,
              })),
              p_don_vi: donViId,
            },
          })

          // Invalidate decision queries too
          queryClient.invalidateQueries({ queryKey: ["dinh_muc_quyet_dinh_list"] })

          toast({
            title: "Nhập thành công",
            description: result.inserted > 0
              ? `Đã thêm ${result.inserted} danh mục và ${quotaResult.inserted} định mức${quotaResult.failed > 0 ? ` (${quotaResult.failed} lỗi)` : ""}. Quyết định định mức nhập đã được tạo tự động.`
              : `Đã nhập ${quotaResult.inserted} định mức cho danh mục hiện có${quotaResult.failed > 0 ? ` (${quotaResult.failed} lỗi)` : ""}. Quyết định định mức nhập đã được tạo tự động.`,
          })
        } catch (quotaError) {
          quotaImportFailed = true
          console.error("Failed to import quotas:", quotaError)
          toast({
            variant: "destructive",
            title: "Định mức thất bại",
            description: `Đã thêm ${result.inserted} danh mục nhưng nhập định mức thất bại: ${translateRpcError(getUnknownErrorMessage(quotaError, "Lỗi không xác định"))}`,
          })
        }
      } else {
        toast({
          title: "Nhập thành công",
          description: `Đã thêm ${result.inserted} danh mục${result.failed > 0 ? `, ${result.failed} thất bại` : ""}.`,
        })
      }

      dispatch({ type: "import-finished", partial: quotaImportFailed })

      // Invalidate queries to refresh category list
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_nhom_list"] })
    },
    onError: (error: Error) => {
      dispatch({ type: "import-failed" })
      toast({
        variant: "destructive",
        title: "Nhập thất bại",
        description: translateRpcError(error.message),
      })
    },
  })

  const handleImport = () => {
    if (parsedRows.length === 0) return
    importMutation.mutate(parsedRows)
  }

  const isSubmitting = importMutation.isPending || status === "importing"

  const handleClose = () => {
    if (isSubmitting) return // Prevent closing while submitting
    closeImportDialog()
  }

  // Allow import if there are valid rows (even if there are warnings or errors for other rows)
  const canImport = status === "parsed" && parsedRows.length > 0

  return (
    <Dialog open={isImportDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Nhập danh mục từ Excel
          </DialogTitle>
          <DialogDescription>
            Tải lên file Excel theo mẫu để nhập hàng loạt danh mục thiết bị.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="category-import-file">Chọn file Excel</Label>
            <Input
              ref={fileInputRef}
              id="category-import-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isSubmitting}
            />
          </div>

          <DeviceQuotaCategoryImportDialogAlerts
            status={status}
            parsedRowsCount={parsedRows.length}
            parseError={parseError}
            validationErrors={validationErrors}
            validationWarnings={validationWarnings}
            importResult={importResult}
            isSubmitting={isSubmitting}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {status === "success" || status === "partial_success" ? "Đóng" : "Hủy"}
          </Button>
          {status !== "success" && status !== "partial_success" && (
            <Button onClick={handleImport} disabled={!canImport || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Đang nhập…
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  Nhập {parsedRows.length > 0 ? `(${parsedRows.length})` : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
