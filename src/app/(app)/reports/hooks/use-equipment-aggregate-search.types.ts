export type EquipmentAggregateSearchGroupBy = "region" | "facility"

export type EquipmentAggregateSearchGroupType = EquipmentAggregateSearchGroupBy

export type EquipmentAggregateSearchQuotaStatus =
  | "no_active_quota"
  | "unassigned_category"
  | "not_in_unit_quota"
  | "below_minimum"
  | "over_limit"
  | "within_limit"
  | "mixed"

export interface EquipmentAggregateSearchRequest {
  query: string
  groupBy: EquipmentAggregateSearchGroupBy
  regionId?: number | null
  limit?: number
}

export interface EquipmentAggregateSearchRpcArgs extends Record<string, unknown> {
  p_query: string
  p_group_by: EquipmentAggregateSearchGroupBy
  p_region_id: number | null
  p_limit: number
}

export interface EquipmentAggregateSearchRow {
  groupType: EquipmentAggregateSearchGroupType
  groupId: number | null
  groupName: string
  parentRegionId: number | null
  parentRegionName: string | null
  equipmentCount: number
  facilityCount: number | null
  quotaCurrentCount: number | null
  quotaMinCount: number | null
  quotaMaxCount: number | null
  quotaStatus: EquipmentAggregateSearchQuotaStatus | null
  quotaNotes?: string[]
}

export interface EquipmentAggregateSearchSummary {
  totalEquipmentCount: number
  regionCount: number
  facilityCount: number
  query: string
  scopeLabel: string
}

export interface EquipmentAggregateSearchData {
  rows: EquipmentAggregateSearchRow[]
  summary: EquipmentAggregateSearchSummary
}
