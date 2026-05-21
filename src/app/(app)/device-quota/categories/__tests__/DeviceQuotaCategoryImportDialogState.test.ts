import { describe, expect, it } from "vitest"

import type { ImportResult, ParsedCategoryRow } from "@/lib/category-import-validation"

import {
  importDialogReducer,
  initialImportDialogState,
} from "../_components/DeviceQuotaCategoryImportDialogState"

const parsedRow: ParsedCategoryRow = {
  ma_nhom: "A.01",
  ten_nhom: "May xet nghiem",
  parent_ma_nhom: null,
  phan_loai: null,
  don_vi_tinh: null,
  thu_tu_hien_thi: null,
  mo_ta: null,
  dinh_muc_toi_da: 5,
  toi_thieu: 1,
}

const importResult: ImportResult = {
  success: true,
  inserted: 1,
  failed: 0,
  total: 1,
  details: [],
}

describe("DeviceQuotaCategoryImportDialogState", () => {
  it("resets all parse and import state", () => {
    const dirtyState = importDialogReducer(initialImportDialogState, {
      type: "parse-succeeded",
      rows: [parsedRow],
      errors: ["Dong 2 loi"],
      warnings: ["Trung ma"],
    })

    expect(importDialogReducer(dirtyState, { type: "reset" })).toEqual(initialImportDialogState)
  })

  it("stores parsed rows, validation errors, and validation warnings together", () => {
    const nextState = importDialogReducer(initialImportDialogState, {
      type: "parse-succeeded",
      rows: [parsedRow],
      errors: ["Dong 2 loi"],
      warnings: ["Trung ma"],
    })

    expect(nextState).toMatchObject({
      status: "parsed",
      parsedRows: [parsedRow],
      parseError: null,
      validationErrors: ["Dong 2 loi"],
      validationWarnings: ["Trung ma"],
      importResult: null,
    })
  })

  it("stores parse failures without stale parsed data", () => {
    const parsedState = importDialogReducer(initialImportDialogState, {
      type: "parse-succeeded",
      rows: [parsedRow],
      errors: [],
      warnings: [],
    })

    expect(importDialogReducer(parsedState, { type: "parse-failed", message: "File bi hong" })).toEqual({
      ...initialImportDialogState,
      status: "error",
      parseError: "File bi hong",
    })
  })

  it("tracks import success and partial success from a single result payload", () => {
    const importingState = importDialogReducer(initialImportDialogState, {
      type: "import-started",
      result: importResult,
    })

    expect(importingState).toMatchObject({
      status: "importing",
      importResult,
    })
    expect(importDialogReducer(importingState, { type: "import-finished", partial: false }).status).toBe(
      "success"
    )
    expect(importDialogReducer(importingState, { type: "import-finished", partial: true }).status).toBe(
      "partial_success"
    )
  })
})
