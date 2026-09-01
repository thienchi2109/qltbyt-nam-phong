export type DeviceQuotaDraftItem = {
  id: string
  regulatory_item_id: string
  display_name_override: string | null
  applied_unit: string | null
  applied_quantity: number | null
  notes: string | null
  is_excluded: boolean
  display_order: number
  source_identifier: string
  source_label: string
  regulatory_name: string
  regulatory_unit: string
  regulatory_quota_lines: string[]
  regulatory_rules: Array<{
    line_order: number
    source_text: string
  }>
}

export type DeviceQuotaDraft = {
  id: string
  don_vi: number
  catalog_version_id: string
  status: "draft"
  revision: number
  created_by: number
  updated_by: number
  created_at: string
  updated_at: string
  items: DeviceQuotaDraftItem[]
}

export type DeviceQuotaDraftSaveItem = {
  regulatory_item_id: string
  display_name_override: string | null
  applied_unit: string | null
  applied_quantity: number | null
  notes: string | null
  is_excluded: boolean
  display_order: number
}

export type DeviceQuotaDraftRpc =
  | {
      fn: "device_quota_unit_catalog_draft_create_or_open"
      args: Record<string, never>
    }
  | {
      fn: "device_quota_unit_catalog_draft_get"
      args: { p_draft_id?: string | null }
    }
  | {
      fn: "device_quota_unit_catalog_draft_save"
      args: {
        p_draft_id: string
        p_expected_revision: number
        p_items: DeviceQuotaDraftSaveItem[]
      }
    }
  | {
      fn: "device_quota_unit_catalog_draft_exclude" | "device_quota_unit_catalog_draft_restore"
      args: {
        p_draft_id: string
        p_regulatory_item_id: string
        p_expected_revision: number
      }
    }
