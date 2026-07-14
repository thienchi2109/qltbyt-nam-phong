import type {
  UseBulkImportStateOptions,
  UseBulkImportStateWorkbookOptions,
} from "@/components/bulk-import/useBulkImportState"

interface RawRow {
  name: string
}

interface ParsedRow extends RawRow {
  valid: boolean
}

export interface ExtendedBulkImportOptions extends UseBulkImportStateOptions<RawRow, ParsedRow> {
  source: string
}

export interface ExtendedWorkbookBulkImportOptions extends UseBulkImportStateWorkbookOptions<
  RawRow,
  ParsedRow
> {
  source: string
}

interface MixedBulkImportOptions {
  headerMap: Record<string, string>
  transformRow: (raw: Record<string, unknown>) => RawRow
  parseWorkbook: UseBulkImportStateWorkbookOptions<RawRow, ParsedRow>["parseWorkbook"]
  validateData: UseBulkImportStateOptions<RawRow, ParsedRow>["validateData"]
}

declare const mixedOptions: MixedBulkImportOptions

// @ts-expect-error Default and workbook parser modes are mutually exclusive.
const invalidMixedOptions:
  | UseBulkImportStateOptions<RawRow, ParsedRow>
  | UseBulkImportStateWorkbookOptions<RawRow, ParsedRow> = mixedOptions

void invalidMixedOptions
