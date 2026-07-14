/** Visible worksheet containing canonical baseline rows. */
export const BASELINE_WORKBOOK_SHEET_NAME = "Baseline"

/** Hidden worksheet containing the workbook ownership metadata. */
export const BASELINE_WORKBOOK_META_SHEET_NAME = "_meta"

/** Stable discriminator for technical configuration baseline workbooks. */
export const BASELINE_WORKBOOK_TEMPLATE_KIND = "technical_configuration_baseline"

/** Supported baseline workbook contract version. */
export const BASELINE_WORKBOOK_TEMPLATE_VERSION = 1

/** Exact ordered columns accepted on the Baseline worksheet. */
export const BASELINE_WORKBOOK_COLUMNS = [
  "row_type",
  "group_order",
  "group_name",
  "criterion_order",
  "criterion_code",
  "criterion_title",
  "requirement_text",
] as const

/** Exact ordered metadata keys accepted on the hidden worksheet. */
export const BASELINE_WORKBOOK_META_KEYS = [
  "template_kind",
  "template_version",
  "dossier_id",
  "baseline_version_id",
  "baseline_revision",
  "generated_at",
] as const

/** Editable starter groups derived from the reference CSV files. */
export const BASELINE_WORKBOOK_SUGGESTED_GROUPS = [
  "Yêu cầu chung",
  "Yêu cầu cấu hình cung cấp",
  "Yêu cầu kỹ thuật",
  "Yêu cầu khác",
] as const

export interface TechnicalConfigurationBaselineWorkbookMetadata {
  template_kind: typeof BASELINE_WORKBOOK_TEMPLATE_KIND
  template_version: typeof BASELINE_WORKBOOK_TEMPLATE_VERSION
  dossier_id: string
  baseline_version_id: string
  baseline_revision: number
  generated_at: string
}

export interface TechnicalConfigurationBaselineWorkbookGroupRow {
  row_type: "GROUP"
  group_order: number
  group_name: string
  criterion_order: null
  criterion_code: null
  criterion_title: null
  requirement_text: null
}

export interface TechnicalConfigurationBaselineWorkbookCriterionRow {
  row_type: "CRITERION"
  group_order: number
  group_name: null
  criterion_order: number
  criterion_code: string | null
  criterion_title: string | null
  requirement_text: string
}

export type TechnicalConfigurationBaselineWorkbookRow =
  | TechnicalConfigurationBaselineWorkbookGroupRow
  | TechnicalConfigurationBaselineWorkbookCriterionRow

export interface TechnicalConfigurationBaselineWorkbookParseResult {
  metadata: TechnicalConfigurationBaselineWorkbookMetadata
  rows: TechnicalConfigurationBaselineWorkbookRow[]
}
