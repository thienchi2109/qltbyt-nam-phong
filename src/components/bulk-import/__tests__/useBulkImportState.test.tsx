import { act, renderHook } from "@testing-library/react"
import type { ChangeEvent } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const excelMocks = vi.hoisted(() => ({
  readExcelFile: vi.fn(),
  worksheetToJson: vi.fn(),
}))

vi.mock("@/lib/excel-utils", () => ({
  readExcelFile: (...args: unknown[]) => excelMocks.readExcelFile(...args),
  worksheetToJson: (...args: unknown[]) => excelMocks.worksheetToJson(...args),
}))

import {
  useBulkImportState,
  type UseBulkImportStateOptions,
} from "@/components/bulk-import/useBulkImportState"

interface RawRow {
  name: string
}

interface ParsedRow extends RawRow {
  valid: boolean
}

interface ExtendedBulkImportOptions extends UseBulkImportStateOptions<RawRow, ParsedRow> {
  source: string
}

const firstSheet = { name: "First" }
const secondSheet = { name: "Second" }
const workbook = {
  SheetNames: ["First", "Second"],
  Sheets: {
    First: firstSheet,
    Second: secondSheet,
  },
  _workbook: {},
}

function createFileChangeEvent(file?: File): ChangeEvent<HTMLInputElement> {
  return {
    target: {
      files: file ? [file] : [],
    },
  } as unknown as ChangeEvent<HTMLInputElement>
}

function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

function createDefaultOptions(): ExtendedBulkImportOptions {
  return {
    source: "equipment",
    headerMap: { "Ten thiet bi": "name" },
    transformRow: (raw: Record<string, unknown>): RawRow => ({
      name: String(raw.name),
    }),
    validateData: (rows: RawRow[]) => ({
      isValid: true,
      errors: [],
      validRecords: rows.map((row) => ({ ...row, valid: true })),
    }),
  }
}

describe("useBulkImportState", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    excelMocks.readExcelFile.mockResolvedValue(workbook)
    excelMocks.worksheetToJson.mockResolvedValue([{ "Ten thiet bi": "  May sieu am  " }])
  })

  it("keeps the first-sheet header-map parser as the default", async () => {
    const options = createDefaultOptions()
    const { result } = renderHook(() => useBulkImportState<RawRow, ParsedRow>(options))
    const file = new File(["workbook"], "equipment.xlsx")

    await act(async () => {
      await result.current.handleFileChange(createFileChangeEvent(file))
    })

    expect(excelMocks.readExcelFile).toHaveBeenCalledWith(file)
    expect(excelMocks.worksheetToJson).toHaveBeenCalledWith(firstSheet)
    expect(result.current.state).toEqual({
      status: "parsed",
      selectedFile: file,
      parsedData: [{ name: "May sieu am", valid: true }],
      parseError: null,
      validationErrors: [],
    })
  })

  it("clears previous rows while a new file is parsing", async () => {
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>(createDefaultOptions())
    )

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "first.xlsx"))
      )
    })
    expect(result.current.state.parsedData).toEqual([{ name: "May sieu am", valid: true }])

    const nextRead = createDeferred<typeof workbook>()
    excelMocks.readExcelFile.mockReturnValueOnce(nextRead.promise)
    const secondFile = new File(["workbook"], "second.xlsx")
    let secondAttempt!: Promise<void>

    await act(async () => {
      secondAttempt = result.current.handleFileChange(createFileChangeEvent(secondFile))
      await Promise.resolve()
    })

    expect(result.current.state.status).toBe("parsing")
    expect(result.current.state.selectedFile).toBe(secondFile)
    expect(result.current.state.parsedData).toEqual([])

    await act(async () => {
      nextRead.resolve(workbook)
      await secondAttempt
    })
  })

  it("keeps reset state when a pending workbook read finishes", async () => {
    const pendingRead = createDeferred<typeof workbook>()
    excelMocks.readExcelFile.mockReturnValueOnce(pendingRead.promise)
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>(createDefaultOptions())
    )
    let attempt!: Promise<void>

    await act(async () => {
      attempt = result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "pending.xlsx"))
      )
      await Promise.resolve()
    })
    expect(result.current.state.status).toBe("parsing")

    act(() => {
      result.current.resetState()
    })
    expect(result.current.state.status).toBe("idle")

    await act(async () => {
      pendingRead.resolve(workbook)
      await attempt
    })

    expect(excelMocks.worksheetToJson).not.toHaveBeenCalled()
    expect(result.current.state).toEqual({
      status: "idle",
      selectedFile: null,
      parsedData: [],
      parseError: null,
      validationErrors: [],
    })
  })

  it("delegates the loaded workbook to a custom parser", async () => {
    const parseWorkbook = vi.fn().mockResolvedValue([{ name: "Canonical row" }])
    const validateData = vi.fn((rows: RawRow[]) => ({
      isValid: true,
      errors: [],
      validRecords: rows.map((row) => ({ ...row, valid: true })),
    }))
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>({
        parseWorkbook,
        validateData,
      })
    )
    const file = new File(["workbook"], "baseline.xlsx")

    await act(async () => {
      await result.current.handleFileChange(createFileChangeEvent(file))
    })

    expect(parseWorkbook).toHaveBeenCalledWith(workbook)
    expect(excelMocks.worksheetToJson).not.toHaveBeenCalled()
    expect(validateData).toHaveBeenCalledWith([{ name: "Canonical row" }])
    expect(result.current.state.parsedData).toEqual([{ name: "Canonical row", valid: true }])
    expect(result.current.state.status).toBe("parsed")
  })

  it("ignores an older parser result that finishes after a newer attempt", async () => {
    const firstParse = createDeferred<RawRow[]>()
    const secondParse = createDeferred<RawRow[]>()
    const parseWorkbook = vi
      .fn()
      .mockReturnValueOnce(firstParse.promise)
      .mockReturnValueOnce(secondParse.promise)
    const validateData = createDefaultOptions().validateData
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>({
        parseWorkbook,
        validateData,
      })
    )
    const firstFile = new File(["workbook"], "first.xlsx")
    const secondFile = new File(["workbook"], "second.xlsx")
    let firstAttempt!: Promise<void>
    let secondAttempt!: Promise<void>

    await act(async () => {
      firstAttempt = result.current.handleFileChange(createFileChangeEvent(firstFile))
      await Promise.resolve()
    })
    expect(parseWorkbook).toHaveBeenCalledTimes(1)

    await act(async () => {
      secondAttempt = result.current.handleFileChange(createFileChangeEvent(secondFile))
      await Promise.resolve()
    })
    expect(parseWorkbook).toHaveBeenCalledTimes(2)

    await act(async () => {
      secondParse.resolve([{ name: "Second result" }])
      await secondAttempt
    })
    expect(result.current.state.selectedFile).toBe(secondFile)
    expect(result.current.state.parsedData).toEqual([{ name: "Second result", valid: true }])

    await act(async () => {
      firstParse.resolve([{ name: "First result" }])
      await firstAttempt
    })

    expect(result.current.state.selectedFile).toBe(secondFile)
    expect(result.current.state.parsedData).toEqual([{ name: "Second result", valid: true }])
  })

  it("ignores an older parser rejection after a newer attempt succeeds", async () => {
    const firstParse = createDeferred<RawRow[]>()
    const parseWorkbook = vi
      .fn()
      .mockReturnValueOnce(firstParse.promise)
      .mockResolvedValueOnce([{ name: "Second result" }])
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>({
        parseWorkbook,
        validateData: createDefaultOptions().validateData,
      })
    )
    const secondFile = new File(["workbook"], "second.xlsx")
    let firstAttempt!: Promise<void>

    await act(async () => {
      firstAttempt = result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "first.xlsx"))
      )
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.handleFileChange(createFileChangeEvent(secondFile))
    })
    expect(result.current.state.selectedFile).toBe(secondFile)
    expect(result.current.state.parsedData).toEqual([{ name: "Second result", valid: true }])

    await act(async () => {
      firstParse.reject(new Error("Old parser failed"))
      await firstAttempt
    })

    expect(result.current.state.selectedFile).toBe(secondFile)
    expect(result.current.state.parsedData).toEqual([{ name: "Second result", valid: true }])
    expect(result.current.state.parseError).toBeNull()
  })

  it("reports an empty custom parser result without invoking validation", async () => {
    const parseWorkbook = vi.fn().mockResolvedValue([])
    const validateData = vi.fn(createDefaultOptions().validateData)
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>({
        parseWorkbook,
        validateData,
      })
    )

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "baseline.xlsx"))
      )
    })

    expect(validateData).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe("error")
    expect(result.current.state.parsedData).toEqual([])
    expect(result.current.state.parseError).toBe(
      "File khong co du lieu. Vui long kiem tra lai file cua ban."
    )
  })

  it("reports custom parser failures", async () => {
    const parseWorkbook = vi.fn().mockRejectedValue(new Error("Invalid canonical workbook"))
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>({
        parseWorkbook,
        validateData: createDefaultOptions().validateData,
      })
    )

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "baseline.xlsx"))
      )
    })

    expect(result.current.state.status).toBe("error")
    expect(result.current.state.parsedData).toEqual([])
    expect(result.current.state.parseError).toBe(
      "Da co loi xay ra khi doc file: Invalid canonical workbook"
    )
  })

  it("keeps validation errors and clears parsed rows", async () => {
    const options = {
      ...createDefaultOptions(),
      validateData: () => ({
        isValid: false,
        errors: ["Dong 2 khong hop le"],
        validRecords: [],
      }),
    }
    const { result } = renderHook(() => useBulkImportState<RawRow, ParsedRow>(options))

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "equipment.xlsx"))
      )
    })

    expect(result.current.state.status).toBe("error")
    expect(result.current.state.validationErrors).toEqual(["Dong 2 khong hop le"])
    expect(result.current.state.parsedData).toEqual([])
  })

  it("clears validation errors before reporting a later parse error", async () => {
    const options = {
      ...createDefaultOptions(),
      validateData: () => ({
        isValid: false,
        errors: ["Dong 2 khong hop le"],
        validRecords: [],
      }),
    }
    const { result } = renderHook(() => useBulkImportState<RawRow, ParsedRow>(options))

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "first.xlsx"))
      )
    })
    expect(result.current.state.validationErrors).toEqual(["Dong 2 khong hop le"])

    const pendingRead = createDeferred<typeof workbook>()
    excelMocks.readExcelFile.mockReturnValueOnce(pendingRead.promise)
    excelMocks.worksheetToJson.mockResolvedValueOnce([])
    let secondAttempt!: Promise<void>

    await act(async () => {
      secondAttempt = result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "second.xlsx"))
      )
      await Promise.resolve()
    })

    expect(result.current.state.status).toBe("parsing")
    expect(result.current.state.validationErrors).toEqual([])

    await act(async () => {
      pendingRead.resolve(workbook)
      await secondAttempt
    })

    expect(result.current.state.validationErrors).toEqual([])
    expect(result.current.state.parseError).toBe(
      "File khong co du lieu. Vui long kiem tra lai file cua ban."
    )
  })

  it("rejects unsupported extensions without parsing", async () => {
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>(createDefaultOptions())
    )

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "equipment.csv"))
      )
    })

    expect(excelMocks.readExcelFile).not.toHaveBeenCalled()
    expect(result.current.state).toEqual({
      status: "error",
      selectedFile: null,
      parsedData: [],
      parseError: "File khong hop le. Vui long chon file Excel (.xlsx, .xls).",
      validationErrors: [],
    })
  })

  it("reports an empty first worksheet without invoking validation", async () => {
    excelMocks.worksheetToJson.mockResolvedValueOnce([])
    const validateData = vi.fn(createDefaultOptions().validateData)
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>({
        ...createDefaultOptions(),
        validateData,
      })
    )

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "equipment.xlsx"))
      )
    })

    expect(validateData).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe("error")
    expect(result.current.state.parsedData).toEqual([])
    expect(result.current.state.parseError).toBe(
      "File khong co du lieu. Vui long kiem tra lai file cua ban."
    )
  })

  it("reports a workbook without worksheets as empty", async () => {
    excelMocks.readExcelFile.mockResolvedValueOnce({
      SheetNames: [],
      Sheets: {},
      _workbook: {},
    })
    const validateData = vi.fn(createDefaultOptions().validateData)
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>({
        ...createDefaultOptions(),
        validateData,
      })
    )

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "equipment.xlsx"))
      )
    })

    expect(excelMocks.worksheetToJson).not.toHaveBeenCalled()
    expect(validateData).not.toHaveBeenCalled()
    expect(result.current.state.status).toBe("error")
    expect(result.current.state.parsedData).toEqual([])
    expect(result.current.state.parseError).toBe(
      "File khong co du lieu. Vui long kiem tra lai file cua ban."
    )
  })

  it("reports workbook read failures", async () => {
    excelMocks.readExcelFile.mockRejectedValueOnce(new Error("Invalid workbook"))
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>(createDefaultOptions())
    )

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "equipment.xlsx"))
      )
    })

    expect(result.current.state.status).toBe("error")
    expect(result.current.state.parsedData).toEqual([])
    expect(result.current.state.parseError).toBe("Da co loi xay ra khi doc file: Invalid workbook")
  })

  it("resets parsed state when file selection is cleared", async () => {
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>(createDefaultOptions())
    )

    await act(async () => {
      await result.current.handleFileChange(
        createFileChangeEvent(new File(["workbook"], "equipment.xlsx"))
      )
    })
    expect(result.current.state.status).toBe("parsed")

    await act(async () => {
      await result.current.handleFileChange(createFileChangeEvent())
    })

    expect(result.current.state).toEqual({
      status: "idle",
      selectedFile: null,
      parsedData: [],
      parseError: null,
      validationErrors: [],
    })
  })

  it("preserves submit state transitions", () => {
    const { result } = renderHook(() =>
      useBulkImportState<RawRow, ParsedRow>(createDefaultOptions())
    )

    act(() => {
      result.current.setSubmitting()
    })
    expect(result.current.state.status).toBe("submitting")

    act(() => {
      result.current.setSuccess()
    })
    expect(result.current.state.status).toBe("success")

    act(() => {
      result.current.setSubmitError("Import failed")
    })
    expect(result.current.state.status).toBe("error")
    expect(result.current.state.parseError).toBe("Import failed")
  })
})
