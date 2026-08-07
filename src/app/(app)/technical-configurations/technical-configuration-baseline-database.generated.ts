// Focused excerpt generated from the live Supabase schema through MCP on 2026-08-07.
export interface TechnicalConfigurationBaselineGeneratedTables {
  technical_configuration_baseline_criteria: {
    Row: {
      id: string
      baseline_version_id: string
      group_id: string
      criterion_code: string
      title: string | null
      requirement_text: string
      sort_order: number
      source_criterion_id: string | null
      created_at: string
      created_by: number
      updated_at: string
      updated_by: number
      subgroup_id: string | null
    }
    Insert: {
      id?: string
      baseline_version_id: string
      group_id: string
      criterion_code: string
      title?: string | null
      requirement_text: string
      sort_order: number
      source_criterion_id?: string | null
      created_at?: string
      created_by: number
      updated_at?: string
      updated_by: number
      subgroup_id?: string | null
    }
    Update: {
      id?: string
      baseline_version_id?: string
      group_id?: string
      criterion_code?: string
      title?: string | null
      requirement_text?: string
      sort_order?: number
      source_criterion_id?: string | null
      created_at?: string
      created_by?: number
      updated_at?: string
      updated_by?: number
      subgroup_id?: string | null
    }
    Relationships: [
      {
        foreignKeyName: "tc_baseline_criteria_subgroup_scope_fkey"
        columns: ["subgroup_id", "group_id", "baseline_version_id"]
        isOneToOne: false
        referencedRelation: "technical_configuration_baseline_subgroups"
        referencedColumns: ["id", "group_id", "baseline_version_id"]
      },
      {
        foreignKeyName: "technical_configuration_basel_group_id_baseline_version_id_fkey"
        columns: ["group_id", "baseline_version_id"]
        isOneToOne: false
        referencedRelation: "technical_configuration_baseline_groups"
        referencedColumns: ["id", "baseline_version_id"]
      },
      {
        foreignKeyName: "technical_configuration_baseline_crite_baseline_version_id_fkey"
        columns: ["baseline_version_id"]
        isOneToOne: false
        referencedRelation: "technical_configuration_baseline_versions"
        referencedColumns: ["id"]
      },
      {
        foreignKeyName: "technical_configuration_baseline_crite_source_criterion_id_fkey"
        columns: ["source_criterion_id"]
        isOneToOne: false
        referencedRelation: "technical_configuration_baseline_criteria"
        referencedColumns: ["id"]
      },
    ]
  }
  technical_configuration_baseline_groups: {
    Row: {
      id: string
      baseline_version_id: string
      name: string
      sort_order: number
      created_at: string
      created_by: number
      updated_at: string
      updated_by: number
    }
    Insert: {
      id?: string
      baseline_version_id: string
      name: string
      sort_order: number
      created_at?: string
      created_by: number
      updated_at?: string
      updated_by: number
    }
    Update: {
      id?: string
      baseline_version_id?: string
      name?: string
      sort_order?: number
      created_at?: string
      created_by?: number
      updated_at?: string
      updated_by?: number
    }
    Relationships: [
      {
        foreignKeyName: "technical_configuration_baseline_group_baseline_version_id_fkey"
        columns: ["baseline_version_id"]
        isOneToOne: false
        referencedRelation: "technical_configuration_baseline_versions"
        referencedColumns: ["id"]
      },
    ]
  }
  technical_configuration_baseline_subgroups: {
    Row: {
      id: string
      baseline_version_id: string
      group_id: string
      name: string
      sort_order: number
      created_at: string
      created_by: number
      updated_at: string
      updated_by: number
    }
    Insert: {
      id?: string
      baseline_version_id: string
      group_id: string
      name: string
      sort_order: number
      created_at?: string
      created_by: number
      updated_at?: string
      updated_by: number
    }
    Update: {
      id?: string
      baseline_version_id?: string
      group_id?: string
      name?: string
      sort_order?: number
      created_at?: string
      created_by?: number
      updated_at?: string
      updated_by?: number
    }
    Relationships: [
      {
        foreignKeyName: "tc_baseline_subgroups_group_scope_fkey"
        columns: ["group_id", "baseline_version_id"]
        isOneToOne: false
        referencedRelation: "technical_configuration_baseline_groups"
        referencedColumns: ["id", "baseline_version_id"]
      },
    ]
  }
}
