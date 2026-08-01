export type TechnicalConfigurationReferenceRankingEligibility = "eligible" | "incomplete"

export interface TechnicalConfigurationReferenceRankingItemWire {
  option_id: string
  supplier_id: string
  supplier_name: string
  display_label: string
  eligibility: TechnicalConfigurationReferenceRankingEligibility
  incomplete_criterion_count: number
  failed_count: number
  insufficient_evidence_count: number
  exceeds_count: number
  rank: number | null
}

export interface TechnicalConfigurationReferenceRankingPageWireResponse {
  data: TechnicalConfigurationReferenceRankingItemWire[]
  dossier_id: string
  baseline_version_id: string
  snapshot_token: string
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationReferenceRankingListRpcArgs {
  p_dossier_id: string
  p_baseline_version_id: string
  p_page: number
  p_page_size: number
}

export interface TechnicalConfigurationReferenceRankingSnapshot {
  data: TechnicalConfigurationReferenceRankingItemWire[]
  dossier_id: string
  baseline_version_id: string
  snapshot_token: string
  total: number
}
