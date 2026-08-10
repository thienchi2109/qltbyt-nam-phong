import {
  BASELINE_WORKBOOK_V2_TEMPLATE_KIND,
  BASELINE_WORKBOOK_V2_TEMPLATE_VERSION,
} from "@/lib/technical-configuration-baseline-excel-v2-contract"
import type { TechnicalConfigurationBaselineWorkbookParseResult } from "@/lib/technical-configuration-baseline-excel-contract"

export type TechnicalConfigurationBaselineWorkbookV2IssueCode =
  | "unexpected_sheet"
  | "missing_sheet"
  | "invalid_sheet_visibility"
  | "invalid_columns"
  | "invalid_cell_value"
  | "invalid_metadata"
  | "version_mismatch"
  | "invalid_file_type"
  | "file_too_large"
  | "meaningful_row_limit_exceeded"
  | "workbook_read_error"
  | "unsupported_marker"
  | "empty_content"
  | "content_before_section"
  | "subgroup_without_section"
  | "wrong_identity_kind"
  | "partial_identity"
  | "foreign_identity"
  | "duplicate_identity"
  | "changed_criterion_code"

export interface TechnicalConfigurationBaselineWorkbookV2Issue {
  code: TechnicalConfigurationBaselineWorkbookV2IssueCode
  message: string
  row?: number
  column?: string
}

/** Carries all structured validation issues found while parsing a workbook. */
export class TechnicalConfigurationBaselineWorkbookV2Error extends Error {
  readonly issues: TechnicalConfigurationBaselineWorkbookV2Issue[]

  constructor(issues: TechnicalConfigurationBaselineWorkbookV2Issue[]) {
    super(
      issues.map((issue) => `${issue.row ? `Dòng ${issue.row}: ` : ""}${issue.message}`).join("\n")
    )
    this.name = "TechnicalConfigurationBaselineWorkbookV2Error"
    this.issues = issues
  }
}

export interface TechnicalConfigurationBaselineWorkbookV2ExistingHierarchy {
  groups: readonly { id: string }[]
  subgroups: readonly { id: string; group_id: string }[]
  criteria: readonly {
    id: string
    criterion_code: string
    title: string | null
    group_id: string
    subgroup_id: string | null
  }[]
}

export interface ParseTechnicalConfigurationBaselineWorkbookV2Options {
  existingHierarchy: TechnicalConfigurationBaselineWorkbookV2ExistingHierarchy
}

export type TechnicalConfigurationBaselineWorkbookV2ParsedRow =
  | {
      row: number
      row_type: "GROUP"
      group_order: number
      group_id: string | null
      group_name: string
    }
  | {
      row: number
      row_type: "SUBGROUP"
      group_order: number
      subgroup_order: number
      subgroup_id: string | null
      subgroup_name: string
    }
  | {
      row: number
      row_type: "CRITERION"
      group_order: number
      subgroup_order: number | null
      criterion_order: number
      criterion_id: string | null
      criterion_code: string | null
      criterion_title: string | null
      requirement_text: string
    }

export interface TechnicalConfigurationBaselineWorkbookV2ParseResult {
  format: "v2"
  metadata: {
    template_kind: typeof BASELINE_WORKBOOK_V2_TEMPLATE_KIND
    template_version: typeof BASELINE_WORKBOOK_V2_TEMPLATE_VERSION
    dossier_id: string
    baseline_version_id: string
    baseline_revision: number
    generated_at: string
  }
  rows: TechnicalConfigurationBaselineWorkbookV2ParsedRow[]
}

export interface TechnicalConfigurationBaselineWorkbookLegacyParseResult extends TechnicalConfigurationBaselineWorkbookParseResult {
  format: "legacy"
  row_numbers: number[]
}

export type TechnicalConfigurationBaselineWorkbookCompatibleParseResult =
  | TechnicalConfigurationBaselineWorkbookLegacyParseResult
  | TechnicalConfigurationBaselineWorkbookV2ParseResult

/** Throws one aggregate parser error when validation produced any issues. */
export function throwIfTechnicalConfigurationBaselineWorkbookV2Issues(
  issues: TechnicalConfigurationBaselineWorkbookV2Issue[]
): void {
  if (issues.length > 0) {
    throw new TechnicalConfigurationBaselineWorkbookV2Error(issues)
  }
}
