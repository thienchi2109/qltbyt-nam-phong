export interface TechnicalConfigurationCitationWire {
  id: string
  criterion_id: string
  page_section: string | null
  excerpt: string | null
}

export interface TechnicalConfigurationDocumentWire {
  id: string
  owner_type: "baseline" | "reference_product"
  owner_id: string
  name: string
  url: string
  created_by: number
  created_at: string
  updated_at: string
  citations: TechnicalConfigurationCitationWire[]
}

export interface TechnicalConfigurationDocumentsListWireResponse {
  data: TechnicalConfigurationDocumentWire[]
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationDocumentMutationWireResponse {
  data: TechnicalConfigurationDocumentWire & {
    revision: number
  }
}

export interface TechnicalConfigurationDocumentDeleteWireResponse {
  data: {
    id: string
    revision: number
    affected_link_count: number
  }
}

export interface TechnicalConfigurationCitationMutationWireResponse {
  data: TechnicalConfigurationCitationWire & {
    revision: number
  }
}

export interface TechnicalConfigurationCitationDeleteWireResponse {
  data: {
    id: string
    revision: number
  }
}

export interface TechnicalConfigurationBaselineDocumentsListRpcArgs {
  p_baseline_version_id: string
  p_page?: number
  p_page_size?: number
}

export interface TechnicalConfigurationBaselineDocumentCreateRpcArgs {
  p_baseline_version_id: string
  p_name: string
  p_url: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineDocumentUpdateRpcArgs {
  p_baseline_document_id: string
  p_name: string
  p_url: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineDocumentDeleteRpcArgs {
  p_baseline_document_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineCitationUpsertRpcArgs {
  p_baseline_document_id: string
  p_criterion_id: string
  p_page_section: string | null
  p_excerpt: string | null
  p_expected_revision: number
}

export interface TechnicalConfigurationBaselineCitationDeleteRpcArgs {
  p_baseline_citation_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationReferenceDocumentCreateRpcArgs {
  p_reference_product_id: string
  p_name: string
  p_url: string
  p_expected_revision: number
}

export interface TechnicalConfigurationReferenceDocumentUpdateRpcArgs {
  p_reference_document_id: string
  p_name: string
  p_url: string
  p_expected_revision: number
}

export interface TechnicalConfigurationReferenceDocumentDeleteRpcArgs {
  p_reference_document_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationReferenceCitationUpsertRpcArgs {
  p_reference_document_id: string
  p_criterion_id: string
  p_page_section: string | null
  p_excerpt: string | null
  p_expected_revision: number
}

export interface TechnicalConfigurationReferenceCitationDeleteRpcArgs {
  p_reference_citation_id: string
  p_expected_revision: number
}
