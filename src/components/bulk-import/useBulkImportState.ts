"use client"

import { useRef, useState, useCallback, useMemo } from "react"
import { readExcelFile, worksheetToJson } from "@/lib/excel-utils"
import type {
  BulkImportState,
  BulkImportWorkbookParser,
  ValidationResult,
} from "./bulk-import-types"

/**
 * Configuration options for useBulkImportState hook
 */
interface BaseBulkImportStateOptions<TRaw, TRow> {
  /**
   * Validate all transformed data and return valid records
   */
  validateData: (data: TRaw[]) => ValidationResult<TRow>

  /**
   * Accepted file extensions (default: '.xlsx, .xls')
   */
  acceptedExtensions?: string
}

export interface UseBulkImportStateOptions<TRaw, TRow> extends BaseBulkImportStateOptions<
  TRaw,
  TRow
> {
  /**
   * Map Vietnamese Excel headers to database field names
   * e.g., { 'Ma nhom thiet bi': 'ma_nhom', 'So luong': 'so_luong' }
   */
  headerMap: Record<string, string>

  /**
   * Transform raw row data after header mapping
   * Use for type coercion, trimming, etc.
   */
  transformRow: (raw: Record<string, unknown>) => TRaw
  parseWorkbook?: never
}

export interface UseBulkImportStateWorkbookOptions<TRaw, TRow> extends BaseBulkImportStateOptions<
  TRaw,
  TRow
> {
  /**
   * Parse the complete loaded workbook instead of the default first-sheet flow
   */
  parseWorkbook: BulkImportWorkbookParser<TRaw>
  headerMap?: never
  transformRow?: never
}

/**
 * Return type for useBulkImportState hook
 */
export interface UseBulkImportStateReturn<TRow> {
  state: BulkImportState<TRow>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  resetState: () => void
  setSubmitting: () => void
  setSuccess: () => void
  setSubmitError: (error: string) => void
}

/**
 * Custom hook for bulk import state management
 *
 * Extracts common patterns from DeviceQuotaImportDialog and ImportEquipmentDialog.
 * Handles file selection, Excel parsing, header mapping, and validation.
 *
 * @example
 * ```tsx
 * const { state, fileInputRef, handleFileChange, resetState } = useBulkImportState({
 *   headerMap: { 'Ma nhom': 'ma_nhom', 'So luong': 'so_luong' },
 *   transformRow: (raw) => ({ ma_nhom: String(raw.ma_nhom), so_luong: Number(raw.so_luong) }),
 *   validateData: (data) => validateQuotaData(data, validCodes)
 * })
 * ```
 */
export function useBulkImportState<TRaw, TRow>(
  options: UseBulkImportStateOptions<TRaw, TRow> | UseBulkImportStateWorkbookOptions<TRaw, TRow>
): UseBulkImportStateReturn<TRow> {
  const { validateData, acceptedExtensions = ".xlsx, .xls" } = options
  const parseWorkbook = "parseWorkbook" in options ? options.parseWorkbook : undefined
  const headerMap = options.headerMap
  const transformRow = options.transformRow

  const [status, setStatus] = useState<BulkImportState<TRow>["status"]>("idle")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<TRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const parseAttemptRef = useRef(0)

  // Build regex from accepted extensions - memoized to avoid useCallback dependency issues
  const extensionRegex = useMemo(() => {
    const extensionPattern = acceptedExtensions
      .split(",")
      .map((ext) => ext.trim().replace(".", "\\."))
      .join("|")
    return new RegExp(`(${extensionPattern})$`, "i")
  }, [acceptedExtensions])

  const resetState = useCallback(() => {
    parseAttemptRef.current += 1
    setStatus("idle")
    setSelectedFile(null)
    setParsedData([])
    setParseError(null)
    setValidationErrors([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const setSubmitting = useCallback(() => {
    setStatus("submitting")
  }, [])

  const setSuccess = useCallback(() => {
    setStatus("success")
  }, [])

  const setSubmitError = useCallback((error: string) => {
    setStatus("error")
    setParseError(error)
  }, [])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const attempt = ++parseAttemptRef.current
      const file = event.target.files?.[0]
      if (!file) {
        resetState()
        return
      }

      // Validate file extension
      if (!extensionRegex.test(file.name)) {
        setParseError(`File khong hop le. Vui long chon file Excel (${acceptedExtensions}).`)
        setSelectedFile(null)
        setParsedData([])
        setValidationErrors([])
        setStatus("error")
        return
      }

      setSelectedFile(file)
      setParseError(null)
      setValidationErrors([])
      setParsedData([])
      setStatus("parsing")

      try {
        const workbook = await readExcelFile(file)
        if (attempt !== parseAttemptRef.current) return

        let rawData: TRaw[]

        if (parseWorkbook) {
          rawData = await parseWorkbook(workbook)
          if (attempt !== parseAttemptRef.current) return
        } else {
          const sheetName = workbook.SheetNames[0]
          const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined

          if (!worksheet) {
            rawData = []
          } else {
            const json = await worksheetToJson(worksheet)
            if (attempt !== parseAttemptRef.current) return

            rawData = json.map((row) => {
              const newRow: Record<string, unknown> = {}
              for (const header in row) {
                if (Object.prototype.hasOwnProperty.call(headerMap, header)) {
                  const dbKey = headerMap![header]
                  const rawVal = row[header]
                  let value: unknown = rawVal === "" || rawVal === undefined ? null : rawVal

                  if (typeof rawVal === "string") {
                    value = rawVal.trim() === "" ? null : rawVal.trim()
                  }

                  newRow[dbKey] = value
                }
              }
              return transformRow!(newRow)
            })
          }
        }

        if (rawData.length === 0) {
          setParseError("File khong co du lieu. Vui long kiem tra lai file cua ban.")
          setParsedData([])
          setStatus("error")
          return
        }

        const validation = validateData(rawData)

        if (!validation.isValid) {
          setValidationErrors(validation.errors)
          setParsedData([])
          setStatus("error")
        } else {
          setValidationErrors([])
          setParsedData(validation.validRecords)
          setStatus("parsed")
        }
      } catch (err: unknown) {
        if (attempt !== parseAttemptRef.current) return

        const errorMessage = err instanceof Error ? err.message : "Loi khong xac dinh"
        setParseError("Da co loi xay ra khi doc file: " + errorMessage)
        setParsedData([])
        setStatus("error")
      }
    },
    [
      resetState,
      parseWorkbook,
      headerMap,
      transformRow,
      validateData,
      acceptedExtensions,
      extensionRegex,
    ]
  )

  const state: BulkImportState<TRow> = {
    status,
    selectedFile,
    parsedData,
    parseError,
    validationErrors,
  }

  return {
    state,
    fileInputRef,
    handleFileChange,
    resetState,
    setSubmitting,
    setSuccess,
    setSubmitError,
  }
}
