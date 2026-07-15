/** Named baseline RPC functions shared by client and server code. */
export const BASELINE_RPC_FUNCTIONS = {
  createDraft: "technical_configuration_baseline_draft_create",
  getDraft: "technical_configuration_baseline_draft_get",
  listVersions: "technical_configuration_baseline_versions_list",
  lockVersion: "technical_configuration_baseline_lock",
  copyVersion: "technical_configuration_baseline_copy",
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
  applyImport: "technical_configuration_baseline_import_apply",
} as const

/** Ordered baseline RPC names for allowlists and contract iteration. */
export const BASELINE_RPC_FUNCTION_NAMES = Object.values(BASELINE_RPC_FUNCTIONS)
