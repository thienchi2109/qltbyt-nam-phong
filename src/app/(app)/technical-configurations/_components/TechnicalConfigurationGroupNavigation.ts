/** Sentinel value for the read-only all-groups overview tab. */
export const ALL_GROUPS_VALUE = "__all-groups__"

/** Shared panel ID referenced by the group navigation tabs. */
export const GROUP_WORKSPACE_PANEL_ID = "technical-configuration-group-workspace"

/** Builds the stable DOM ID for a group navigation tab. */
export function getTechnicalConfigurationGroupTabId(value: string) {
  return `technical-configuration-group-tab-${value}`
}
