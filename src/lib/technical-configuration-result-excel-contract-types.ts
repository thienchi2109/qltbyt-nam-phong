import type {
  TechnicalConfigurationDerivedStatus,
  TechnicalConfigurationEvidenceAxis,
  TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"

export type TechnicalConfigurationResultWorkbookContentMode =
  "full" | "ranking_only" | "detailed_matrix_only"

export type TechnicalConfigurationResultWorkbookScope = "all" | "selected"

export interface TechnicalConfigurationResultWorkbookManifestSource {
  readonly dossier: {
    readonly id: string
    readonly device_type_name: string
    readonly name: string
  }
  readonly baseline_version: {
    readonly id: string
    readonly version_number: number
    readonly locked_at: string | null
  }
  readonly option_total: number
  readonly criterion_total: number
  readonly snapshot_token: string
  readonly ranking_snapshot_token: string
}

export interface TechnicalConfigurationResultWorkbookRankingSourceRow {
  readonly option_id: string
  readonly supplier_id: string
  readonly supplier_name: string
  readonly display_label: string
  readonly eligibility: "eligible" | "incomplete"
  readonly incomplete_criterion_count: number
  readonly failed_count: number
  readonly insufficient_evidence_count: number
  readonly exceeds_count: number
  readonly rank: number | null
}

export interface TechnicalConfigurationResultWorkbookDocumentLink {
  readonly document_id: string
  readonly document_name: string
  readonly document_url: string
  readonly citation_id: string
  readonly page_section: string | null
  readonly excerpt: string | null
}

/** Ordered supplier-option descriptor from the stable P14A4 export dataset. */
export interface TechnicalConfigurationResultWorkbookOptionSource {
  readonly option_id: string
  readonly supplier_id: string
  readonly supplier_name: string
  readonly display_label: string
  readonly model: string | null
  readonly manufacturer: string | null
  readonly option_name: string | null
}

/** Ordered criterion descriptor from the stable P14A4 export dataset. */
export interface TechnicalConfigurationResultWorkbookCriterionSource {
  readonly group_id: string
  readonly group_name: string
  readonly group_order: number
  readonly criterion_id: string
  readonly criterion_code: string
  readonly criterion_title: string | null
  readonly requirement_text: string
  readonly criterion_order: number
}

export interface TechnicalConfigurationResultWorkbookMatrixSourceCell
  extends
    TechnicalConfigurationResultWorkbookCriterionSource,
    TechnicalConfigurationResultWorkbookOptionSource {
  readonly response_text: string | null
  readonly supplementary_information: string | null
  readonly document_links: readonly TechnicalConfigurationResultWorkbookDocumentLink[]
  readonly technical_axis: TechnicalConfigurationTechnicalAxis | null
  readonly evidence_axis: TechnicalConfigurationEvidenceAxis | null
  readonly assessment_notes: string | null
  readonly conclusion: TechnicalConfigurationDerivedStatus
}

interface TechnicalConfigurationResultWorkbookBuildContext {
  readonly manifest: TechnicalConfigurationResultWorkbookManifestSource
  readonly optionAxis: readonly TechnicalConfigurationResultWorkbookOptionSource[]
  readonly criterionAxis: readonly TechnicalConfigurationResultWorkbookCriterionSource[]
  readonly option_ids: readonly string[] | null
  readonly criterion_ids: readonly string[] | null
  readonly generated_at: string
  readonly generated_by: string
}

/** Complete stable dataset plus output metadata needed to build the pure workbook model. */
export type TechnicalConfigurationResultWorkbookBuildInput =
  TechnicalConfigurationResultWorkbookBuildContext &
    (
      | {
          readonly mode: "full"
          readonly ranking: readonly TechnicalConfigurationResultWorkbookRankingSourceRow[]
          readonly matrix: readonly TechnicalConfigurationResultWorkbookMatrixSourceCell[]
        }
      | {
          readonly mode: "ranking_only"
          readonly ranking: readonly TechnicalConfigurationResultWorkbookRankingSourceRow[]
          readonly matrix: null
        }
      | {
          readonly mode: "detailed_matrix_only"
          readonly ranking: null
          readonly matrix: readonly TechnicalConfigurationResultWorkbookMatrixSourceCell[]
        }
    )
