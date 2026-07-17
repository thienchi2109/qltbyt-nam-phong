export interface TechnicalConfigurationReferenceResponseWire {
  id: string
  baseline_version_id: string
  reference_product_id: string
  criterion_id: string
  response_text: string
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  revision: number
}

export interface TechnicalConfigurationReferenceProductWire {
  id: string
  baseline_version_id: string
  model: string | null
  manufacturer: string | null
  description: string | null
  notes: string | null
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  revision: number
  responses: TechnicalConfigurationReferenceResponseWire[]
}

export interface TechnicalConfigurationReferenceProductsListWireResponse {
  data: TechnicalConfigurationReferenceProductWire[]
  revision: number
  total: number
  page: number
  page_size: number
}

export type TechnicalConfigurationReferenceProductsSnapshot = {
  products: TechnicalConfigurationReferenceProductWire[]
  revision: number
}

export interface TechnicalConfigurationReferenceProductMutationWireResponse {
  data: TechnicalConfigurationReferenceProductWire
}

export interface TechnicalConfigurationReferenceResponseMutationWireResponse {
  data: TechnicalConfigurationReferenceResponseWire
}

export interface TechnicalConfigurationReferenceProductDeleteWireResponse {
  data: {
    id: string
    revision: number
  }
}

export interface TechnicalConfigurationReferenceProductsListRpcArgs {
  p_baseline_version_id: string
  p_page?: number
  p_page_size?: number
}

export interface TechnicalConfigurationReferenceProductCreateRpcArgs {
  p_baseline_version_id: string
  p_model: string | null
  p_manufacturer: string | null
  p_description: string | null
  p_notes: string | null
  p_expected_revision: number
}

export interface TechnicalConfigurationReferenceProductUpdateRpcArgs {
  p_reference_product_id: string
  p_model: string | null
  p_manufacturer: string | null
  p_description: string | null
  p_notes: string | null
  p_expected_revision: number
}

export interface TechnicalConfigurationReferenceProductDeleteRpcArgs {
  p_reference_product_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationReferenceResponseUpsertRpcArgs {
  p_reference_product_id: string
  p_criterion_id: string
  p_response_text: string
  p_expected_revision: number
}
