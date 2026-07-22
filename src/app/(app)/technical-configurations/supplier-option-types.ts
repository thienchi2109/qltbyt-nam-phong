export interface TechnicalConfigurationSupplierWire {
  id: string
  dossier_id: string
  name: string
  normalized_name: string
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  revision: number
}

export interface TechnicalConfigurationSuppliersListWireResponse {
  data: TechnicalConfigurationSupplierWire[]
  revision: number
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationSupplierMutationWireResponse {
  data: TechnicalConfigurationSupplierWire
}

export interface TechnicalConfigurationSupplierDeleteWireResponse {
  data: {
    id: string
    revision: number
  }
}

export interface TechnicalConfigurationSuppliersListRpcArgs {
  p_dossier_id: string
  p_page?: number
  p_page_size?: number
}

export interface TechnicalConfigurationSupplierCreateRpcArgs {
  p_dossier_id: string
  p_name: string
  p_expected_revision: number
}

export interface TechnicalConfigurationSupplierUpdateRpcArgs {
  p_supplier_id: string
  p_name: string
  p_expected_revision: number
}

export interface TechnicalConfigurationSupplierDeleteRpcArgs {
  p_supplier_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationOptionWire {
  id: string
  dossier_id: string
  supplier_id: string
  supplier_name: string
  model: string | null
  manufacturer: string | null
  option_name: string | null
  notes: string | null
  display_label: string
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  revision: number
}

export interface TechnicalConfigurationOptionsListWireResponse {
  data: TechnicalConfigurationOptionWire[]
  revision: number
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationOptionMutationWireResponse {
  data: TechnicalConfigurationOptionWire
}

export interface TechnicalConfigurationOptionDeleteWireResponse {
  data: {
    id: string
    revision: number
  }
}

export interface TechnicalConfigurationOptionsListRpcArgs {
  p_dossier_id: string
  p_supplier_id?: string | null
  p_page?: number
  p_page_size?: number
}

export interface TechnicalConfigurationOptionCreateRpcArgs {
  p_supplier_id: string
  p_model: string | null
  p_manufacturer: string | null
  p_option_name: string | null
  p_notes: string | null
  p_expected_revision: number
}

export interface TechnicalConfigurationOptionUpdateRpcArgs {
  p_option_id: string
  p_model: string | null
  p_manufacturer: string | null
  p_option_name: string | null
  p_notes: string | null
  p_expected_revision: number
}

export interface TechnicalConfigurationOptionDeleteRpcArgs {
  p_option_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationOptionResponseWire {
  id: string
  comparison_set_id: string
  baseline_version_id: string
  criterion_id: string
  response_text: string
  supplementary_information: string
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  revision: number
}

export interface TechnicalConfigurationComparisonSetWire {
  id: string
  dossier_id: string
  option_id: string
  baseline_version_id: string
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
  revision: number
  responses: TechnicalConfigurationOptionResponseWire[]
}

export interface TechnicalConfigurationComparisonSetWireResponse {
  data: TechnicalConfigurationComparisonSetWire
}

export interface TechnicalConfigurationOptionResponseWireResponse {
  data: TechnicalConfigurationOptionResponseWire
}

export interface TechnicalConfigurationComparisonSetGetOrCreateRpcArgs {
  p_option_id: string
  p_baseline_version_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationOptionResponseUpsertRpcArgs {
  p_comparison_set_id: string
  p_criterion_id: string
  p_response_text: string | null
  p_supplementary_information: string | null
  p_expected_revision: number
}
