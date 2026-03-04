"use client"

/**
 * DeviceQuotaCategoryImportDialog - Excel import for device categories + quotas.
 *
 * Zero-props dialog controlled via DeviceQuotaCategoryContext.
 * Allows bulk importing of device categories (nhom_thiet_bi) from Excel files.
 * If Excel has quota columns, auto-creates a draft decision and imports chi_tiet.
 */

import * as React from "react"
import { FileSpreadsheet, Loader2, Upload, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { readExcelFile, worksheetToJson } from "@/lib/excel-utils"
import { translateRpcError } from "@/lib/error-translations"
import { toKeyedTexts } from "@/lib/list-key-utils"
import {
  type ParsedCategoryRow,
  type ImportResult,
  type ImportStatus,
  validateParsedRows,
  transformExcelHeaders,
} from "@/lib/category-import-validation"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

// ============================================
// Component
// ============================================

export function DeviceQuotaCategoryImportDialog() {
  const { isImportDialogOpen, closeImportDialog, allCategories, donViId } =
    useDeviceQuotaCategoryContext()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // State
  const [status, setStatus] = React.useState<ImportStatus>("idle")
  const [parsedRows, setParsedRows] = React.useState<ParsedCategoryRow[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [validationErrors, setValidationErrors] = React.useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = React.useState<string[]>([])
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null)

  const resetParsedState = React.useCallback((): void => {
    setParsedRows([])
    setParseError(null)
    setValidationErrors([])
    setValidationWarnings([])
  }, [])

  // Existing category codes for duplicate detection
  const existingCodes = React.useMemo(() => {
    return new Set((allCategories ?? []).map((c) => c.ma_nhom))
  }, [allCategories])

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!isImportDialogOpen) {
      const timer = setTimeout(() => {
        setStatus("idle")
        resetParsedState()
        setImportResult(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [isImportDialogOpen, resetParsedState])

  // File change handler
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setStatus("parsing")
    resetParsedState()

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

      setParsedRows(validRows)
      setValidationErrors(errors)
      setValidationWarnings(warnings)
      setStatus("parsed")
    } catch (error) {
      console.error("Failed to parse Excel file:", error)
      setParseError(error instanceof Error ? error.message : "Loi doc file Excel")
      setStatus("error")
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
      setStatus("importing")
      setImportResult(result)

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
            description: result.failed > 0
              ? `Đã thêm ${result.inserted} danh mục mới (${result.failed} đã tồn tại) và ${quotaResult.inserted} định mức${quotaResult.failed > 0 ? ` (${quotaResult.failed} lỗi)` : ""}. Quyết định định mức nhập đã được tạo tự động.`
              : `Đã thêm ${result.inserted} danh mục và ${quotaResult.inserted} định mức${quotaResult.failed > 0 ? ` (${quotaResult.failed} lỗi)` : ""}. Quyết định định mức nhập đã được tạo tự động.`,
          })
        } catch (quotaError) {
          quotaImportFailed = true
          console.error("Failed to import quotas:", quotaError)
          toast({
            variant: "destructive",
            title: "Định mức thất bại",
            description: `Đã thêm ${result.inserted} danh mục nhưng nhập định mức thất bại: ${translateRpcError(quotaError instanceof Error ? quotaError.message : "Lỗi không xác định")}`,
          })
        }
      } else {
        toast({
          title: "Nhập thành công",
          description: `Đã thêm ${result.inserted} danh mục${result.failed > 0 ? `, ${result.failed} thất bại` : ""}.`,
        })
      }

      setStatus(quotaImportFailed ? "partial_success" : "success")

      // Invalidate queries to refresh category list
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_nhom_list_paginated"] })
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_nhom_list"] })
    },
    onError: (error: Error) => {
      setStatus("error")
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
            <FileSpreadsheet className="h-5 w-5" />
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

          {/* Parsing indicator */}
          {status === "parsing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang đọc file...
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Lỗi đọc file</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Validation errors (blocking - rows were skipped) */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Lỗi dữ liệu - {validationErrors.length} dòng bị bỏ qua</AlertTitle>
              <AlertDescription>
                <ScrollArea className="h-32 mt-2">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {toKeyedTexts(validationErrors.slice(0, 20)).map(({ key, text }) => (
                      <li key={key}>{text}</li>
                    ))}
                    {validationErrors.length > 20 && (
                      <li className="text-muted-foreground">
                        ... và {validationErrors.length - 20} lỗi khác
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Validation warnings (non-blocking) */}
          {validationWarnings.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Cảnh báo ({validationWarnings.length})</AlertTitle>
              <AlertDescription className="text-yellow-700">
                <ScrollArea className="h-24 mt-2">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {toKeyedTexts(validationWarnings.slice(0, 10)).map(({ key, text }) => (
                      <li key={key}>{text}</li>
                    ))}
                    {validationWarnings.length > 10 && (
                      <li className="text-yellow-600">
                        ... và {validationWarnings.length - 10} cảnh báo khác
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Parsed successfully */}
          {status === "parsed" && parsedRows.length > 0 && (
            <Alert className={validationErrors.length > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
              <CheckCircle2 className={`h-4 w-4 ${validationErrors.length > 0 ? "text-yellow-600" : "text-green-600"}`} />
              <AlertTitle className={validationErrors.length > 0 ? "text-yellow-800" : ""}>
                {validationErrors.length > 0 ? "Sẵn sàng nhập (một phần)" : "Sẵn sàng nhập"}
              </AlertTitle>
              <AlertDescription className={validationErrors.length > 0 ? "text-yellow-700" : ""}>
                Đã đọc được {parsedRows.length} danh mục hợp lệ từ file Excel.
                {validationErrors.length > 0 && (
                  <span className="text-red-600"> ({validationErrors.length} dòng bị bỏ qua do lỗi.)</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* No valid rows */}
          {status === "parsed" && parsedRows.length === 0 && validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Không có dữ liệu hợp lệ</AlertTitle>
              <AlertDescription>
                Tất cả các dòng trong file đều có lỗi. Vui lòng sửa file và thử lại.
              </AlertDescription>
            </Alert>
          )}

          {/* Import success */}
          {status === "success" && importResult && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Nhập thành công</AlertTitle>
              <AlertDescription className="text-green-700">
                Đã thêm {importResult.inserted} danh mục vào hệ thống.
                {importResult.failed > 0 && (
                  <span className="text-red-600">
                    {" "}
                    {importResult.failed} danh mục thất bại.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Partial success – categories OK but quota import failed */}
          {status === "partial_success" && importResult && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Nhập thành công một phần</AlertTitle>
              <AlertDescription className="text-yellow-700">
                Đã thêm {importResult.inserted} danh mục nhưng nhập định mức thất bại.
                Vui lòng thử nhập định mức riêng.
              </AlertDescription>
            </Alert>
          )}

          {/* Submitting indicator */}
          {isSubmitting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang nhập dữ liệu...
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {status === "success" || status === "partial_success" ? "Đóng" : "Hủy"}
          </Button>
          {status !== "success" && status !== "partial_success" && (
            <Button onClick={handleImport} disabled={!canImport || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang nhập...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
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
