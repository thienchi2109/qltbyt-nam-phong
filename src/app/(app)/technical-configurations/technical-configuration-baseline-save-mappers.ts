import type {
  TechnicalConfigurationBaselineCriterionMutationWire,
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineGroupMutationWire,
  TechnicalConfigurationBaselineGroupWire,
} from "./baseline-types"

/** Maps a group mutation response into the persisted draft group shape. */
export function toTechnicalConfigurationBaselineWireGroup(
  group: TechnicalConfigurationBaselineGroupMutationWire
): TechnicalConfigurationBaselineGroupWire {
  return {
    id: group.id,
    baseline_version_id: group.baseline_version_id,
    name: group.name,
    sort_order: group.sort_order,
    created_at: group.created_at,
    created_by: group.created_by,
    updated_at: group.updated_at,
    updated_by: group.updated_by,
    criteria: [],
  }
}

/** Removes mutation-only revision metadata from a persisted criterion. */
export function toTechnicalConfigurationBaselineWireCriterion(
  criterion: TechnicalConfigurationBaselineCriterionMutationWire
): TechnicalConfigurationBaselineCriterionWire {
  const { revision: _revision, ...wireCriterion } = criterion
  return wireCriterion
}
