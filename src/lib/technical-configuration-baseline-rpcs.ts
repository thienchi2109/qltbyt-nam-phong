/** Named baseline RPC functions shared by client and server code. */
export const BASELINE_RPC_FUNCTIONS = {
  createDraft: "technical_configuration_baseline_draft_create",
  getDraft: "technical_configuration_baseline_draft_get",
  listVersions: "technical_configuration_baseline_versions_list",
  lockVersion: "technical_configuration_baseline_lock",
  copyVersion: "technical_configuration_baseline_copy",
  listCrossDossierSources: "technical_configuration_baseline_cross_dossier_sources_list",
  previewCrossDossierCopy: "technical_configuration_baseline_cross_dossier_copy_preview",
  applyCrossDossierCopy: "technical_configuration_baseline_cross_dossier_copy_apply",
  createGroup: "technical_configuration_baseline_group_create",
  updateGroup: "technical_configuration_baseline_group_update",
  deleteGroup: "technical_configuration_baseline_group_delete",
  reorderGroups: "technical_configuration_baseline_groups_reorder",
  createCriterion: "technical_configuration_baseline_criterion_create",
  updateCriterion: "technical_configuration_baseline_criterion_update",
  deleteCriterion: "technical_configuration_baseline_criterion_delete",
  reorderCriteria: "technical_configuration_baseline_criteria_reorder",
  previewBulk: "technical_configuration_baseline_bulk_preview",
  previewImport: "technical_configuration_baseline_import_preview",
  previewHierarchyImport: "technical_configuration_baseline_import_preview_v2",
  applyImport: "technical_configuration_baseline_import_apply",
  applyHierarchyImport: "technical_configuration_baseline_import_apply_v2",
} as const

/** Ordered baseline RPC names for allowlists and contract iteration. */
export const BASELINE_RPC_FUNCTION_NAMES = Object.values(BASELINE_RPC_FUNCTIONS)

/** Hierarchy authoring RPCs activated on the server in P6A. */
export const TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS = {
  createSubgroup: "technical_configuration_baseline_subgroup_create",
  updateSubgroup: "technical_configuration_baseline_subgroup_update",
  deleteSubgroup: "technical_configuration_baseline_subgroup_delete",
  reorderSubgroups: "technical_configuration_baseline_subgroups_reorder",
  createCriterion: "technical_configuration_baseline_hierarchy_criterion_create",
  moveCriterion: "technical_configuration_baseline_hierarchy_criterion_move",
  reorderCriteria: "technical_configuration_baseline_hierarchy_criteria_reorder",
} as const

/** Ordered hierarchy authoring RPC names for the production proxy allowlist. */
export const TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPC_NAMES = Object.values(
  TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS
)
