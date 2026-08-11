/** Dormant P1E mutation names. Do not add these to the production proxy allowlist before P6A. */
export const TECHNICAL_CONFIGURATION_BASELINE_HIERARCHY_AUTHORING_RPCS = {
  createSubgroup: "technical_configuration_baseline_subgroup_create",
  updateSubgroup: "technical_configuration_baseline_subgroup_update",
  deleteSubgroup: "technical_configuration_baseline_subgroup_delete",
  reorderSubgroups: "technical_configuration_baseline_subgroups_reorder",
  createCriterion: "technical_configuration_baseline_hierarchy_criterion_create",
  moveCriterion: "technical_configuration_baseline_hierarchy_criterion_move",
  reorderCriteria: "technical_configuration_baseline_hierarchy_criteria_reorder",
} as const
