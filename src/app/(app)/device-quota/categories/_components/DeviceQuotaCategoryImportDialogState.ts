import type {
  ImportResult,
  ImportStatus,
  ParsedCategoryRow,
} from "@/lib/category-import-validation"

export interface ImportDialogState {
  status: ImportStatus
  parsedRows: ParsedCategoryRow[]
  parseError: string | null
  validationErrors: string[]
  validationWarnings: string[]
  importResult: ImportResult | null
}

export type ImportDialogAction =
  | { type: "reset" }
  | { type: "parse-started" }
  | {
      type: "parse-succeeded"
      rows: ParsedCategoryRow[]
      errors: string[]
      warnings: string[]
    }
  | { type: "parse-failed"; message: string }
  | { type: "import-started"; result: ImportResult }
  | { type: "import-finished"; partial: boolean }
  | { type: "import-failed" }

/** Initial empty state for the category Excel import dialog. */
export const initialImportDialogState: ImportDialogState = {
  status: "idle",
  parsedRows: [],
  parseError: null,
  validationErrors: [],
  validationWarnings: [],
  importResult: null,
}

/** Applies a single import dialog transition so related state changes stay atomic. */
export function importDialogReducer(
  state: ImportDialogState,
  action: ImportDialogAction
): ImportDialogState {
  switch (action.type) {
    case "reset":
      return initialImportDialogState
    case "parse-started":
      return {
        ...initialImportDialogState,
        status: "parsing",
      }
    case "parse-succeeded":
      return {
        status: "parsed",
        parsedRows: action.rows,
        parseError: null,
        validationErrors: action.errors,
        validationWarnings: action.warnings,
        importResult: null,
      }
    case "parse-failed":
      return {
        ...initialImportDialogState,
        status: "error",
        parseError: action.message,
      }
    case "import-started":
      return {
        ...state,
        status: "importing",
        importResult: action.result,
      }
    case "import-finished":
      return {
        ...state,
        status: action.partial ? "partial_success" : "success",
      }
    case "import-failed":
      return {
        ...state,
        status: "error",
      }
    default:
      return state
  }
}
