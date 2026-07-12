export interface TechnicalConfigurationDossierWire {
  id: string
  device_type_name: string
  name: string
  description: string | null
  revision: number
  archived_at: string | null
  archived_by: number | null
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
}

export interface TechnicalConfigurationDossierListWireResponse {
  data: TechnicalConfigurationDossierWire[]
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationDossierWireResponse {
  data: TechnicalConfigurationDossierWire
}

export interface TechnicalConfigurationDossierListRpcArgs {
  p_page?: number
  p_page_size?: number
  p_include_archived?: boolean
}

export interface TechnicalConfigurationDossierGetRpcArgs {
  p_id: string
}

export interface TechnicalConfigurationDossierCreateRpcArgs {
  p_device_type_name: string
  p_name: string
  p_description: string | null
  p_expected_revision: 0
}

export interface TechnicalConfigurationDossierUpdateRpcArgs {
  p_id: string
  p_device_type_name: string
  p_name: string
  p_description: string | null
  p_expected_revision: number
}

export interface TechnicalConfigurationDossierArchiveRpcArgs {
  p_id: string
  p_expected_revision: number
}
