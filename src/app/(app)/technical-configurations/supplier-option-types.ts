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
