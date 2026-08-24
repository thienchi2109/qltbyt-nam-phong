import { describe, expect, it } from "vitest"

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"
import { TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-rpcs"

const EXPECTED_TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES = [
  "technical_configuration_dossiers_list",
  "technical_configuration_dossiers_get",
  "technical_configuration_dossiers_create",
  "technical_configuration_dossiers_update",
  "technical_configuration_dossiers_archive",
  "technical_configuration_dossiers_delete",
  "technical_configuration_baseline_draft_create",
  "technical_configuration_baseline_draft_get",
  "technical_configuration_baseline_versions_list",
  "technical_configuration_baseline_lock",
  "technical_configuration_baseline_copy",
  "technical_configuration_baseline_cross_dossier_sources_list",
  "technical_configuration_baseline_cross_dossier_copy_preview",
  "technical_configuration_baseline_cross_dossier_copy_apply",
  "technical_configuration_baseline_group_create",
  "technical_configuration_baseline_group_update",
  "technical_configuration_baseline_group_delete",
  "technical_configuration_baseline_groups_reorder",
  "technical_configuration_baseline_criterion_create",
  "technical_configuration_baseline_criterion_update",
  "technical_configuration_baseline_criterion_delete",
  "technical_configuration_baseline_criteria_reorder",
  "technical_configuration_baseline_bulk_preview",
  "technical_configuration_baseline_import_preview",
  "technical_configuration_baseline_import_preview_v2",
  "technical_configuration_baseline_import_apply",
  "technical_configuration_baseline_import_apply_v2",
  "technical_configuration_baseline_subgroup_create",
  "technical_configuration_baseline_subgroup_update",
  "technical_configuration_baseline_subgroup_delete",
  "technical_configuration_baseline_subgroups_reorder",
  "technical_configuration_baseline_hierarchy_criterion_create",
  "technical_configuration_baseline_hierarchy_criterion_move",
  "technical_configuration_baseline_hierarchy_criteria_reorder",
  "technical_configuration_reference_products_list",
  "technical_configuration_reference_product_create",
  "technical_configuration_reference_product_update",
  "technical_configuration_reference_product_delete",
  "technical_configuration_reference_response_upsert",
  "technical_configuration_baseline_documents_list",
  "technical_configuration_baseline_document_create",
  "technical_configuration_baseline_document_update",
  "technical_configuration_baseline_document_delete",
  "technical_configuration_baseline_citation_upsert",
  "technical_configuration_baseline_citation_delete",
  "technical_configuration_reference_document_create",
  "technical_configuration_reference_document_update",
  "technical_configuration_reference_document_delete",
  "technical_configuration_reference_citation_upsert",
  "technical_configuration_reference_citation_delete",
  "technical_configuration_option_documents_list",
  "technical_configuration_option_document_create",
  "technical_configuration_option_document_update",
  "technical_configuration_option_document_delete",
  "technical_configuration_option_citation_upsert",
  "technical_configuration_option_citation_delete",
  "technical_configuration_suppliers_list",
  "technical_configuration_supplier_create",
  "technical_configuration_supplier_update",
  "technical_configuration_supplier_delete",
  "technical_configuration_options_list",
  "technical_configuration_option_create",
  "technical_configuration_option_update",
  "technical_configuration_option_delete",
  "technical_configuration_comparison_set_get_or_create",
  "technical_configuration_option_response_upsert",
  "technical_configuration_comparison_set_get",
  "technical_configuration_option_import_preview",
  "technical_configuration_option_import_apply",
  "technical_configuration_comparison_get",
  "technical_configuration_assessments_list",
  "technical_configuration_evaluation_criteria_list",
  "technical_configuration_assessment_upsert",
  "technical_configuration_reference_ranking_list",
  "technical_configuration_result_export_manifest_get",
  "technical_configuration_result_export_ranking_list",
  "technical_configuration_result_export_matrix_list",
  "technical_configuration_result_export_option_axis_list",
  "technical_configuration_result_export_criterion_axis_list",
] as const

describe("technical configuration RPC manifest", () => {
  it("composes the exact ordered set of 79 client-callable module RPCs", () => {
    expect(TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES).toEqual(
      EXPECTED_TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES
    )
    expect(new Set(TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES).size).toBe(79)
  })

  it("keeps the generic transport allowlist at exact module parity", () => {
    expect(
      [...ALLOWED_FUNCTIONS].filter((fn) => fn.startsWith("technical_configuration_"))
    ).toEqual(EXPECTED_TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES)
  })
})
