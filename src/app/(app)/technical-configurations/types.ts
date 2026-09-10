export interface TechnicalConfigurationDossierWire {
  id: string
  device_type_name: string
  name: string
  description: string | null
  specialty: string | null
  revision: number
  archived_at: string | null
  archived_by: number | null
  created_at: string
  created_by: number
  updated_at: string
  updated_by: number
}

export interface TechnicalConfigurationDossierListItemWire extends TechnicalConfigurationDossierWire {
  can_delete: boolean
}

export interface TechnicalConfigurationDossierListWireResponse {
  data: TechnicalConfigurationDossierListItemWire[]
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
  p_search?: string | null
  p_specialty?: string | null
  p_filter_specialty?: boolean
}

export interface TechnicalConfigurationDossierGetRpcArgs {
  p_id: string
}

export interface TechnicalConfigurationDossierCreateRpcArgs {
  p_device_type_name: string
  p_name: string
  p_description: string | null
  p_expected_revision: 0
  p_specialty: string | null
}

export interface TechnicalConfigurationDossierUpdateRpcArgs {
  p_id: string
  p_device_type_name: string
  p_name: string
  p_description: string | null
  p_expected_revision: number
  p_specialty: string | null
}

export interface TechnicalConfigurationDossierSpecialtiesRpcArgs {
  p_page?: number
  p_page_size?: number
  p_search?: string | null
}

export interface TechnicalConfigurationDossierSpecialtiesWireResponse {
  data: string[]
  total: number
  page: number
  page_size: number
}

export interface TechnicalConfigurationDossierDeleteRpcArgs {
  p_id: string
  p_expected_revision: number
}

export interface TechnicalConfigurationDossierDeleteWireResponse {
  data: {
    id: string
  }
}

export interface TechnicalConfigurationDossierArchiveRpcArgs {
  p_id: string
  p_expected_revision: number
}
