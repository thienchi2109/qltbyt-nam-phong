"use client"

/**
 * DeviceQuotaCategoryImportDialog - Excel import for device categories
 *
 * Zero-props dialog controlled via DeviceQuotaCategoryContext.
 * Allows bulk importing of device categories (nhom_thiet_bi) from Excel files.
 *
 * @example
 * ```tsx
 * // In page.tsx, inside DeviceQuotaCategoryProvider:
 * <DeviceQuotaCategoryImportDialog />
 *
 * // Open via context:
 * const { openImportDialog } = useDeviceQuotaCategoryContext()
 * <Button onClick={openImportDialog}>Import</Button>
 * ```
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
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

// ============================================
// Types
// ============================================

interface ParsedCategoryRow {
  ma_nhom: string
  ten_nhom: string
  parent_ma_nhom: string | null
  phan_loai: string | null
  don_vi_tinh: string | null
  thu_tu_hien_thi: number | null
  mo_ta: string | null
}

interface ImportResultDetail {
  ma_nhom: string
  success: boolean
  error?: string
}

interface ImportResult {
  success: boolean
  inserted: number
  failed: number
  total: number
  details: ImportResultDetail[]
}

type ImportStatus = "idle" | "parsing" | "parsed" | "success" | "error"

// ============================================
// Header Mapping with Diacritic Support
// ============================================

/**
 * Normalize Vietnamese text by removing diacritics for header matching.
 * This allows Excel files with either diacritic or non-diacritic headers to work.
 */
function normalizeVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/đ/gi, "d") // Handle đ separately
    .toLowerCase()
    .trim()
}

// Map normalized Vietnamese headers to database field names
// Supports both with and without diacritics
const HEADER_TO_DB_MAP: Record<string, string> = {
  "stt": "_stt", // Ignored
  "ma nhom": "ma_nhom",
  "ten nhom": "ten_nhom",
  "ma nhom cha": "parent_ma_nhom",
  "phan loai": "phan_loai",
  "don vi tinh": "don_vi_tinh",
  "thu tu hien thi": "thu_tu_hien_thi",
  "mo ta": "mo_ta",
}

// ============================================
// Validation
// ============================================

// ma_nhom format pattern: XX, XX.XX, XX.XX.XX, XX.XX.XX.XX (1-4 levels, alphanumeric)
const MA_NHOM_PATTERN = /^[A-Za-z0-9]+(\.[A-Za-z0-9]+){0,3}$/

function validateParsedRows(
  rows: Record<string, unknown>[],
  existingCodes: Set<string>
): { validRows: ParsedCategoryRow[]; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const validRows: ParsedCategoryRow[] = []
  const seenCodes = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // Excel row (1-indexed, header is row 1)
    const rowErrors: string[] = []
    const rowWarnings: string[] = []

    // Get values
    const maNhom = String(row.ma_nhom ?? "").trim()
    const tenNhom = String(row.ten_nhom ?? "").trim()
    const parentMaNhom = row.parent_ma_nhom ? String(row.parent_ma_nhom).trim() : null
    const phanLoai = row.phan_loai ? String(row.phan_loai).trim().toUpperCase() : null
    const donViTinh = row.don_vi_tinh ? String(row.don_vi_tinh).trim() : null
    const thuTuRaw = row.thu_tu_hien_thi
    const moTa = row.mo_ta ? String(row.mo_ta).trim() : null

    // Skip empty rows
    if (!maNhom && !tenNhom) {
      continue
    }

    // Required field validation (blocking errors)
    if (!maNhom) {
      rowErrors.push(`Dong ${rowNum}: Thieu ma nhom (bat buoc)`)
    }
    if (!tenNhom) {
      rowErrors.push(`Dong ${rowNum}: Thieu ten nhom (bat buoc)`)
    }

    // ma_nhom format validation (blocking error)
    if (maNhom && !MA_NHOM_PATTERN.test(maNhom)) {
      rowErrors.push(`Dong ${rowNum}: Ma nhom "${maNhom}" khong dung dinh dang (VD: XX, XX.XX, XX.XX.XX)`)
    }

    // Duplicate check within file (blocking error)
    if (maNhom && seenCodes.has(maNhom)) {
      rowErrors.push(`Dong ${rowNum}: Ma nhom "${maNhom}" bi trung trong file`)
    }

    // Duplicate check against existing categories (warning - server will handle per-item)
    if (maNhom && existingCodes.has(maNhom)) {
      rowWarnings.push(`Dong ${rowNum}: Ma nhom "${maNhom}" da ton tai - se bi bo qua`)
    }

    // Classification validation (blocking error for invalid values)
    if (phanLoai && phanLoai !== "A" && phanLoai !== "B") {
      rowErrors.push(`Dong ${rowNum}: Phan loai phai la "A" hoac "B", khong phai "${phanLoai}"`)
    }

    // Display order validation (must be integer >= 0)
    let thuTuHienThi: number | null = null
    if (thuTuRaw !== null && thuTuRaw !== undefined && thuTuRaw !== "") {
      const parsed = Number(thuTuRaw)
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        rowErrors.push(`Dong ${rowNum}: Thu tu hien thi phai la so nguyen >= 0`)
      } else {
        thuTuHienThi = parsed
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors)
      // Row with errors won't be added to validRows
    } else if (maNhom) {
      // Add warnings but still include the row
      warnings.push(...rowWarnings)
      seenCodes.add(maNhom)
      validRows.push({
        ma_nhom: maNhom,
        ten_nhom: tenNhom,
        parent_ma_nhom: parentMaNhom || null,
        phan_loai: phanLoai,
        don_vi_tinh: donViTinh,
        thu_tu_hien_thi: thuTuHienThi,
        mo_ta: moTa,
      })
    }
  }

  return { validRows, errors, warnings }
}

// ============================================
// Component
// ============================================

export function DeviceQuotaCategoryImportDialog() {
  const { isImportDialogOpen, closeImportDialog, categories, donViId } =
    useDeviceQuotaCategoryContext()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // State
  const [status, setStatus] = React.useState<ImportStatus>("idle")
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [parsedRows, setParsedRows] = React.useState<ParsedCategoryRow[]>([])
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [validationErrors, setValidationErrors] = React.useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = React.useState<string[]>([])
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null)

  // Existing category codes for duplicate detection
  const existingCodes = React.useMemo(() => {
    return new Set(categories.map((c) => c.ma_nhom))
  }, [categories])

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!isImportDialogOpen) {
      // Delay reset to allow closing animation
      const timer = setTimeout(() => {
        setStatus("idle")
        setSelectedFile(null)
        setParsedRows([])
        setParseError(null)
        setValidationErrors([])
        setValidationWarnings([])
        setImportResult(null)
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

    setSelectedFile(file)
    setStatus("parsing")
    setParseError(null)
    setValidationErrors([])
    setValidationWarnings([])
    setParsedRows([])

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
      const transformedData = jsonData.map(row => {
        const newRow: Record<string, unknown> = {}
        for (const header in row) {
          // Normalize header for matching
          const normalizedHeader = normalizeVietnamese(header)
          if (Object.prototype.hasOwnProperty.call(HEADER_TO_DB_MAP, normalizedHeader)) {
            const dbKey = HEADER_TO_DB_MAP[normalizedHeader]
            const rawVal = row[header]
            let value: unknown = (rawVal === "" || rawVal === undefined) ? null : rawVal

            // Trim string values
            if (typeof rawVal === "string") {
              value = rawVal.trim() === "" ? null : rawVal.trim()
            }

            newRow[dbKey] = value
          }
        }
        return newRow
      })

      // Check if any rows have data (after transformation)
      const hasData = transformedData.some(row => 
        row.ma_nhom !== undefined || row.ten_nhom !== undefined
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
    onSuccess: (result) => {
      setImportResult(result)
      setStatus("success")

      // Invalidate queries to refresh category list
      queryClient.invalidateQueries({ queryKey: ["dinh_muc_nhom_list"] })

      toast({
        title: "Nhap thanh cong",
        description: `Da them ${result.inserted} danh muc${result.failed > 0 ? `, ${result.failed} that bai` : ""}.`,
      })
    },
    onError: (error: Error) => {
      setStatus("error")
      toast({
        variant: "destructive",
        title: "Nhap that bai",
        description: translateRpcError(error.message),
      })
    },
  })

  const handleImport = () => {
    if (parsedRows.length === 0) return
    importMutation.mutate(parsedRows)
  }

  const handleClose = () => {
    if (importMutation.isPending) return // Prevent closing while submitting
    closeImportDialog()
  }

  // Allow import if there are valid rows (even if there are warnings or errors for other rows)
  // Errors mean some rows were skipped, warnings mean some rows may fail on server
  const canImport = status === "parsed" && parsedRows.length > 0

  // Mark selectedFile as used to avoid lint warning
  void selectedFile

  return (
    <Dialog open={isImportDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Nhap danh muc tu Excel
          </DialogTitle>
          <DialogDescription>
            Tai len file Excel theo mau de nhap hang loat danh muc thiet bi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="category-import-file">Chon file Excel</Label>
            <Input
              ref={fileInputRef}
              id="category-import-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={importMutation.isPending}
            />
          </div>

          {/* Parsing indicator */}
          {status === "parsing" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Dang doc file...
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Loi doc file</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {/* Validation errors (blocking - rows were skipped) */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Loi du lieu - {validationErrors.length} dong bi bo qua</AlertTitle>
              <AlertDescription>
                <ScrollArea className="h-32 mt-2">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validationErrors.slice(0, 20).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                    {validationErrors.length > 20 && (
                      <li className="text-muted-foreground">
                        ... va {validationErrors.length - 20} loi khac
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Validation warnings (non-blocking - rows included but may fail on server) */}
          {validationWarnings.length > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">Canh bao ({validationWarnings.length})</AlertTitle>
              <AlertDescription className="text-yellow-700">
                <ScrollArea className="h-24 mt-2">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {validationWarnings.slice(0, 10).map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                    {validationWarnings.length > 10 && (
                      <li className="text-yellow-600">
                        ... va {validationWarnings.length - 10} canh bao khac
                      </li>
                    )}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {/* Parsed successfully - show valid row count */}
          {status === "parsed" && parsedRows.length > 0 && (
            <Alert className={validationErrors.length > 0 ? "border-yellow-200 bg-yellow-50" : ""}>
              <CheckCircle2 className={`h-4 w-4 ${validationErrors.length > 0 ? "text-yellow-600" : "text-green-600"}`} />
              <AlertTitle className={validationErrors.length > 0 ? "text-yellow-800" : ""}>
                {validationErrors.length > 0 ? "San sang nhap (mot phan)" : "San sang nhap"}
              </AlertTitle>
              <AlertDescription className={validationErrors.length > 0 ? "text-yellow-700" : ""}>
                Da doc duoc {parsedRows.length} danh muc hop le tu file Excel.
                {validationErrors.length > 0 && (
                  <span className="text-red-600"> ({validationErrors.length} dong bi bo qua do loi.)</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* No valid rows after parsing */}
          {status === "parsed" && parsedRows.length === 0 && validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Khong co du lieu hop le</AlertTitle>
              <AlertDescription>
                Tat ca cac dong trong file deu co loi. Vui long sua file va thu lai.
              </AlertDescription>
            </Alert>
          )}

          {/* Import success */}
          {status === "success" && importResult && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Nhap thanh cong</AlertTitle>
              <AlertDescription className="text-green-700">
                Da them {importResult.inserted} danh muc vao he thong.
                {importResult.failed > 0 && (
                  <span className="text-red-600">
                    {" "}
                    {importResult.failed} danh muc that bai.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Submitting indicator */}
          {importMutation.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Dang nhap du lieu...
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importMutation.isPending}>
            {status === "success" ? "Dong" : "Huy"}
          </Button>
          {status !== "success" && (
            <Button onClick={handleImport} disabled={!canImport || importMutation.isPending}>
              {importMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Dang nhap...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Nhap {parsedRows.length > 0 ? `(${parsedRows.length})` : ""}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
