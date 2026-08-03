import type {
  TechnicalConfigurationDerivedStatus,
  TechnicalConfigurationEvidenceAxis,
  TechnicalConfigurationTechnicalAxis,
} from "@/lib/technical-configuration-evaluation"

import type { TechnicalConfigurationBaselineStatus } from "./baseline-types"
import type { TechnicalConfigurationReferenceRankingEligibility } from "./reference-ranking-types"

export type TechnicalConfigurationResultExportScopeRpcArgs = {
  p_dossier_id: string
  p_baseline_version_id: string
  p_option_ids: readonly string[] | null
  p_criterion_ids: readonly string[] | null
}

export type TechnicalConfigurationResultExportPageRpcArgs =
  TechnicalConfigurationResultExportScopeRpcArgs & {
    p_page: number
    p_page_size: number
  }

export type TechnicalConfigurationResultExportManifestWire = {
  readonly dossier: {
    readonly id: string
    readonly device_type_name: string
    readonly name: string
    readonly revision: number
    readonly archived_at: string | null
  }
  readonly baseline_version: {
    readonly id: string
    readonly dossier_id: string
    readonly version_number: number
    readonly status: TechnicalConfigurationBaselineStatus
    readonly revision: number
    readonly locked_at: string | null
  }
  readonly option_total: number
  readonly criterion_total: number
  readonly snapshot_token: string
  readonly ranking_snapshot_token: string
}

export type TechnicalConfigurationResultExportManifestWireResponse = {
  readonly data: TechnicalConfigurationResultExportManifestWire
}

export type TechnicalConfigurationResultExportOptionAxisItemWire = {
  readonly option_id: string
  readonly supplier_id: string
  readonly supplier_name: string
  readonly display_label: string
  readonly model: string | null
  readonly manufacturer: string | null
  readonly option_name: string | null
}

export type TechnicalConfigurationResultExportCriterionAxisItemWire = {
  readonly group_id: string
  readonly group_name: string
  readonly group_order: number
  readonly criterion_id: string
  readonly criterion_code: string
  readonly criterion_title: string | null
  readonly requirement_text: string
  readonly criterion_order: number
}

export type TechnicalConfigurationResultExportPageWireResponse<TItem> = {
  readonly data: TItem[]
  readonly dossier_id: string
  readonly baseline_version_id: string
  readonly snapshot_token: string
  readonly ranking_snapshot_token: string
  readonly total: number
  readonly page: number
  readonly page_size: number
}

export type TechnicalConfigurationResultExportOptionAxisPageWireResponse =
  TechnicalConfigurationResultExportPageWireResponse<TechnicalConfigurationResultExportOptionAxisItemWire>

export type TechnicalConfigurationResultExportCriterionAxisPageWireResponse =
  TechnicalConfigurationResultExportPageWireResponse<TechnicalConfigurationResultExportCriterionAxisItemWire>

export type TechnicalConfigurationResultExportRankingItemWire = {
  readonly option_id: string
  readonly supplier_id: string
  readonly supplier_name: string
  readonly display_label: string
  readonly eligibility: TechnicalConfigurationReferenceRankingEligibility
  readonly incomplete_criterion_count: number
  readonly failed_count: number
  readonly insufficient_evidence_count: number
  readonly exceeds_count: number
  readonly rank: number | null
}

export type TechnicalConfigurationResultExportRankingPageWireResponse =
  TechnicalConfigurationResultExportPageWireResponse<TechnicalConfigurationResultExportRankingItemWire>

export type TechnicalConfigurationResultExportDocumentLinkWire = {
  readonly document_id: string
  readonly document_name: string
  readonly document_url: string
  readonly citation_id: string
  readonly page_section: string | null
  readonly excerpt: string | null
}

export type TechnicalConfigurationResultExportMatrixCellWire = {
  readonly group_id: string
  readonly group_name: string
  readonly group_order: number
  readonly criterion_id: string
  readonly criterion_code: string
  readonly criterion_title: string | null
  readonly requirement_text: string
  readonly criterion_order: number
  readonly option_id: string
  readonly supplier_id: string
  readonly supplier_name: string
  readonly display_label: string
  readonly model: string | null
  readonly manufacturer: string | null
  readonly option_name: string | null
  readonly response_text: string | null
  readonly supplementary_information: string | null
  readonly document_links: readonly TechnicalConfigurationResultExportDocumentLinkWire[]
  readonly technical_axis: TechnicalConfigurationTechnicalAxis | null
  readonly evidence_axis: TechnicalConfigurationEvidenceAxis | null
  readonly assessment_notes: string | null
  readonly conclusion: TechnicalConfigurationDerivedStatus
}

export type TechnicalConfigurationResultExportMatrixPageWireResponse =
  TechnicalConfigurationResultExportPageWireResponse<TechnicalConfigurationResultExportMatrixCellWire>

export type TechnicalConfigurationResultExportMode =
  "full" | "ranking_only" | "detailed_matrix_only"

export type TechnicalConfigurationResultExportRequest = {
  readonly mode: TechnicalConfigurationResultExportMode
  readonly dossierId: string
  readonly baselineVersionId: string
  readonly optionIds: readonly string[] | null
  readonly criterionIds: readonly string[] | null
  readonly signal?: AbortSignal
}

type ResultExportDatasetBase = {
  readonly manifest: TechnicalConfigurationResultExportManifestWire
  readonly optionAxis: readonly TechnicalConfigurationResultExportOptionAxisItemWire[]
  readonly criterionAxis: readonly TechnicalConfigurationResultExportCriterionAxisItemWire[]
}

export type TechnicalConfigurationResultExportDataset =
  | (ResultExportDatasetBase & {
      readonly mode: "full"
      readonly ranking: readonly TechnicalConfigurationResultExportRankingItemWire[]
      readonly matrix: readonly TechnicalConfigurationResultExportMatrixCellWire[]
    })
  | (ResultExportDatasetBase & {
      readonly mode: "ranking_only"
      readonly ranking: readonly TechnicalConfigurationResultExportRankingItemWire[]
      readonly matrix: null
    })
  | (ResultExportDatasetBase & {
      readonly mode: "detailed_matrix_only"
      readonly ranking: null
      readonly matrix: readonly TechnicalConfigurationResultExportMatrixCellWire[]
    })
